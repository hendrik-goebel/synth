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

// Cache note button elements once for the lifetime of the page
let noteButtonElements = null;

function getNoteButtonElements() {
  if (!noteButtonElements) {
    noteButtonElements = NOTE_OPTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean);
  }
  return noteButtonElements;
}

// Cache control config entries once
const controlConfigEntries = Object.keys(controlConfig).map((id) => ({ id, ...controlConfig[id] }));

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

  // Incremental update: if channels are already rendered, only patch class state
  if (mixerChannelsContainer.children.length > 0) {
    const strips = mixerChannelsContainer.querySelectorAll(".channel-strip[data-preset-id]");
    strips.forEach((strip) => {
      const { presetId } = strip.dataset;
      const isPlaying = state.playingPresetIds.has(presetId);
      const isCurrent = presetId === state.activeInstrumentPresetId;

      strip.classList.toggle("is-current", isCurrent);

      const indicator = strip.querySelector(".channel-indicator");
      if (indicator) {
        indicator.classList.toggle("is-playing", isPlaying);
      }

      const playBtn = strip.querySelector(".channel-play-btn");
      if (playBtn) {
        playBtn.textContent = isPlaying ? "Stop" : "Play";
        playBtn.classList.toggle("is-playing", isPlaying);
      }
    });
    return;
  }

  // Full initial render (runs only once)
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

  controlConfigEntries.forEach(({ id: controlId, key }) => {
    const value = GLOBAL_CONTROL_KEYS.has(key)
      ? state.synthParams[key]
      : instrumentParams[key];
    setControlUIValue(controlId, value);
  });

  syncNoteButtonsFromActiveInstrumentPage();
  updateTransportUI();
}

export function bindControls() {
  controlConfigEntries.forEach(({ id: controlId, key }) => {
    const input = document.getElementById(controlId);

    if (!input) {
      return;
    }

    setControlLabel(controlId, state.synthParams[key]);

    input.addEventListener("input", (event) => {
      const numericValue = Number.parseFloat(event.target.value);

      if (Number.isNaN(numericValue)) {
        return;
      }

      if (GLOBAL_CONTROL_KEYS.has(key)) {
        state.synthParams[key] = numericValue;
        setControlLabel(controlId, numericValue);
        applyLiveAudioUpdates(key, numericValue);
        return;
      }

      const instrumentParams = getInstrumentParams(state.activeInstrumentPresetId);
      instrumentParams[key] = numericValue;
      setControlLabel(controlId, numericValue);
    });
  });
}

export function bindNoteSelector() {
  const buttons = getNoteButtonElements();

  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.currentTarget.classList.toggle("is-active");

      const activeButtons = buttons.filter((btn) => btn.classList.contains("is-active"));

      if (activeButtons.length === 0) {
        event.currentTarget.classList.add("is-active");
        event.currentTarget.setAttribute("aria-pressed", "true");
        return;
      }

      buttons.forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.classList.contains("is-active")));
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

