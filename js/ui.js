import {
  controlConfig,
  DEAD_NOTE_PAUSE_COUNT_MAX,
  DEAD_NOTE_PAUSE_COUNT_MIN,
  delayFeedbackFromNormalized,
  delayDivisionIndexFromUiValue,
  extractOctave,
  getCircleOfFifthsKeyLabel,
  MIDI_CHANNEL_MAX,
  MIDI_CHANNEL_MIN,
  getPitchClassLabel,
  getPitchClassesForMajorKey,
  GLOBAL_CONTROL_KEYS,
  lfoRateFromNormalized,
  normalizedFromDelayFeedback,
  normalizedFromLfoRate,
  NOTE_LENGTH_OPTIONS,
  NOTE_OPTIONS,
  POST_FILTER_TYPE_OPTIONS,
  uiValueFromDelayDivisionIndex,
} from "./constants.js";
import { statusLabel } from "./dom.js";
import {
  getEnabledArpeggioOctaves,
  ensureInstrumentNoteState,
  getEnabledArpeggioPitchClasses,
  syncNoteButtonsFromActiveInstrumentPage,
} from "./patterns.js";
import {
  getAssignedPresetId,
  getAvailablePresetGroups,
  getInstrumentParams,
  getPresetIds,
  getPresetLabel,
} from "./presets.js";
import { replaceStateSeedInLocation } from "./state-seed.js";
import { state } from "./state.js";
import { clamp } from "./utils.js";

// Cache note button elements once for the lifetime of the page
let noteButtonElements = null;
let deadNoteToggleElement = null;
let deadNoteCountToggleElement = null;
let arpeggioSettingsToggleElement = null;
let arpeggioSettingsDialogElement = null;
let arpeggioSettingsCloseElement = null;
let arpeggioSettingsApplyElement = null;
let arpeggioSettingsHistoryPrevElement = null;
let arpeggioSettingsHistoryNextElement = null;
let arpeggioSettingsHistoryPositionElement = null;
let arpeggioSettingsKeyPrevElement = null;
let arpeggioSettingsKeyNextElement = null;
let arpeggioSettingsKeyValueElement = null;
let globalKeyValueElement = null;
let globalKeyNoteListElement = null;
let globalPlayButtonElement = null;
let globalStopButtonElement = null;
let midiStatusElement = null;
let midiClockStatusElement = null;
let midiInputPortElement = null;
let midiOutputPortElement = null;
let midiClockModeElement = null;
let midiRefreshElement = null;
let stateSeedInputElement = null;
let stateSeedSaveElement = null;
let stateSeedLoadElement = null;
let stateSeedDeleteElement = null;
let globalKeyTransposeUpElement = null;
let globalKeyTransposeDownElement = null;
let settingsNoteButtonElements = null;
let settingsChannelButtonElements = null;
let noteRowToggleElements = null;
let noteRowElements = null;
let selectedArpeggioApplyChannelIds = new Set();
const mixerChannelCache = new Map();
const controlElementCache = new Map();
const controlLabelElementCache = new Map();
const delayToggleControlIds = new Set(["tape-delay-enabled", "clean-delay-enabled"]);

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

function getArpeggioSettingsToggleElement() {
  if (!arpeggioSettingsToggleElement) {
    arpeggioSettingsToggleElement = document.getElementById("arpeggio-settings-toggle");
  }
  return arpeggioSettingsToggleElement;
}

function getArpeggioSettingsDialogElement() {
  if (!arpeggioSettingsDialogElement) {
    arpeggioSettingsDialogElement = document.getElementById("arpeggio-settings-dialog");
  }
  return arpeggioSettingsDialogElement;
}

function getArpeggioSettingsCloseElement() {
  if (!arpeggioSettingsCloseElement) {
    arpeggioSettingsCloseElement = document.getElementById("arpeggio-settings-close");
  }
  return arpeggioSettingsCloseElement;
}

function getArpeggioSettingsApplyElement() {
  if (!arpeggioSettingsApplyElement) {
    arpeggioSettingsApplyElement = document.getElementById("arpeggio-settings-apply");
  }
  return arpeggioSettingsApplyElement;
}

function getArpeggioSettingsHistoryPrevElement() {
  if (!arpeggioSettingsHistoryPrevElement) {
    arpeggioSettingsHistoryPrevElement = document.getElementById("arpeggio-settings-history-prev");
  }
  return arpeggioSettingsHistoryPrevElement;
}

function getArpeggioSettingsHistoryNextElement() {
  if (!arpeggioSettingsHistoryNextElement) {
    arpeggioSettingsHistoryNextElement = document.getElementById("arpeggio-settings-history-next");
  }
  return arpeggioSettingsHistoryNextElement;
}

function getArpeggioSettingsHistoryPositionElement() {
  if (!arpeggioSettingsHistoryPositionElement) {
    arpeggioSettingsHistoryPositionElement = document.getElementById("arpeggio-settings-history-position");
  }
  return arpeggioSettingsHistoryPositionElement;
}

function getArpeggioSettingsKeyPrevElement() {
  if (!arpeggioSettingsKeyPrevElement) {
    arpeggioSettingsKeyPrevElement = document.getElementById("arpeggio-settings-key-prev");
  }
  return arpeggioSettingsKeyPrevElement;
}

function getArpeggioSettingsKeyNextElement() {
  if (!arpeggioSettingsKeyNextElement) {
    arpeggioSettingsKeyNextElement = document.getElementById("arpeggio-settings-key-next");
  }
  return arpeggioSettingsKeyNextElement;
}

