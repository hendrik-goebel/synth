import {
  clampMidiChannel,
  clampMidiVelocity,
  MIDI_CLOCK_MODE_OPTIONS,
  MIDI_CLOCK_PULSES_PER_QUARTER,
} from "./constants.js";
import { MIDI_VELOCITY_MAX } from "./value-limits.js";
import { state } from "./state.js";

let midiAccess = null;
let boundController = null;
let selectedInputPort = null;
let selectedOutputPort = null;
let masterClockTimerId = null;
let masterClockNextPulseAtMs = 0;
let crossTabCoordinator = null;

const MIDI_CROSS_TAB_CHANNEL_NAME = "audiostate-midi-cross-tab";
const CROSS_TAB_SEEN_EVENT_LIMIT = 512;

function createCrossTabId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isCrossTabSyncSupported() {
  return typeof globalThis.BroadcastChannel === "function";
}

export function createMidiCrossTabCoordinator({
  tabId = createCrossTabId(),
  channelName = MIDI_CROSS_TAB_CHANNEL_NAME,
  createChannel = () => new globalThis.BroadcastChannel(channelName),
  onRemoteEvent = () => {},
} = {}) {
  let channel = null;
  const seenEventIds = new Set();

  function rememberEventId(eventId) {
    if (!eventId) {
      return;
    }

    seenEventIds.add(eventId);
    if (seenEventIds.size <= CROSS_TAB_SEEN_EVENT_LIMIT) {
      return;
    }

    const [firstSeenEventId] = seenEventIds;
    if (firstSeenEventId) {
      seenEventIds.delete(firstSeenEventId);
    }
  }

  function handleEnvelope(envelope) {
    if (!envelope || typeof envelope !== "object") {
      return false;
    }

    const { eventId, originTabId, type, payload } = envelope;
    if (!eventId || !type || originTabId === tabId || seenEventIds.has(eventId)) {
      return false;
    }

    rememberEventId(eventId);
    onRemoteEvent({
      eventId,
      originTabId,
      type,
      payload: payload && typeof payload === "object" ? payload : {},
    });
    return true;
  }

  return {
    tabId,
    start() {
      if (!isCrossTabSyncSupported() || channel) {
        return Boolean(channel);
      }

      channel = createChannel();
      channel.onmessage = (event) => {
        handleEnvelope(event?.data);
      };
      return true;
    },
    stop() {
      if (!channel) {
        return false;
      }

      channel.onmessage = null;
      if (typeof channel.close === "function") {
        channel.close();
      }
      channel = null;
      return true;
    },
    publish(type, payload = {}) {
      if (!channel || !type) {
        return false;
      }

      const envelope = {
        eventId: `${tabId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        originTabId: tabId,
        type,
        payload,
      };
      rememberEventId(envelope.eventId);
      channel.postMessage(envelope);
      return true;
    },
    handleEnvelope,
  };
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getSafeRelayDelayMs(targetTimestampMs, originNowMs) {
  if (!Number.isFinite(targetTimestampMs)) {
    return 0;
  }

  return Math.max(0, targetTimestampMs - originNowMs);
}

function shouldSuppressLocalMidiNoteOutput() {
  return Boolean(state.midi.remoteNoteOutputActive);
}

function buildCrossTabMidiNoteOutputPayload({
  presetId,
  noteOnBytes,
  noteOffBytes,
  startTimestampMs,
  endTimestampMs,
}) {
  const originNowMs = nowMs();

  return {
    presetId,
    noteOnBytes: noteOnBytes.slice(),
    noteOffBytes: noteOffBytes.slice(),
    startDelayMs: getSafeRelayDelayMs(startTimestampMs, originNowMs),
    endDelayMs: getSafeRelayDelayMs(endTimestampMs, originNowMs),
  };
}

function replayCrossTabMidiNoteOutput(payload = {}) {
  if (!selectedOutputPort) {
    return false;
  }

  const noteOnBytes = Array.isArray(payload.noteOnBytes) ? payload.noteOnBytes.slice() : [];
  const noteOffBytes = Array.isArray(payload.noteOffBytes) ? payload.noteOffBytes.slice() : [];
  if (noteOnBytes.length === 0 || noteOffBytes.length === 0) {
    return false;
  }

  const baseNowMs = nowMs();
  const startDelayMs = Math.max(0, Number(payload.startDelayMs) || 0);
  const endDelayMs = Math.max(startDelayMs, Number(payload.endDelayMs) || 0);
  const noteOnTimestampMs = startDelayMs > 0 ? baseNowMs + startDelayMs : undefined;
  const noteOffTimestampMs = endDelayMs > 0 ? baseNowMs + endDelayMs : undefined;
  const detail = {
    presetId: payload.presetId,
    relayed: true,
    scheduledBy: "crossTabMidiNoteOutputRelay",
  };

  const sentNoteOn = sendOutputMessage(noteOnBytes, noteOnTimestampMs, detail);
  const sentNoteOff = sendOutputMessage(noteOffBytes, noteOffTimestampMs, detail);
  return sentNoteOn || sentNoteOff;
}

function getMidiMessageType(statusByte, data2 = 0) {
  if (!Number.isInteger(statusByte)) {
    return "unknown";
  }

  if (statusByte === 0xf8) {
    return "clock";
  }

  if (statusByte === 0xfa) {
    return "start";
  }

  if (statusByte === 0xfb) {
    return "continue";
  }

  if (statusByte === 0xfc) {
    return "stop";
  }

  const messageType = statusByte & 0xf0;
  if (messageType === 0x90) {
    return data2 > 0 ? "noteon" : "noteoff";
  }

  if (messageType === 0x80) {
    return "noteoff";
  }

  if (messageType === 0xb0) {
    return "controlchange";
  }

  if (messageType === 0xc0) {
    return "programchange";
  }

  if (messageType === 0xe0) {
    return "pitchbend";
  }

  return "unknown";
}

function getMidiMessageLogDetails(bytes = []) {
  const [statusByte, data1 = 0, data2 = 0] = bytes;
  const type = getMidiMessageType(statusByte, data2);
  const isChannelMessage = Number.isInteger(statusByte) && statusByte < 0xf0;

  return {
    type,
    statusByte,
    midiChannel: isChannelMessage ? (statusByte & 0x0f) + 1 : null,
    noteNumber: type === "noteon" || type === "noteoff" ? data1 : null,
    velocity: type === "noteon" || type === "noteoff" ? data2 : null,
  };
}

function logMidiMessage({
  direction,
  source,
  bytes = [],
  timestampMs = undefined,
  portId = "",
  portName = "",
  detail = {},
} = {}) {
  if (typeof globalThis.console?.debug !== "function") {
    return;
  }

  const normalizedBytes = Array.isArray(bytes) ? bytes.slice() : [];
  const messageDetails = getMidiMessageLogDetails(normalizedBytes);

  globalThis.console.debug("[MIDI]", {
    direction,
    source,
    portId,
    portName,
    timestampMs,
    bytes: normalizedBytes,
    ...messageDetails,
    ...detail,
  });
}

function logMidiRelayEvent({ direction, type, payload = {}, detail = {} } = {}) {
  if (typeof globalThis.console?.debug !== "function") {
    return;
  }

  globalThis.console.debug("[MIDI]", {
    direction,
    source: "cross-tab",
    type,
    payload: payload && typeof payload === "object" ? { ...payload } : payload,
    ...detail,
  });
}

function getMidiSupport() {
  return typeof globalThis.navigator?.requestMIDIAccess === "function";
}

function syncCrossTabState() {
  state.midi.crossTabSyncSupported = isCrossTabSyncSupported();
  state.midi.crossTabSyncActive = Boolean(crossTabCoordinator);
  state.midi.tabId = crossTabCoordinator?.tabId || "";
}

function shouldApplyRemoteCrossTabMidiEvents() {
  return state.midi.clockMode === "slave" || !state.midi.inputPortId;
}

function canDriveMasterClock() {
  return Boolean(selectedOutputPort) || Boolean(crossTabCoordinator);
}

async function handleRemoteCrossTabMidiEvent({ type, payload }) {
  if (!boundController) {
    return false;
  }

  logMidiRelayEvent({
    direction: "receive",
    type,
    payload,
  });

  switch (type) {
    case "transport-start":
      if (state.midi.clockMode === "slave") {
        return false;
      }
      return boundController.playAll({ source: "cross-tab" });
    case "transport-stop":
      if (state.midi.clockMode === "slave") {
        return false;
      }
      return boundController.stopAll({ source: "cross-tab" });
    case "midi-clock-start":
      if (!shouldApplyRemoteCrossTabMidiEvents()) {
        return false;
      }
      return boundController.handleIncomingMidiClockStart({ source: "cross-tab" });
    case "midi-clock-continue":
      if (!shouldApplyRemoteCrossTabMidiEvents()) {
        return false;
      }
      return boundController.handleIncomingMidiClockContinue({ source: "cross-tab" });
    case "midi-clock-stop":
      if (!shouldApplyRemoteCrossTabMidiEvents()) {
        return false;
      }
      return boundController.handleIncomingMidiClockStop({ source: "cross-tab" });
    case "midi-clock-pulse":
      if (!shouldApplyRemoteCrossTabMidiEvents()) {
        return false;
      }
      return boundController.handleIncomingMidiClockPulse(payload.timestampMs, { source: "cross-tab" });
    case "midi-note-message":
      if (!shouldApplyRemoteCrossTabMidiEvents()) {
        return false;
      }
      return boundController.handleIncomingMidiNoteMessage(payload, { source: "cross-tab" });
    case "midi-note-output":
      return replayCrossTabMidiNoteOutput(payload);
    default:
      return false;
  }
}

function ensureCrossTabCoordinator() {
  syncCrossTabState();

  if (crossTabCoordinator || !isCrossTabSyncSupported()) {
    return Boolean(crossTabCoordinator);
  }

  crossTabCoordinator = createMidiCrossTabCoordinator({
    onRemoteEvent: (event) => {
      void handleRemoteCrossTabMidiEvent(event);
    },
  });
  crossTabCoordinator.start();
  syncCrossTabState();
  return true;
}

function broadcastCrossTabMidiEvent(type, payload = {}) {
  if (!crossTabCoordinator) {
    return false;
  }

  const published = crossTabCoordinator.publish(type, payload);
  if (published) {
    logMidiRelayEvent({
      direction: "send",
      type,
      payload,
      detail: {
        tabId: crossTabCoordinator.tabId,
      },
    });
  }

  return published;
}

export function broadcastCrossTabTransportStart(payload = {}) {
  return broadcastCrossTabMidiEvent("transport-start", payload);
}

export function broadcastCrossTabTransportStop(payload = {}) {
  return broadcastCrossTabMidiEvent("transport-stop", payload);
}

function emitMidiStateChange(type, detail = {}) {
  boundController?.emitStateChange(type, {
    ...detail,
    midi: {
      supported: state.midi.supported,
      accessGranted: state.midi.accessGranted,
      crossTabSyncSupported: state.midi.crossTabSyncSupported,
      crossTabSyncActive: state.midi.crossTabSyncActive,
      tabId: state.midi.tabId,
      inputPortId: state.midi.inputPortId,
      outputPortId: state.midi.outputPortId,
      availableInputs: state.midi.availableInputs.slice(),
      availableOutputs: state.midi.availableOutputs.slice(),
      clockMode: state.midi.clockMode,
      clockMasterRunning: state.midi.clockMasterRunning,
      awaitingExternalClockStart: state.midi.awaitingExternalClockStart,
      remoteNoteOutputActive: state.midi.remoteNoteOutputActive,
      externalClockTempoBpm: state.midi.externalClockTempoBpm,
      channelSettingsByPresetId: Object.fromEntries(
        Object.entries(state.midi.channelSettingsByPresetId).map(([presetId, value]) => [presetId, { ...value }]),
      ),
    },
  });
}

function emitMidiError(message, detail = {}) {
  boundController?.emitError(message, detail);
}

function serializePort(port) {
  return {
    id: port.id,
    name: port.name || port.manufacturer || port.id,
    manufacturer: port.manufacturer || "",
    state: port.state || "connected",
    connection: port.connection || "closed",
  };
}

function listPorts(portMap) {
  if (!portMap) {
    return [];
  }

  return Array.from(portMap.values()).map(serializePort);
}

function getPortById(portMap, portId) {
  if (!portMap || !portId) {
    return null;
  }

  return portMap.get(portId) || null;
}

function handleMidiInputMessage(event) {
  const data = Array.from(event?.data || []);
  if (data.length === 0) {
    return;
  }

  logMidiMessage({
    direction: "receive",
    source: "hardware",
    bytes: data,
    timestampMs: event?.receivedTime ?? nowMs(),
    portId: selectedInputPort?.id || "",
    portName: selectedInputPort?.name || "",
  });

  const [statusByte, data1 = 0, data2 = 0] = data;

  if (statusByte === 0xf8) {
    const timestampMs = event.receivedTime ?? nowMs();
    boundController?.handleIncomingMidiClockPulse(timestampMs, { source: "hardware" });
    broadcastCrossTabMidiEvent("midi-clock-pulse", { timestampMs });
    return;
  }

  if (statusByte === 0xfa) {
    boundController?.handleIncomingMidiClockStart({ source: "hardware" });
    broadcastCrossTabMidiEvent("midi-clock-start");
    return;
  }

  if (statusByte === 0xfb) {
    boundController?.handleIncomingMidiClockContinue({ source: "hardware" });
    broadcastCrossTabMidiEvent("midi-clock-continue");
    return;
  }

  if (statusByte === 0xfc) {
    boundController?.handleIncomingMidiClockStop({ source: "hardware" });
    broadcastCrossTabMidiEvent("midi-clock-stop");
    return;
  }

  const messageType = statusByte & 0xf0;
  const midiChannel = (statusByte & 0x0f) + 1;

  if (messageType === 0x90) {
    if (data2 > 0) {
      const midiEvent = {
        type: "noteon",
        midiChannel,
        noteNumber: data1,
        velocity: data2,
      };
      boundController?.handleIncomingMidiNoteMessage(midiEvent, { source: "hardware" });
      broadcastCrossTabMidiEvent("midi-note-message", midiEvent);
      return;
    }

    boundController?.handleIncomingMidiNoteMessage({
      type: "noteoff",
      midiChannel,
      noteNumber: data1,
      velocity: 0,
    }, { source: "hardware" });
    return;
  }

  if (messageType === 0x80) {
    boundController?.handleIncomingMidiNoteMessage({
      type: "noteoff",
      midiChannel,
      noteNumber: data1,
      velocity: data2,
    }, { source: "hardware" });
  }
}

function attachSelectedInputPort(port) {
  if (selectedInputPort && selectedInputPort !== port) {
    selectedInputPort.onmidimessage = null;
  }

  selectedInputPort = port || null;

  if (selectedInputPort) {
    selectedInputPort.onmidimessage = handleMidiInputMessage;
    if (typeof selectedInputPort.open === "function") {
      selectedInputPort.open().catch(() => {});
    }
  }
}

function selectInputPort(portId) {
  const nextPort = getPortById(midiAccess?.inputs, portId);
  if (portId && !nextPort) {
    return false;
  }

  state.midi.inputPortId = nextPort?.id || "";
  attachSelectedInputPort(nextPort);
  return true;
}

function selectOutputPort(portId) {
  const nextPort = getPortById(midiAccess?.outputs, portId);
  if (portId && !nextPort) {
    return false;
  }

  selectedOutputPort = nextPort || null;
  state.midi.outputPortId = nextPort?.id || "";
  if (selectedOutputPort && typeof selectedOutputPort.open === "function") {
    selectedOutputPort.open().catch(() => {});
  }
  return true;
}

function refreshPortSnapshots(reason = "midi-ports-updated") {
  state.midi.supported = getMidiSupport();
  state.midi.accessGranted = Boolean(midiAccess);
  syncCrossTabState();
  state.midi.availableInputs = listPorts(midiAccess?.inputs);
  state.midi.availableOutputs = listPorts(midiAccess?.outputs);

  const availableInputIds = new Set(state.midi.availableInputs.map(({ id }) => id));
  const availableOutputIds = new Set(state.midi.availableOutputs.map(({ id }) => id));

  if (state.midi.inputPortId && !availableInputIds.has(state.midi.inputPortId)) {
    selectInputPort("");
  }
  if (state.midi.outputPortId && !availableOutputIds.has(state.midi.outputPortId)) {
    selectOutputPort("");
  }

  if (!state.midi.inputPortId && state.midi.availableInputs.length > 0) {
    selectInputPort(state.midi.availableInputs[0].id);
  }
  if (!state.midi.outputPortId && state.midi.availableOutputs.length > 0) {
    selectOutputPort(state.midi.availableOutputs[0].id);
  }

  emitMidiStateChange(reason);
}

function clearMasterClockTimer() {
  if (masterClockTimerId !== null) {
    clearTimeout(masterClockTimerId);
    masterClockTimerId = null;
  }
}

function getMasterClockPulseIntervalMs() {
  const tempoBpm = Number.isFinite(state.synthParams.tempoBpm) ? state.synthParams.tempoBpm : 120;
  return 60000 / (tempoBpm * MIDI_CLOCK_PULSES_PER_QUARTER);
}

function sendOutputMessage(bytes, timestampMs = undefined, detail = {}) {
  if (!selectedOutputPort || typeof selectedOutputPort.send !== "function") {
    return false;
  }

  try {
    if (timestampMs === undefined) {
      selectedOutputPort.send(bytes);
    } else {
      selectedOutputPort.send(bytes, timestampMs);
    }

    logMidiMessage({
      direction: "send",
      source: "hardware",
      bytes,
      timestampMs,
      portId: selectedOutputPort.id || "",
      portName: selectedOutputPort.name || "",
      detail,
    });
    return true;
  } catch (error) {
    emitMidiError("Unable to send MIDI message", { error });
    return false;
  }
}

function scheduleNextMasterClockPulse() {
  if (!state.midi.clockMasterRunning || state.midi.clockMode !== "master" || !canDriveMasterClock()) {
    clearMasterClockTimer();
    return;
  }

  const pulseIntervalMs = getMasterClockPulseIntervalMs();
  const currentNow = nowMs();
  if (masterClockNextPulseAtMs <= currentNow) {
    masterClockNextPulseAtMs = currentNow + pulseIntervalMs;
  }

  const delayMs = Math.max(0, masterClockNextPulseAtMs - currentNow);
  masterClockTimerId = setTimeout(() => {
    if (!state.midi.clockMasterRunning || state.midi.clockMode !== "master") {
      return;
    }

    sendOutputMessage([0xf8], masterClockNextPulseAtMs);
    broadcastCrossTabMidiEvent("midi-clock-pulse", {
      timestampMs: masterClockNextPulseAtMs,
    });
    masterClockNextPulseAtMs += pulseIntervalMs;
    scheduleNextMasterClockPulse();
  }, delayMs);
}

export async function initializeMidi(controller) {
  boundController = controller || boundController;
  state.midi.supported = getMidiSupport();
  ensureCrossTabCoordinator();

  if (!state.midi.supported) {
    state.midi.accessGranted = false;
    refreshPortSnapshots("midi-ports-updated");
    return false;
  }

  try {
    if (!midiAccess) {
      midiAccess = await globalThis.navigator.requestMIDIAccess();
      midiAccess.onstatechange = () => {
        refreshPortSnapshots("midi-ports-updated");
        if (!state.midi.outputPortId) {
          stopMidiClockOutput({ sendStopMessage: false });
        }
      };
    }

    refreshPortSnapshots("midi-ports-updated");
    return true;
  } catch (error) {
    state.midi.accessGranted = false;
    emitMidiError("Unable to access MIDI devices", { error });
    refreshPortSnapshots("midi-ports-updated");
    return false;
  }
}

export function refreshMidiPorts() {
  if (!midiAccess) {
    refreshPortSnapshots("midi-ports-updated");
    return false;
  }

  refreshPortSnapshots("midi-ports-updated");
  return true;
}

export function setMidiInputPort(portId) {
  if (!midiAccess) {
    return portId === "";
  }

  const changed = selectInputPort(portId);
  if (changed) {
    emitMidiStateChange("midi-settings-updated", { inputPortId: state.midi.inputPortId });
  }
  return changed;
}

export function setMidiOutputPort(portId) {
  if (!midiAccess) {
    return portId === "";
  }

  const changed = selectOutputPort(portId);
  if (changed) {
    if (!selectedOutputPort) {
      stopMidiClockOutput({ sendStopMessage: false });
    }
    emitMidiStateChange("midi-settings-updated", { outputPortId: state.midi.outputPortId });
  }
  return changed;
}

export function startMidiClockOutput({ sendStartMessage = false } = {}) {
  if (state.midi.clockMode !== "master" || !canDriveMasterClock()) {
    state.midi.clockMasterRunning = false;
    clearMasterClockTimer();
    emitMidiStateChange("midi-clock-state-updated");
    return false;
  }

  clearMasterClockTimer();
  masterClockNextPulseAtMs = nowMs() + getMasterClockPulseIntervalMs();
  state.midi.clockMasterRunning = true;

  if (sendStartMessage) {
    if (selectedOutputPort) {
      sendOutputMessage([0xfa]);
    }
    broadcastCrossTabMidiEvent("midi-clock-start");
  }

  scheduleNextMasterClockPulse();
  emitMidiStateChange("midi-clock-state-updated");
  return true;
}

export function stopMidiClockOutput({ sendStopMessage = false } = {}) {
  const hadRunningClock = state.midi.clockMasterRunning;
  clearMasterClockTimer();
  state.midi.clockMasterRunning = false;
  masterClockNextPulseAtMs = 0;

  if (sendStopMessage) {
    if (selectedOutputPort) {
      sendOutputMessage([0xfc]);
    }
    broadcastCrossTabMidiEvent("midi-clock-stop");
  }

  if (hadRunningClock || sendStopMessage) {
    emitMidiStateChange("midi-clock-state-updated");
  }
  return hadRunningClock;
}

export function syncMidiClockOutputState({ sendStartMessage = false, sendStopMessage = false } = {}) {
  if (state.midi.clockMode === "master" && state.transportState === "playing" && state.playingPresetIds.size > 0) {
    return startMidiClockOutput({ sendStartMessage });
  }

  stopMidiClockOutput({ sendStopMessage });
  return false;
}

export function resyncMidiClockTempo() {
  if (!state.midi.clockMasterRunning) {
    return false;
  }

  return startMidiClockOutput({ sendStartMessage: false });
}

function getOutputTimestampFromAudioTime(audioTimeSeconds) {
  const audioContext = state.audioContext;
  if (!audioContext || !Number.isFinite(audioTimeSeconds)) {
    return nowMs();
  }

  return nowMs() + Math.max(0, (audioTimeSeconds - audioContext.currentTime) * 1000);
}

export function sendMidiNoteForPreset(
  presetId,
  noteNumber,
  {
    timeSeconds = state.audioContext?.currentTime,
    durationSeconds = 0.2,
    velocity = MIDI_VELOCITY_MAX,
  } = {},
) {
  if (shouldSuppressLocalMidiNoteOutput()) {
    return false;
  }

  const channelSettings = state.midi.channelSettingsByPresetId[presetId];
  if (!channelSettings || !Number(channelSettings.sendEnabled)) {
    return false;
  }

  const normalizedNoteNumber = Math.max(0, Math.min(127, Math.round(noteNumber)));
  const midiChannel = clampMidiChannel(channelSettings.midiChannel);
  const normalizedVelocity = clampMidiVelocity(velocity, 96);
  const noteOnStatus = 0x90 + (midiChannel - 1);
  const noteOffStatus = 0x80 + (midiChannel - 1);
  const startTimestampMs = getOutputTimestampFromAudioTime(timeSeconds);
  const endTimestampMs = getOutputTimestampFromAudioTime(timeSeconds + Math.max(0.03, durationSeconds));
  const noteOnBytes = [noteOnStatus, normalizedNoteNumber, normalizedVelocity];
  const noteOffBytes = [noteOffStatus, normalizedNoteNumber, 0];
  const relayPayload = buildCrossTabMidiNoteOutputPayload({
    presetId,
    noteOnBytes,
    noteOffBytes,
    startTimestampMs,
    endTimestampMs,
  });

  const sentNoteOn = sendOutputMessage(noteOnBytes, startTimestampMs, {
    presetId,
    scheduledBy: "sendMidiNoteForPreset",
  });
  const sentNoteOff = sendOutputMessage(noteOffBytes, endTimestampMs, {
    presetId,
    scheduledBy: "sendMidiNoteForPreset",
  });
  const relayedNoteOutput = broadcastCrossTabMidiEvent("midi-note-output", relayPayload);
  return sentNoteOn || sentNoteOff || relayedNoteOutput;
}

export function isValidMidiClockMode(mode) {
  return MIDI_CLOCK_MODE_OPTIONS.includes(mode);
}

