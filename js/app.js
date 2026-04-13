const REVERB_SECONDS = 2;
const REVERB_DECAY = 2.4;
const HUMANIZE = {
  detuneCents: 0.8,
  gainAmount: 0.1,
  attackSeconds: 0.008,
  decaySeconds: 0.03,
  cutoffAmount: 0.12,
  panAmount: 0.22,
  fxSendAmount: 0.12,
};
const MAX_SIMULTANEOUS_PRESETS = 12;
const DEFAULT_NOTE_IDS = ["note-c4", "note-e4", "note-g4"];
const NOTE_OPTIONS = [
  { id: "note-c4", frequency: 261.63 },
  { id: "note-cs4", frequency: 277.18 },
  { id: "note-d4", frequency: 293.66 },
  { id: "note-ds4", frequency: 311.13 },
  { id: "note-e4", frequency: 329.63 },
  { id: "note-f4", frequency: 349.23 },
  { id: "note-fs4", frequency: 369.99 },
  { id: "note-g4", frequency: 392.0 },
  { id: "note-gs4", frequency: 415.3 },
  { id: "note-a4", frequency: 440.0 },
  { id: "note-as4", frequency: 466.16 },
  { id: "note-b4", frequency: 493.88 },
];
const BASE_SOUND_PRESETS = {
  "warm-pad": {
    oscAWave: "sawtooth",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 3,
    subLevel: 0.45,
    filterCutoff: 1700,
    filterQ: 1.2,
    attack: 0.12,
    decay: 0.55,
    release: 0.14,
  },
  pluck: {
    oscAWave: "square",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 1.2,
    subLevel: 0.25,
    filterCutoff: 2500,
    filterQ: 2.2,
    attack: 0.01,
    decay: 0.18,
    release: 0.05,
  },
  organ: {
    oscAWave: "square",
    oscBWave: "sine",
    subWave: "triangle",
    detuneSpread: 0.6,
    subLevel: 0.35,
    filterCutoff: 3200,
    filterQ: 0.8,
    attack: 0.03,
    decay: 0.25,
    release: 0.1,
  },
  bass: {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "sine",
    detuneSpread: 2,
    subLevel: 0.7,
    filterCutoff: 900,
    filterQ: 1.6,
    attack: 0.015,
    decay: 0.32,
    release: 0.08,
  },
  "glass-shimmer": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 6,
    subLevel: 0.18,
    filterCutoff: 4200,
    filterQ: 3.2,
    attack: 0.03,
    decay: 0.22,
    release: 0.18,
    stereoPan: 0.2,
    reverbSend: 0.45,
  },
  "acid-bite": {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "triangle",
    detuneSpread: 1.5,
    subLevel: 0.2,
    filterCutoff: 1100,
    filterQ: 4.8,
    attack: 0.01,
    decay: 0.2,
    release: 0.06,
    delaySend: 0.08,
    reverbSend: 0.12,
  },
  "hollow-drift": {
    oscAWave: "triangle",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 8,
    subLevel: 0.3,
    filterCutoff: 1400,
    filterQ: 0.6,
    attack: 0.2,
    decay: 0.45,
    release: 0.24,
    stereoPan: -0.25,
    reverbSend: 0.4,
  },
  "noisy-spark": {
    oscAWave: "square",
    oscBWave: "square",
    subWave: "sine",
    detuneSpread: 12,
    subLevel: 0.1,
    filterCutoff: 3600,
    filterQ: 5.5,
    attack: 0.005,
    decay: 0.1,
    release: 0.03,
    delaySend: 0.16,
    delayFeedback: 0.38,
    stereoPan: 0.35,
  },
  "deep-space": {
    oscAWave: "sine",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 0.8,
    subLevel: 0.75,
    filterCutoff: 700,
    filterQ: 1.1,
    attack: 0.25,
    decay: 0.6,
    release: 0.3,
    delaySend: 0.32,
    delayTime: 0.4,
    reverbSend: 0.5,
    stereoPan: -0.1,
  },
  "rubber-seq": {
    oscAWave: "sawtooth",
    oscBWave: "triangle",
    subWave: "triangle",
    detuneSpread: 2.8,
    subLevel: 0.35,
    filterCutoff: 1500,
    filterQ: 2.8,
    attack: 0.02,
    decay: 0.16,
    release: 0.07,
    delaySend: 0.14,
    delayFeedback: 0.22,
  },
  "metal-cloud": {
    oscAWave: "square",
    oscBWave: "sawtooth",
    subWave: "sine",
    detuneSpread: 9,
    subLevel: 0.22,
    filterCutoff: 2800,
    filterQ: 3.8,
    attack: 0.04,
    decay: 0.38,
    release: 0.2,
    reverbSend: 0.42,
    stereoPan: 0.15,
  },
  "pixel-tone": {
    oscAWave: "square",
    oscBWave: "square",
    subWave: "triangle",
    detuneSpread: 0.2,
    subLevel: 0.28,
    filterCutoff: 3000,
    filterQ: 1.5,
    attack: 0.005,
    decay: 0.08,
    release: 0.04,
    delaySend: 0.05,
    reverbSend: 0.06,
  },
  "wide-chorus": {
    oscAWave: "sawtooth",
    oscBWave: "sine",
    subWave: "triangle",
    detuneSpread: 10,
    subLevel: 0.25,
    filterCutoff: 2400,
    filterQ: 1.0,
    attack: 0.09,
    decay: 0.42,
    release: 0.18,
    delaySend: 0.2,
    reverbSend: 0.34,
    stereoPan: -0.2,
  },
  "sub-rumble": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 1.1,
    subLevel: 0.95,
    filterCutoff: 550,
    filterQ: 1.9,
    attack: 0.03,
    decay: 0.26,
    release: 0.11,
    delaySend: 0.07,
    reverbSend: 0.1,
    stereoPan: 0,
  },
};
const DEFAULT_PRESET_ID = "warm-pad";
const GLOBAL_CONTROL_KEYS = new Set([
  "tempoBpm",
  "masterVolume",
  "reverbMix",
  "delayTime",
  "delayFeedback",
]);

