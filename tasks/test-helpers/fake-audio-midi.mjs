export class FakeAudioParam {
  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  setValueAtTime(value) {
    this.value = value;
  }

  setTargetAtTime(value) {
    this.value = value;
  }

  linearRampToValueAtTime(value) {
    this.value = value;
  }

  exponentialRampToValueAtTime(value) {
    this.value = value;
  }

  cancelScheduledValues() {}
}

export class FakeAudioNode {
  constructor(paramKeys = []) {
    this.connections = [];
    paramKeys.forEach((key) => {
      this[key] = new FakeAudioParam();
    });
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections = [];
  }
}

export class FakeOscillatorNode extends FakeAudioNode {
  constructor() {
    super(["frequency", "detune"]);
    this.type = "sine";
    this.startedAt = null;
    this.stoppedAt = null;
    this.onended = null;
  }

  start(time) {
    this.startedAt = time;
  }

  stop(time) {
    this.stoppedAt = time;
  }
}

export class FakeBufferSourceNode extends FakeAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.startedAt = null;
    this.stoppedAt = null;
  }

  start(time) {
    this.startedAt = time;
  }

  stop(time) {
    this.stoppedAt = time;
  }
}

export class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = "running";
    this.destination = new FakeAudioNode();
    this.createdOscillators = [];
  }

  createGain() {
    const node = new FakeAudioNode(["gain"]);
    node.gain.value = 1;
    return node;
  }

  createDynamicsCompressor() {
    return new FakeAudioNode(["threshold", "knee", "ratio", "attack", "release"]);
  }

  createDelay() {
    return new FakeAudioNode(["delayTime"]);
  }

  createWaveShaper() {
    const node = new FakeAudioNode();
    node.curve = null;
    node.oversample = "none";
    return node;
  }

  createBiquadFilter() {
    const node = new FakeAudioNode(["frequency", "Q"]);
    node.type = "lowpass";
    return node;
  }

  createConvolver() {
    const node = new FakeAudioNode();
    node.buffer = null;
    return node;
  }

  createStereoPanner() {
    return new FakeAudioNode(["pan"]);
  }

  createBuffer(numberOfChannels, length) {
    return {
      numberOfChannels,
      length,
      getChannelData() {
        return new Float32Array(length);
      },
    };
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.createdOscillators.push(oscillator);
    return oscillator;
  }

  createBufferSource() {
    return new FakeBufferSourceNode();
  }

  close() {
    this.state = "closed";
    return Promise.resolve();
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}

export class FakeMIDIInputPort {
  constructor(id, name = id) {
    this.id = id;
    this.name = name;
    this.manufacturer = "Test";
    this.state = "connected";
    this.connection = "closed";
    this.type = "input";
    this.onmidimessage = null;
  }

  open() {
    this.connection = "open";
    return Promise.resolve(this);
  }

  emit(data, receivedTime = globalThis.performance?.now?.() ?? Date.now()) {
    this.onmidimessage?.({
      data: Uint8Array.from(data),
      receivedTime,
    });
  }
}

export class FakeMIDIOutputPort {
  constructor(id, name = id) {
    this.id = id;
    this.name = name;
    this.manufacturer = "Test";
    this.state = "connected";
    this.connection = "closed";
    this.type = "output";
    this.sentMessages = [];
  }

  open() {
    this.connection = "open";
    return Promise.resolve(this);
  }

  send(data, timestamp) {
    this.sentMessages.push({
      data: Array.from(data),
      timestamp,
    });
  }
}

export class FakeMIDIAccess {
  constructor({ inputs = [], outputs = [] } = {}) {
    this.inputs = new Map(inputs.map((port) => [port.id, port]));
    this.outputs = new Map(outputs.map((port) => [port.id, port]));
    this.onstatechange = null;
  }
}

const broadcastChannelListenersByName = new Map();

export class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!broadcastChannelListenersByName.has(name)) {
      broadcastChannelListenersByName.set(name, new Set());
    }
    broadcastChannelListenersByName.get(name).add(this);
  }

  postMessage(message) {
    const listeners = broadcastChannelListenersByName.get(this.name) || new Set();
    listeners.forEach((listener) => {
      if (listener === this) {
        return;
      }

      listener.onmessage?.({ data: message });
    });
  }

  close() {
    const listeners = broadcastChannelListenersByName.get(this.name);
    listeners?.delete(this);
    this.onmessage = null;
  }
}

