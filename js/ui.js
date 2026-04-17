import {
  controlConfig,
  DEAD_NOTE_PAUSE_COUNT_MAX,
  DEAD_NOTE_PAUSE_COUNT_MIN,
  delayFeedbackFromNormalized,
  delayDivisionIndexFromUiValue,
  GLOBAL_CONTROL_KEYS,
  lfoRateFromNormalized,
  normalizedFromDelayFeedback,
  normalizedFromLfoRate,
  NOTE_LENGTH_OPTIONS,
  NOTE_OPTIONS,
  POST_FILTER_TYPE_OPTIONS,
  POST_FILTER_TYPE_LABELS,
  uiValueFromDelayDivisionIndex,
} from "./constants.js";
import { statusLabel } from "./dom.js";
import {
  ensureInstrumentNoteState,
  syncNoteButtonsFromActiveInstrumentPage,
} from "./patterns.js";
import { getInstrumentParams, getPresetIds, getPresetLabel } from "./presets.js";
import { state } from "./state.js";
import { clamp } from "./utils.js";

// Cache note button elements once for the lifetime of the page
let noteButtonElements = null;
let deadNoteToggleElement = null;
let deadNoteCountToggleElement = null;
const mixerChannelCache = new Map();
const controlElementCache = new Map();
const controlLabelElementCache = new Map();

function getNoteButtonElements() {
  if (!noteButtonElements) {
    noteButtonElements = NOTE_OPTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean);
  }
  return noteButtonElements;
}

function getDeadNoteToggleElement() {
  if (!deadNoteToggleElement) {
    deadNoteToggleElement = document.getElementById("dead-note-toggle");
  }
  return deadNoteToggleElement;
}

function getDeadNoteCountToggleElement() {
  if (!deadNoteCountToggleElement) {
    deadNoteCountToggleElement = document.getElementById("dead-note-count-toggle");
  }
  return deadNoteCountToggleElement;
}

// Cache control config entries once
const controlConfigEntries = Object.keys(controlConfig).map((id) => ({ id, ...controlConfig[id] }));

export function setControlLabel(controlId, value) {
  const config = controlConfig[controlId];
  if (!config?.valueId) {
    return;
  }
  let valueElement = controlLabelElementCache.get(config.valueId);
  if (!valueElement) {
    valueElement = document.getElementById(config.valueId);
    if (valueElement) {
      controlLabelElementCache.set(config.valueId, valueElement);
    }
  }

  if (valueElement) {
    valueElement.textContent = config.formatter(value);
  }
}

export function setControlUIValue(controlId, value) {
  let input = controlElementCache.get(controlId);
  if (!input) {
    input = document.getElementById(controlId);
    if (input) {
      controlElementCache.set(controlId, input);
    }
  }
  if (input) {
    if (input.type === "checkbox") {
      const nextChecked = Boolean(Number(value));
      if (input.checked !== nextChecked) {
        input.checked = nextChecked;
      }
    } else {
      let nextValue = String(value);
      if (controlId === "lfo-rate") {
        nextValue = String(normalizedFromLfoRate(value));
      } else if (controlId === "delay-time") {
        nextValue = String(uiValueFromDelayDivisionIndex(value));
      } else if (controlId === "delay-feedback") {
        nextValue = String(normalizedFromDelayFeedback(value));
      }
      if (input.value !== nextValue) {
        input.value = nextValue;
      }
    }
  }
  setControlLabel(controlId, value);
}

