import { BASE_SOUND_PRESETS, DEFAULT_PRESET_ID } from "./constants.js";
import { state } from "./state.js";

const presetLabelCache = new Map();
const presetPanCache = new Map();

function getInitialStereoPan(presetId) {
  if (presetPanCache.has(presetId)) {
    return presetPanCache.get(presetId);
  }

  const presetIds = getPresetIds();
  const index = Math.max(0, presetIds.indexOf(presetId));
  const maxIndex = Math.max(1, presetIds.length - 1);
  const pan = presetIds.length <= 1
    ? 0
    : -0.9 + (index / maxIndex) * 1.8;

  presetPanCache.set(presetId, pan);
  return pan;
}

export function getPresetLabel(presetId) {
  if (presetLabelCache.has(presetId)) {
    return presetLabelCache.get(presetId);
  }
  const label = presetId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  presetLabelCache.set(presetId, label);
  return label;
}

export function getPresetIds() {
  return Object.keys(BASE_SOUND_PRESETS);
}

export function createInstrumentParams(presetId) {
  return {
    ...state.synthParams,
    ...(BASE_SOUND_PRESETS[presetId] || {}),
    // Ensure every instrument starts at a unique panorama position.
    stereoPan: getInitialStereoPan(presetId),
  };
}

export function getInstrumentParams(presetId) {
  if (!state.instrumentParamsByPresetId[presetId]) {
    state.instrumentParamsByPresetId[presetId] = createInstrumentParams(presetId);
  }

  return state.instrumentParamsByPresetId[presetId];
}

export function getActivePresetIds() {
  if (state.activePresetIds.length > 0) {
    return state.activePresetIds;
  }

  return [DEFAULT_PRESET_ID];
}

export function getPlayablePresetIds() {
  return getActivePresetIds().filter((presetId) => state.playingPresetIds.has(presetId));
}

