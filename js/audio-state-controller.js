import {
  ARPEGGIO_HISTORY_LIMIT,
  ARPEGGIO_OCTAVE_OPTIONS,
  CLEAN_DELAY_REPETITIONS_MAX,
  CLEAN_DELAY_REPETITIONS_MIN,
  clampLfoRateHz,
  controlConfig,
  extractOctave,
  getCircleOfFifthsKeyLabel,
  getPitchClassesForMajorKey,
  DEAD_NOTE_PAUSE_COUNT_MAX,
  DEAD_NOTE_PAUSE_COUNT_MIN,
  DELAY_FEEDBACK_MAX,
  DELAY_DIVISION_OPTIONS,
  DISTORTION_FEEDBACK_MAX,
  GLOBAL_CONTROL_KEYS,
  INITIAL_SYNTH_PARAMS,
  LFO_TARGET_OPTIONS,
  NOTE_LENGTH_OPTIONS,
  NOTE_OPTIONS,
  normalizeCircleOfFifthsKeyIndex,
  PITCH_CLASS_OPTIONS,
  POST_FILTER_TYPE_OPTIONS,
  STARTUP_DELAY_FEEDBACK_MAX,
  TAPE_DELAY_SEND_MAX,
} from "./constants.js";
import {
  applyLiveAudioUpdates,
  applyLiveChannelLevelUpdates,
  ensureAudioContext,
  pauseAllPlayback,
  resetTransportTimeline,
  scheduleCurrentTransportStep,
  syncDelayTimeToTempo,
  startSchedulerLoop,
  startGlobalPlaybackFromBeginning,
  startPresetPlayback,
  stopSchedulerLoop,
  stopAllPlayback,
  stopPresetPlayback,
  triggerImmediateMidiNote,
} from "./audio-engine.js";
import {
  clampMidiChannel,
  MIDI_CHANNEL_MAX,
  MIDI_CHANNEL_MIN,
} from "./constants.js";
import {
  broadcastCrossTabTransportStart,
  broadcastCrossTabTransportStop,
  initializeMidi as initializeMidiRuntime,
  isValidMidiClockMode,
  refreshMidiPorts as refreshMidiPortSnapshots,
  resyncMidiClockTempo,
  startMidiClockOutput,
  setMidiInputPort as applyMidiInputPortSelection,
  setMidiOutputPort as applyMidiOutputPortSelection,
  syncMidiClockOutputState,
} from "./midi-engine.js";
import {
  createInstrumentNoteVariation,
  ensureInstrumentNoteState,
  getEnabledArpeggioPitchClasses,
  getEnabledArpeggioOctaves,
  getEligibleRandomNotePoolFromPitchClasses,
  getSelectedInstrumentNoteIds,
  regenerateInstrumentRandomNoteIds,
  rebuildInstrumentPattern,
  transposeInstrumentArpeggioPitchClassesByKeyStep,
} from "./patterns.js";
import {
  applyAssignedPresetToChannel,
  getAvailablePresetIds,
  getAssignedPresetId,
  getInstrumentParams,
  getPresetIds,
} from "./presets.js";
import {
  decodeStateSeedString,
  encodeStateSeedSnapshot,
  STATE_SEED_CHANNEL_PARAM_KEYS,
  STATE_SEED_GLOBAL_PARAM_KEYS,
  STATE_SEED_VERSION,
} from "./state-seed.js";
import { state } from "./state.js";

const validControlIds = new Set(Object.keys(controlConfig));
const validChannelIds = new Set(getPresetIds());
const validAssignablePresetIds = new Set(getAvailablePresetIds());
const validNoteIds = new Set(NOTE_OPTIONS.map(({ id }) => id));
const validNoteLengths = new Set(NOTE_LENGTH_OPTIONS);
const validDelayDivisionIndices = new Set(DELAY_DIVISION_OPTIONS.map((_, index) => index));
const validToggleValues = new Set([0, 1]);
const validLfoTargetIndices = new Set(LFO_TARGET_OPTIONS.map((_, index) => index));
const validPitchClassKeys = new Set(PITCH_CLASS_OPTIONS.map(({ key }) => key));
const validPostFilterTypes = new Set(POST_FILTER_TYPE_OPTIONS);
const validArpeggioOctaves = new Set(ARPEGGIO_OCTAVE_OPTIONS);
const noteIdOrderIndexMap = new Map(NOTE_OPTIONS.map(({ id }, index) => [id, index]));
const validOscillatorTypes = new Set(["sine", "square", "sawtooth", "triangle"]);

function ensureMidiChannelSettings(presetId) {
  if (!state.midi.channelSettingsByPresetId[presetId]) {
    const presetIds = getPresetIds();
    const fallbackChannel = clampMidiChannel(presetIds.indexOf(presetId) + 1 || MIDI_CHANNEL_MIN);
    state.midi.channelSettingsByPresetId[presetId] = {
      midiChannel: fallbackChannel,
      sendEnabled: 1,
      receiveEnabled: 1,
    };
  }

  return state.midi.channelSettingsByPresetId[presetId];
}

function shuffle(values) {
  const clone = values.slice();
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }
  return clone;
}

function getRandomCount(minimum, maximum) {
  const safeMinimum = Math.max(0, Math.floor(minimum));
  const safeMaximum = Math.max(safeMinimum, Math.floor(maximum));
  return safeMinimum + Math.floor(Math.random() * (safeMaximum - safeMinimum + 1));
}

function getRandomBoolean(trueProbability = 0.5) {
  return Math.random() < trueProbability ? 1 : 0;
}

function getRandomRoundedValue(minimum, maximum, precision = 0.001) {
  const safeMinimum = Math.min(minimum, maximum);
  const safeMaximum = Math.max(minimum, maximum);
  const rawValue = safeMinimum + Math.random() * (safeMaximum - safeMinimum);
  const step = precision > 0 ? precision : 0.001;
  return Math.round(rawValue / step) * step;
}

function getRandomPitchClassSelection(keyPitchClasses) {
  const safePitchClasses = Array.from(new Set(keyPitchClasses.filter((pitchClassKey) => validPitchClassKeys.has(pitchClassKey))));
  if (safePitchClasses.length === 0) {
    return PITCH_CLASS_OPTIONS.slice(0, 1).map(({ key }) => key);
  }

  const minimumCount = Math.min(3, safePitchClasses.length);
  const maximumCount = Math.min(5, safePitchClasses.length);
  const selectedPitchClassSet = new Set(
    shuffle(safePitchClasses).slice(0, getRandomCount(minimumCount, maximumCount)),
  );

  return safePitchClasses.filter((pitchClassKey) => selectedPitchClassSet.has(pitchClassKey));
}

function getRandomAssignedPresetIds(channelCount) {
  const availablePresetIds = getAvailablePresetIds();
  if (availablePresetIds.length === 0) {
    return [];
  }

  const shuffledPresetIds = shuffle(availablePresetIds);
  return Array.from({ length: channelCount }, (_, index) => shuffledPresetIds[index % shuffledPresetIds.length]);
}

function getSafeEnabledOctaves(presetId) {
  const enabledOctaves = getEnabledArpeggioOctaves(presetId);
  if (enabledOctaves.length > 0) {
    return enabledOctaves;
  }

  state.instrumentArpeggioOctavesByPresetId[presetId] = ARPEGGIO_OCTAVE_OPTIONS.slice();
  return state.instrumentArpeggioOctavesByPresetId[presetId].slice();
}

