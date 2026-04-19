import {
  DEFAULT_RANDOM_PITCH_CLASS_KEYS,
  extractPitchClass,
  getPitchClassesForMajorKey,
  NOTE_OPTIONS,
  PITCH_CLASS_OPTIONS,
  PENTATONIC_NOTE_IDS,
} from "./constants.js";
import { getInstrumentParams } from "./presets.js";
import { state } from "./state.js";

// Pre-built Map for O(1) frequency lookups instead of linear NOTE_OPTIONS.find()
const noteFrequencyMap = new Map(NOTE_OPTIONS.map(({ id, frequency }) => [id, frequency]));
const noteOrderIndexMap = new Map(NOTE_OPTIONS.map(({ id }, index) => [id, index]));
const pitchClassOrder = PITCH_CLASS_OPTIONS.map(({ key }) => key);
const pitchClassOrderIndexMap = new Map(pitchClassOrder.map((key, index) => [key, index]));

function shuffle(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[randomIndex]] = [clone[randomIndex], clone[i]];
  }
  return clone;
}

function getRandomNoteIdsFromPool(noteIds, desiredCount = null) {
  const pool = noteIds.slice();

  if (pool.length === 0) {
    return [];
  }

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[randomIndex]] = [pool[randomIndex], pool[i]];
  }

  const maxCount = Math.min(5, pool.length);
  const minCount = Math.min(2, maxCount);
  const hasDesiredCount = Number.isInteger(desiredCount);
  const count = hasDesiredCount
    ? Math.max(0, Math.min(pool.length, desiredCount))
    : minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

  return pool
    .slice(0, count)
    .sort((a, b) => noteOrderIndexMap.get(a) - noteOrderIndexMap.get(b));
}

export function getEligibleRandomNotePoolFromPitchClasses(enabledPitchClassKeys) {
  const enabledPitchClasses = new Set(enabledPitchClassKeys);
  const eligibleNoteIds = NOTE_OPTIONS
    .map(({ id }) => id)
    .filter((id) => enabledPitchClasses.has(extractPitchClass(id)));

  if (eligibleNoteIds.length > 0) {
    return eligibleNoteIds;
  }

  return PENTATONIC_NOTE_IDS.slice();
}

export function getEligibleRandomNotePool(presetId) {
  return getEligibleRandomNotePoolFromPitchClasses(getEnabledArpeggioPitchClasses(presetId));
}

