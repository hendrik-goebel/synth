import { DEFAULT_NOTE_IDS, NOTE_OPTIONS } from "./constants.js";
import { state } from "./state.js";

export function buildArpeggioPattern(notes) {
  if (notes.length < 2) {
    return notes.slice();
  }

  const ascending = notes.slice();
  const descendingWithoutPeak = notes.slice(0, -1).reverse();

  return ascending.concat(descendingWithoutPeak);
}

export function updateSelectedNotesFromUI() {
  state.instrumentNoteIdsByPresetId[state.activeInstrumentPresetId] = NOTE_OPTIONS
    .filter(({ id }) => {
      const button = document.getElementById(id);
      return button && button.classList.contains("is-active");
    })
    .map(({ id }) => id);

  rebuildInstrumentPattern(state.activeInstrumentPresetId);
}

export function rebuildInstrumentPattern(presetId) {
  const selectedNoteIds = state.instrumentNoteIdsByPresetId[presetId] || DEFAULT_NOTE_IDS.slice();
  const selectedFrequencies = selectedNoteIds
    .map((selectedId) => NOTE_OPTIONS.find((note) => note.id === selectedId))
    .filter(Boolean)
    .map((note) => note.frequency);

  state.instrumentPatternsByPresetId[presetId] = buildArpeggioPattern(selectedFrequencies);
}

export function ensureInstrumentNoteState(presetId) {
  if (!state.instrumentNoteIdsByPresetId[presetId]) {
    state.instrumentNoteIdsByPresetId[presetId] = DEFAULT_NOTE_IDS.slice();
  }

  if (!state.instrumentPatternsByPresetId[presetId]) {
    rebuildInstrumentPattern(presetId);
  }
}

export function getInstrumentPattern(presetId) {
  ensureInstrumentNoteState(presetId);
  return state.instrumentPatternsByPresetId[presetId] || [];
}

export function syncNoteButtonsFromActiveInstrumentPage() {
  ensureInstrumentNoteState(state.activeInstrumentPresetId);
  const selectedNoteIds = state.instrumentNoteIdsByPresetId[state.activeInstrumentPresetId];

  NOTE_OPTIONS.forEach((note) => {
    const noteButton = document.getElementById(note.id);
    if (!noteButton) {
      return;
    }

    const isActive = selectedNoteIds.includes(note.id);
    noteButton.classList.toggle("is-active", isActive);
    noteButton.setAttribute("aria-pressed", String(isActive));
  });
}

export function hasPatternForPreset(presetId) {
  return getInstrumentPattern(presetId).length > 0;
}

