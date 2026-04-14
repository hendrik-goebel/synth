import { controlConfig, GLOBAL_CONTROL_KEYS, NOTE_OPTIONS } from "./constants.js";
import { applyLiveAudioUpdates, startPresetPlayback, stopPresetPlayback } from "./audio-engine.js";
import { statusLabel } from "./dom.js";
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

export function renderMixerChannels() {
  const mixerChannelsContainer = document.getElementById("mixer-channels");
  if (!mixerChannelsContainer) {
    return;
  }

  mixerChannelsContainer.innerHTML = "";

  getPresetIds().forEach((presetId) => {
    const channelStrip = document.createElement("div");
    channelStrip.className = "channel-strip";
    channelStrip.dataset.presetId = presetId;

    if (presetId === state.activeInstrumentPresetId) {
      channelStrip.classList.add("is-current");
    }

    const nameDiv = document.createElement("div");
    nameDiv.className = "channel-name";
    nameDiv.textContent = getPresetLabel(presetId);

    const indicator = document.createElement("div");
    indicator.className = "channel-indicator";
    if (state.playingPresetIds.has(presetId)) {
      indicator.classList.add("is-playing");
    }

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "channel-buttons";

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "channel-select-btn";
    selectBtn.textContent = "Select";
    selectBtn.dataset.presetId = presetId;

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "channel-play-btn";
    playBtn.textContent = state.playingPresetIds.has(presetId) ? "Stop" : "Play";
    playBtn.dataset.presetId = presetId;
    if (state.playingPresetIds.has(presetId)) {
      playBtn.classList.add("is-playing");
    }

    buttonsDiv.append(selectBtn, playBtn);
    channelStrip.append(nameDiv, indicator, buttonsDiv);
    mixerChannelsContainer.append(channelStrip);
  });
}

export function updateTransportUI() {
  renderMixerChannels();

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

export function bindMixerChannels() {
  state.activePresetIds.forEach((presetId) => {
    getInstrumentParams(presetId);
    ensureInstrumentNoteState(presetId);
  });
  syncControlsFromActiveInstrumentPage();
  updateTransportUI();

  const mixerChannelsContainer = document.getElementById("mixer-channels");
  if (!mixerChannelsContainer) {
    return;
  }

  mixerChannelsContainer.addEventListener("click", async (event) => {
    const selectBtn = event.target.closest(".channel-select-btn");
    const playBtn = event.target.closest(".channel-play-btn");

    if (selectBtn) {
      const presetId = selectBtn.dataset.presetId;
      if (!presetId) {
        return;
      }
      state.activeInstrumentPresetId = presetId;
      syncControlsFromActiveInstrumentPage();
      updateTransportUI();
      return;
    }

    if (playBtn) {
      const presetId = playBtn.dataset.presetId;
      if (!presetId) {
        return;
      }

      if (state.playingPresetIds.has(presetId)) {
        stopPresetPlayback(presetId);
      } else {
        const { ensureAudioContext } = await import("./audio-engine.js");
        await ensureAudioContext();
        startPresetPlayback(presetId);
      }
      updateTransportUI();
    }
  });
}