export function resetFakeBroadcastChannels() {
  broadcastChannelListenersByName.clear();
}

export function installFakeAudioAndMidiEnvironment({
  withInput = true,
  withOutput = true,
} = {}) {
  const fakeInput = withInput ? new FakeMIDIInputPort("input-1", "Input 1") : null;
  const fakeOutput = withOutput ? new FakeMIDIOutputPort("output-1", "Output 1") : null;
  const midiAccess = new FakeMIDIAccess({
    inputs: fakeInput ? [fakeInput] : [],
    outputs: fakeOutput ? [fakeOutput] : [],
  });

  const previousWindow = globalThis.window;
  const previousNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const previousBroadcastChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel");

  resetFakeBroadcastChannels();

  globalThis.window = {
    ...(previousWindow || {}),
    AudioContext: FakeAudioContext,
  };

  Object.defineProperty(globalThis, "BroadcastChannel", {
    configurable: true,
    value: FakeBroadcastChannel,
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      requestMIDIAccess: async () => midiAccess,
    },
  });

  return {
    fakeInput,
    fakeOutput,
    midiAccess,
    restore() {
      globalThis.window = previousWindow;
      if (previousBroadcastChannelDescriptor) {
        Object.defineProperty(globalThis, "BroadcastChannel", previousBroadcastChannelDescriptor);
      } else {
        delete globalThis.BroadcastChannel;
      }
      if (previousNavigatorDescriptor) {
        Object.defineProperty(globalThis, "navigator", previousNavigatorDescriptor);
      } else {
        delete globalThis.navigator;
      }
      resetFakeBroadcastChannels();
    },
  };
}

export async function flushMicrotasks() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function resetSharedAppState(
  state,
  {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    INITIAL_SYNTH_PARAMS,
    MIXER_CHANNEL_IDS,
  },
) {
  state.synthParams = { ...INITIAL_SYNTH_PARAMS };
  state.audioContext = undefined;
  state.transportState = "stopped";
  state.schedulerId = null;
  state.schedulerChannel = null;
  state.nextNoteTime = 0;
  state.stepIndex = 0;
  state.masterGain = null;
  state.compressor = null;
  state.delayNode = null;
  state.delayFeedback = null;
  state.delayDrive = null;
  state.delayHighpass = null;
  state.delayReturnGain = null;
  state.delayTone = null;
  state.cleanDelayNode = null;
  state.cleanDelayFeedback = null;
  state.cleanDelayReturnGain = null;
  state.reverbConvolver = null;
  state.reverbInput = null;
  state.reverbWetGain = null;
  state.reverbDryGain = null;
  state.distortionFeedbackBusByPresetId = {};
  state.activeChannelLevelGainsByPresetId = {};
  state.activePresetIds = MIXER_CHANNEL_IDS.slice();
  state.channelAssignedPresetIdById = Object.fromEntries(
    MIXER_CHANNEL_IDS.map((presetId) => [presetId, presetId]),
  );
  state.instrumentParamsByPresetId = {};
  state.instrumentArpeggioPitchClassesByPresetId = {};
  state.instrumentArpeggioOctavesByPresetId = {};
  state.instrumentNoteIdsByPresetId = {};
  state.instrumentNoteLengthInitializedByPresetId = {};
  state.instrumentPatternsByPresetId = {};
  state.instrumentPatternNoteIdsByPresetId = {};
  state.globalArpeggioKeyIndex = DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX;
  state.startupRandomizationApplied = true;
  state.currentStateSeed = "";
  state.arpeggioHistorySnapshots = [];
  state.arpeggioHistoryIndex = 0;
  state.activeInstrumentPresetId = DEFAULT_PRESET_ID;
  state.playingPresetIds = new Set();
  state.midi = {
    supported: false,
    accessGranted: false,
    crossTabSyncSupported: false,
    crossTabSyncActive: false,
    tabId: "",
    inputPortId: "",
    outputPortId: "",
    availableInputs: [],
    availableOutputs: [],
    clockMode: "off",
    clockMasterRunning: false,
    awaitingExternalClockStart: false,
    remoteNoteOutputActive: false,
    externalClockPulseCount: 0,
    externalClockTempoBpm: 0,
    lastExternalClockTimestampMs: 0,
    channelSettingsByPresetId: Object.fromEntries(
      Object.entries(DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID).map(([presetId, value]) => [presetId, { ...value }]),
    ),
  };
}