function randomizeStartupState() {
  const channelIds = getPresetIds();
  state.globalArpeggioKeyIndex = Math.floor(Math.random() * PITCH_CLASS_OPTIONS.length);
  state.synthParams.delayDivision = getRandomCount(0, DELAY_DIVISION_OPTIONS.length - 1);
  state.synthParams.cleanDelayDivision = getRandomCount(0, DELAY_DIVISION_OPTIONS.length - 1);
  state.synthParams.delayFeedback = getRandomRoundedValue(0.01, STARTUP_DELAY_FEEDBACK_MAX, 0.001);
  state.synthParams.cleanDelayRepetitions = getRandomCount(
    CLEAN_DELAY_REPETITIONS_MIN,
    CLEAN_DELAY_REPETITIONS_MAX,
  );
  syncDelayTimeToTempo();

  const assignedPresetIds = getRandomAssignedPresetIds(channelIds.length);
  const keyPitchClasses = getPitchClassesForMajorKey(state.globalArpeggioKeyIndex);

  channelIds.forEach((channelId, index) => {
    const assignedPresetId = assignedPresetIds[index] || channelId;
    applyAssignedPresetToChannel(channelId, assignedPresetId);
    ensureInstrumentNoteState(channelId);
    const instrumentParams = getInstrumentParams(channelId);
    instrumentParams.deadNoteAtEnd = getRandomBoolean(0.45);
    instrumentParams.endPauseCount = getRandomCount(1, Math.min(6, DEAD_NOTE_PAUSE_COUNT_MAX));

    const enabledOctaves = getSafeEnabledOctaves(channelId);
    const enabledPitchClasses = getRandomPitchClassSelection(keyPitchClasses);
    state.instrumentArpeggioPitchClassesByPresetId[channelId] = enabledPitchClasses;

    const eligibleNotePool = getEligibleRandomNotePoolFromPitchClasses(enabledPitchClasses, enabledOctaves);
    const desiredNoteCount = eligibleNotePool.length <= 1
      ? Math.max(1, eligibleNotePool.length)
      : getRandomCount(2, Math.min(5, eligibleNotePool.length));

    regenerateInstrumentRandomNoteIds(channelId, desiredNoteCount);
    rebuildInstrumentPattern(channelId);
  });
}

function toNumber(value) {
  const numeric = Number.parseFloat(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function clampNumber(value, minimum, maximum, fallback) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, numeric));
}

function sanitizeToggleValue(value, fallback = 0) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return fallback;
  }

  return numeric >= 0.5 ? 1 : 0;
}

function sanitizeSeedGlobalParamValue(key, value, fallback) {
  switch (key) {
    case "tempoBpm":
      return clampNumber(value, 60, 220, fallback);
    case "globalTimbre":
      return clampNumber(value, -1, 1, fallback);
    case "lfoTarget": {
      const numeric = toNumber(value);
      return numeric === null ? fallback : Math.max(0, Math.min(LFO_TARGET_OPTIONS.length - 1, Math.round(numeric)));
    }
    case "lfoRate":
      return clampLfoRateHz(toNumber(value) ?? fallback);
    case "lfoDepth":
    case "reverbMix":
    case "masterVolume":
      return clampNumber(value, 0, 1, fallback);
    case "tapeDelayEnabled":
    case "cleanDelayEnabled":
      return sanitizeToggleValue(value, fallback);
    case "delayDivision":
    case "cleanDelayDivision": {
      const numeric = toNumber(value);
      return numeric === null ? fallback : Math.max(0, Math.min(DELAY_DIVISION_OPTIONS.length - 1, Math.round(numeric)));
    }
    case "delayFeedback":
      return clampNumber(value, 0, DELAY_FEEDBACK_MAX, fallback);
    case "cleanDelayRepetitions": {
      const numeric = toNumber(value);
      return numeric === null
        ? fallback
        : Math.max(CLEAN_DELAY_REPETITIONS_MIN, Math.min(CLEAN_DELAY_REPETITIONS_MAX, Math.round(numeric)));
    }
    default:
      return fallback;
  }
}

function sanitizeSeedChannelParamValue(key, value, fallback) {
  switch (key) {
    case "attack":
      return clampNumber(value, 0.001, 0.8, fallback);
    case "decay":
      return clampNumber(value, 0.01, 1.2, fallback);
    case "release":
      return clampNumber(value, 0.01, 0.8, fallback);
    case "filterCutoff":
      return clampNumber(value, 250, 8000, fallback);
    case "filterTracking":
      return clampNumber(value, 0, 2, fallback);
    case "filterQ":
      return clampNumber(value, 0.2, 12, fallback);
    case "detuneSpread":
      return clampNumber(value, 0, 20, fallback);
    case "subLevel":
    case "upperLevel":
      return clampNumber(value, 0, 1.3, fallback);
    case "stereoPan":
      return clampNumber(value, -1, 1, fallback);
    case "distortionDrive":
    case "distortionMix":
    case "reverbSend":
    case "cleanDelaySend":
    case "postFilterCutoff":
    case "postFilterMix":
    case "channelVolume":
      return clampNumber(value, 0, 1, fallback);
    case "distortionTone":
      return clampNumber(value, 20, 20000, fallback);
    case "distortionFeedback":
      return clampNumber(value, 0, DISTORTION_FEEDBACK_MAX, fallback);
    case "transientAmount":
      return clampNumber(value, 0, 0.7, fallback);
    case "transientDecay":
      return clampNumber(value, 0.005, 0.08, fallback);
    case "transientTone":
      return clampNumber(value, 300, 6000, fallback);
    case "pitchDropCents":
      return clampNumber(value, 0, 240, fallback);
    case "delaySend":
      return clampNumber(value, 0, TAPE_DELAY_SEND_MAX, fallback);
    case "deadNoteAtEnd":
    case "channelMuted":
      return sanitizeToggleValue(value, fallback);
    case "endPauseCount": {
      const numeric = toNumber(value);
      return numeric === null
        ? fallback
        : Math.max(DEAD_NOTE_PAUSE_COUNT_MIN, Math.min(DEAD_NOTE_PAUSE_COUNT_MAX, Math.round(numeric)));
    }
    case "noteLength": {
      const numeric = toNumber(value);
      if (numeric === null) {
        return fallback;
      }

      const rounded = Math.round(numeric);
      return validNoteLengths.has(rounded) ? rounded : fallback;
    }
    case "postFilterType": {
      const numeric = toNumber(value);
      if (numeric === null) {
        return fallback;
      }

      const rounded = Math.round(numeric);
      return validPostFilterTypes.has(rounded) ? rounded : fallback;
    }
    case "postFilterQ":
      return clampNumber(value, 0.1, 18, fallback);
    case "oscAWave":
    case "oscBWave":
    case "subWave":
      return typeof value === "string" && validOscillatorTypes.has(value) ? value : fallback;
    default:
      return toNumber(value) ?? fallback;
  }
}

function normalizeSeedPitchClasses(values, fallback) {
  const normalized = Array.isArray(values)
    ? Array.from(new Set(values.filter((pitchClassKey) => validPitchClassKeys.has(pitchClassKey))))
    : [];
  return normalized.length > 0 ? normalized : fallback.slice();
}

function normalizeSeedOctaves(values, fallback) {
  const normalized = Array.isArray(values)
    ? Array.from(new Set(values.filter((octave) => validArpeggioOctaves.has(Number.parseInt(octave, 10)))))
      .map((octave) => Number.parseInt(octave, 10))
      .sort((left, right) => left - right)
    : [];
  return normalized.length > 0 ? normalized : fallback.slice();
}