export function renderMixerChannels() {
  const mixerChannelsContainer = document.getElementById("mixer-channels");
  if (!mixerChannelsContainer) {
    return;
  }

  // Incremental update: if channels are already rendered, only patch class state
  if (mixerChannelCache.size > 0) {
    mixerChannelCache.forEach(({ strip, indicator, playBtn }, presetId) => {
      const isPlaying = state.playingPresetIds.has(presetId);
      const isCurrent = presetId === state.activeInstrumentPresetId;

      strip.classList.toggle("is-current", isCurrent);
      indicator.classList.toggle("is-playing", isPlaying);

      const nextPlayLabel = isPlaying ? "Stop" : "Play";
      if (playBtn.textContent !== nextPlayLabel) {
        playBtn.textContent = nextPlayLabel;
      }
      playBtn.classList.toggle("is-playing", isPlaying);
    });
    return;
  }

  // Full initial render (runs only once)
  mixerChannelCache.clear();
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

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "channel-play-btn";
    playBtn.textContent = state.playingPresetIds.has(presetId) ? "Stop" : "Play";
    playBtn.dataset.presetId = presetId;
    if (state.playingPresetIds.has(presetId)) {
      playBtn.classList.add("is-playing");
    }

    const variationBtn = document.createElement("button");
    variationBtn.type = "button";
    variationBtn.className = "channel-variation-btn";
    variationBtn.textContent = "Var";
    variationBtn.dataset.presetId = presetId;

    const noteLengthBtn = document.createElement("button");
    noteLengthBtn.type = "button";
    noteLengthBtn.className = "channel-note-length-btn";
    const noteLength = getInstrumentParams(presetId).noteLength ?? 8;
    noteLengthBtn.textContent = `1/${noteLength}`;
    noteLengthBtn.value = String(noteLength);
    noteLengthBtn.dataset.presetId = presetId;
    noteLengthBtn.title = "Note Length";

    const volumeSlider = document.createElement("input");
    volumeSlider.type = "range";
    volumeSlider.className = "channel-volume-slider";
    volumeSlider.min = "0";
    volumeSlider.max = "1";
    volumeSlider.step = "0.01";
    const initialVolume = getInstrumentParams(presetId).channelVolume ?? 1;
    volumeSlider.value = String(initialVolume);
    volumeSlider.title = "Channel Volume";
    volumeSlider.dataset.presetId = presetId;

    buttonsDiv.append(playBtn, variationBtn, noteLengthBtn, volumeSlider);
    channelStrip.append(nameDiv, indicator, buttonsDiv);
    mixerChannelsContainer.append(channelStrip);

    mixerChannelCache.set(presetId, {
      strip: channelStrip,
      indicator,
      playBtn,
      noteLengthBtn,
      volumeSlider,
    });
  });
}

function updateChannelNoteLengthButton(presetId, value) {
  const channelElements = mixerChannelCache.get(presetId);
  const btn = channelElements?.noteLengthBtn;
  if (!btn) return;
  const rounded = Math.round(value);
  btn.textContent = `1/${rounded}`;
  btn.value = String(rounded);
}

function updateChannelVolumeSlider(presetId, value) {
  const channelElements = mixerChannelCache.get(presetId);
  const slider = channelElements?.volumeSlider;
  if (!slider) return;
  const next = String(clamp(value, 0, 1));
  if (slider.value !== next) {
    slider.value = next;
  }
}

export function syncDeadNoteControlsUI(deadNoteEnabled, pauseCount) {
  const toggleButton = getDeadNoteToggleElement();
  const countButton = getDeadNoteCountToggleElement();
  const isActive = Boolean(Number(deadNoteEnabled));
  const normalizedPauseCount = clamp(
    Math.round(Number.isFinite(pauseCount) ? pauseCount : DEAD_NOTE_PAUSE_COUNT_MIN),
    DEAD_NOTE_PAUSE_COUNT_MIN,
    DEAD_NOTE_PAUSE_COUNT_MAX,
  );

  if (toggleButton) {
    toggleButton.value = isActive ? "1" : "0";
    toggleButton.classList.toggle("is-active", isActive);
    toggleButton.setAttribute("aria-pressed", String(isActive));
    toggleButton.textContent = isActive ? "Pause On" : "Pause Off";
  }

  if (!countButton) {
    return;
  }

  countButton.value = String(normalizedPauseCount);
  countButton.textContent = `${normalizedPauseCount}`;
  countButton.classList.toggle("is-muted", !isActive);
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
  syncDeadNoteControlsUI(
    instrumentParams.deadNoteAtEnd ?? 0,
    instrumentParams.endPauseCount ?? DEAD_NOTE_PAUSE_COUNT_MIN,
  );
  updateTransportUI();
}

