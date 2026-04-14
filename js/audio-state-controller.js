import { controlConfig, GLOBAL_CONTROL_KEYS, NOTE_LENGTH_OPTIONS, NOTE_OPTIONS } from "./constants.js";
import { applyLiveAudioUpdates, ensureAudioContext, startPresetPlayback, stopPresetPlayback } from "./audio-engine.js";
import { ensureInstrumentNoteState, rebuildInstrumentPattern } from "./patterns.js";
import { getInstrumentParams, getPresetIds } from "./presets.js";
import { state } from "./state.js";

const validControlIds = new Set(Object.keys(controlConfig));
const validPresetIds = new Set(getPresetIds());
const validNoteIds = new Set(NOTE_OPTIONS.map(({ id }) => id));
const validNoteLengths = new Set(NOTE_LENGTH_OPTIONS);

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