function normalizeSeedNoteIds(values, enabledOctaves, fallback, enabledPitchClasses) {
  const enabledOctaveSet = new Set(enabledOctaves);
  const filterNoteIds = (noteIds) => Array.from(new Set(
    Array.isArray(noteIds)
      ? noteIds.filter((noteId) => validNoteIds.has(noteId) && enabledOctaveSet.has(extractOctave(noteId)))
      : [],
  )).sort((left, right) => noteIdOrderIndexMap.get(left) - noteIdOrderIndexMap.get(right));

  const normalized = filterNoteIds(values);
  if (normalized.length > 0) {
    return normalized;
  }

  const fallbackNoteIds = filterNoteIds(fallback);
  if (fallbackNoteIds.length > 0) {
    return fallbackNoteIds;
  }

  const eligibleNotePool = getEligibleRandomNotePoolFromPitchClasses(enabledPitchClasses, enabledOctaves);
  return eligibleNotePool.length > 0 ? [eligibleNotePool[0]] : [NOTE_OPTIONS[0].id];
}

function captureArpeggioSnapshot() {
  const presetIds = getPresetIds();
  const channels = {};

  presetIds.forEach((presetId) => {
    ensureInstrumentNoteState(presetId);
    channels[presetId] = {
      enabledPitchClasses: getEnabledArpeggioPitchClasses(presetId),
      enabledOctaves: getEnabledArpeggioOctaves(presetId),
      noteIds: state.instrumentNoteIdsByPresetId[presetId]?.slice() || [],
    };
  });

  return {
    globalArpeggioKeyIndex: state.globalArpeggioKeyIndex,
    channels,
  };
}

function restoreArpeggioSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  state.globalArpeggioKeyIndex = normalizeCircleOfFifthsKeyIndex(snapshot.globalArpeggioKeyIndex);

  getPresetIds().forEach((presetId) => {
    const channelSnapshot = snapshot.channels?.[presetId];
    if (!channelSnapshot) {
      ensureInstrumentNoteState(presetId);
      return;
    }

    state.instrumentArpeggioPitchClassesByPresetId[presetId] = Array.isArray(channelSnapshot.enabledPitchClasses)
      ? channelSnapshot.enabledPitchClasses.slice()
      : getEnabledArpeggioPitchClasses(presetId);
    state.instrumentArpeggioOctavesByPresetId[presetId] = Array.isArray(channelSnapshot.enabledOctaves)
      ? channelSnapshot.enabledOctaves.slice().sort((left, right) => left - right)
      : getEnabledArpeggioOctaves(presetId);
    state.instrumentNoteIdsByPresetId[presetId] = Array.isArray(channelSnapshot.noteIds)
      ? channelSnapshot.noteIds.slice()
      : getSelectedInstrumentNoteIds(presetId);
    rebuildInstrumentPattern(presetId);
  });

  return true;
}

function areArpeggioSnapshotsEqual(left, right) {
  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function getArpeggioHistoryStepAvailability() {
  const storedSnapshotCount = state.arpeggioHistorySnapshots.length;
  const isLivePosition = storedSnapshotCount > 0 && state.arpeggioHistoryIndex === storedSnapshotCount - 1;
  const canStepPrev = storedSnapshotCount > 0 && state.arpeggioHistoryIndex > 0;
  const canStepNext = storedSnapshotCount > 0 && state.arpeggioHistoryIndex < storedSnapshotCount - 1;
  const historyLength = storedSnapshotCount;
  const historyPosition = historyLength === 0 ? 0 : state.arpeggioHistoryIndex + 1;

  return {
    snapshotCount: storedSnapshotCount,
    historyLength,
    historyPosition,
    index: isLivePosition ? storedSnapshotCount : state.arpeggioHistoryIndex,
    isLivePosition,
    canStepPrev,
    canStepNext,
  };
}

function applySeedSnapshotToState(seedSnapshot) {
  STATE_SEED_GLOBAL_PARAM_KEYS.forEach((key) => {
    const fallback = state.synthParams[key] ?? INITIAL_SYNTH_PARAMS[key];
    const nextValue = seedSnapshot.synthParams?.[key] === undefined
      ? fallback
      : sanitizeSeedGlobalParamValue(key, seedSnapshot.synthParams[key], fallback);
    state.synthParams[key] = nextValue;
  });

  state.globalArpeggioKeyIndex = normalizeCircleOfFifthsKeyIndex(
    seedSnapshot.globalArpeggioKeyIndex,
  );

  getPresetIds().forEach((channelId) => {
    const channelSeed = seedSnapshot.channels?.[channelId] || {};
    const assignedPresetId = validAssignablePresetIds.has(channelSeed.assignedPresetId)
      ? channelSeed.assignedPresetId
      : getAssignedPresetId(channelId);
    const instrumentParams = applyAssignedPresetToChannel(channelId, assignedPresetId);

    ensureInstrumentNoteState(channelId);

    STATE_SEED_CHANNEL_PARAM_KEYS.forEach((key) => {
      if (channelSeed.params?.[key] === undefined) {
        return;
      }

      instrumentParams[key] = sanitizeSeedChannelParamValue(key, channelSeed.params[key], instrumentParams[key]);
    });

    const fallbackPitchClasses = getEnabledArpeggioPitchClasses(channelId);
    const enabledPitchClasses = normalizeSeedPitchClasses(
      channelSeed.enabledPitchClasses,
      fallbackPitchClasses,
    );
    state.instrumentArpeggioPitchClassesByPresetId[channelId] = enabledPitchClasses;

    const fallbackOctaves = getEnabledArpeggioOctaves(channelId);
    const enabledOctaves = normalizeSeedOctaves(channelSeed.enabledOctaves, fallbackOctaves);
    state.instrumentArpeggioOctavesByPresetId[channelId] = enabledOctaves;

    const fallbackNoteIds = state.instrumentNoteIdsByPresetId[channelId]?.slice() || [];
    state.instrumentNoteIdsByPresetId[channelId] = normalizeSeedNoteIds(
      channelSeed.noteIds,
      enabledOctaves,
      fallbackNoteIds,
      enabledPitchClasses,
    );
    state.instrumentNoteLengthInitializedByPresetId[channelId] = true;
    rebuildInstrumentPattern(channelId);
    applyLiveChannelLevelUpdates(channelId, instrumentParams);
  });

  if (validChannelIds.has(seedSnapshot.activeInstrumentPresetId)) {
    state.activeInstrumentPresetId = seedSnapshot.activeInstrumentPresetId;
  }

  STATE_SEED_GLOBAL_PARAM_KEYS.forEach((key) => {
    applyLiveAudioUpdates(key, state.synthParams[key]);
  });

  state.arpeggioHistorySnapshots = [];
  state.arpeggioHistoryIndex = 0;
  state.startupRandomizationApplied = true;
  state.currentStateSeed = encodeStateSeedSnapshot();
}

function getExternalMidiTempoBpm(timestampMs) {
  const previousTimestamp = state.midi.lastExternalClockTimestampMs;
  state.midi.lastExternalClockTimestampMs = timestampMs;

  if (!Number.isFinite(previousTimestamp) || previousTimestamp <= 0) {
    return null;
  }

  const intervalMs = timestampMs - previousTimestamp;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || intervalMs > 250) {
    return null;
  }

  return 60000 / (intervalMs * 24);
}

export class AudioStateController extends EventTarget {
  emitTransportStateChange(type = "transport-state-updated", detail = {}) {
    this.emitStateChange(type, {
      transportState: state.transportState,
      playingPresetCount: state.playingPresetIds.size,
      playingPresetIds: Array.from(state.playingPresetIds),
      ...detail,
    });
  }