function getArpeggioSettingsKeyValueElement() {
  if (!arpeggioSettingsKeyValueElement) {
    arpeggioSettingsKeyValueElement = document.getElementById("arpeggio-settings-key-value");
  }
  return arpeggioSettingsKeyValueElement;
}

function getGlobalKeyValueElement() {
  if (!globalKeyValueElement) {
    globalKeyValueElement = document.getElementById("global-key-value");
  }
  return globalKeyValueElement;
}

function getGlobalKeyNoteListElement() {
  if (!globalKeyNoteListElement) {
    globalKeyNoteListElement = document.getElementById("global-key-note-list");
  }
  return globalKeyNoteListElement;
}

function getGlobalPlayButtonElement() {
  if (!globalPlayButtonElement) {
    globalPlayButtonElement = document.getElementById("global-play");
  }
  return globalPlayButtonElement;
}

function getGlobalStopButtonElement() {
  if (!globalStopButtonElement) {
    globalStopButtonElement = document.getElementById("global-stop");
  }
  return globalStopButtonElement;
}

function getMidiStatusElement() {
  if (!midiStatusElement) {
    midiStatusElement = document.getElementById("midi-status");
  }
  return midiStatusElement;
}

function getMidiClockStatusElement() {
  if (!midiClockStatusElement) {
    midiClockStatusElement = document.getElementById("midi-clock-status");
  }
  return midiClockStatusElement;
}

function getMidiInputPortElement() {
  if (!midiInputPortElement) {
    midiInputPortElement = document.getElementById("midi-input-port");
  }
  return midiInputPortElement;
}

function getMidiOutputPortElement() {
  if (!midiOutputPortElement) {
    midiOutputPortElement = document.getElementById("midi-output-port");
  }
  return midiOutputPortElement;
}

function getMidiClockModeElement() {
  if (!midiClockModeElement) {
    midiClockModeElement = document.getElementById("midi-clock-mode");
  }
  return midiClockModeElement;
}

function getMidiRefreshElement() {
  if (!midiRefreshElement) {
    midiRefreshElement = document.getElementById("midi-refresh");
  }
  return midiRefreshElement;
}

function getStateSeedInputElement() {
  if (!stateSeedInputElement) {
    stateSeedInputElement = document.getElementById("state-seed-input");
  }
  return stateSeedInputElement;
}

function getStateSeedSaveElement() {
  if (!stateSeedSaveElement) {
    stateSeedSaveElement = document.getElementById("state-seed-save");
  }
  return stateSeedSaveElement;
}

function getStateSeedLoadElement() {
  if (!stateSeedLoadElement) {
    stateSeedLoadElement = document.getElementById("state-seed-load");
  }
  return stateSeedLoadElement;
}

function getStateSeedDeleteElement() {
  if (!stateSeedDeleteElement) {
    stateSeedDeleteElement = document.getElementById("state-seed-delete");
  }
  return stateSeedDeleteElement;
}

function getGlobalKeyTransposeUpElement() {
  if (!globalKeyTransposeUpElement) {
    globalKeyTransposeUpElement = document.getElementById("global-key-transpose-up");
  }
  return globalKeyTransposeUpElement;
}

function getGlobalKeyTransposeDownElement() {
  if (!globalKeyTransposeDownElement) {
    globalKeyTransposeDownElement = document.getElementById("global-key-transpose-down");
  }
  return globalKeyTransposeDownElement;
}

function getSettingsNoteButtonElements() {
  if (!settingsNoteButtonElements) {
    settingsNoteButtonElements = Array.from(document.querySelectorAll(".settings-note-toggle"));
  }
  return settingsNoteButtonElements;
}

function getSettingsChannelButtonElements() {
  if (!settingsChannelButtonElements) {
    settingsChannelButtonElements = Array.from(document.querySelectorAll(".settings-channel-btn"));
  }
  return settingsChannelButtonElements;
}

function getNoteRowToggleElements() {
  if (!noteRowToggleElements) {
    noteRowToggleElements = Array.from(document.querySelectorAll(".note-row-toggle"));
  }
  return noteRowToggleElements;
}

function getNoteRowElements() {
  if (!noteRowElements) {
    noteRowElements = Array.from(document.querySelectorAll(".note-row"));
  }
  return noteRowElements;
}

function resetArpeggioApplyChannelSelection(channelIds = getPresetIds()) {
  selectedArpeggioApplyChannelIds = new Set(channelIds);
  syncArpeggioSettingsChannelButtons();
}