export function bindControls() {
  controlConfigEntries.forEach(({ id: controlId }) => {
    const input = document.getElementById(controlId);
    if (input) {
      controlElementCache.set(controlId, input);
    }

    if (!input || input.type === "checkbox" || input.tagName === "BUTTON") {
      return;
    }

    input.addEventListener("input", (event) => {
      const controller = event.currentTarget?.controllerRef;
      if (!controller) {
        return;
      }

      if (controlId === "lfo-rate") {
        const normalized = Number.parseFloat(event.target.value);
        controller.setControlValue(controlId, lfoRateFromNormalized(normalized));
        return;
      }

      if (controlId === "delay-time") {
        const uiValue = Number.parseFloat(event.target.value);
        controller.setControlValue(controlId, delayDivisionIndexFromUiValue(uiValue));
        return;
      }

      if (controlId === "delay-feedback") {
        const normalized = Number.parseFloat(event.target.value);
        controller.setControlValue(controlId, delayFeedbackFromNormalized(normalized));
        return;
      }

      controller.setControlValue(controlId, event.target.value);
    });
  });
}

export function bindNoteLengthToggle(controller) {
  const button = document.getElementById("note-length-toggle");
  if (!button) {
    return;
  }

  button.addEventListener("click", (event) => {
    const currentValue = Number.parseInt(event.currentTarget.value, 10);
    const currentIndex = NOTE_LENGTH_OPTIONS.indexOf(currentValue);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % NOTE_LENGTH_OPTIONS.length;
    controller.setControlValue("note-length-toggle", NOTE_LENGTH_OPTIONS[nextIndex]);
  });
}

export function bindPostFilterTypeToggle(controller) {
  const button = document.getElementById("post-filter-type");
  if (!button) {
    return;
  }

  button.controllerRef = controller;
  button.addEventListener("click", (event) => {
    const currentValue = Number.parseInt(event.currentTarget.value, 10);
    const currentIndex = POST_FILTER_TYPE_OPTIONS.indexOf(currentValue);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % POST_FILTER_TYPE_OPTIONS.length;
    controller.setControlValue("post-filter-type", POST_FILTER_TYPE_OPTIONS[nextIndex]);
  });
}

export function bindNoteSelector(controller) {
  const buttons = getNoteButtonElements();

  buttons.forEach((button) => {
    button.controllerRef = controller;
    button.addEventListener("click", (event) => {
      const noteId = event.currentTarget.dataset.noteId;
      if (!noteId) {
        return;
      }
      const controllerRef = event.currentTarget?.controllerRef;
      if (!controllerRef) {
        return;
      }
      controllerRef.toggleNote(noteId);
    });
  });

  ensureInstrumentNoteState(state.activeInstrumentPresetId);
  syncNoteButtonsFromActiveInstrumentPage();
}

export function bindDeadNoteToggle(controller) {
  const toggleButton = getDeadNoteToggleElement();
  const countButton = getDeadNoteCountToggleElement();

  if (toggleButton) {
    toggleButton.controllerRef = controller;
    toggleButton.addEventListener("click", (event) => {
      const controllerRef = event.currentTarget?.controllerRef;
      if (!controllerRef) {
        return;
      }
      controllerRef.toggleDeadNoteAtEnd();
    });
  }

  if (!countButton) {
    return;
  }

  countButton.controllerRef = controller;
  countButton.addEventListener("click", (event) => {
    const controllerRef = event.currentTarget?.controllerRef;
    if (!controllerRef) {
      return;
    }

    const currentValue = Number.parseInt(event.currentTarget.value, 10);
    const safeCurrentValue = Number.isInteger(currentValue)
      ? currentValue
      : DEAD_NOTE_PAUSE_COUNT_MIN;
    const nextValue = safeCurrentValue >= DEAD_NOTE_PAUSE_COUNT_MAX
      ? DEAD_NOTE_PAUSE_COUNT_MIN
      : safeCurrentValue + 1;

    controllerRef.setDeadNotePauseCount(nextValue);
  });
}

