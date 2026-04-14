import { NOTE_OPTIONS, PENTATONIC_NOTE_IDS } from "./constants.js";
import { getInstrumentParams } from "./presets.js";
import { state } from "./state.js";

// Pre-built Map for O(1) frequency lookups instead of linear NOTE_OPTIONS.find()
const noteFrequencyMap = new Map(NOTE_OPTIONS.map(({ id, frequency }) => [id, frequency]));
const noteOrderIndexMap = new Map(NOTE_OPTIONS.map(({ id }, index) => [id, index]));

function shuffle(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[randomIndex]] = [clone[randomIndex], clone[i]];
  }
  return clone;
}

function getRandomPentatonicNoteIds() {
  const pool = PENTATONIC_NOTE_IDS.slice();

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[randomIndex]] = [pool[randomIndex], pool[i]];
  }

  const maxCount = Math.min(5, pool.length);
  const minCount = Math.min(2, maxCount);
  const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

  return pool
    .slice(0, count)
    .sort((a, b) => noteOrderIndexMap.get(a) - noteOrderIndexMap.get(b));
}

const noteLengthWeightsByNoteCount = {
  2: [
    { value: 3, weight: 7 },
    { value: 4, weight: 4 },
    { value: 6, weight: 4 },
    { value: 8, weight: 2 },
    { value: 16, weight: 1 },
  ],
  3: [
    { value: 3, weight: 5 },
    { value: 4, weight: 4 },
    { value: 6, weight: 4 },
    { value: 8, weight: 3 },
    { value: 16, weight: 2 },
  ],
  4: [
    { value: 3, weight: 3 },
    { value: 4, weight: 4 },
    { value: 6, weight: 4 },
    { value: 8, weight: 4 },
    { value: 16, weight: 3 },
  ],
  5: [
    { value: 3, weight: 1 },
    { value: 4, weight: 2 },
    { value: 6, weight: 3 },
    { value: 8, weight: 5 },
    { value: 16, weight: 5 },
  ],
};

function getRandomWeightedNoteLength(noteCount) {
  const clampedCount = Math.min(5, Math.max(2, noteCount));
  const options = noteLengthWeightsByNoteCount[clampedCount] || noteLengthWeightsByNoteCount[3];
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let randomWeight = Math.random() * totalWeight;

  for (let i = 0; i < options.length; i += 1) {
    randomWeight -= options[i].weight;
    if (randomWeight <= 0) {
      return options[i].value;
    }
  }

  return options[options.length - 1].value;
}

// Cache note button DOM elements after first access
let noteButtonCache = null;

function getNoteButtonCache() {
  if (!noteButtonCache) {
    noteButtonCache = new Map(
      NOTE_OPTIONS.map(({ id }) => [id, document.getElementById(id)]),
    );
  }
  return noteButtonCache;
}

export function buildArpeggioPattern(notes) {
  if (notes.length < 2) {
    return notes.slice();
  }

  const ascending = notes.slice();
  const descendingWithoutPeak = notes.slice(0, -1).reverse();

  return ascending.concat(descendingWithoutPeak);
}

export function updateSelectedNotesFromUI() {
  const buttons = getNoteButtonCache();
  state.instrumentNoteIdsByPresetId[state.activeInstrumentPresetId] = NOTE_OPTIONS
    .filter(({ id }) => {
      const button = buttons.get(id);
      return button && button.classList.contains("is-active");
    })
    .map(({ id }) => id);

  rebuildInstrumentPattern(state.activeInstrumentPresetId);
}

export function rebuildInstrumentPattern(presetId) {
  const selectedNoteIds = state.instrumentNoteIdsByPresetId[presetId] || PENTATONIC_NOTE_IDS.slice(0, 3);
  const selectedFrequencies = selectedNoteIds
    .map((id) => noteFrequencyMap.get(id))
    .filter(Boolean);

  state.instrumentPatternsByPresetId[presetId] = buildArpeggioPattern(selectedFrequencies);
}

export function createInstrumentNoteVariation(presetId) {
  ensureInstrumentNoteState(presetId);

  const currentNoteIds = state.instrumentNoteIdsByPresetId[presetId] || [];
  if (currentNoteIds.length === 0) {
    return { changed: false, noteIds: [] };
  }

  const availablePentatonicReplacements = PENTATONIC_NOTE_IDS
    .filter((id) => !currentNoteIds.includes(id));

  if (availablePentatonicReplacements.length === 0) {
    return { changed: false, noteIds: currentNoteIds.slice() };
  }

  const maxChanges = Math.max(1, Math.floor(currentNoteIds.length * 0.6));
  const desiredChanges = 1 + Math.floor(Math.random() * maxChanges);
  const actualChanges = Math.min(
    desiredChanges,
    currentNoteIds.length,
    availablePentatonicReplacements.length,
  );

  const indexPool = shuffle(currentNoteIds.map((_, index) => index));
  const replacementPool = shuffle(availablePentatonicReplacements);
  const nextNoteIds = currentNoteIds.slice();

  for (let i = 0; i < actualChanges; i += 1) {
    nextNoteIds[indexPool[i]] = replacementPool[i];
  }

  const normalized = Array.from(new Set(nextNoteIds))
    .sort((a, b) => noteOrderIndexMap.get(a) - noteOrderIndexMap.get(b));

  state.instrumentNoteIdsByPresetId[presetId] = normalized;
  rebuildInstrumentPattern(presetId);

  return { changed: true, noteIds: normalized };
}

export function ensureInstrumentNoteState(presetId) {
  if (!state.instrumentNoteIdsByPresetId[presetId]) {
    state.instrumentNoteIdsByPresetId[presetId] = getRandomPentatonicNoteIds();
  }

  if (!state.instrumentNoteLengthInitializedByPresetId[presetId]) {
    const instrumentParams = getInstrumentParams(presetId);
    const noteCount = state.instrumentNoteIdsByPresetId[presetId].length;
    instrumentParams.noteLength = getRandomWeightedNoteLength(noteCount);
    state.instrumentNoteLengthInitializedByPresetId[presetId] = true;
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
  const buttons = getNoteButtonCache();

  NOTE_OPTIONS.forEach((note) => {
    const noteButton = buttons.get(note.id);
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