  storeCurrentArpeggioSnapshot() {
    const currentSnapshot = captureArpeggioSnapshot();
    const snapshotCount = state.arpeggioHistorySnapshots.length;
    const isBrowsingOlderHistory = snapshotCount > 0 && state.arpeggioHistoryIndex < snapshotCount - 1;

    if (isBrowsingOlderHistory) {
      state.arpeggioHistorySnapshots = state.arpeggioHistorySnapshots.slice(0, state.arpeggioHistoryIndex + 1);
    }

    const lastSnapshot = state.arpeggioHistorySnapshots.at(-1);
    if (!areArpeggioSnapshotsEqual(lastSnapshot, currentSnapshot)) {
      state.arpeggioHistorySnapshots.push(currentSnapshot);
    }

    if (state.arpeggioHistorySnapshots.length > ARPEGGIO_HISTORY_LIMIT) {
      state.arpeggioHistorySnapshots = state.arpeggioHistorySnapshots.slice(-ARPEGGIO_HISTORY_LIMIT);
    }

    state.arpeggioHistoryIndex = state.arpeggioHistorySnapshots.length === 0
      ? 0
      : state.arpeggioHistorySnapshots.length - 1;

    return getArpeggioHistoryStepAvailability();
  }

  initialize({ seed = "" } = {}) {
    state.activePresetIds.forEach((presetId) => {
      getInstrumentParams(presetId);
      ensureInstrumentNoteState(presetId);
    });

    const startupSeed = `${seed ?? ""}`.trim();
    const loadedSeed = startupSeed ? this.loadStateSeed(startupSeed) : false;

    if (!loadedSeed && !state.startupRandomizationApplied) {
      randomizeStartupState();
      state.startupRandomizationApplied = true;
      state.currentStateSeed = "";
    }

    state.midi.remoteNoteOutputActive = false;

    this.emitStateChange("initialized", {
      activeInstrumentPresetId: state.activeInstrumentPresetId,
      seedLoaded: loadedSeed,
      seed: state.currentStateSeed,
    });

    return {
      initialized: true,
      seedLoaded: loadedSeed,
    };
  }

  async initializeMidi() {
    return initializeMidiRuntime(this);
  }

  refreshMidiPorts() {
    const refreshed = refreshMidiPortSnapshots();
    this.emitAction("midi-ports-refreshed", {
      inputPortId: state.midi.inputPortId,
      outputPortId: state.midi.outputPortId,
    });
    return refreshed;
  }

  setMidiInputPort(portId) {
    const changed = applyMidiInputPortSelection(`${portId ?? ""}`);
    if (!changed) {
      this.emitError(`Unknown MIDI input port: ${portId}`, { portId });
      return false;
    }

    this.emitAction("midi-input-port-updated", {
      inputPortId: state.midi.inputPortId,
    });
    return true;
  }

  setMidiOutputPort(portId) {
    const changed = applyMidiOutputPortSelection(`${portId ?? ""}`);
    if (!changed) {
      this.emitError(`Unknown MIDI output port: ${portId}`, { portId });
      return false;
    }

    syncMidiClockOutputState();
    this.emitAction("midi-output-port-updated", {
      outputPortId: state.midi.outputPortId,
    });
    return true;
  }

  setMidiClockMode(mode) {
    const normalizedMode = `${mode ?? "off"}`.trim().toLowerCase();
    if (!isValidMidiClockMode(normalizedMode)) {
      this.emitError(`Unknown MIDI clock mode: ${mode}`, { mode });
      return false;
    }

    const previousMode = state.midi.clockMode;
    if (previousMode === normalizedMode) {
      return true;
    }

    state.midi.clockMode = normalizedMode;
    state.midi.externalClockPulseCount = 0;
    state.midi.lastExternalClockTimestampMs = 0;
    state.midi.remoteNoteOutputActive = false;

    if (normalizedMode === "slave") {
      stopSchedulerLoop();
      state.transportState = "stopped";
      state.midi.awaitingExternalClockStart = state.playingPresetIds.size > 0;
      resetTransportTimeline();
    } else {
      state.midi.awaitingExternalClockStart = false;
    }

    syncMidiClockOutputState({ sendStopMessage: previousMode === "master" && normalizedMode !== "master" });

    this.emitAction("midi-clock-mode-updated", {
      mode: normalizedMode,
      previousMode,
    });
    this.emitStateChange("midi-settings-updated", {
      clockMode: normalizedMode,
      previousMode,
    });
    this.emitTransportStateChange("transport-state-updated", {
      source: "midi-clock-mode",
    });
    return true;
  }

  setChannelMidiChannel(presetId, midiChannel) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const normalizedChannel = clampMidiChannel(midiChannel, 0);
    if (normalizedChannel < MIDI_CHANNEL_MIN || normalizedChannel > MIDI_CHANNEL_MAX) {
      this.emitError(`MIDI channel must stay between ${MIDI_CHANNEL_MIN} and ${MIDI_CHANNEL_MAX}`, {
        presetId,
        midiChannel,
      });
      return false;
    }

    const channelSettings = ensureMidiChannelSettings(presetId);
    channelSettings.midiChannel = normalizedChannel;

