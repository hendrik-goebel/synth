import { BASE_SOUND_PRESETS, DEFAULT_PRESET_ID, GLOBAL_CONTROL_KEYS } from "./constants.js";
import { state } from "./state.js";

const presetLabelCache = new Map();
const presetPanCache = new Map();
const presetOverrideCache = new Map();
const NON_PRESET_PARAM_KEYS = new Set([...GLOBAL_CONTROL_KEYS, "delayTime"]);
const PRESET_IDS = Object.keys(BASE_SOUND_PRESETS);

function getPresetOverrides(presetId) {
  if (presetOverrideCache.has(presetId)) {
    return presetOverrideCache.get(presetId);
  }

  const source = BASE_SOUND_PRESETS[presetId] || {};
  const result = {};
  const keys = Object.keys(source);

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!NON_PRESET_PARAM_KEYS.has(key)) {
      result[key] = source[key];
    }
  }

  presetOverrideCache.set(presetId, result);
  return result;
}

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
  return PRESET_IDS;
}

export function createInstrumentParams(presetId) {
  const presetOverrides = getPresetOverrides(presetId);

  return {
    ...state.synthParams,
    ...presetOverrides,
    // Keep shared controls global; presets should only contribute instrument-scoped defaults.
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