const toggleButton = document.getElementById("play-toggle");
const statusLabel = document.getElementById("status");
const presetButtonsContainer = document.getElementById("sound-preset-buttons");

const synthParams = {
  tempoBpm: 120,
  attack: 0.1,
  decay: 0.5,
  release: 0.08,
  filterCutoff: 1600,
  filterQ: 1.1,
  detuneSpread: 3,
  subLevel: 0.45,
  stereoPan: 0,
  delaySend: 0.35,
  delayTime: 0.24,
  delayFeedback: 0.26,
  reverbMix: 0.7,
  reverbSend: 0.24,
  masterVolume: 0.75,
  oscAWave: "sawtooth",
  oscBWave: "triangle",
  subWave: "sine",
};

const controlConfig = {
  "tempo-bpm": {
    key: "tempoBpm",
    valueId: "tempo-bpm-value",
    formatter: (value) => String(Math.round(value)),
  },
  attack: {
    key: "attack",
    valueId: "attack-value",
    formatter: (value) => value.toFixed(2),
  },
  decay: {
    key: "decay",
    valueId: "decay-value",
    formatter: (value) => value.toFixed(2),
  },
  release: {
    key: "release",
    valueId: "release-value",
    formatter: (value) => value.toFixed(2),
  },
  "filter-cutoff": {
    key: "filterCutoff",
    valueId: "filter-cutoff-value",
    formatter: (value) => String(Math.round(value)),
  },
  "filter-q": {
    key: "filterQ",
    valueId: "filter-q-value",
    formatter: (value) => value.toFixed(2),
  },
  "detune-spread": {
    key: "detuneSpread",
    valueId: "detune-spread-value",
    formatter: (value) => value.toFixed(1),
  },
  "sub-level": {
    key: "subLevel",
    valueId: "sub-level-value",
    formatter: (value) => value.toFixed(2),
  },
  "stereo-pan": {
    key: "stereoPan",
    valueId: "stereo-pan-value",
    formatter: (value) => value.toFixed(2),
  },
  "delay-send": {
    key: "delaySend",
    valueId: "delay-send-value",
    formatter: (value) => value.toFixed(2),
  },
  "delay-time": {
    key: "delayTime",
    valueId: "delay-time-value",
    formatter: (value) => value.toFixed(2),
  },
  "delay-feedback": {
    key: "delayFeedback",
    valueId: "delay-feedback-value",
    formatter: (value) => value.toFixed(2),
  },
  "reverb-mix": {
    key: "reverbMix",
    valueId: "reverb-mix-value",
    formatter: (value) => value.toFixed(2),
  },
  "reverb-send": {
    key: "reverbSend",
    valueId: "reverb-send-value",
    formatter: (value) => value.toFixed(2),
  },
  "master-volume": {
    key: "masterVolume",
    valueId: "master-volume-value",
    formatter: (value) => value.toFixed(2),
  },
};