function getDefaultEnabledRandomNoteIds(presetId) {
  return getRandomNoteIdsFromPool(getEligibleRandomNotePool(presetId));
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

export function buildArpeggioPattern(notes, trailingPauseCount = 0) {
  let pattern;

  if (notes.length < 2) {
    pattern = notes.slice();
  } else {
    const ascending = notes.slice();
    const descendingWithoutPeakOrRoot = notes.slice(1, -1).reverse();

    pattern = ascending.concat(descendingWithoutPeakOrRoot);
  }

  const normalizedPauseCount = Math.max(0, Math.floor(trailingPauseCount));
  for (let i = 0; i < normalizedPauseCount; i += 1) {
    pattern.push(null);
  }

  return pattern;
}

export function ensureInstrumentArpeggioPitchClassState(presetId) {
  if (!state.instrumentArpeggioPitchClassesByPresetId[presetId]) {
    state.instrumentArpeggioPitchClassesByPresetId[presetId] = DEFAULT_RANDOM_PITCH_CLASS_KEYS.slice();
  }
}

export function getEnabledArpeggioPitchClasses(presetId) {
  ensureInstrumentArpeggioPitchClassState(presetId);
  return state.instrumentArpeggioPitchClassesByPresetId[presetId].slice();
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
  const selectedNoteIds = state.instrumentNoteIdsByPresetId[presetId] || getEligibleRandomNotePool(presetId).slice(0, 3);
  const instrumentParams = getInstrumentParams(presetId);
  const selectedFrequencies = selectedNoteIds
    .map((id) => noteFrequencyMap.get(id))
    .filter(Boolean);

  state.instrumentPatternsByPresetId[presetId] = buildArpeggioPattern(
    selectedFrequencies,
    instrumentParams.deadNoteAtEnd ? instrumentParams.endPauseCount ?? 1 : 0,
  );
}

export function createInstrumentNoteVariation(presetId) {
  ensureInstrumentNoteState(presetId);

  const currentNoteIds = state.instrumentNoteIdsByPresetId[presetId] || [];
  if (currentNoteIds.length === 0) {
    return { changed: false, noteIds: [] };
  }

  const availableEnabledReplacements = getEligibleRandomNotePool(presetId)
    .filter((id) => !currentNoteIds.includes(id));

  if (availableEnabledReplacements.length === 0) {
    return { changed: false, noteIds: currentNoteIds.slice() };
  }

  const maxChanges = Math.max(1, Math.floor(currentNoteIds.length * 0.6));
  const desiredChanges = 1 + Math.floor(Math.random() * maxChanges);
  const actualChanges = Math.min(
    desiredChanges,
    currentNoteIds.length,
    availableEnabledReplacements.length,
  );

  const indexPool = shuffle(currentNoteIds.map((_, index) => index));
  const replacementPool = shuffle(availableEnabledReplacements);
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

export function transposeInstrumentArpeggioPitchClassesByKeyStep(presetId, step) {
  ensureInstrumentNoteState(presetId);

  const normalizedStep = Number.parseInt(step, 10);
  if (!Number.isInteger(normalizedStep) || normalizedStep === 0) {
    return {
      changed: false,
      pitchClassKeys: getEnabledArpeggioPitchClasses(presetId),
      reason: "Transpose step must be a non-zero integer",
    };
  }

  const currentPitchClasses = getEnabledArpeggioPitchClasses(presetId)
    .slice()
    .sort((left, right) => pitchClassOrderIndexMap.get(left) - pitchClassOrderIndexMap.get(right));

  if (currentPitchClasses.length === 0) {
    return {
      changed: false,
      pitchClassKeys: [],
      reason: "No settings notes available to transpose",
    };
  }

  const keyPitchClasses = getPitchClassesForMajorKey(state.globalArpeggioKeyIndex);
  const keyPitchClassSet = new Set(keyPitchClasses);

  const shiftPitchClass = (pitchClassKey) => {
    const startIndex = pitchClassOrderIndexMap.get(pitchClassKey);
    const safeStartIndex = Number.isInteger(startIndex) ? startIndex : 0;

    if (keyPitchClassSet.has(pitchClassKey)) {
      const keyIndex = keyPitchClasses.indexOf(pitchClassKey);
      const nextKeyIndex = (keyIndex + normalizedStep + keyPitchClasses.length) % keyPitchClasses.length;
      return keyPitchClasses[nextKeyIndex];
    }

    for (let offset = 1; offset <= pitchClassOrder.length; offset += 1) {
      const nextIndex = (safeStartIndex + (normalizedStep > 0 ? offset : -offset) + pitchClassOrder.length) % pitchClassOrder.length;
      const candidate = pitchClassOrder[nextIndex];
      if (keyPitchClassSet.has(candidate)) {
        return candidate;
      }
    }

    return keyPitchClasses[0] || pitchClassKey;
  };

  const nextPitchClasses = Array.from(new Set(currentPitchClasses.map(shiftPitchClass)))
    .sort((left, right) => pitchClassOrderIndexMap.get(left) - pitchClassOrderIndexMap.get(right));

  const unchanged = nextPitchClasses.length === currentPitchClasses.length
    && nextPitchClasses.every((pitchClassKey, index) => pitchClassKey === currentPitchClasses[index]);

  state.instrumentArpeggioPitchClassesByPresetId[presetId] = nextPitchClasses;

  return {
    changed: !unchanged,
    pitchClassKeys: nextPitchClasses,
  };
}

export function regenerateInstrumentRandomNoteIds(presetId, desiredCount) {
  ensureInstrumentArpeggioPitchClassState(presetId);

  const eligibleNotePool = getEligibleRandomNotePool(presetId);
  const normalizedDesiredCount = Math.max(0, Math.floor(Number.isFinite(desiredCount) ? desiredCount : 0));

  if (normalizedDesiredCount > eligibleNotePool.length) {
    return {
      changed: false,
      noteIds: state.instrumentNoteIdsByPresetId[presetId]?.slice() || [],
      maxAvailableCount: eligibleNotePool.length,
      requestedCount: normalizedDesiredCount,
    };
  }

  const nextNoteIds = getRandomNoteIdsFromPool(eligibleNotePool, normalizedDesiredCount);
  state.instrumentNoteIdsByPresetId[presetId] = nextNoteIds;
  rebuildInstrumentPattern(presetId);

  return {
    changed: true,
    noteIds: nextNoteIds,
    maxAvailableCount: eligibleNotePool.length,
    requestedCount: normalizedDesiredCount,
  };
}

export function ensureInstrumentNoteState(presetId) {
  ensureInstrumentArpeggioPitchClassState(presetId);

  if (!state.instrumentNoteIdsByPresetId[presetId]) {
    state.instrumentNoteIdsByPresetId[presetId] = getDefaultEnabledRandomNoteIds(presetId);
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