export function bindMixerChannels(controller) {
  const mixerChannelsContainer = document.getElementById("mixer-channels");
  if (!mixerChannelsContainer) {
    return;
  }

  // Volume slider input (separate handler to avoid stopPropagation issues)
  mixerChannelsContainer.addEventListener("input", (event) => {
    if (!event.target.classList.contains("channel-volume-slider")) {
      return;
    }
    const presetId = event.target.dataset.presetId;
    if (!presetId) return;
    controller.setChannelVolume(presetId, Number.parseFloat(event.target.value));
  });

  mixerChannelsContainer.addEventListener("click", async (event) => {
    const strip = event.target.closest(".channel-strip");
    if (!strip) {
      return;
    }

    const playBtn = event.target.closest(".channel-play-btn");
    const variationBtn = event.target.closest(".channel-variation-btn");
    const noteLengthBtn = event.target.closest(".channel-note-length-btn");
    const presetId = strip.dataset.presetId;
    if (!presetId) {
      return;
    }

    // Keep controls scoped to the clicked channel, but avoid redundant re-sync work.
    if (state.activeInstrumentPresetId !== presetId) {
      controller.selectInstrument(presetId);
    }

    if (playBtn) {
      await controller.togglePlayback(presetId);
      return;
    }

    if (variationBtn) {
      controller.createNoteVariation(presetId);
      return;
    }

    if (noteLengthBtn) {
      const currentValue = Number.parseInt(noteLengthBtn.value, 10);
      const currentIndex = NOTE_LENGTH_OPTIONS.indexOf(currentValue);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % NOTE_LENGTH_OPTIONS.length;
      controller.setControlValue("note-length-toggle", NOTE_LENGTH_OPTIONS[nextIndex]);
      return;
    }
  });
}

export function bindKeyboardShortcuts(controller) {
  const presetIds = getPresetIds();

  document.addEventListener("keydown", (event) => {
    // Ignore when focus is inside a text-entry input to avoid hijacking typing
    const el = document.activeElement;
    const textLike = el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" ||
      (el?.tagName === "INPUT" && el.type !== "range" && el.type !== "checkbox" && el.type !== "button");
    if (textLike) {
      return;
    }

    // Space → toggle playback for the active instrument
    if (event.key === " ") {
      event.preventDefault();
      controller.togglePlayback(state.activeInstrumentPresetId);
      return;
    }

    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const digitIndex = digits.indexOf(event.key);
    if (digitIndex === -1) {
      return;
    }

    const presetId = presetIds[digitIndex];
    if (presetId) {
      controller.selectInstrument(presetId);
    }
  });
}

export function bindControllerEvents(controller) {
  controlConfigEntries.forEach(({ id: controlId }) => {
    const input = document.getElementById(controlId);
    if (input) {
      controlElementCache.set(controlId, input);
      input.controllerRef = controller;
    }
  });

  controller.addEventListener("statechange", (event) => {
    const { type, controlId, value, presetId } = event.detail;

    if (type === "initialized" || type === "instrument-selected") {
      syncControlsFromActiveInstrumentPage();
      return;
    }

    if (type === "control-updated") {
      if (GLOBAL_CONTROL_KEYS.has(controlConfig[controlId].key) || presetId === state.activeInstrumentPresetId) {
        setControlUIValue(controlId, value);
      }
      if (controlId === "note-length-toggle") {
        updateChannelNoteLengthButton(presetId, value);
      }
      return;
    }

    if (type === "notes-updated") {
      if (presetId === state.activeInstrumentPresetId) {
        syncNoteButtonsFromActiveInstrumentPage();
      }
      return;
    }

    if (type === "dead-note-updated" || type === "dead-note-count-updated") {
      if (presetId === state.activeInstrumentPresetId) {
        const instrumentParams = getInstrumentParams(presetId);
        syncDeadNoteControlsUI(
          instrumentParams.deadNoteAtEnd ?? 0,
          instrumentParams.endPauseCount ?? DEAD_NOTE_PAUSE_COUNT_MIN,
        );
      }
      return;
    }

    if (type === "channel-volume-updated") {
      updateChannelVolumeSlider(event.detail.presetId, event.detail.value);
      return;
    }

    if (type === "playback-toggled") {
      updateTransportUI();
    }
  });

  controller.addEventListener("error", (event) => {
    if (!statusLabel) {
      return;
    }

    const { message } = event.detail;
    statusLabel.textContent = message;
  });
}