let audioContext;
let schedulerId = null;
let nextNoteTime = 0;
let stepIndex = 0;

let masterGain;
let compressor;
let delayNode;
let delayFeedback;
let delayTone;
let reverbConvolver;
let reverbInput;
let reverbWetGain;
let reverbDryGain;

let activePresetIds = Object.keys(BASE_SOUND_PRESETS);
const instrumentParamsByPresetId = {};
const instrumentNoteIdsByPresetId = {};
const instrumentPatternsByPresetId = {};
let activeInstrumentPresetId = DEFAULT_PRESET_ID;
const playingPresetIds = new Set();

function buildArpeggioPattern(notes) {
  if (notes.length < 2) {
    return notes.slice();
  }

  const ascending = notes.slice();
  const descendingWithoutPeak = notes.slice(0, -1).reverse();

  return ascending.concat(descendingWithoutPeak);
}

function updateSelectedNotesFromUI() {
  instrumentNoteIdsByPresetId[activeInstrumentPresetId] = NOTE_OPTIONS
    .filter(({ id }) => {
      const button = document.getElementById(id);
      return button && button.classList.contains("is-active");
    })
    .map(({ id }) => id);
  rebuildInstrumentPattern(activeInstrumentPresetId);
}

function rebuildInstrumentPattern(presetId) {
  const selectedNoteIds = instrumentNoteIdsByPresetId[presetId] || DEFAULT_NOTE_IDS.slice();
  const selectedFrequencies = selectedNoteIds
    .map((selectedId) => NOTE_OPTIONS.find((note) => note.id === selectedId))
    .filter(Boolean)
    .map((note) => note.frequency);

  instrumentPatternsByPresetId[presetId] = buildArpeggioPattern(selectedFrequencies);
}

function ensureInstrumentNoteState(presetId) {
  if (!instrumentNoteIdsByPresetId[presetId]) {
    instrumentNoteIdsByPresetId[presetId] = DEFAULT_NOTE_IDS.slice();
  }

  if (!instrumentPatternsByPresetId[presetId]) {
    rebuildInstrumentPattern(presetId);
  }
}

function getInstrumentPattern(presetId) {
  ensureInstrumentNoteState(presetId);
  return instrumentPatternsByPresetId[presetId] || [];
}

function syncNoteButtonsFromActiveInstrumentPage() {
  ensureInstrumentNoteState(activeInstrumentPresetId);
  const selectedNoteIds = instrumentNoteIdsByPresetId[activeInstrumentPresetId];

  NOTE_OPTIONS.forEach((note) => {
    const noteButton = document.getElementById(note.id);
    if (!noteButton) {
      return;
    }

    const isActive = selectedNoteIds.includes(note.id);
    noteButton.classList.toggle("is-active", isActive);
    noteButton.setAttribute("aria-pressed", String(isActive));
  });
}


function hasPatternForPreset(presetId) {
  return getInstrumentPattern(presetId).length > 0;
}

function getStepDuration() {
  // One arpeggio step equals an eighth note.
  return 30 / synthParams.tempoBpm;
}

