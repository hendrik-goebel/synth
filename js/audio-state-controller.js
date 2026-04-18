import {
  controlConfig,
  DEAD_NOTE_PAUSE_COUNT_MAX,
  DEAD_NOTE_PAUSE_COUNT_MIN,
  DELAY_FEEDBACK_MAX,
  DELAY_DIVISION_OPTIONS,
  DISTORTION_FEEDBACK_MAX,
  GLOBAL_CONTROL_KEYS,
  LFO_TARGET_OPTIONS,
  NOTE_LENGTH_OPTIONS,
  NOTE_OPTIONS,
  PITCH_CLASS_OPTIONS,
  POST_FILTER_TYPE_OPTIONS,
} from "./constants.js";
import { applyLiveAudioUpdates, ensureAudioContext, startPresetPlayback, stopPresetPlayback } from "./audio-engine.js";
import {
  createInstrumentNoteVariation,
  ensureInstrumentNoteState,
  getEnabledArpeggioPitchClasses,
  getEligibleRandomNotePoolFromPitchClasses,
  regenerateInstrumentRandomNoteIds,
  rebuildInstrumentPattern,
} from "./patterns.js";
import { getInstrumentParams, getPresetIds } from "./presets.js";
import { state } from "./state.js";

const validControlIds = new Set(Object.keys(controlConfig));
const validPresetIds = new Set(getPresetIds());
const validNoteIds = new Set(NOTE_OPTIONS.map(({ id }) => id));
const validNoteLengths = new Set(NOTE_LENGTH_OPTIONS);
const validDelayDivisionIndices = new Set(DELAY_DIVISION_OPTIONS.map((_, index) => index));
const validLfoTargetIndices = new Set(LFO_TARGET_OPTIONS.map((_, index) => index));
const validPitchClassKeys = new Set(PITCH_CLASS_OPTIONS.map(({ key }) => key));
const validPostFilterTypes = new Set(POST_FILTER_TYPE_OPTIONS);

function toNumber(value) {
  const numeric = Number.parseFloat(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export class AudioStateController extends EventTarget {
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
    if (!validPresetIds.has(presetId)) {
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

    if (controlId === "delay-time" && !validDelayDivisionIndices.has(numericValue)) {
      this.emitError(`Invalid delay division value for ${controlId}`, { controlId, value });
      return false;
    }

    if (controlId === "lfo-target" && !validLfoTargetIndices.has(numericValue)) {
      this.emitError(`Invalid LFO target value for ${controlId}`, { controlId, value });
      return false;
    }

    if (controlId === "delay-feedback" && (numericValue < 0 || numericValue > DELAY_FEEDBACK_MAX)) {
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

  toggleArpeggioPitchClass(pitchClassKey, presetId = state.activeInstrumentPresetId) {
    if (!validPresetIds.has(presetId)) {
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

  applyActiveArpeggioSettingsToAllInstruments() {
    const sourcePresetId = state.activeInstrumentPresetId;
    ensureInstrumentNoteState(sourcePresetId);

    const sourcePitchClasses = getEnabledArpeggioPitchClasses(sourcePresetId);
    const eligibleNotePool = getEligibleRandomNotePoolFromPitchClasses(sourcePitchClasses);
    const instrumentNoteCounts = getPresetIds().map((presetId) => {
      ensureInstrumentNoteState(presetId);
      return {
        presetId,
        noteCount: state.instrumentNoteIdsByPresetId[presetId]?.length ?? 0,
      };
    });

    instrumentNoteCounts.forEach(({ presetId, noteCount }) => {
      state.instrumentArpeggioPitchClassesByPresetId[presetId] = sourcePitchClasses.slice();
      regenerateInstrumentRandomNoteIds(
        presetId,
        Math.min(noteCount, eligibleNotePool.length),
      );
    });

    this.emitAction("arpeggio-settings-applied-to-all", {
      sourcePresetId,
      enabledPitchClasses: sourcePitchClasses.slice(),
      updatedPresetIds: instrumentNoteCounts.map(({ presetId }) => presetId),
    });
    this.emitStateChange("arpeggio-settings-applied-to-all", {
      sourcePresetId,
      enabledPitchClasses: sourcePitchClasses.slice(),
      updatedPresetIds: instrumentNoteCounts.map(({ presetId }) => presetId),
    });
    return true;
  }

  toggleDeadNoteAtEnd(presetId = state.activeInstrumentPresetId) {
    if (!validPresetIds.has(presetId)) {
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
    if (!validPresetIds.has(presetId)) {
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
    if (!validPresetIds.has(presetId)) {
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

  setChannelVolume(presetId, value) {
    if (!validPresetIds.has(presetId)) {
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
    if (!validPresetIds.has(presetId)) {
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

