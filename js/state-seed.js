import {
  GLOBAL_CONTROL_KEYS,
  INITIAL_SYNTH_PARAMS,
} from "./constants.js";
import {
  ensureInstrumentNoteState,
  getEnabledArpeggioOctaves,
  getEnabledArpeggioPitchClasses,
} from "./patterns.js";
import {
  getAssignedPresetId,
  getInstrumentParams,
  getPresetIds,
} from "./presets.js";
import { state } from "./state.js";

export const STATE_SEED_VERSION = 1;

const DERIVED_SYNTH_PARAM_KEYS = new Set(["delayTime", "cleanDelayTime"]);
const CHANNEL_LOCAL_PARAM_KEYS = ["channelVolume", "channelMuted"];

export const STATE_SEED_GLOBAL_PARAM_KEYS = Object.keys(INITIAL_SYNTH_PARAMS)
  .filter((key) => GLOBAL_CONTROL_KEYS.has(key));

export const STATE_SEED_CHANNEL_PARAM_KEYS = Array.from(new Set([
  ...Object.keys(INITIAL_SYNTH_PARAMS)
    .filter((key) => !GLOBAL_CONTROL_KEYS.has(key) && !DERIVED_SYNTH_PARAM_KEYS.has(key)),
  ...CHANNEL_LOCAL_PARAM_KEYS,
]));

function pickValues(source, keys) {
  return keys.reduce((result, key) => {
    if (source?.[key] !== undefined) {
      result[key] = source[key];
    }
    return result;
  }, {});
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("Base64 encoding is not available in this environment");
}

function base64ToBytes(base64) {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  if (typeof atob === "function") {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  throw new Error("Base64 decoding is not available in this environment");
}

function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(seed) {
  const normalized = seed
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(seed.length / 4) * 4, "=");
  const bytes = base64ToBytes(normalized);
  return new TextDecoder().decode(bytes);
}

export function createStateSeedSnapshot() {
  const channels = {};

  getPresetIds().forEach((channelId) => {
    ensureInstrumentNoteState(channelId);
    channels[channelId] = {
      assignedPresetId: getAssignedPresetId(channelId),
      params: pickValues(getInstrumentParams(channelId), STATE_SEED_CHANNEL_PARAM_KEYS),
      enabledPitchClasses: getEnabledArpeggioPitchClasses(channelId),
      enabledOctaves: getEnabledArpeggioOctaves(channelId),
      noteIds: state.instrumentNoteIdsByPresetId[channelId]?.slice() || [],
    };
  });

  return {
    v: STATE_SEED_VERSION,
    activeInstrumentPresetId: state.activeInstrumentPresetId,
    globalArpeggioKeyIndex: state.globalArpeggioKeyIndex,
    synthParams: pickValues(state.synthParams, STATE_SEED_GLOBAL_PARAM_KEYS),
    channels,
  };
}

export function encodeStateSeedSnapshot(snapshot = createStateSeedSnapshot()) {
  return encodeBase64Url(JSON.stringify(snapshot));
}

export function decodeStateSeedString(seed) {
  const normalizedSeed = `${seed ?? ""}`.trim();
  if (!normalizedSeed) {
    throw new Error("State seed is empty");
  }

  const payload = normalizedSeed.startsWith("{")
    ? normalizedSeed
    : decodeBase64Url(normalizedSeed);

  return JSON.parse(payload);
}

export function getStateSeedFromLocation(locationLike = globalThis.window?.location) {
  if (!locationLike) {
    return "";
  }

  const href = typeof locationLike === "string"
    ? locationLike
    : locationLike.href
      || `https://seed.local${locationLike.pathname || "/"}${locationLike.search || ""}${locationLike.hash || ""}`;
  const url = new URL(href, "https://seed.local");
  const searchSeed = url.searchParams.get("seed");
  if (searchSeed) {
    return searchSeed.trim();
  }

  if (url.hash.startsWith("#seed=")) {
    return new URLSearchParams(url.hash.slice(1)).get("seed")?.trim() || "";
  }

  return "";
}

export function replaceStateSeedInLocation(
  seed,
  {
    locationLike = globalThis.window?.location,
    historyLike = globalThis.window?.history,
  } = {},
) {
  if (!locationLike || !historyLike || typeof historyLike.replaceState !== "function") {
    return false;
  }

  const href = typeof locationLike === "string"
    ? locationLike
    : locationLike.href
      || `https://seed.local${locationLike.pathname || "/"}${locationLike.search || ""}${locationLike.hash || ""}`;
  const url = new URL(href, "https://seed.local");
  const normalizedSeed = `${seed ?? ""}`.trim();

  if (normalizedSeed) {
    url.searchParams.set("seed", normalizedSeed);
  } else {
    url.searchParams.delete("seed");
  }
  url.hash = "";

  historyLike.replaceState(historyLike.state ?? null, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