function getNoteDuration() {
  return getStepDuration() + 0.05;
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function randomCentered(amount) {
  return (Math.random() * 2 - 1) * amount;
}

function getPresetLabel(presetId) {
  return presetId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPresetIds() {
  return Object.keys(BASE_SOUND_PRESETS);
}

function createInstrumentParams(presetId) {
  return {
    ...synthParams,
    ...(BASE_SOUND_PRESETS[presetId] || {}),
  };
}

function getInstrumentParams(presetId) {
  if (!instrumentParamsByPresetId[presetId]) {
    instrumentParamsByPresetId[presetId] = createInstrumentParams(presetId);
  }

  return instrumentParamsByPresetId[presetId];
}

function setControlUIValue(controlId, value) {
  const input = document.getElementById(controlId);
  if (input) {
    input.value = String(value);
  }
  setControlLabel(controlId, value);
}

function syncControlsFromActiveInstrumentPage() {
  const instrumentParams = getInstrumentParams(activeInstrumentPresetId);

  Object.keys(controlConfig).forEach((controlId) => {
    const { key } = controlConfig[controlId];
    const value = GLOBAL_CONTROL_KEYS.has(key) ? synthParams[key] : instrumentParams[key];
    setControlUIValue(controlId, value);
  });

  syncNoteButtonsFromActiveInstrumentPage();
  updateTransportUI();
}

function renderPresetStackButtons() {
  if (!presetButtonsContainer) {
    return;
  }

  presetButtonsContainer.innerHTML = "";

  getPresetIds().forEach((presetId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.presetId = presetId;
    button.className = "preset-button";
    button.textContent = `${playingPresetIds.has(presetId) ? "● " : "○ "}${getPresetLabel(presetId)}`;
    button.setAttribute("aria-pressed", String(presetId === activeInstrumentPresetId));

    if (playingPresetIds.has(presetId)) {
      button.classList.add("is-playing");
    }

    if (presetId === activeInstrumentPresetId) {
      button.classList.add("is-current");
    }

    presetButtonsContainer.append(button);
  });
}

function getActivePresetIds() {
  if (activePresetIds.length > 0) {
    return activePresetIds;
  }

  return [DEFAULT_PRESET_ID];
}

function getPlayablePresetIds() {
  return getActivePresetIds().filter((presetId) => playingPresetIds.has(presetId));
}

function updateTransportUI() {
  renderPresetStackButtons();

  const isCurrentPagePlaying = playingPresetIds.has(activeInstrumentPresetId);
  toggleButton.textContent = isCurrentPagePlaying ? "Stop" : "Start";

  if (playingPresetIds.size === 0) {
    statusLabel.textContent = "Stopped";
    return;
  }

  statusLabel.textContent = `Playing ${playingPresetIds.size} instruments`;
}

function startPresetPlayback(presetId) {
  if (!playingPresetIds.has(presetId) && playingPresetIds.size >= MAX_SIMULTANEOUS_PRESETS) {
    statusLabel.textContent = `Maximum ${MAX_SIMULTANEOUS_PRESETS} playing instruments`;
    return;
  }

  playingPresetIds.add(presetId);

  if (schedulerId === null) {
    stepIndex = 0;
    nextNoteTime = audioContext.currentTime + 0.05;
    scheduleAhead();
    schedulerId = window.setInterval(scheduleAhead, 25);
  }

  updateTransportUI();
}

function stopPresetPlayback(presetId) {
  playingPresetIds.delete(presetId);

  if (playingPresetIds.size === 0 && schedulerId !== null) {
    window.clearInterval(schedulerId);
    schedulerId = null;
  }

  updateTransportUI();
}

function createImpulseResponse(context, durationSeconds, decay) {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * durationSeconds);
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel);

    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      const envelope = Math.pow(1 - progress, decay);
      channelData[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

function applyReverbMix() {
  if (!reverbDryGain || !reverbWetGain || !audioContext) {
    return;
  }

  const clamped = Math.max(0, Math.min(1, synthParams.reverbMix));
  reverbDryGain.gain.setValueAtTime(1 - clamped, audioContext.currentTime);
  reverbWetGain.gain.setValueAtTime(clamped, audioContext.currentTime);
}

function initializeAudioGraph() {
  masterGain = audioContext.createGain();
  compressor = audioContext.createDynamicsCompressor();
  delayNode = audioContext.createDelay(1.0);
  delayFeedback = audioContext.createGain();
  delayTone = audioContext.createBiquadFilter();
  reverbConvolver = audioContext.createConvolver();
  reverbInput = audioContext.createGain();
  reverbWetGain = audioContext.createGain();
  reverbDryGain = audioContext.createGain();

  masterGain.gain.value = synthParams.masterVolume;

  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;

  delayNode.delayTime.value = synthParams.delayTime;
  delayFeedback.gain.value = synthParams.delayFeedback;
  delayTone.type = "lowpass";
  delayTone.frequency.value = 1600;
  delayTone.Q.value = 0.7;

  reverbConvolver.buffer = createImpulseResponse(audioContext, REVERB_SECONDS, REVERB_DECAY);
  applyReverbMix();

  masterGain.connect(reverbDryGain);
  reverbDryGain.connect(compressor);
  masterGain.connect(reverbInput);
  reverbInput.connect(reverbConvolver);
  reverbConvolver.connect(reverbWetGain);
  reverbWetGain.connect(compressor);
  compressor.connect(audioContext.destination);

  delayNode.connect(delayTone);
  delayTone.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayTone.connect(masterGain);
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
    initializeAudioGraph();
  }

  if (audioContext.state === "suspended") {
    return audioContext.resume();
  }

  return Promise.resolve();
}

function scheduleNote(frequency, time, voiceParams, layerIndex, layerCount) {
  const oscA = audioContext.createOscillator();
  const oscB = audioContext.createOscillator();
  const subOsc = audioContext.createOscillator();

  const voiceGain = audioContext.createGain();
  const upperMix = audioContext.createGain();
  const subMix = audioContext.createGain();
  const toneFilter = audioContext.createBiquadFilter();
  const delaySend = audioContext.createGain();
  const reverbSend = audioContext.createGain();
  const stereoPanner = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;

  const noteDuration = getNoteDuration();
  const releaseStartTime = Math.max(time + 0.02, time + noteDuration - voiceParams.release);
  const layerGainScale = 1 / Math.sqrt(layerCount);
  const driftCents = randomCentered(HUMANIZE.detuneCents);
  const attackTime = clamp(
    voiceParams.attack + randomCentered(HUMANIZE.attackSeconds),
    0.005,
    0.8,
  );
  const decayTime = clamp(
    voiceParams.decay + randomCentered(HUMANIZE.decaySeconds),
    0.01,
    1.2,
  );
  const peakGain = clamp(0.19 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale, 0.03, 0.26);
  const sustainGain = clamp(0.11 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale, 0.02, 0.16);
  const cutoffWithVariation = clamp(
    (Math.min(8000, voiceParams.filterCutoff + frequency * 0.8)) *
      (1 + randomCentered(HUMANIZE.cutoffAmount)),
    250,
    8000,
  );
  const delaySendValue = clamp(
    voiceParams.delaySend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );
  const reverbSendValue = clamp(
    voiceParams.reverbSend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );

  oscA.type = voiceParams.oscAWave;
  oscA.frequency.setValueAtTime(frequency, time);
  oscA.detune.value = -voiceParams.detuneSpread + driftCents;

  oscB.type = voiceParams.oscBWave;
  oscB.frequency.setValueAtTime(frequency, time);
  oscB.detune.value = voiceParams.detuneSpread + driftCents;

  subOsc.type = voiceParams.subWave;
  subOsc.frequency.setValueAtTime(frequency / 2, time);

  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(cutoffWithVariation, time);
  toneFilter.Q.value = voiceParams.filterQ;

  upperMix.gain.value = 0.7;
  subMix.gain.value = voiceParams.subLevel;

  delaySend.gain.value = delaySendValue;
  reverbSend.gain.value = reverbSendValue;

  voiceGain.gain.setValueAtTime(0.0001, time);
  voiceGain.gain.linearRampToValueAtTime(peakGain, time + attackTime);
  voiceGain.gain.linearRampToValueAtTime(
    sustainGain,
    time + attackTime + decayTime,
  );
  voiceGain.gain.setTargetAtTime(0.0001, releaseStartTime, Math.max(0.01, voiceParams.release / 2));

  oscA.connect(upperMix);
  oscB.connect(upperMix);
  subOsc.connect(subMix);
  upperMix.connect(voiceGain);
  subMix.connect(voiceGain);

  voiceGain.connect(toneFilter);
  if (stereoPanner) {
    const layerSpread = layerCount > 1 ? ((layerIndex / (layerCount - 1)) * 2 - 1) * 0.35 : 0;
    stereoPanner.pan.value = clamp(
      voiceParams.stereoPan + layerSpread + randomCentered(HUMANIZE.panAmount),
      -1,
      1,
    );
    toneFilter.connect(stereoPanner);
    stereoPanner.connect(masterGain);
    stereoPanner.connect(delaySend);
    stereoPanner.connect(reverbSend);
  } else {
    toneFilter.connect(masterGain);
    toneFilter.connect(delaySend);
    toneFilter.connect(reverbSend);
  }
  delaySend.connect(delayNode);
  reverbSend.connect(reverbInput);

  oscA.start(time);
  oscB.start(time);
  subOsc.start(time);

  const stopTime = time + noteDuration + 0.04;
  oscA.stop(stopTime);
  oscB.stop(stopTime);
  subOsc.stop(stopTime);
}

function scheduleInstrumentStackNote(time) {
  const presetIds = getPlayablePresetIds();

  presetIds.forEach((presetId, layerIndex) => {
    const voiceParams = getInstrumentParams(presetId);
    const pattern = getInstrumentPattern(presetId);

    if (pattern.length === 0) {
      return;
    }

    const layerFrequency = pattern[stepIndex % pattern.length];
    scheduleNote(layerFrequency, time, voiceParams, layerIndex, presetIds.length);
  });
}

function scheduleAhead() {
  const lookaheadSeconds = 0.18;

  if (getPlayablePresetIds().length === 0) {
    return;
  }

  while (nextNoteTime < audioContext.currentTime + lookaheadSeconds) {
    scheduleInstrumentStackNote(nextNoteTime);
    nextNoteTime += getStepDuration();
    stepIndex += 1;
  }
}

async function toggleCurrentPagePlayback() {
  if (playingPresetIds.has(activeInstrumentPresetId)) {
    stopPresetPlayback(activeInstrumentPresetId);
    return;
  }

  if (!hasPatternForPreset(activeInstrumentPresetId)) {
    statusLabel.textContent = "Select at least one note";
    return;
  }

  await ensureAudioContext();
  startPresetPlayback(activeInstrumentPresetId);
}

function setControlLabel(controlId, value) {
  const config = controlConfig[controlId];
  const valueElement = document.getElementById(config.valueId);

  if (valueElement) {
    valueElement.textContent = config.formatter(value);
  }
}

function applyLiveAudioUpdates(paramKey, value) {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;

  if (paramKey === "masterVolume" && masterGain) {
    masterGain.gain.setValueAtTime(value, now);
    return;
  }

  if (paramKey === "delayTime" && delayNode) {
    delayNode.delayTime.setValueAtTime(value, now);
    return;
  }

  if (paramKey === "delayFeedback" && delayFeedback) {
    delayFeedback.gain.setValueAtTime(value, now);
    return;
  }

  if (paramKey === "reverbMix") {
    applyReverbMix();
  }
}

function bindControls() {
  Object.keys(controlConfig).forEach((controlId) => {
    const config = controlConfig[controlId];
    const input = document.getElementById(controlId);

    if (!input) {
      return;
    }

    setControlLabel(controlId, synthParams[config.key]);

    input.addEventListener("input", (event) => {
      const numericValue = Number.parseFloat(event.target.value);

      if (Number.isNaN(numericValue)) {
        return;
      }

      if (GLOBAL_CONTROL_KEYS.has(config.key)) {
        synthParams[config.key] = numericValue;
        setControlLabel(controlId, numericValue);
        applyLiveAudioUpdates(config.key, numericValue);
        return;
      }

      const instrumentParams = getInstrumentParams(activeInstrumentPresetId);
      instrumentParams[config.key] = numericValue;
      setControlLabel(controlId, numericValue);
    });
  });
}

function bindNoteSelector() {
  NOTE_OPTIONS.forEach(({ id }) => {
    const button = document.getElementById(id);

    if (!button) {
      return;
    }

    button.addEventListener("click", (event) => {
      event.currentTarget.classList.toggle("is-active");

      const activeButtons = NOTE_OPTIONS
        .map((note) => document.getElementById(note.id))
        .filter((node) => node && node.classList.contains("is-active"));

      if (activeButtons.length === 0) {
        event.currentTarget.classList.add("is-active");
        event.currentTarget.setAttribute("aria-pressed", "true");
        return;
      }

      NOTE_OPTIONS.forEach((note) => {
        const noteButton = document.getElementById(note.id);
        if (noteButton) {
          noteButton.setAttribute(
            "aria-pressed",
            String(noteButton.classList.contains("is-active")),
          );
        }
      });

      updateSelectedNotesFromUI();
    });
  });

  ensureInstrumentNoteState(activeInstrumentPresetId);
  syncNoteButtonsFromActiveInstrumentPage();
}

function bindPresetSelector() {
  if (!presetButtonsContainer) {
    return;
  }

  activePresetIds.forEach((presetId) => {
    getInstrumentParams(presetId);
    ensureInstrumentNoteState(presetId);
  });
  syncControlsFromActiveInstrumentPage();
  updateTransportUI();

  presetButtonsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-preset-id]");
    if (!button) {
      return;
    }

    const presetId = button.dataset.presetId;
    if (!presetId || !BASE_SOUND_PRESETS[presetId]) {
      return;
    }

    activeInstrumentPresetId = presetId;
    syncControlsFromActiveInstrumentPage();
    updateTransportUI();
  });
}

toggleButton.addEventListener("click", () => {
  toggleCurrentPagePlayback().catch((error) => {
    console.error("Unable to start audio:", error);
    stopPresetPlayback(activeInstrumentPresetId);
    statusLabel.textContent = "Audio start failed (see console)";
  });
});

bindControls();
bindNoteSelector();
bindPresetSelector();