    this.emitAction("channel-midi-updated", {
      presetId,
      midiChannel: normalizedChannel,
      sendEnabled: channelSettings.sendEnabled,
      receiveEnabled: channelSettings.receiveEnabled,
    });
    this.emitStateChange("channel-midi-updated", {
      presetId,
      midiChannel: normalizedChannel,
      sendEnabled: channelSettings.sendEnabled,
      receiveEnabled: channelSettings.receiveEnabled,
    });
    return true;
  }

  toggleChannelMidiSend(presetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const channelSettings = ensureMidiChannelSettings(presetId);
    channelSettings.sendEnabled = channelSettings.sendEnabled ? 0 : 1;

    this.emitAction("channel-midi-updated", {
      presetId,
      midiChannel: channelSettings.midiChannel,
      sendEnabled: channelSettings.sendEnabled,
      receiveEnabled: channelSettings.receiveEnabled,
    });
    this.emitStateChange("channel-midi-updated", {
      presetId,
      midiChannel: channelSettings.midiChannel,
      sendEnabled: channelSettings.sendEnabled,
      receiveEnabled: channelSettings.receiveEnabled,
    });
    return true;
  }

  toggleChannelMidiReceive(presetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const channelSettings = ensureMidiChannelSettings(presetId);
    channelSettings.receiveEnabled = channelSettings.receiveEnabled ? 0 : 1;

    this.emitAction("channel-midi-updated", {
      presetId,
      midiChannel: channelSettings.midiChannel,
      sendEnabled: channelSettings.sendEnabled,
      receiveEnabled: channelSettings.receiveEnabled,
    });
    this.emitStateChange("channel-midi-updated", {
      presetId,
      midiChannel: channelSettings.midiChannel,
      sendEnabled: channelSettings.sendEnabled,
      receiveEnabled: channelSettings.receiveEnabled,
    });
    return true;
  }

  async handleIncomingMidiClockStart({ source = "hardware" } = {}) {
    if (source === "hardware" && state.midi.clockMode !== "slave") {
      return false;
    }

    try {
      await ensureAudioContext();
      stopSchedulerLoop();
      if (state.playingPresetIds.size === 0) {
        getPresetIds().forEach((presetId) => state.playingPresetIds.add(presetId));
      }
      state.transportState = "playing";
      state.midi.awaitingExternalClockStart = false;
      state.midi.externalClockPulseCount = 0;
      state.midi.remoteNoteOutputActive = source === "cross-tab";
      resetTransportTimeline(0.005);
      scheduleCurrentTransportStep(state.audioContext.currentTime + 0.005);

        this.emitAction("midi-clock-started", {
          source,
        presetIds: Array.from(state.playingPresetIds),
      });
      this.emitTransportStateChange("transport-state-updated", {
          source: source === "cross-tab" ? "cross-tab-midi-clock" : "external-midi-clock",
      });
      return true;
    } catch (error) {
      this.emitError("Unable to start external MIDI clock sync", { error });
      return false;
    }
  }

  async handleIncomingMidiClockContinue({ source = "hardware" } = {}) {
    if (source === "hardware" && state.midi.clockMode !== "slave") {
      return false;
    }

    try {
      await ensureAudioContext();
      stopSchedulerLoop();
      if (state.playingPresetIds.size === 0) {
        getPresetIds().forEach((presetId) => state.playingPresetIds.add(presetId));
      }
      state.transportState = "playing";
      state.midi.awaitingExternalClockStart = false;
      state.midi.remoteNoteOutputActive = source === "cross-tab";

      this.emitTransportStateChange("transport-state-updated", {
        source: source === "cross-tab" ? "cross-tab-midi-clock" : "external-midi-clock",
        continued: true,
      });
      return true;
    } catch (error) {
      this.emitError("Unable to continue external MIDI clock sync", { error });
      return false;
    }
  }

  handleIncomingMidiClockStop({ source = "hardware" } = {}) {
    if (source === "hardware" && state.midi.clockMode !== "slave") {
      return false;
    }

    stopSchedulerLoop();
    state.transportState = "stopped";
    state.midi.awaitingExternalClockStart = state.playingPresetIds.size > 0;
    state.midi.externalClockPulseCount = 0;
    state.midi.lastExternalClockTimestampMs = 0;
    state.midi.remoteNoteOutputActive = false;
    resetTransportTimeline();

    this.emitAction("midi-clock-stopped", {
      source,
      presetIds: Array.from(state.playingPresetIds),
    });
    this.emitTransportStateChange("transport-state-updated", {
      source: source === "cross-tab" ? "cross-tab-midi-clock" : "external-midi-clock",
      stoppedByExternalClock: true,
    });
    return true;
  }

  handleIncomingMidiClockPulse(timestampMs = globalThis.performance?.now?.() ?? Date.now(), { source = "hardware" } = {}) {
    if (source === "hardware" && state.midi.clockMode !== "slave") {
      return false;
    }

    const nextTempoBpm = getExternalMidiTempoBpm(timestampMs);
    if (Number.isFinite(nextTempoBpm)) {
      const previousTempoBpm = state.synthParams.tempoBpm;
      const smoothedTempoBpm = previousTempoBpm
        ? (previousTempoBpm * 0.75) + (nextTempoBpm * 0.25)
        : nextTempoBpm;
      const roundedTempoBpm = Math.max(20, Math.min(300, smoothedTempoBpm));
      state.synthParams.tempoBpm = roundedTempoBpm;
      state.midi.externalClockTempoBpm = roundedTempoBpm;
      syncDelayTimeToTempo();

      if (Math.abs((previousTempoBpm ?? 0) - roundedTempoBpm) >= 0.25) {
        this.emitStateChange("midi-clock-tempo-updated", {
          value: roundedTempoBpm,
        });
      }
    }

    if (state.transportState !== "playing") {
      return true;
    }

    state.midi.externalClockPulseCount += 1;
    if (state.midi.externalClockPulseCount % 2 === 0 && state.audioContext) {
      scheduleCurrentTransportStep(state.audioContext.currentTime + 0.005);
    }
    return true;
  }

  async handleIncomingMidiNoteMessage({ type, midiChannel, noteNumber, velocity = 0 }, { source = "hardware" } = {}) {
    if (type !== "noteon") {
      return false;
    }

    const targetPresetIds = getPresetIds().filter((presetId) => {
      const channelSettings = ensureMidiChannelSettings(presetId);
      return Number(channelSettings.receiveEnabled) && clampMidiChannel(channelSettings.midiChannel) === midiChannel;
    });

    if (targetPresetIds.length === 0) {
      return false;
    }

    try {
      await ensureAudioContext();
      targetPresetIds.forEach((presetId) => {
        triggerImmediateMidiNote(presetId, noteNumber, velocity);
      });

      this.emitAction("midi-note-received", {
        source,
        midiChannel,
        noteNumber,
        velocity,
        presetIds: targetPresetIds,
      });
      this.emitStateChange("midi-note-received", {
        source,
        midiChannel,
        noteNumber,
        velocity,
        presetIds: targetPresetIds,
      });
      return true;
    } catch (error) {
      this.emitError("Unable to handle incoming MIDI note", {
        error,
        midiChannel,
        noteNumber,
      });
      return false;
    }
  }

  getStateSeed() {
    state.currentStateSeed = encodeStateSeedSnapshot();

    this.emitAction("state-seed-generated", {
      seed: state.currentStateSeed,
      version: STATE_SEED_VERSION,
    });
    this.emitStateChange("seed-generated", {
      seed: state.currentStateSeed,
      version: STATE_SEED_VERSION,
    });

    return state.currentStateSeed;
  }

  clearStateSeed() {
    state.currentStateSeed = "";

    this.emitAction("state-seed-cleared", {
      seed: state.currentStateSeed,
      version: STATE_SEED_VERSION,
    });
    this.emitStateChange("seed-cleared", {
      seed: state.currentStateSeed,
      version: STATE_SEED_VERSION,
    });

    return true;
  }

  loadStateSeed(seed) {
    let seedSnapshot;
    try {
      seedSnapshot = decodeStateSeedString(seed);
    } catch (error) {
      this.emitError("Invalid state seed", { seed, error });
      return false;
    }

    if (!seedSnapshot || typeof seedSnapshot !== "object") {
      this.emitError("Invalid state seed", { seed });
      return false;
    }

    if (seedSnapshot.v !== STATE_SEED_VERSION) {
      this.emitError(`Unsupported state seed version: ${seedSnapshot.v ?? "unknown"}`, {
        seed,
        version: seedSnapshot.v,
      });
      return false;
    }

    applySeedSnapshotToState(seedSnapshot);

    this.emitAction("state-seed-loaded", {
      seed: state.currentStateSeed,
      version: STATE_SEED_VERSION,
    });
    this.emitStateChange("seed-loaded", {
      seed: state.currentStateSeed,
      version: STATE_SEED_VERSION,
      activeInstrumentPresetId: state.activeInstrumentPresetId,
    });

    return true;
  }

  selectInstrument(presetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    state.activeInstrumentPresetId = presetId;
    ensureInstrumentNoteState(presetId);

    this.emitAction("instrument-selected", { presetId });
    this.emitStateChange("instrument-selected", {
      presetId,
      activeInstrumentPresetId: state.activeInstrumentPresetId,
    });
    return true;
  }

  setChannelInstrument(channelId, assignedPresetId) {
    if (!validChannelIds.has(channelId)) {
      this.emitError(`Unknown preset id: ${channelId}`, { presetId: channelId });
      return false;
    }

    if (!validAssignablePresetIds.has(assignedPresetId)) {
      this.emitError(`Unknown preset id: ${assignedPresetId}`, { presetId: assignedPresetId, channelId });
      return false;
    }

    const previousAssignedPresetId = getAssignedPresetId(channelId);
    if (previousAssignedPresetId === assignedPresetId) {
      return true;
    }

    const instrumentParams = applyAssignedPresetToChannel(channelId, assignedPresetId);
    rebuildInstrumentPattern(channelId);

    this.emitAction("channel-instrument-updated", {
      presetId: channelId,
      assignedPresetId,
      previousAssignedPresetId,
    });
    this.emitStateChange("channel-instrument-updated", {
      presetId: channelId,
      assignedPresetId,
      previousAssignedPresetId,
      noteLength: instrumentParams.noteLength,
      channelVolume: instrumentParams.channelVolume,
    });
    return true;
  }

  setControlValue(controlId, value) {
    if (!validControlIds.has(controlId)) {
      this.emitError(`Unknown control id: ${controlId}`, { controlId });
      return false;
    }

    const numericValue = toNumber(value);
    if (numericValue === null) {
      this.emitError(`Invalid control value for ${controlId}`, { controlId, value });
      return false;
    }

    if (controlId === "note-length-toggle" && !validNoteLengths.has(numericValue)) {
      this.emitError(`Invalid note length value for ${controlId}`, { controlId, value });
      return false;
    }

    if ((controlId === "delay-time" || controlId === "clean-delay-time") && !validDelayDivisionIndices.has(numericValue)) {
      this.emitError(`Invalid delay division value for ${controlId}`, { controlId, value });
      return false;
    }

    if (controlId === "clean-delay-repetitions") {
      const isValidRepetitionCount = Number.isInteger(numericValue)
        && numericValue >= CLEAN_DELAY_REPETITIONS_MIN
        && numericValue <= CLEAN_DELAY_REPETITIONS_MAX;

      if (!isValidRepetitionCount) {
        this.emitError(
          `Clean delay repetitions must stay between ${CLEAN_DELAY_REPETITIONS_MIN} and ${CLEAN_DELAY_REPETITIONS_MAX}`,
          { controlId, value },
        );
        return false;
      }
    }

    if ((controlId === "tape-delay-enabled" || controlId === "clean-delay-enabled")
      && !validToggleValues.has(numericValue)) {
      this.emitError(`Invalid toggle value for ${controlId}`, { controlId, value });
      return false;
    }

    if (controlId === "lfo-target" && !validLfoTargetIndices.has(numericValue)) {
      this.emitError(`Invalid LFO target value for ${controlId}`, { controlId, value });
      return false;
    }

    if (controlId === "delay-feedback"
      && (numericValue < 0 || numericValue > DELAY_FEEDBACK_MAX)) {
      this.emitError(`Delay feedback must stay between 0 and ${DELAY_FEEDBACK_MAX}`, {
        controlId,
        value,
      });
      return false;
    }

    if (controlId === "distortion-feedback" && (numericValue < 0 || numericValue > DISTORTION_FEEDBACK_MAX)) {
      this.emitError(`Distortion feedback must stay between 0 and ${DISTORTION_FEEDBACK_MAX}`, {
        controlId,
        value,
      });
      return false;
    }

    if (controlId === "delay-send" && (numericValue < 0 || numericValue > TAPE_DELAY_SEND_MAX)) {
      this.emitError(`Tape delay send must stay between 0 and ${TAPE_DELAY_SEND_MAX}`, {
        controlId,
        value,
      });
      return false;
    }

    if (controlId === "post-filter-type" && !validPostFilterTypes.has(numericValue)) {
      this.emitError(`Invalid post-filter type value for ${controlId}`, { controlId, value });
      return false;
    }

    const { key } = controlConfig[controlId];
    if (GLOBAL_CONTROL_KEYS.has(key)) {
      state.synthParams[key] = numericValue;
      if (key === "tempoBpm") {
        syncDelayTimeToTempo();
        resyncMidiClockTempo();
      }
      applyLiveAudioUpdates(key, numericValue);
    } else {
      const instrumentParams = getInstrumentParams(state.activeInstrumentPresetId);
      instrumentParams[key] = numericValue;
    }

    this.emitAction("control-updated", {
      controlId,
      key,
      value: numericValue,
      presetId: state.activeInstrumentPresetId,
    });
    this.emitStateChange("control-updated", {
      controlId,
      key,
      value: numericValue,
      presetId: state.activeInstrumentPresetId,
    });
    return true;
  }

  toggleNote(noteId) {
    if (!validNoteIds.has(noteId)) {
      this.emitError(`Unknown note id: ${noteId}`, { noteId });
      return false;
    }

    const presetId = state.activeInstrumentPresetId;
    ensureInstrumentNoteState(presetId);
    const noteOctave = extractOctave(noteId);
    const enabledOctaves = getEnabledArpeggioOctaves(presetId);
    if (!enabledOctaves.includes(noteOctave)) {
      this.emitError(`Enable octave ${noteOctave} before selecting notes in that row`, {
        presetId,
        noteId,
        octave: noteOctave,
      });
      return false;
    }

    const selectedNoteIds = state.instrumentNoteIdsByPresetId[presetId];

    const noteIndex = selectedNoteIds.indexOf(noteId);
    if (noteIndex === -1) {
      selectedNoteIds.push(noteId);
    } else if (selectedNoteIds.length > 1) {
      selectedNoteIds.splice(noteIndex, 1);
    } else {
      this.emitError("At least one note must stay active", { presetId, noteId });
      return false;
    }

    rebuildInstrumentPattern(presetId);

    this.emitAction("note-toggled", {
      presetId,
      noteId,
      activeNoteIds: selectedNoteIds.slice(),
    });
    this.emitStateChange("notes-updated", {
      presetId,
      activeNoteIds: selectedNoteIds.slice(),
    });
    return true;
  }

  toggleArpeggioOctaveRow(octave, presetId = state.activeInstrumentPresetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const numericOctave = Number.parseInt(octave, 10);
    if (!validArpeggioOctaves.has(numericOctave)) {
      this.emitError(`Unknown arpeggio octave row: ${octave}`, { presetId, octave });
      return false;
    }

    ensureInstrumentNoteState(presetId);
    const enabledOctaves = getEnabledArpeggioOctaves(presetId);
    const octaveIndex = enabledOctaves.indexOf(numericOctave);

    if (octaveIndex === -1) {
      enabledOctaves.push(numericOctave);
    } else {
      enabledOctaves.splice(octaveIndex, 1);
    }

    state.instrumentArpeggioOctavesByPresetId[presetId] = enabledOctaves.sort((left, right) => left - right);
    const activeNoteIds = getSelectedInstrumentNoteIds(presetId);
    rebuildInstrumentPattern(presetId);

    this.emitAction("arpeggio-octave-row-toggled", {
      presetId,
      octave: numericOctave,
      enabledOctaves: state.instrumentArpeggioOctavesByPresetId[presetId].slice(),
      activeNoteIds,
    });
    this.emitStateChange("arpeggio-octave-rows-updated", {
      presetId,
      octave: numericOctave,
      enabledOctaves: state.instrumentArpeggioOctavesByPresetId[presetId].slice(),
      activeNoteIds,
    });
    return true;
  }

  toggleArpeggioPitchClass(pitchClassKey, presetId = state.activeInstrumentPresetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    if (!validPitchClassKeys.has(pitchClassKey)) {
      this.emitError(`Unknown pitch class key: ${pitchClassKey}`, { pitchClassKey, presetId });
      return false;
    }

    ensureInstrumentNoteState(presetId);
    const enabledPitchClasses = getEnabledArpeggioPitchClasses(presetId);
    const pitchClassIndex = enabledPitchClasses.indexOf(pitchClassKey);

    if (pitchClassIndex === -1) {
      enabledPitchClasses.push(pitchClassKey);
    } else if (enabledPitchClasses.length > 1) {
      enabledPitchClasses.splice(pitchClassIndex, 1);
    } else {
      this.emitError("At least one settings note must stay enabled", { presetId, pitchClassKey });
      return false;
    }

    state.instrumentArpeggioPitchClassesByPresetId[presetId] = enabledPitchClasses;

    this.emitAction("arpeggio-settings-updated", {
      presetId,
      enabledPitchClasses: enabledPitchClasses.slice(),
    });
    this.emitStateChange("arpeggio-settings-updated", {
      presetId,
      enabledPitchClasses: enabledPitchClasses.slice(),
    });
    return true;
  }

  stepGlobalArpeggioKey(step) {
    const numericStep = Number.parseInt(step, 10);
    if (!Number.isInteger(numericStep) || numericStep === 0) {
      this.emitError("Arpeggio key step must be a non-zero integer", { step });
      return false;
    }

    const nextIndex = normalizeCircleOfFifthsKeyIndex(state.globalArpeggioKeyIndex + numericStep);
    state.globalArpeggioKeyIndex = nextIndex;

    this.emitAction("global-arpeggio-key-updated", {
      value: nextIndex,
      keyLabel: getCircleOfFifthsKeyLabel(nextIndex),
    });
    this.emitStateChange("global-arpeggio-key-updated", {
      value: nextIndex,
      keyLabel: getCircleOfFifthsKeyLabel(nextIndex),
    });
    return true;
  }

  stepArpeggioHistory(step) {
    const numericStep = Number.parseInt(step, 10);
    if (!Number.isInteger(numericStep) || numericStep === 0) {
      this.emitError("Arpeggio history step must be a non-zero integer", { step });
      return false;
    }

    const direction = numericStep > 0 ? 1 : -1;
    const snapshotCount = state.arpeggioHistorySnapshots.length;
    if (snapshotCount === 0) {
      this.emitError("No stored arpeggio presets available yet", { step: direction });
      return false;
    }

    if (direction < 0) {
      if (state.arpeggioHistoryIndex > 0) {
        state.arpeggioHistoryIndex -= 1;
      } else {
        this.emitError("Already at the oldest stored arpeggio preset", { step: direction });
        return false;
      }

      restoreArpeggioSnapshot(state.arpeggioHistorySnapshots[state.arpeggioHistoryIndex]);
    } else if (state.arpeggioHistoryIndex < snapshotCount - 1) {
      state.arpeggioHistoryIndex += 1;
      restoreArpeggioSnapshot(state.arpeggioHistorySnapshots[state.arpeggioHistoryIndex]);
    } else {
      this.emitError("Already at the newest arpeggio preset", { step: direction });
      return false;
    }

    const historyState = getArpeggioHistoryStepAvailability();
    this.emitAction("arpeggio-history-stepped", {
      step: direction,
      ...historyState,
    });
    this.emitStateChange("arpeggio-history-stepped", {
      step: direction,
      ...historyState,
    });
    return true;
  }

  applyActiveArpeggioSettingsToChannels(targetPresetIds = getPresetIds()) {
    if (!Array.isArray(targetPresetIds)) {
      this.emitError("Selected channels must be provided as an array", { targetPresetIds });
      return false;
    }

    const normalizedTargetPresetIds = Array.from(new Set(targetPresetIds));
    if (normalizedTargetPresetIds.length === 0) {
      this.emitError("Select at least one channel before applying arpeggio settings", { targetPresetIds });
      return false;
    }

    const invalidPresetId = normalizedTargetPresetIds.find((presetId) => !validChannelIds.has(presetId));
    if (invalidPresetId) {
      this.emitError(`Unknown preset id: ${invalidPresetId}`, { presetId: invalidPresetId, targetPresetIds });
      return false;
    }

    const sourcePresetId = state.activeInstrumentPresetId;
    ensureInstrumentNoteState(sourcePresetId);

    const sourcePitchClasses = getEnabledArpeggioPitchClasses(sourcePresetId);
    const instrumentNoteCounts = normalizedTargetPresetIds.map((presetId) => {
      ensureInstrumentNoteState(presetId);
      const enabledOctaves = getEnabledArpeggioOctaves(presetId);
      const eligibleNotePool = getEligibleRandomNotePoolFromPitchClasses(sourcePitchClasses, enabledOctaves);
      return {
        presetId,
        noteCount: getSelectedInstrumentNoteIds(presetId).length,
        eligibleNotePoolLength: eligibleNotePool.length,
      };
    });

    instrumentNoteCounts.forEach(({ presetId, noteCount, eligibleNotePoolLength }) => {
      state.instrumentArpeggioPitchClassesByPresetId[presetId] = sourcePitchClasses.slice();
      regenerateInstrumentRandomNoteIds(
        presetId,
        Math.min(noteCount, eligibleNotePoolLength),
      );
    });

    const historyState = this.storeCurrentArpeggioSnapshot();

    this.emitAction("arpeggio-settings-applied-to-all", {
      sourcePresetId,
      enabledPitchClasses: sourcePitchClasses.slice(),
      updatedPresetIds: normalizedTargetPresetIds,
      ...historyState,
    });
    this.emitStateChange("arpeggio-settings-applied", {
      sourcePresetId,
      enabledPitchClasses: sourcePitchClasses.slice(),
      updatedPresetIds: normalizedTargetPresetIds,
      ...historyState,
    });
    return true;
  }

  applyActiveArpeggioSettingsToAllInstruments() {
    return this.applyActiveArpeggioSettingsToChannels(getPresetIds());
  }

  toggleDeadNoteAtEnd(presetId = state.activeInstrumentPresetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    ensureInstrumentNoteState(presetId);
    const instrumentParams = getInstrumentParams(presetId);
    const nextValue = instrumentParams.deadNoteAtEnd ? 0 : 1;
    instrumentParams.deadNoteAtEnd = nextValue;
    rebuildInstrumentPattern(presetId);

    this.emitAction("dead-note-toggled", {
      presetId,
      value: nextValue,
    });
    this.emitStateChange("dead-note-updated", {
      presetId,
      value: nextValue,
    });
    return true;
  }

  setDeadNotePauseCount(value, presetId = state.activeInstrumentPresetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const numericValue = Number.parseInt(value, 10);
    const isValidCount = Number.isInteger(numericValue)
      && numericValue >= DEAD_NOTE_PAUSE_COUNT_MIN
      && numericValue <= DEAD_NOTE_PAUSE_COUNT_MAX;

    if (!isValidCount) {
      this.emitError(
        `End pause count must stay between ${DEAD_NOTE_PAUSE_COUNT_MIN} and ${DEAD_NOTE_PAUSE_COUNT_MAX}`,
        { presetId, value },
      );
      return false;
    }

    ensureInstrumentNoteState(presetId);
    const instrumentParams = getInstrumentParams(presetId);
    instrumentParams.endPauseCount = numericValue;
    rebuildInstrumentPattern(presetId);

    this.emitAction("dead-note-count-updated", {
      presetId,
      value: numericValue,
    });
    this.emitStateChange("dead-note-count-updated", {
      presetId,
      value: numericValue,
    });
    return true;
  }

  createNoteVariation(presetId = state.activeInstrumentPresetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const result = createInstrumentNoteVariation(presetId);
    if (!result.changed) {
      this.emitError("No eligible enabled settings notes available for variation", { presetId });
      return false;
    }

    this.emitAction("note-variation-created", {
      presetId,
      activeNoteIds: result.noteIds,
    });
    this.emitStateChange("notes-updated", {
      presetId,
      activeNoteIds: result.noteIds,
    });
    return true;
  }

  transposeArpeggioSettingsByKeyStep(step, presetId = state.activeInstrumentPresetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const numericStep = Number.parseInt(step, 10);
    if (!Number.isInteger(numericStep) || numericStep === 0) {
      this.emitError("Transpose step must be a non-zero integer", { step, presetId });
      return false;
    }

    const result = transposeInstrumentArpeggioPitchClassesByKeyStep(presetId, numericStep);
    if (result.reason) {
      this.emitError(result.reason, { presetId, step: numericStep });
      return false;
    }

    this.emitAction("arpeggio-settings-transposed", {
      presetId,
      step: numericStep,
      enabledPitchClasses: result.pitchClassKeys,
    });
    this.emitStateChange("arpeggio-settings-updated", {
      presetId,
      enabledPitchClasses: result.pitchClassKeys,
    });
    return true;
  }

  transposeActiveNotesByKeyStep(step, presetId = state.activeInstrumentPresetId) {
    return this.transposeArpeggioSettingsByKeyStep(step, presetId);
  }

  setChannelVolume(presetId, value) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    const instrumentParams = getInstrumentParams(presetId);
    instrumentParams.channelVolume = clamped;
    applyLiveChannelLevelUpdates(presetId, instrumentParams);

    this.emitStateChange("channel-volume-updated", { presetId, value: clamped });
    return true;
  }

  toggleChannelMute(presetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    const instrumentParams = getInstrumentParams(presetId);
    const nextValue = instrumentParams.channelMuted ? 0 : 1;
    instrumentParams.channelMuted = nextValue;
    applyLiveChannelLevelUpdates(presetId, instrumentParams);

    this.emitAction("channel-mute-toggled", {
      presetId,
      value: nextValue,
    });
    this.emitStateChange("channel-mute-updated", {
      presetId,
      value: nextValue,
    });
    return true;
  }

  async playAll({ source = "local" } = {}) {
    state.midi.remoteNoteOutputActive = source === "cross-tab";

    if (state.midi.clockMode === "slave") {
      try {
        await ensureAudioContext();
        stopSchedulerLoop();
        state.playingPresetIds.clear();
        getPresetIds().forEach((presetId) => state.playingPresetIds.add(presetId));
        state.transportState = "stopped";
        state.midi.awaitingExternalClockStart = true;
        state.midi.externalClockPulseCount = 0;
        state.midi.lastExternalClockTimestampMs = 0;
        resetTransportTimeline();

        this.emitAction("global-playback-armed", {
          presetIds: Array.from(state.playingPresetIds),
          awaitingExternalMidiClock: true,
        });
        this.emitTransportStateChange("transport-state-updated", {
          awaitingExternalMidiClock: true,
          source,
        });
        return true;
      } catch (error) {
        this.emitError("Unable to arm external MIDI clock playback", { error });
        return false;
      }
    }

    try {
      await stopAllPlayback();
      await ensureAudioContext();

      if (state.midi.clockMode === "master") {
        stopSchedulerLoop();
        state.playingPresetIds.clear();
        getPresetIds().forEach((presetId) => state.playingPresetIds.add(presetId));
        state.transportState = "playing";
        resetTransportTimeline();
        startMidiClockOutput({ sendStartMessage: source !== "cross-tab" });
        startSchedulerLoop();

        this.emitAction("global-playback-started", {
          presetIds: Array.from(state.playingPresetIds),
          source,
        });
        if (source !== "cross-tab") {
          broadcastCrossTabTransportStart({
            presetIds: Array.from(state.playingPresetIds),
          });
        }
        this.emitTransportStateChange("transport-state-updated", {
          restartedFromBeginning: true,
          source,
        });
        return true;
      }

      const result = startGlobalPlaybackFromBeginning(getPresetIds());
      if (!result.started) {
        this.emitError(result.reason, { presetIds: getPresetIds() });
        return false;
      }

      this.emitAction("global-playback-started", {
        presetIds: result.presetIds,
        source,
      });
      if (source !== "cross-tab") {
        broadcastCrossTabTransportStart({ presetIds: result.presetIds });
      }
      syncMidiClockOutputState({ sendStartMessage: source !== "cross-tab" });
      this.emitTransportStateChange("transport-state-updated", {
        restartedFromBeginning: true,
        source,
      });
      return true;
    } catch (error) {
      this.emitError("Unable to start global playback", { error });
      return false;
    }
  }

  pauseAll({ source = "local" } = {}) {
    const paused = pauseAllPlayback();
    if (!paused) {
      return false;
    }

    state.midi.remoteNoteOutputActive = false;

    this.emitAction("global-playback-paused", { source });
    syncMidiClockOutputState({ sendStopMessage: source !== "cross-tab" });
    this.emitTransportStateChange("transport-state-updated", { source });
    return true;
  }

  async stopAll({ source = "local" } = {}) {
    try {
      const stopped = await stopAllPlayback();
      if (!stopped) {
        return false;
      }

      state.midi.remoteNoteOutputActive = false;

      this.emitAction("global-playback-stopped", { source });
      if (source !== "cross-tab") {
        broadcastCrossTabTransportStop({});
      }
      syncMidiClockOutputState({ sendStopMessage: source !== "cross-tab" });
      this.emitTransportStateChange("transport-state-updated", { source });
      return true;
    } catch (error) {
      this.emitError("Unable to stop audio", { error });
      return false;
    }
  }

  async togglePlayback(presetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    if (state.midi.clockMode === "slave") {
      try {
        await ensureAudioContext();
        const isArmed = state.playingPresetIds.has(presetId);
        if (isArmed) {
          state.playingPresetIds.delete(presetId);
          if (state.playingPresetIds.size === 0) {
            state.transportState = "stopped";
            state.midi.awaitingExternalClockStart = false;
            resetTransportTimeline();
          }
        } else {
          state.playingPresetIds.add(presetId);
          if (state.transportState !== "playing") {
            state.transportState = "stopped";
            state.midi.awaitingExternalClockStart = true;
            resetTransportTimeline();
          }
        }

        this.emitAction(isArmed ? "playback-unarmed" : "playback-armed", {
          presetId,
          awaitingExternalMidiClock: state.midi.awaitingExternalClockStart,
        });
        this.emitStateChange("playback-toggled", {
          presetId,
          isPlaying: !isArmed,
        });
        this.emitTransportStateChange("transport-state-updated", {
          awaitingExternalMidiClock: state.midi.awaitingExternalClockStart,
        });
        return true;
      } catch (error) {
        this.emitError("Unable to arm channel for external MIDI clock", { presetId, error });
        return false;
      }
    }

    if (state.playingPresetIds.has(presetId)) {
      stopPresetPlayback(presetId);
      this.emitAction("playback-stopped", { presetId });
      syncMidiClockOutputState({ sendStopMessage: state.playingPresetIds.size === 0 });
      this.emitStateChange("playback-toggled", {
        presetId,
        isPlaying: false,
      });
      this.emitTransportStateChange();
      return true;
    }

    try {
      await ensureAudioContext();
      const result = startPresetPlayback(presetId);
      if (!result.started) {
        this.emitError(result.reason, { presetId });
        return false;
      }

      this.emitAction("playback-started", { presetId });
      syncMidiClockOutputState({ sendStartMessage: state.playingPresetIds.size === 1 });
      this.emitStateChange("playback-toggled", {
        presetId,
        isPlaying: true,
      });
      this.emitTransportStateChange();
      return true;
    } catch (error) {
      this.emitError("Unable to start audio", { presetId, error });
      return false;
    }
  }

  emitAction(type, detail) {
    this.dispatchEvent(new CustomEvent("action", {
      detail: {
        type,
        ...detail,
      },
    }));
  }

  emitStateChange(type, detail) {
    this.dispatchEvent(new CustomEvent("statechange", {
      detail: {
        type,
        ...detail,
      },
    }));
  }

  emitError(message, detail = {}) {
    this.dispatchEvent(new CustomEvent("error", {
      detail: {
        message,
        ...detail,
      },
    }));
  }
}

