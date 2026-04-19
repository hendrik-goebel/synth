import {
  ARPEGGIO_HISTORY_LIMIT,
  ARPEGGIO_OCTAVE_OPTIONS,
  CLEAN_DELAY_REPETITIONS_MAX,
  CLEAN_DELAY_REPETITIONS_MIN,
  controlConfig,
  extractOctave,
  getCircleOfFifthsKeyLabel,
  DEAD_NOTE_PAUSE_COUNT_MAX,
  DEAD_NOTE_PAUSE_COUNT_MIN,
  DELAY_FEEDBACK_MAX,
  DELAY_DIVISION_OPTIONS,
  DISTORTION_FEEDBACK_MAX,
  GLOBAL_CONTROL_KEYS,
  LFO_TARGET_OPTIONS,
  NOTE_LENGTH_OPTIONS,
  NOTE_OPTIONS,
  normalizeCircleOfFifthsKeyIndex,
  PITCH_CLASS_OPTIONS,
  POST_FILTER_TYPE_OPTIONS,
} from "./constants.js";
import { applyLiveAudioUpdates, ensureAudioContext, startPresetPlayback, stopPresetPlayback } from "./audio-engine.js";
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

function toNumber(value) {
  const numeric = Number.parseFloat(value);
  return Number.isNaN(numeric) ? null : numeric;
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

export class AudioStateController extends EventTarget {
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

  initialize() {
    state.activePresetIds.forEach((presetId) => {
      getInstrumentParams(presetId);
      ensureInstrumentNoteState(presetId);
    });

    this.emitStateChange("initialized", {
      activeInstrumentPresetId: state.activeInstrumentPresetId,
    });
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

    if (controlId === "post-filter-type" && !validPostFilterTypes.has(numericValue)) {
      this.emitError(`Invalid post-filter type value for ${controlId}`, { controlId, value });
      return false;
    }

    const { key } = controlConfig[controlId];
    if (GLOBAL_CONTROL_KEYS.has(key)) {
      state.synthParams[key] = numericValue;
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

    this.emitStateChange("channel-volume-updated", { presetId, value: clamped });
    return true;
  }

  async togglePlayback(presetId) {
    if (!validChannelIds.has(presetId)) {
      this.emitError(`Unknown preset id: ${presetId}`, { presetId });
      return false;
    }

    if (state.playingPresetIds.has(presetId)) {
      stopPresetPlayback(presetId);
      this.emitAction("playback-stopped", { presetId });
      this.emitStateChange("playback-toggled", {
        presetId,
        isPlaying: false,
      });
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
      this.emitStateChange("playback-toggled", {
        presetId,
        isPlaying: true,
      });
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

