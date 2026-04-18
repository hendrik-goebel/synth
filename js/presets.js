import {
  BASE_SOUND_PRESETS,
  DEFAULT_PRESET_ID,
  GLOBAL_CONTROL_KEYS,
  MIXER_CHANNEL_IDS,
  PRESET_CATEGORY_LABELS,
  PRESET_CATEGORY_ORDER,
  PRESET_METADATA,
} from "./constants.js";
import { state } from "./state.js";

const presetLabelCache = new Map();
const presetPanCache = new Map();
const presetOverrideCache = new Map();
const NON_PRESET_PARAM_KEYS = new Set([...GLOBAL_CONTROL_KEYS, "delayTime", "cleanDelayTime"]);
const AVAILABLE_PRESET_IDS = Object.keys(BASE_SOUND_PRESETS);
const CHANNEL_IDS = MIXER_CHANNEL_IDS.slice();
const AVAILABLE_PRESET_GROUPS = buildAvailablePresetGroups();
const CHANNEL_LOCAL_PARAM_KEYS = [
  "channelVolume",
  "stereoPan",
  "noteLength",
  "deadNoteAtEnd",
  "endPauseCount",
];

function buildAvailablePresetGroups() {
  const groupedPresetIds = new Map();

  AVAILABLE_PRESET_IDS.forEach((presetId) => {
    const categoryKey = PRESET_METADATA[presetId]?.categoryKey || "textures";
    if (!groupedPresetIds.has(categoryKey)) {
      groupedPresetIds.set(categoryKey, []);
    }
    groupedPresetIds.get(categoryKey).push(presetId);
  });

  const orderedGroups = PRESET_CATEGORY_ORDER
    .filter((categoryKey) => groupedPresetIds.has(categoryKey))
    .map((categoryKey) => ({
      key: categoryKey,
      label: PRESET_CATEGORY_LABELS[categoryKey] || categoryKey,
      presetIds: groupedPresetIds.get(categoryKey),
    }));

  const unorderedGroups = Array.from(groupedPresetIds.keys())
    .filter((categoryKey) => !PRESET_CATEGORY_ORDER.includes(categoryKey))
    .sort((left, right) => left.localeCompare(right))
    .map((categoryKey) => ({
      key: categoryKey,
      label: PRESET_CATEGORY_LABELS[categoryKey] || categoryKey,
      presetIds: groupedPresetIds.get(categoryKey),
    }));

  return [...orderedGroups, ...unorderedGroups];
}

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
  const label = PRESET_METADATA[presetId]?.label || presetId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  presetLabelCache.set(presetId, label);
  return label;
}

export function getPresetIds() {
  return CHANNEL_IDS;
}

export function getAvailablePresetIds() {
  return AVAILABLE_PRESET_IDS;
}

export function getPresetCategoryKey(presetId) {
  return PRESET_METADATA[presetId]?.categoryKey || "textures";
}

export function getPresetCategoryLabel(presetId) {
  const categoryKey = getPresetCategoryKey(presetId);
  return PRESET_CATEGORY_LABELS[categoryKey] || categoryKey;
}

export function getAvailablePresetGroups() {
  return AVAILABLE_PRESET_GROUPS;
}

export function getAssignedPresetId(channelId) {
  return state.channelAssignedPresetIdById[channelId] || channelId;
}

export function createInstrumentParams(channelId, assignedPresetId = getAssignedPresetId(channelId), previousParams = null) {
  const presetOverrides = getPresetOverrides(assignedPresetId);
  const preservedParams = previousParams || {};

  return {
    ...state.synthParams,
    ...presetOverrides,
    // Keep shared controls global; presets should only contribute instrument-scoped defaults.
    // Ensure every instrument starts at a unique panorama position.
    channelVolume: preservedParams.channelVolume ?? 1,
    stereoPan: preservedParams.stereoPan ?? getInitialStereoPan(channelId),
    ...(preservedParams.noteLength !== undefined ? { noteLength: preservedParams.noteLength } : {}),
    ...(preservedParams.deadNoteAtEnd !== undefined ? { deadNoteAtEnd: preservedParams.deadNoteAtEnd } : {}),
    ...(preservedParams.endPauseCount !== undefined ? { endPauseCount: preservedParams.endPauseCount } : {}),
  };
}

export function applyAssignedPresetToChannel(channelId, assignedPresetId) {
  const previousParams = state.instrumentParamsByPresetId[channelId]
    ? CHANNEL_LOCAL_PARAM_KEYS.reduce((result, key) => {
      result[key] = state.instrumentParamsByPresetId[channelId][key];
      return result;
    }, {})
    : null;

  state.channelAssignedPresetIdById[channelId] = assignedPresetId;
  state.instrumentParamsByPresetId[channelId] = createInstrumentParams(
    channelId,
    assignedPresetId,
    previousParams,
  );

  return state.instrumentParamsByPresetId[channelId];
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

