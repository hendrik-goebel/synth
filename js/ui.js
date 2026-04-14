import { controlConfig, GLOBAL_CONTROL_KEYS, NOTE_OPTIONS } from "./constants.js";
import { applyLiveAudioUpdates } from "./audio-engine.js";
import { toggleButton, statusLabel, presetButtonsContainer } from "./dom.js";
import {
  ensureInstrumentNoteState,
  syncNoteButtonsFromActiveInstrumentPage,
  updateSelectedNotesFromUI,
} from "./patterns.js";
import { getInstrumentParams, getPresetIds, getPresetLabel } from "./presets.js";
import { state } from "./state.js";

export function setControlLabel(controlId, value) {
  const config = controlConfig[controlId];
  const valueElement = document.getElementById(config.valueId);

  if (valueElement) {
    valueElement.textContent = config.formatter(value);
  }
}

export function setControlUIValue(controlId, value) {
  const input = document.getElementById(controlId);
  if (input) {
    input.value = String(value);
  }
  setControlLabel(controlId, value);
}

export function renderPresetStackButtons() {
  if (!presetButtonsContainer) {
    return;
  }

  presetButtonsContainer.innerHTML = "";

  getPresetIds().forEach((presetId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.presetId = presetId;
    button.className = "preset-button";
    button.textContent = `${state.playingPresetIds.has(presetId) ? "● " : "○ "}${getPresetLabel(presetId)}`;
    button.setAttribute("aria-pressed", String(presetId === state.activeInstrumentPresetId));

    if (state.playingPresetIds.has(presetId)) {
      button.classList.add("is-playing");
    }

    if (presetId === state.activeInstrumentPresetId) {
      button.classList.add("is-current");
    }

    presetButtonsContainer.append(button);
  });
}

export function updateTransportUI() {
  renderPresetStackButtons();

  if (toggleButton) {
    const isCurrentPagePlaying = state.playingPresetIds.has(state.activeInstrumentPresetId);
    toggleButton.textContent = isCurrentPagePlaying ? "Stop" : "Start";
  }

  if (!statusLabel) {
    return;
  }

  if (state.playingPresetIds.size === 0) {
    statusLabel.textContent = "Stopped";
    return;
  }

  statusLabel.textContent = `Playing ${state.playingPresetIds.size} instruments`;
}

export function syncControlsFromActiveInstrumentPage() {
  const instrumentParams = getInstrumentParams(state.activeInstrumentPresetId);

  Object.keys(controlConfig).forEach((controlId) => {
    const { key } = controlConfig[controlId];
    const value = GLOBAL_CONTROL_KEYS.has(key)
      ? state.synthParams[key]
      : instrumentParams[key];
    setControlUIValue(controlId, value);
  });

  syncNoteButtonsFromActiveInstrumentPage();
  updateTransportUI();
}

export function bindControls() {
  Object.keys(controlConfig).forEach((controlId) => {
    const config = controlConfig[controlId];
    const input = document.getElementById(controlId);

    if (!input) {
      return;
    }

    setControlLabel(controlId, state.synthParams[config.key]);

    input.addEventListener("input", (event) => {
      const numericValue = Number.parseFloat(event.target.value);

      if (Number.isNaN(numericValue)) {
        return;
      }

      if (GLOBAL_CONTROL_KEYS.has(config.key)) {
        state.synthParams[config.key] = numericValue;
        setControlLabel(controlId, numericValue);
        applyLiveAudioUpdates(config.key, numericValue);
        return;
      }

      const instrumentParams = getInstrumentParams(state.activeInstrumentPresetId);
      instrumentParams[config.key] = numericValue;
      setControlLabel(controlId, numericValue);
    });
  });
}

export function bindNoteSelector() {
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

  ensureInstrumentNoteState(state.activeInstrumentPresetId);
  syncNoteButtonsFromActiveInstrumentPage();
}

export function bindPresetSelector() {
  if (!presetButtonsContainer) {
    return;
  }

  state.activePresetIds.forEach((presetId) => {
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
    if (!presetId) {
      return;
    }

    state.activeInstrumentPresetId = presetId;
    syncControlsFromActiveInstrumentPage();
    updateTransportUI();
  });
}