function syncArpeggioSettingsChannelButtons() {
  getSettingsChannelButtonElements().forEach((button) => {
    const channelId = button.dataset.settingsChannelId;
    const isActive = Boolean(channelId) && selectedArpeggioApplyChannelIds.has(channelId);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncArpeggioHistoryButtons() {
  const prevButton = getArpeggioSettingsHistoryPrevElement();
  const nextButton = getArpeggioSettingsHistoryNextElement();
  const positionLabel = getArpeggioSettingsHistoryPositionElement();
  const storedSnapshotCount = state.arpeggioHistorySnapshots.length;
  const isLivePosition = storedSnapshotCount > 0 && state.arpeggioHistoryIndex === storedSnapshotCount - 1;
  const canStepPrev = storedSnapshotCount > 0 && state.arpeggioHistoryIndex > 0;
  const canStepNext = storedSnapshotCount > 0 && state.arpeggioHistoryIndex < storedSnapshotCount - 1;
  const historyLength = storedSnapshotCount;
  const historyPosition = historyLength === 0 ? 0 : state.arpeggioHistoryIndex + 1;

  if (prevButton) {
    prevButton.disabled = !canStepPrev;
    prevButton.setAttribute("aria-disabled", String(!canStepPrev));
  }

  if (nextButton) {
    nextButton.disabled = !canStepNext;
    nextButton.setAttribute("aria-disabled", String(!canStepNext));
  }

  if (positionLabel) {
    positionLabel.textContent = `${historyPosition} / ${historyLength}`;
    positionLabel.classList.toggle("is-live", isLivePosition && historyLength > 0);
    positionLabel.setAttribute(
      "aria-label",
      historyLength === 0
        ? "History position 0 of 0"
        : `History position ${historyPosition} of ${historyLength}${isLivePosition ? ", current state" : ""}`,
    );
  }
}

function syncStateSeedField(seed = state.currentStateSeed) {
  const seedInput = getStateSeedInputElement();
  if (!seedInput) {
    return;
  }

  const normalizedSeed = `${seed ?? ""}`.trim();
  if (seedInput.value !== normalizedSeed) {
    seedInput.value = normalizedSeed;
  }
}

function getMidiChannelSettings(presetId) {
  const channelSettings = state.midi.channelSettingsByPresetId[presetId];
  if (channelSettings) {
    return channelSettings;
  }

  return {
    midiChannel: Math.min(MIDI_CHANNEL_MAX, Math.max(MIDI_CHANNEL_MIN, getPresetIds().indexOf(presetId) + 1 || 1)),
    sendEnabled: 1,
    receiveEnabled: 1,
  };
}

function replaceSelectOptions(selectElement, items, selectedValue, emptyLabel = "None") {
  if (!selectElement) {
    return;
  }

  const previousValue = selectElement.value;
  selectElement.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = emptyLabel;
  selectElement.append(emptyOption);

  items.forEach(({ id, name, manufacturer }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = manufacturer ? `${name} — ${manufacturer}` : name;
    selectElement.append(option);
  });

  const nextValue = selectedValue ?? previousValue;
  selectElement.value = Array.from(selectElement.options).some((option) => option.value === nextValue)
    ? nextValue
    : "";
}

function getMidiClockStatusText() {
  if (!state.midi.supported) {
    return "Unsupported";
  }

  if (state.midi.clockMode === "slave") {
    if (state.transportState === "playing") {
      const externalTempoBpm = state.midi.externalClockTempoBpm;
      return Number.isFinite(externalTempoBpm) && externalTempoBpm > 0
        ? `Following ${externalTempoBpm.toFixed(1)} BPM`
        : "Following external clock";
    }

    return state.midi.awaitingExternalClockStart ? "Waiting for external start" : "External clock armed";
  }

  if (state.midi.clockMode === "master") {
    return state.midi.clockMasterRunning ? "Sending MIDI clock" : "Ready to send clock";
  }

  return "Off";
}

function syncMidiGlobalUI() {
  const midiStatus = getMidiStatusElement();
  const midiClockStatus = getMidiClockStatusElement();
  const midiInputPort = getMidiInputPortElement();
  const midiOutputPort = getMidiOutputPortElement();
  const midiClockMode = getMidiClockModeElement();

  if (midiStatus) {
    const baseStatus = !state.midi.supported
      ? "Web MIDI unavailable"
      : state.midi.accessGranted
        ? "Ready"
        : "No device access";
    midiStatus.textContent = state.midi.crossTabSyncActive
      ? `${baseStatus} · Cross-tab sync on`
      : baseStatus;
  }

  if (midiClockStatus) {
    midiClockStatus.textContent = getMidiClockStatusText();
  }

  replaceSelectOptions(midiInputPort, state.midi.availableInputs, state.midi.inputPortId, "None");
  replaceSelectOptions(midiOutputPort, state.midi.availableOutputs, state.midi.outputPortId, "None");

  if (midiClockMode) {
    midiClockMode.value = state.midi.clockMode;
  }
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
    if (delayToggleControlIds.has(controlId)) {
      const isEnabled = Boolean(Number(value));
      input.value = isEnabled ? "1" : "0";
      input.textContent = isEnabled ? "On" : "Off";
      input.classList.toggle("is-active", isEnabled);
      input.setAttribute("aria-pressed", String(isEnabled));
    } else if (input.type === "checkbox") {
      const nextChecked = Boolean(Number(value));
      if (input.checked !== nextChecked) {
        input.checked = nextChecked;
      }
    } else {
      let nextValue = String(value);
      if (controlId === "lfo-rate") {
        nextValue = String(normalizedFromLfoRate(value));
      } else if (controlId === "delay-time" || controlId === "clean-delay-time") {
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
    mixerChannelCache.forEach(({ strip, indicator, instrumentSelect, playBtn, muteBtn, volumeSlider, midiChannelSelect, midiSendBtn, midiReceiveBtn }, presetId) => {
      const isPlaying = state.playingPresetIds.has(presetId);
      const isCurrent = presetId === state.activeInstrumentPresetId;
      const assignedPresetId = getAssignedPresetId(presetId);
      const instrumentParams = getInstrumentParams(presetId);
      const isMuted = Boolean(Number(instrumentParams.channelMuted));
      const midiChannelSettings = getMidiChannelSettings(presetId);

      strip.classList.toggle("is-current", isCurrent);
      strip.classList.toggle("is-muted", isMuted);
      indicator.classList.toggle("is-playing", isPlaying);
      if (instrumentSelect && instrumentSelect.value !== assignedPresetId) {
        instrumentSelect.value = assignedPresetId;
      }

      const nextPlayLabel = isPlaying ? "Stop" : "Play";
      if (playBtn.textContent !== nextPlayLabel) {
        playBtn.textContent = nextPlayLabel;
      }
      playBtn.classList.toggle("is-playing", isPlaying);

      if (muteBtn) {
        muteBtn.textContent = isMuted ? "Muted" : "Mute";
        muteBtn.classList.toggle("is-muted", isMuted);
        muteBtn.setAttribute("aria-pressed", String(isMuted));
      }

      if (volumeSlider) {
        volumeSlider.classList.toggle("is-muted", isMuted);
      }

      if (midiChannelSelect && midiChannelSelect.value !== String(midiChannelSettings.midiChannel)) {
        midiChannelSelect.value = String(midiChannelSettings.midiChannel);
      }

      if (midiSendBtn) {
        const sendEnabled = Boolean(Number(midiChannelSettings.sendEnabled));
        midiSendBtn.classList.toggle("is-active", sendEnabled);
        midiSendBtn.setAttribute("aria-pressed", String(sendEnabled));
      }

      if (midiReceiveBtn) {
        const receiveEnabled = Boolean(Number(midiChannelSettings.receiveEnabled));
        midiReceiveBtn.classList.toggle("is-active", receiveEnabled);
        midiReceiveBtn.setAttribute("aria-pressed", String(receiveEnabled));
      }
    });
    return;
  }

  // Full initial render (runs only once)
  mixerChannelCache.clear();
  const presetIds = getPresetIds();
  const availablePresetGroups = getAvailablePresetGroups();
  presetIds.forEach((presetId, index) => {
    const assignedPresetId = getAssignedPresetId(presetId);
    const instrumentParams = getInstrumentParams(presetId);
    const channelStrip = document.createElement("div");
    channelStrip.className = "channel-strip";
    channelStrip.dataset.presetId = presetId;

    if (presetId === state.activeInstrumentPresetId) {
      channelStrip.classList.add("is-current");
    }

    const isMuted = Boolean(Number(instrumentParams.channelMuted));
    const midiChannelSettings = getMidiChannelSettings(presetId);
    if (isMuted) {
      channelStrip.classList.add("is-muted");
    }

    const instrumentSelect = document.createElement("select");
    instrumentSelect.className = "channel-instrument-select";
    instrumentSelect.dataset.presetId = presetId;
    instrumentSelect.setAttribute("aria-label", `Instrument for channel ${index + 1}`);

    availablePresetGroups.forEach(({ label, presetIds: groupedPresetIds }) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = label;

      groupedPresetIds.forEach((optionPresetId) => {
        const option = document.createElement("option");
        option.value = optionPresetId;
        option.textContent = getPresetLabel(optionPresetId);
        optgroup.append(option);
      });

      instrumentSelect.append(optgroup);
    });
    instrumentSelect.value = assignedPresetId;

    const nameDiv = document.createElement("div");
    nameDiv.className = "channel-name";
    nameDiv.textContent = `Channel ${index + 1}`;

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

    const muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "channel-mute-btn";
    muteBtn.dataset.presetId = presetId;
    muteBtn.textContent = isMuted ? "Muted" : "Mute";
    muteBtn.classList.toggle("is-muted", isMuted);
    muteBtn.setAttribute("aria-pressed", String(isMuted));

    const noteLengthBtn = document.createElement("button");
    noteLengthBtn.type = "button";
    noteLengthBtn.className = "channel-note-length-btn";
    const noteLength = instrumentParams.noteLength ?? 8;
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
    const initialVolume = instrumentParams.channelVolume ?? 1;
    volumeSlider.value = String(initialVolume);
    volumeSlider.title = "Channel Volume";
    volumeSlider.dataset.presetId = presetId;
    volumeSlider.classList.toggle("is-muted", isMuted);

    const midiRow = document.createElement("div");
    midiRow.className = "channel-midi-row";

    const midiChannelSelect = document.createElement("select");
    midiChannelSelect.className = "channel-midi-channel-select";
    midiChannelSelect.dataset.presetId = presetId;
    midiChannelSelect.setAttribute("aria-label", `MIDI channel for channel ${index + 1}`);
    for (let midiChannel = MIDI_CHANNEL_MIN; midiChannel <= MIDI_CHANNEL_MAX; midiChannel += 1) {
      const option = document.createElement("option");
      option.value = String(midiChannel);
      option.textContent = `Ch ${midiChannel}`;
      midiChannelSelect.append(option);
    }
    midiChannelSelect.value = String(midiChannelSettings.midiChannel);

    const midiSendBtn = document.createElement("button");
    midiSendBtn.type = "button";
    midiSendBtn.className = "channel-midi-toggle-btn channel-midi-send-btn";
    midiSendBtn.dataset.presetId = presetId;
    midiSendBtn.textContent = "Out";
    const sendEnabled = Boolean(Number(midiChannelSettings.sendEnabled));
    midiSendBtn.classList.toggle("is-active", sendEnabled);
    midiSendBtn.setAttribute("aria-pressed", String(sendEnabled));

    const midiReceiveBtn = document.createElement("button");
    midiReceiveBtn.type = "button";
    midiReceiveBtn.className = "channel-midi-toggle-btn channel-midi-receive-btn";
    midiReceiveBtn.dataset.presetId = presetId;
    midiReceiveBtn.textContent = "In";
    const receiveEnabled = Boolean(Number(midiChannelSettings.receiveEnabled));
    midiReceiveBtn.classList.toggle("is-active", receiveEnabled);
    midiReceiveBtn.setAttribute("aria-pressed", String(receiveEnabled));

    midiRow.append(midiChannelSelect, midiSendBtn, midiReceiveBtn);

    buttonsDiv.append(playBtn, variationBtn, muteBtn, noteLengthBtn, volumeSlider, midiRow);
    channelStrip.append(instrumentSelect, nameDiv, indicator, buttonsDiv);
    mixerChannelsContainer.append(channelStrip);

    mixerChannelCache.set(presetId, {
      strip: channelStrip,
      indicator,
      instrumentSelect,
      playBtn,
      muteBtn,
      noteLengthBtn,
      volumeSlider,
      midiChannelSelect,
      midiSendBtn,
      midiReceiveBtn,
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

function updateChannelMuteButton(presetId, value) {
  const channelElements = mixerChannelCache.get(presetId);
  const muteButton = channelElements?.muteBtn;
  const slider = channelElements?.volumeSlider;
  const strip = channelElements?.strip;
  const isMuted = Boolean(Number(value));
  if (muteButton) {
    muteButton.textContent = isMuted ? "Muted" : "Mute";
    muteButton.classList.toggle("is-muted", isMuted);
    muteButton.setAttribute("aria-pressed", String(isMuted));
  }
  if (slider) {
    slider.classList.toggle("is-muted", isMuted);
  }
  if (strip) {
    strip.classList.toggle("is-muted", isMuted);
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

function syncGlobalTransportButtons() {
  const playButton = getGlobalPlayButtonElement();
  const stopButton = getGlobalStopButtonElement();
  const isPlaying = state.transportState === "playing";
  const isStopped = state.transportState === "stopped";
  const canStop = state.transportState !== "stopped" || Boolean(state.audioContext);

  if (playButton) {
    playButton.disabled = false;
    playButton.setAttribute("aria-disabled", "false");
    playButton.classList.toggle("is-active", isPlaying);
  }

  if (stopButton) {
    stopButton.disabled = !canStop;
    stopButton.setAttribute("aria-disabled", String(!canStop));
    stopButton.classList.toggle("is-active", isStopped && canStop);
  }
}

export function updateTransportUI() {
  renderMixerChannels();
  syncMidiGlobalUI();
  syncGlobalTransportButtons();

  if (!statusLabel) {
    return;
  }

  if (state.transportState === "paused") {
    statusLabel.textContent = "Paused";
    return;
  }

   if (state.midi.awaitingExternalClockStart && state.playingPresetIds.size > 0) {
     statusLabel.textContent = "Waiting for external MIDI clock";
     return;
   }

  if (state.midi.clockMode === "slave" && state.transportState === "playing") {
    const playingCount = state.playingPresetIds.size;
    statusLabel.textContent = `Synced to external MIDI clock (${playingCount} instrument${playingCount === 1 ? "" : "s"})`;
    return;
  }

  if (state.playingPresetIds.size === 0 || state.transportState === "stopped") {
    statusLabel.textContent = "Stopped";
    return;
  }

  statusLabel.textContent = `Playing ${state.playingPresetIds.size} instrument${state.playingPresetIds.size === 1 ? "" : "s"}`;
}

export function syncGlobalArpeggioKeyUI() {
  const keyLabel = getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex);
  const keyPitchClasses = getPitchClassesForMajorKey(state.globalArpeggioKeyIndex);
  const keyValueElement = getArpeggioSettingsKeyValueElement();
  const globalKeyLabelElement = getGlobalKeyValueElement();
  const globalKeyNotesElement = getGlobalKeyNoteListElement();

  if (keyValueElement) {
    keyValueElement.textContent = keyLabel;
  }

  if (globalKeyLabelElement) {
    globalKeyLabelElement.textContent = keyLabel;
  }

  if (globalKeyNotesElement) {
    globalKeyNotesElement.replaceChildren(
      ...keyPitchClasses.map((pitchClassKey) => {
        const noteTag = document.createElement("span");
        noteTag.className = "global-key-note-chip";
        noteTag.textContent = getPitchClassLabel(pitchClassKey);
        return noteTag;
      }),
    );
  }
}

export function syncArpeggioSettingsNoteButtons(presetId = state.activeInstrumentPresetId) {
  ensureInstrumentNoteState(presetId);
  const enabledPitchClasses = new Set(getEnabledArpeggioPitchClasses(presetId));
  const inKeyPitchClasses = new Set(getPitchClassesForMajorKey(state.globalArpeggioKeyIndex));

  getSettingsNoteButtonElements().forEach((button) => {
    const pitchClassKey = button.dataset.pitchClassKey;
    const isActive = enabledPitchClasses.has(pitchClassKey);
    const isInKey = inKeyPitchClasses.has(pitchClassKey);
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-in-key", isInKey);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

export function syncArpeggioOctaveRowUI(presetId = state.activeInstrumentPresetId) {
  ensureInstrumentNoteState(presetId);
  const enabledOctaves = new Set(getEnabledArpeggioOctaves(presetId));

  getNoteRowElements().forEach((row) => {
    const octave = Number.parseInt(row.dataset.noteOctave, 10);
    row.classList.toggle("is-disabled", !enabledOctaves.has(octave));
  });

  getNoteRowToggleElements().forEach((button) => {
    const octave = Number.parseInt(button.dataset.noteOctave, 10);
    const isEnabled = enabledOctaves.has(octave);
    button.value = isEnabled ? "1" : "0";
    button.textContent = isEnabled ? "On" : "Off";
    button.classList.toggle("is-active", isEnabled);
    button.setAttribute("aria-pressed", String(isEnabled));
  });

  getNoteButtonElements().forEach((button) => {
    const noteId = button.dataset.noteId;
    const noteOctave = extractOctave(noteId);
    const isEnabled = enabledOctaves.has(noteOctave);
    button.disabled = !isEnabled;
    button.classList.toggle("is-disabled-row", !isEnabled);
  });
}

function syncArpeggioSettingsHistoryView(presetId = state.activeInstrumentPresetId) {
  syncGlobalArpeggioKeyUI();
  syncArpeggioSettingsNoteButtons(presetId);
  syncArpeggioOctaveRowUI(presetId);
  syncNoteButtonsFromActiveInstrumentPage();
  syncArpeggioHistoryButtons();
}

export function syncControlsFromActiveInstrumentPage() {
  const instrumentParams = getInstrumentParams(state.activeInstrumentPresetId);

  controlConfigEntries.forEach(({ id: controlId, key }) => {
    const value = GLOBAL_CONTROL_KEYS.has(key)
      ? state.synthParams[key]
      : instrumentParams[key];
    setControlUIValue(controlId, value);
  });

  syncArpeggioOctaveRowUI(state.activeInstrumentPresetId);
  syncNoteButtonsFromActiveInstrumentPage();
  syncDeadNoteControlsUI(
    instrumentParams.deadNoteAtEnd ?? 0,
    instrumentParams.endPauseCount ?? DEAD_NOTE_PAUSE_COUNT_MIN,
  );
  syncArpeggioSettingsHistoryView(state.activeInstrumentPresetId);
  syncMidiGlobalUI();
  updateTransportUI();
}

export function bindControls() {
  controlConfigEntries.forEach(({ id: controlId }) => {
    const input = document.getElementById(controlId);
    if (input) {
      controlElementCache.set(controlId, input);
    }

    if (!input || input.tagName === "BUTTON") {
      return;
    }

    const eventName = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(eventName, (event) => {
      const controller = event.currentTarget?.controllerRef;
      if (!controller) {
        return;
      }

      if (input.type === "checkbox") {
        controller.setControlValue(controlId, event.target.checked ? 1 : 0);
        return;
      }

      if (controlId === "lfo-rate") {
        const normalized = Number.parseFloat(event.target.value);
        controller.setControlValue(controlId, lfoRateFromNormalized(normalized));
        return;
      }

      if (controlId === "delay-time" || controlId === "clean-delay-time") {
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

export function bindDelayToggleButtons(controller) {
  delayToggleControlIds.forEach((controlId) => {
    const button = document.getElementById(controlId);
    if (!button) {
      return;
    }

    controlElementCache.set(controlId, button);
    button.controllerRef = controller;
    button.addEventListener("click", (event) => {
      const controllerRef = event.currentTarget?.controllerRef;
      if (!controllerRef) {
        return;
      }

      const currentValue = Number.parseInt(event.currentTarget.value, 10);
      const nextValue = currentValue === 1 ? 0 : 1;
      controllerRef.setControlValue(controlId, nextValue);
    });
  });
}

export function bindGlobalKeyActions(controller) {
  const transposeUpButton = getGlobalKeyTransposeUpElement();
  const transposeDownButton = getGlobalKeyTransposeDownElement();

  transposeUpButton?.addEventListener("click", () => {
    controller.transposeArpeggioSettingsByKeyStep(1);
  });
  transposeDownButton?.addEventListener("click", () => {
    controller.transposeArpeggioSettingsByKeyStep(-1);
  });
}

export function bindGlobalTransportControls(controller) {
  const playButton = getGlobalPlayButtonElement();
  const stopButton = getGlobalStopButtonElement();

  playButton?.addEventListener("click", async () => {
    await controller.playAll();
  });


  stopButton?.addEventListener("click", async () => {
    await controller.stopAll();
  });

  syncGlobalTransportButtons();
}

export function bindMidiControls(controller) {
  const midiInputPort = getMidiInputPortElement();
  const midiOutputPort = getMidiOutputPortElement();
  const midiClockMode = getMidiClockModeElement();
  const midiRefresh = getMidiRefreshElement();

  midiInputPort?.addEventListener("change", (event) => {
    controller.setMidiInputPort(event.target.value);
  });

  midiOutputPort?.addEventListener("change", (event) => {
    controller.setMidiOutputPort(event.target.value);
  });

  midiClockMode?.addEventListener("change", (event) => {
    controller.setMidiClockMode(event.target.value);
  });

  midiRefresh?.addEventListener("click", async () => {
    await controller.initializeMidi();
    controller.refreshMidiPorts();
  });

  syncMidiGlobalUI();
}

export function bindStateSeedControls(controller) {
  const seedInput = getStateSeedInputElement();
  const saveButton = getStateSeedSaveElement();
  const loadButton = getStateSeedLoadElement();
  const deleteButton = getStateSeedDeleteElement();

  if (!seedInput || !saveButton || !loadButton || !deleteButton) {
    return;
  }

  syncStateSeedField();

  saveButton.addEventListener("click", () => {
    const seed = controller.getStateSeed();
    syncStateSeedField(seed);
    replaceStateSeedInLocation(seed);
  });

  loadButton.addEventListener("click", () => {
    const seed = seedInput.value.trim();
    if (!seed) {
      if (statusLabel) {
        statusLabel.textContent = "Paste a state seed before loading";
      }
      return;
    }

    const loaded = controller.loadStateSeed(seed);
    if (!loaded) {
      return;
    }

    syncStateSeedField(state.currentStateSeed);
    replaceStateSeedInLocation(state.currentStateSeed);
  });

  deleteButton.addEventListener("click", () => {
    controller.clearStateSeed();
    syncStateSeedField("");
    replaceStateSeedInLocation("");
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
  const rowToggleButtons = getNoteRowToggleElements();

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

  rowToggleButtons.forEach((button) => {
    button.controllerRef = controller;
    button.addEventListener("click", (event) => {
      const octave = event.currentTarget.dataset.noteOctave;
      const controllerRef = event.currentTarget?.controllerRef;
      if (!octave || !controllerRef) {
        return;
      }

      controllerRef.toggleArpeggioOctaveRow(octave);
    });
  });

  ensureInstrumentNoteState(state.activeInstrumentPresetId);
  syncArpeggioOctaveRowUI(state.activeInstrumentPresetId);
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

export function bindSettingsDialog(controller) {
  const toggleButton = getArpeggioSettingsToggleElement();
  const dialog = getArpeggioSettingsDialogElement();
  const closeButton = getArpeggioSettingsCloseElement();
  const applyButton = getArpeggioSettingsApplyElement();
  const historyPrevButton = getArpeggioSettingsHistoryPrevElement();
  const historyNextButton = getArpeggioSettingsHistoryNextElement();
  const keyPrevButton = getArpeggioSettingsKeyPrevElement();
  const keyNextButton = getArpeggioSettingsKeyNextElement();

  if (!toggleButton || !dialog) {
    return;
  }

  const openDialog = () => {
    resetArpeggioApplyChannelSelection();
    syncGlobalArpeggioKeyUI();
    syncArpeggioSettingsNoteButtons(state.activeInstrumentPresetId);
    syncArpeggioHistoryButtons();

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    dialog.setAttribute("open", "open");
  };

  const closeDialog = () => {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }

    dialog.removeAttribute("open");
  };

  toggleButton.addEventListener("click", openDialog);
  closeButton?.addEventListener("click", closeDialog);
  keyPrevButton?.addEventListener("click", () => {
    controller?.stepGlobalArpeggioKey(-1);
  });
  keyNextButton?.addEventListener("click", () => {
    controller?.stepGlobalArpeggioKey(1);
  });
  historyPrevButton?.addEventListener("click", () => {
    const changed = controller?.stepArpeggioHistory(-1);
    if (changed) {
      syncArpeggioSettingsHistoryView(state.activeInstrumentPresetId);
    }
  });
  historyNextButton?.addEventListener("click", () => {
    const changed = controller?.stepArpeggioHistory(1);
    if (changed) {
      syncArpeggioSettingsHistoryView(state.activeInstrumentPresetId);
    }
  });
  applyButton?.addEventListener("click", () => {
    const selectedChannelIds = Array.from(selectedArpeggioApplyChannelIds);
    const applied = controller?.applyActiveArpeggioSettingsToChannels(selectedChannelIds);
    if (!applied) {
      return;
    }

    syncArpeggioSettingsNoteButtons(state.activeInstrumentPresetId);
    syncArpeggioHistoryButtons();
    if (selectedChannelIds.includes(state.activeInstrumentPresetId)) {
      syncNoteButtonsFromActiveInstrumentPage();
    }
    if (statusLabel) {
      const channelCount = selectedChannelIds.length;
      statusLabel.textContent = `Applied settings notes to ${channelCount} selected channel${channelCount === 1 ? "" : "s"}`;
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("click", (event) => {
    const settingsChannelButton = event.target.closest(".settings-channel-btn");
    if (settingsChannelButton) {
      const channelId = settingsChannelButton.dataset.settingsChannelId;
      if (!channelId) {
        return;
      }

      if (selectedArpeggioApplyChannelIds.has(channelId)) {
        selectedArpeggioApplyChannelIds.delete(channelId);
      } else {
        selectedArpeggioApplyChannelIds.add(channelId);
      }

      syncArpeggioSettingsChannelButtons();
      return;
    }

    const settingsNoteButton = event.target.closest(".settings-note-toggle");
    if (settingsNoteButton) {
      const pitchClassKey = settingsNoteButton.dataset.pitchClassKey;
      if (!pitchClassKey) {
        return;
      }

      const changed = controller?.toggleArpeggioPitchClass(pitchClassKey);
      if (changed) {
        syncArpeggioSettingsNoteButtons(state.activeInstrumentPresetId);
      }
      return;
    }

    if (event.target === dialog) {
      closeDialog();
    }
  });
}

export function bindMixerChannels(controller) {
  const mixerChannelsContainer = document.getElementById("mixer-channels");
  if (!mixerChannelsContainer) {
    return;
  }

  mixerChannelsContainer.addEventListener("change", (event) => {
    if (!event.target.classList.contains("channel-instrument-select")) {
      if (!event.target.classList.contains("channel-midi-channel-select")) {
        return;
      }
    }

    const channelId = event.target.dataset.presetId;
    if (!channelId) {
      return;
    }

    if (event.target.classList.contains("channel-midi-channel-select")) {
      controller.setChannelMidiChannel(channelId, event.target.value);
      return;
    }

    const assignedPresetId = event.target.value;
    if (!assignedPresetId) {
      return;
    }

    if (state.activeInstrumentPresetId !== channelId) {
      controller.selectInstrument(channelId);
    }

    controller.setChannelInstrument(channelId, assignedPresetId);
  });

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
    if (event.target.closest(".channel-instrument-select")) {
      return;
    }

    const strip = event.target.closest(".channel-strip");
    if (!strip) {
      return;
    }

    const playBtn = event.target.closest(".channel-play-btn");
    const variationBtn = event.target.closest(".channel-variation-btn");
    const muteBtn = event.target.closest(".channel-mute-btn");
    const noteLengthBtn = event.target.closest(".channel-note-length-btn");
    const midiSendBtn = event.target.closest(".channel-midi-send-btn");
    const midiReceiveBtn = event.target.closest(".channel-midi-receive-btn");
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

    if (muteBtn) {
      controller.toggleChannelMute(presetId);
      return;
    }

    if (noteLengthBtn) {
      const currentValue = Number.parseInt(noteLengthBtn.value, 10);
      const currentIndex = NOTE_LENGTH_OPTIONS.indexOf(currentValue);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % NOTE_LENGTH_OPTIONS.length;
      controller.setControlValue("note-length-toggle", NOTE_LENGTH_OPTIONS[nextIndex]);
      return;
    }

    if (midiSendBtn) {
      controller.toggleChannelMidiSend(presetId);
      return;
    }

    if (midiReceiveBtn) {
      controller.toggleChannelMidiReceive(presetId);
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
      if (type === "initialized") {
        syncStateSeedField(event.detail.seed);
      }
      return;
    }

    if (type === "seed-generated") {
      syncStateSeedField(event.detail.seed);
      if (statusLabel) {
        statusLabel.textContent = "Saved current state to seed";
      }
      return;
    }

    if (type === "seed-loaded") {
      syncControlsFromActiveInstrumentPage();
      syncStateSeedField(event.detail.seed);
      if (statusLabel) {
        statusLabel.textContent = "Loaded state from seed";
      }
      return;
    }

    if (type === "seed-cleared") {
      syncStateSeedField("");
      if (statusLabel) {
        statusLabel.textContent = "Cleared state seed";
      }
      return;
    }

    if (type === "midi-ports-updated" || type === "midi-settings-updated" || type === "midi-clock-state-updated") {
      syncMidiGlobalUI();
      updateTransportUI();
      return;
    }

    if (type === "midi-clock-tempo-updated") {
      setControlUIValue("tempo-bpm", event.detail.value);
      syncMidiGlobalUI();
      return;
    }

    if (type === "channel-midi-updated") {
      renderMixerChannels();
      return;
    }

    if (type === "control-updated") {
      if (GLOBAL_CONTROL_KEYS.has(controlConfig[controlId].key) || presetId === state.activeInstrumentPresetId) {
        setControlUIValue(controlId, value);
      }
      if (controlId === "note-length-toggle") {
        updateChannelNoteLengthButton(presetId, value);
      }
      if (controlId === "tempo-bpm") {
        syncMidiGlobalUI();
      }
      return;
    }

    if (type === "channel-instrument-updated") {
      renderMixerChannels();
      updateChannelNoteLengthButton(presetId, event.detail.noteLength ?? getInstrumentParams(presetId).noteLength ?? 8);
      updateChannelVolumeSlider(presetId, event.detail.channelVolume ?? getInstrumentParams(presetId).channelVolume ?? 1);
      if (presetId === state.activeInstrumentPresetId) {
        syncControlsFromActiveInstrumentPage();
      }
      return;
    }

    if (type === "notes-updated") {
      if (presetId === state.activeInstrumentPresetId) {
        syncArpeggioOctaveRowUI(presetId);
        syncNoteButtonsFromActiveInstrumentPage();
      }
      return;
    }

    if (type === "arpeggio-octave-rows-updated") {
      if (presetId === state.activeInstrumentPresetId) {
        syncArpeggioOctaveRowUI(presetId);
        syncNoteButtonsFromActiveInstrumentPage();
      }
      return;
    }

    if (type === "arpeggio-settings-updated") {
      if (presetId === state.activeInstrumentPresetId) {
        syncArpeggioSettingsNoteButtons(presetId);
      }
      return;
    }

    if (type === "global-arpeggio-key-updated") {
      syncArpeggioSettingsHistoryView(state.activeInstrumentPresetId);
      return;
    }

    if (type === "arpeggio-settings-applied" || type === "arpeggio-settings-applied-to-all") {
      const updatedPresetIds = event.detail.updatedPresetIds || [];
      syncArpeggioSettingsNoteButtons(state.activeInstrumentPresetId);
      syncArpeggioHistoryButtons();
      if (updatedPresetIds.includes(state.activeInstrumentPresetId)) {
        syncNoteButtonsFromActiveInstrumentPage();
      }
      return;
    }

    if (type === "arpeggio-history-stepped") {
      syncArpeggioSettingsHistoryView(state.activeInstrumentPresetId);
      if (statusLabel) {
        const { historyPosition, historyLength, isLivePosition } = event.detail;
        statusLabel.textContent = isLivePosition
          ? `Loaded current arpeggio preset ${historyPosition} of ${historyLength}`
          : `Loaded stored arpeggio preset ${historyPosition} of ${historyLength}`;
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

    if (type === "channel-mute-updated") {
      updateChannelMuteButton(event.detail.presetId, event.detail.value);
      return;
    }

    if (type === "playback-toggled") {
      updateTransportUI();
      return;
    }

    if (type === "transport-state-updated") {
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

