export const REVERB_SECONDS = 2;
export const REVERB_DECAY = 2.4;
export const HUMANIZE = {
  detuneCents: 0.8,
  gainAmount: 0.1,
  attackSeconds: 0.008,
  decaySeconds: 0.03,
  cutoffAmount: 0.12,
  panAmount: 0.22,
  fxSendAmount: 0.12,
  upperAmount: 0.1,
  transientAmount: 0.18,
  pitchDropCents: 0.22,
};
export const MAX_SIMULTANEOUS_PRESETS = 8;
export const NOTE_LENGTH_OPTIONS = [8, 16, 6, 4, 3];
export const DEAD_NOTE_PAUSE_COUNT_MIN = 1;
export const DEAD_NOTE_PAUSE_COUNT_MAX = 16;
export const DELAY_FEEDBACK_MAX = 1;
export const DELAY_FEEDBACK_LOG_MIN = 0.001;
export const CLEAN_DELAY_REPETITIONS_MIN = 1;
export const CLEAN_DELAY_REPETITIONS_MAX = 12;
export const DISTORTION_FEEDBACK_MAX = 0.35;
export const DELAY_DIVISION_OPTIONS = [
  { label: "1/32", beats: 0.125 },
  { label: "1/16T", beats: 1 / 6 },
  { label: "1/16", beats: 0.25 },
  { label: "1/8T", beats: 1 / 3 },
  { label: "1/8", beats: 0.5 },
  { label: "1/4T", beats: 2 / 3 },
  { label: "1/8D", beats: 0.75 },
  { label: "1/4", beats: 1 },
];
export const LFO_TARGET_OPTIONS = [
  { label: "Off", key: null, min: 0, max: 0 },
  { label: "Filter Cutoff", key: "filterCutoff", min: 250, max: 8000 },
  { label: "Filter Resonance", key: "filterQ", min: 0.2, max: 12 },
];
export const LFO_RATE_MIN_HZ = 0.05;
export const LFO_RATE_MAX_HZ = 12;
export const LFO_RATE_CURVE_EXPONENT = 1.15;

export function clampLfoRateHz(value) {
  const numeric = Number.isFinite(value) ? value : LFO_RATE_MIN_HZ;
  return Math.min(LFO_RATE_MAX_HZ, Math.max(LFO_RATE_MIN_HZ, numeric));
}

export function lfoRateFromNormalized(normalized) {
  const t = Math.min(1, Math.max(0, Number.isFinite(normalized) ? normalized : 0));
  const curved = Math.pow(t, LFO_RATE_CURVE_EXPONENT);
  const ratio = LFO_RATE_MAX_HZ / LFO_RATE_MIN_HZ;
  return LFO_RATE_MIN_HZ * Math.pow(ratio, curved);
}

export function normalizedFromLfoRate(rateHz) {
  const clampedRate = clampLfoRateHz(rateHz);
  const ratio = LFO_RATE_MAX_HZ / LFO_RATE_MIN_HZ;
  const curved = Math.log(clampedRate / LFO_RATE_MIN_HZ) / Math.log(ratio);
  return Math.pow(curved, 1 / LFO_RATE_CURVE_EXPONENT);
}

export function delayFeedbackFromNormalized(normalized) {
  const t = Math.min(1, Math.max(0, Number.isFinite(normalized) ? normalized : 0));
  if (t === 0) {
    return 0;
  }

  const ratio = DELAY_FEEDBACK_MAX / DELAY_FEEDBACK_LOG_MIN;
  return DELAY_FEEDBACK_LOG_MIN * Math.pow(ratio, t);
}

export function normalizedFromDelayFeedback(value) {
  const clampedValue = Math.min(DELAY_FEEDBACK_MAX, Math.max(0, Number.isFinite(value) ? value : 0));
  if (clampedValue === 0) {
    return 0;
  }

  const ratio = DELAY_FEEDBACK_MAX / DELAY_FEEDBACK_LOG_MIN;
  return Math.log(clampedValue / DELAY_FEEDBACK_LOG_MIN) / Math.log(ratio);
}

export function delayDivisionIndexFromUiValue(uiValue) {
  const maxIndex = DELAY_DIVISION_OPTIONS.length - 1;
  const roundedUiValue = Math.round(Number.isFinite(uiValue) ? uiValue : maxIndex - 4);
  return Math.max(0, Math.min(maxIndex, maxIndex - roundedUiValue));
}

export function uiValueFromDelayDivisionIndex(index) {
  const maxIndex = DELAY_DIVISION_OPTIONS.length - 1;
  const roundedIndex = Math.round(Number.isFinite(index) ? index : 4);
  return Math.max(0, Math.min(maxIndex, maxIndex - roundedIndex));
}

export const DEFAULT_NOTE_IDS = ["note-c4", "note-e4", "note-g4"];
export const PITCH_CLASS_OPTIONS = [
  { key: "c", label: "C" },
  { key: "cs", label: "C#" },
  { key: "d", label: "D" },
  { key: "ds", label: "D#" },
  { key: "e", label: "E" },
  { key: "f", label: "F" },
  { key: "fs", label: "F#" },
  { key: "g", label: "G" },
  { key: "gs", label: "G#" },
  { key: "a", label: "A" },
  { key: "as", label: "A#" },
  { key: "b", label: "B" },
];
export const CIRCLE_OF_FIFTHS_KEY_ORDER = ["c", "g", "d", "a", "e", "b", "fs", "cs", "gs", "ds", "as", "f"];
export const DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX = 0;

const MAJOR_KEY_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const PITCH_CLASS_KEY_ORDER = PITCH_CLASS_OPTIONS.map(({ key }) => key);
const PITCH_CLASS_LABEL_BY_KEY = new Map(PITCH_CLASS_OPTIONS.map(({ key, label }) => [key, label]));

export function normalizeCircleOfFifthsKeyIndex(index) {
  const total = CIRCLE_OF_FIFTHS_KEY_ORDER.length;
  const numeric = Number.isFinite(index) ? Math.round(index) : DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX;
  return ((numeric % total) + total) % total;
}

export function getCircleOfFifthsKey(index) {
  return CIRCLE_OF_FIFTHS_KEY_ORDER[normalizeCircleOfFifthsKeyIndex(index)];
}

export function getCircleOfFifthsKeyLabel(index) {
  return PITCH_CLASS_LABEL_BY_KEY.get(getCircleOfFifthsKey(index)) || "C";
}

export function getPitchClassLabel(key) {
  return PITCH_CLASS_LABEL_BY_KEY.get(key) || "C";
}

export function getPitchClassesForMajorKey(keyOrIndex) {
  const tonicKey = typeof keyOrIndex === "string"
    ? keyOrIndex
    : getCircleOfFifthsKey(keyOrIndex);
  const tonicIndex = PITCH_CLASS_KEY_ORDER.indexOf(tonicKey);
  const normalizedTonicIndex = tonicIndex === -1 ? 0 : tonicIndex;
  return MAJOR_KEY_SCALE_INTERVALS.map(
    (interval) => PITCH_CLASS_KEY_ORDER[(normalizedTonicIndex + interval) % PITCH_CLASS_KEY_ORDER.length],
  );
}

export const DEFAULT_RANDOM_PITCH_CLASS_KEYS = ["c", "d", "e", "g", "a"];
export const NOTE_OPTIONS = [
  { id: "note-c4", frequency: 261.63 },
  { id: "note-cs4", frequency: 277.18 },
  { id: "note-d4", frequency: 293.66 },
  { id: "note-ds4", frequency: 311.13 },
  { id: "note-e4", frequency: 329.63 },
  { id: "note-f4", frequency: 349.23 },
  { id: "note-fs4", frequency: 369.99 },
  { id: "note-g4", frequency: 392.0 },
  { id: "note-gs4", frequency: 415.3 },
  { id: "note-a4", frequency: 440.0 },
  { id: "note-as4", frequency: 466.16 },
  { id: "note-b4", frequency: 493.88 },
  { id: "note-c5", frequency: 523.25 },
  { id: "note-cs5", frequency: 554.37 },
  { id: "note-d5", frequency: 587.33 },
  { id: "note-ds5", frequency: 622.25 },
  { id: "note-e5", frequency: 659.25 },
  { id: "note-f5", frequency: 698.46 },
  { id: "note-fs5", frequency: 739.99 },
  { id: "note-g5", frequency: 783.99 },
  { id: "note-gs5", frequency: 830.61 },
  { id: "note-a5", frequency: 880.0 },
  { id: "note-as5", frequency: 932.33 },
  { id: "note-b5", frequency: 987.77 },
];

const PENTATONIC_PITCH_CLASSES = new Set(["c", "d", "e", "g", "a"]);
export function extractPitchClass(noteId) {
  return noteId.replace("note-", "").replace(/[0-9]+$/, "");
}
export const PENTATONIC_NOTE_IDS = NOTE_OPTIONS
  .map(({ id }) => id)
  .filter((id) => PENTATONIC_PITCH_CLASSES.has(extractPitchClass(id)));
export const BASE_SOUND_PRESETS = {
  "warm": {
    oscAWave: "sawtooth",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 2.5,
    subLevel: 0.8,
    upperLevel: 0.48,
    filterCutoff: 760,
    filterTracking: 0.62,
    filterQ: 0.95,
    attack: 0.16,
    decay: 0.65,
    release: 0.24,
    reverbSend: 0.56,
    distortionDrive: 0.28,
    distortionMix: 0.16,
    distortionTone: 2200,
  },
  pluck: {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 0.8,
    subLevel: 0.46,
    upperLevel: 0.46,
    filterCutoff: 1050,
    filterTracking: 0.82,
    filterQ: 1.2,
    attack: 0.006,
    decay: 0.12,
    release: 0.08,
    distortionDrive: 0.22,
    distortionMix: 0.12,
    distortionTone: 1500,
    transientAmount: 0.18,
    transientDecay: 0.018,
    transientTone: 1400,
    pitchDropCents: 18,
  },
  organ: {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "triangle",
    detuneSpread: 0.4,
    subLevel: 0.78,
    upperLevel: 0.46,
    filterCutoff: 900,
    filterTracking: 0.56,
    filterQ: 0.7,
    attack: 0.06,
    decay: 0.34,
    release: 0.18,
    reverbSend: 0.22,
    distortionDrive: 0.25,
    distortionMix: 0.16,
    distortionTone: 1700,
  },
  bass: {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "sine",
    detuneSpread: 1.4,
    subLevel: 0.98,
    upperLevel: 0.46,
    filterCutoff: 430,
    filterTracking: 0.45,
    filterQ: 1.1,
    attack: 0.006,
    decay: 0.22,
    release: 0.12,
    distortionDrive: 0.58,
    distortionMix: 0.36,
    distortionTone: 1250,
    transientAmount: 0.1,
    transientDecay: 0.028,
    transientTone: 760,
    pitchDropCents: 40,
  },
  "glass": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 4.5,
    subLevel: 0.58,
    upperLevel: 0.34,
    filterCutoff: 920,
    filterTracking: 0.78,
    filterQ: 1.1,
    attack: 0.012,
    decay: 0.03,
    release: 0.14,
    stereoPan: 0.2,
    reverbSend: 0.18,
    delaySend: 0.04,
    distortionDrive: 0.18,
    distortionMix: 0.1,
    distortionTone: 1700,
    transientAmount: 0.08,
    transientDecay: 0.022,
    transientTone: 1900,
    pitchDropCents: 10,
  },
  "acid": {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "triangle",
    detuneSpread: 1.1,
    subLevel: 0.48,
    upperLevel: 0.66,
    filterCutoff: 560,
    filterTracking: 0.58,
    filterQ: 3.1,
    attack: 0.003,
    decay: 0.14,
    release: 0.08,
    delaySend: 0.09,
    reverbSend: 0.24,
    distortionDrive: 0.78,
    distortionMix: 0.58,
    distortionTone: 1400,
    transientAmount: 0.16,
    transientDecay: 0.015,
    transientTone: 1200,
    pitchDropCents: 26,
  },

  "noisy": {
    oscAWave: "square",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 8.5,
    subLevel: 0.42,
    upperLevel: 0.54,
    filterCutoff: 760,
    filterTracking: 0.7,
    filterQ: 1.9,
    attack: 0.002,
    decay: 0.1,
    release: 0.06,
    delaySend: 0.12,
    stereoPan: 0.35,
    distortionDrive: 0.72,
    distortionMix: 0.48,
    distortionTone: 1100,
    transientAmount: 0.3,
    transientDecay: 0.012,
    transientTone: 1800,
    pitchDropCents: 32,
  },
  "deep": {
    oscAWave: "sine",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 0.5,
    subLevel: 1,
    upperLevel: 0.32,
    filterCutoff: 360,
    filterTracking: 0.32,
    filterQ: 0.85,
    attack: 0.3,
    decay: 0.7,
    release: 0.4,
    delaySend: 0.44,
    reverbSend: 0.8,
    stereoPan: -0.12,
    distortionDrive: 0.3,
    distortionMix: 0.18,
    distortionTone: 1100,
  },
  "rubber": {
    oscAWave: "sawtooth",
    oscBWave: "triangle",
    subWave: "triangle",
    detuneSpread: 2.4,
    subLevel: 0.66,
    upperLevel: 0.54,
    filterCutoff: 720,
    filterTracking: 0.62,
    filterQ: 1.8,
    attack: 0.006,
    decay: 0.11,
    release: 0.07,
    delaySend: 0.14,
    distortionDrive: 0.34,
    distortionMix: 0.2,
    distortionTone: 1550,
    transientAmount: 0.14,
    transientDecay: 0.016,
    transientTone: 1100,
    pitchDropCents: 22,
  },
  "velvet": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 4.5,
    subLevel: 0.84,
    upperLevel: 0.34,
    filterCutoff: 620,
    filterTracking: 0.38,
    filterQ: 0.7,
    attack: 0.22,
    decay: 0.62,
    release: 0.4,
    delaySend: 0.16,
    reverbSend: 0.82,
    distortionDrive: 0.22,
    distortionMix: 0.12,
    distortionTone: 1400,
  },
  "dusk-pad": {
    oscAWave: "sawtooth",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 5.8,
    subLevel: 0.78,
    upperLevel: 0.4,
    filterCutoff: 520,
    filterTracking: 0.34,
    filterQ: 0.82,
    attack: 0.26,
    decay: 0.7,
    release: 0.48,
    delaySend: 0.18,
    reverbSend: 0.78,
    distortionDrive: 0.18,
    distortionMix: 0.1,
    distortionTone: 1300,
  },
  "choir-pad": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "triangle",
    detuneSpread: 3.2,
    subLevel: 0.74,
    upperLevel: 0.5,
    filterCutoff: 680,
    filterTracking: 0.44,
    filterQ: 0.9,
    attack: 0.22,
    decay: 0.56,
    release: 0.42,
    cleanDelaySend: 0.06,
    reverbSend: 0.82,
    distortionDrive: 0.16,
    distortionMix: 0.08,
    distortionTone: 1500,
  },
  "frost-pad": {
    oscAWave: "triangle",
    oscBWave: "sawtooth",
    subWave: "sine",
    detuneSpread: 7.2,
    subLevel: 0.54,
    upperLevel: 0.6,
    filterCutoff: 940,
    filterTracking: 0.72,
    filterQ: 1.1,
    attack: 0.1,
    decay: 0.24,
    release: 0.22,
    delaySend: 0.12,
    reverbSend: 0.62,
    stereoPan: 0.22,
    distortionDrive: 0.26,
    distortionMix: 0.16,
    distortionTone: 1900,
    transientAmount: 0.06,
    transientDecay: 0.024,
    transientTone: 2200,
    pitchDropCents: 6,
  },
  "sub-bass": {
    oscAWave: "sine",
    oscBWave: "square",
    subWave: "sine",
    detuneSpread: 0.3,
    subLevel: 0.98,
    upperLevel: 0.22,
    filterCutoff: 300,
    filterTracking: 0.24,
    filterQ: 0.8,
    attack: 0.004,
    decay: 0.2,
    release: 0.12,
    distortionDrive: 0.38,
    distortionMix: 0.22,
    distortionTone: 720,
    transientAmount: 0.08,
    transientDecay: 0.03,
    transientTone: 420,
    pitchDropCents: 32,
  },
  "wobble-bass": {
    oscAWave: "square",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 1.8,
    subLevel: 0.94,
    upperLevel: 0.38,
    filterCutoff: 460,
    filterTracking: 0.42,
    filterQ: 1.6,
    attack: 0.01,
    decay: 0.18,
    release: 0.11,
    delaySend: 0.08,
    reverbSend: 0.12,
    distortionDrive: 0.54,
    distortionMix: 0.34,
    distortionTone: 900,
    transientAmount: 0.12,
    transientDecay: 0.022,
    transientTone: 740,
    pitchDropCents: 24,
  },
  "fm-bass": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "triangle",
    detuneSpread: 0.9,
    subLevel: 0.9,
    upperLevel: 0.42,
    filterCutoff: 560,
    filterTracking: 0.5,
    filterQ: 1.8,
    attack: 0.005,
    decay: 0.16,
    release: 0.1,
    cleanDelaySend: 0.05,
    distortionDrive: 0.44,
    distortionMix: 0.24,
    distortionTone: 1200,
    transientAmount: 0.14,
    transientDecay: 0.018,
    transientTone: 920,
    pitchDropCents: 18,
  },
  mallet: {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 0.6,
    subLevel: 0.36,
    upperLevel: 0.44,
    filterCutoff: 1200,
    filterTracking: 0.86,
    filterQ: 1.2,
    attack: 0.002,
    decay: 0.16,
    release: 0.08,
    cleanDelaySend: 0.08,
    reverbSend: 0.3,
    distortionDrive: 0.2,
    distortionMix: 0.1,
    distortionTone: 1700,
    transientAmount: 0.22,
    transientDecay: 0.014,
    transientTone: 1800,
    pitchDropCents: 12,
  },
  bell: {
    oscAWave: "sine",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 8.2,
    subLevel: 0.18,
    upperLevel: 0.7,
    filterCutoff: 1800,
    filterTracking: 0.9,
    filterQ: 1.5,
    attack: 0.001,
    decay: 0.34,
    release: 0.28,
    cleanDelaySend: 0.18,
    reverbSend: 0.7,
    stereoPan: -0.18,
    distortionDrive: 0.18,
    distortionMix: 0.08,
    distortionTone: 2400,
    transientAmount: 0.16,
    transientDecay: 0.01,
    transientTone: 2800,
    pitchDropCents: 4,
  },
  reed: {
    oscAWave: "square",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 1.1,
    subLevel: 0.52,
    upperLevel: 0.54,
    filterCutoff: 820,
    filterTracking: 0.64,
    filterQ: 1.4,
    attack: 0.012,
    decay: 0.24,
    release: 0.14,
    delaySend: 0.09,
    reverbSend: 0.24,
    distortionDrive: 0.36,
    distortionMix: 0.18,
    distortionTone: 1300,
    transientAmount: 0.09,
    transientDecay: 0.02,
    transientTone: 1200,
    pitchDropCents: 10,
  },
  vapor: {
    oscAWave: "sine",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 3.6,
    subLevel: 0.72,
    upperLevel: 0.28,
    filterCutoff: 700,
    filterTracking: 0.48,
    filterQ: 0.8,
    attack: 0.18,
    decay: 0.5,
    release: 0.3,
    delaySend: 0.3,
    cleanDelaySend: 0.14,
    reverbSend: 0.76,
    stereoPan: -0.24,
    distortionDrive: 0.18,
    distortionMix: 0.1,
    distortionTone: 1300,
  },
  swarm: {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "triangle",
    detuneSpread: 11.5,
    subLevel: 0.38,
    upperLevel: 0.7,
    filterCutoff: 860,
    filterTracking: 0.72,
    filterQ: 2.1,
    attack: 0.026,
    decay: 0.16,
    release: 0.16,
    delaySend: 0.2,
    reverbSend: 0.34,
    stereoPan: 0.3,
    distortionDrive: 0.62,
    distortionMix: 0.42,
    distortionTone: 1100,
    transientAmount: 0.18,
    transientDecay: 0.016,
    transientTone: 1600,
    pitchDropCents: 14,
  },
};
export const MIXER_CHANNEL_IDS = ["warm", "pluck", "organ", "bass", "glass", "acid", "noisy", "deep"];
export const PRESET_CATEGORY_ORDER = ["bass", "pads", "keys", "textures"];
export const PRESET_CATEGORY_LABELS = {
  bass: "Bass",
  pads: "Pads",
  keys: "Keys & Plucks",
  textures: "Textures",
};
export const PRESET_METADATA = {
  warm: { label: "Warm Pad", categoryKey: "pads" },
  pluck: { label: "Soft Pluck", categoryKey: "keys" },
  organ: { label: "Dusty Organ", categoryKey: "keys" },
  bass: { label: "Mono Bass", categoryKey: "bass" },
  glass: { label: "Glass Pluck", categoryKey: "keys" },
  acid: { label: "Acid Bass", categoryKey: "bass" },
  noisy: { label: "Noise Synth", categoryKey: "textures" },
  deep: { label: "Deep Bloom", categoryKey: "pads" },
  rubber: { label: "Rubber Seq", categoryKey: "keys" },
  velvet: { label: "Velvet Choir", categoryKey: "pads" },
  "dusk-pad": { label: "Dusk Pad", categoryKey: "pads" },
  "choir-pad": { label: "Choir Pad", categoryKey: "pads" },
  "frost-pad": { label: "Frost Pad", categoryKey: "pads" },
  "sub-bass": { label: "Sub Bass", categoryKey: "bass" },
  "wobble-bass": { label: "Wobble Bass", categoryKey: "bass" },
  "fm-bass": { label: "FM Bass", categoryKey: "bass" },
  mallet: { label: "Mallet Keys", categoryKey: "keys" },
  bell: { label: "Bell Tone", categoryKey: "keys" },
  reed: { label: "Reed Lead", categoryKey: "keys" },
  vapor: { label: "Vapor Drift", categoryKey: "textures" },
  swarm: { label: "Swarm", categoryKey: "textures" },
};
export const DEFAULT_PRESET_ID = "warm";
export const GLOBAL_CONTROL_KEYS = new Set([
  "tempoBpm",
  "globalTimbre",
  "lfoTarget",
  "lfoRate",
  "lfoDepth",
  "masterVolume",
  "reverbMix",
  "tapeDelayEnabled",
  "delayDivision",
  "delayFeedback",
  "cleanDelayEnabled",
  "cleanDelayDivision",
  "cleanDelayRepetitions",
]);

export const POST_FILTER_TYPE_OPTIONS = [0, 1, 2, 3];
export const POST_FILTER_TYPE_LABELS = ["Off", "LP", "HP", "BP"];
export const POST_FILTER_WEB_AUDIO_TYPES = [null, "lowpass", "highpass", "bandpass"];

export const INITIAL_SYNTH_PARAMS = {
  tempoBpm: 120,
  globalTimbre: 0,
  lfoTarget: 0,
  lfoRate: 1.2,
  lfoDepth: 0,
  attack: 0.12,
  decay: 0.5,
  release: 0.12,
  filterCutoff: 950,
  filterTracking: 0.72,
  filterQ: 1.0,
  detuneSpread: 3,
  subLevel: 0.62,
  upperLevel: 0.58,
  stereoPan: 0,
  distortionDrive: 0.45,
  distortionMix: 0.32,
  distortionTone: 3000,
  distortionFeedback: 0,
  transientAmount: 0,
  transientDecay: 0.02,
  transientTone: 1800,
  pitchDropCents: 0,
  tapeDelayEnabled: 1,
  delaySend: 0.35,
  cleanDelaySend: 0,
  delayDivision: 4,
  delayTime: 0.25,
  delayFeedback: 0.06,
  cleanDelayEnabled: 1,
  cleanDelayDivision: 4,
  cleanDelayTime: 0.25,
  cleanDelayRepetitions: 4,
  reverbMix: 0.48,
  reverbSend: 0.44,
  masterVolume: 0.75,
  oscAWave: "sawtooth",
  oscBWave: "triangle",
  subWave: "sine",
  deadNoteAtEnd: 0,
  endPauseCount: DEAD_NOTE_PAUSE_COUNT_MIN,
  noteLength: 8,
  postFilterType: 0,
  postFilterCutoff: 0.534,   // normalized log position → ~800 Hz via 20 * 1000^t
  postFilterQ: 1.0,
  postFilterMix: 0.5,
};

export const controlConfig = {
  "note-length-toggle": {
    key: "noteLength",
    valueId: "note-length-toggle-value",
    formatter: (value) => String(Math.round(value)),
  },
  "global-timbre": {
    key: "globalTimbre",
    valueId: "global-timbre-value",
    formatter: (value) => {
      const amount = Math.round(Math.abs(value) * 100);
      if (amount === 0) {
        return "Neutral";
      }
      return value < 0 ? ` ${amount}%` : ` ${amount}%`;
    },
  },
  "lfo-target": {
    key: "lfoTarget",
    valueId: "lfo-target-value",
    formatter: (value) => {
      const index = Math.max(0, Math.min(LFO_TARGET_OPTIONS.length - 1, Math.round(value)));
      return LFO_TARGET_OPTIONS[index].label;
    },
  },
  "lfo-rate": {
    key: "lfoRate",
    valueId: "lfo-rate-value",
    formatter: (value) => `${value.toFixed(2)} Hz`,
  },
  "lfo-depth": {
    key: "lfoDepth",
    valueId: "lfo-depth-value",
    formatter: (value) => `${Math.round(value * 100)}%`,
  },
  "tempo-bpm": {
    key: "tempoBpm",
    valueId: "tempo-bpm-value",
    formatter: (value) => String(Math.round(value)),
  },
  "tape-delay-enabled": {
    key: "tapeDelayEnabled",
    valueId: "tape-delay-enabled-value",
    formatter: (value) => (Number(value) ? "On" : "Off"),
  },
  attack: {
    key: "attack",
    valueId: "attack-value",
    formatter: (value) => value.toFixed(2),
  },
  decay: {
    key: "decay",
    valueId: "decay-value",
    formatter: (value) => value.toFixed(2),
  },
  release: {
    key: "release",
    valueId: "release-value",
    formatter: (value) => value.toFixed(2),
  },
  "filter-cutoff": {
    key: "filterCutoff",
    valueId: "filter-cutoff-value",
    formatter: (value) => String(Math.round(value)),
  },
  "filter-q": {
    key: "filterQ",
    valueId: "filter-q-value",
    formatter: (value) => value.toFixed(2),
  },
  "detune-spread": {
    key: "detuneSpread",
    valueId: "detune-spread-value",
    formatter: (value) => value.toFixed(1),
  },
  "sub-level": {
    key: "subLevel",
    valueId: "sub-level-value",
    formatter: (value) => value.toFixed(2),
  },
  "stereo-pan": {
    key: "stereoPan",
    valueId: "stereo-pan-value",
    formatter: (value) => value.toFixed(2),
  },
  "distortion-drive": {
    key: "distortionDrive",
    valueId: "distortion-drive-value",
    formatter: (value) => value.toFixed(2),
  },
  "distortion-mix": {
    key: "distortionMix",
    valueId: "distortion-mix-value",
    formatter: (value) => value.toFixed(2),
  },
  "distortion-tone": {
    key: "distortionTone",
    valueId: "distortion-tone-value",
    formatter: (value) => String(Math.round(value)),
  },
  "distortion-feedback": {
    key: "distortionFeedback",
    valueId: "distortion-feedback-value",
    formatter: (value) => value.toFixed(2),
  },
  "delay-send": {
    key: "delaySend",
    valueId: "delay-send-value",
    formatter: (value) => value.toFixed(2),
  },
  "clean-delay-send": {
    key: "cleanDelaySend",
    valueId: "clean-delay-send-value",
    formatter: (value) => value.toFixed(2),
  },
  "delay-time": {
    key: "delayDivision",
    valueId: "delay-time-value",
    formatter: (value) => DELAY_DIVISION_OPTIONS[Math.round(value)]?.label || DELAY_DIVISION_OPTIONS[4].label,
  },
  "delay-feedback": {
    key: "delayFeedback",
    valueId: "delay-feedback-value",
    formatter: (value) => (value > 0 && value < 0.01 ? value.toFixed(3) : value.toFixed(2)),
  },
  "clean-delay-time": {
    key: "cleanDelayDivision",
    valueId: "clean-delay-time-value",
    formatter: (value) => DELAY_DIVISION_OPTIONS[Math.round(value)]?.label || DELAY_DIVISION_OPTIONS[4].label,
  },
  "clean-delay-repetitions": {
    key: "cleanDelayRepetitions",
    valueId: "clean-delay-repetitions-value",
    formatter: (value) => {
      const repetitions = Math.round(value);
      return `${repetitions} ${repetitions === 1 ? "repeat" : "repeats"}`;
    },
  },
  "clean-delay-enabled": {
    key: "cleanDelayEnabled",
    valueId: "clean-delay-enabled-value",
    formatter: (value) => (Number(value) ? "On" : "Off"),
  },
  "reverb-mix": {
    key: "reverbMix",
    valueId: "reverb-mix-value",
    formatter: (value) => value.toFixed(2),
  },
  "reverb-send": {
    key: "reverbSend",
    valueId: "reverb-send-value",
    formatter: (value) => value.toFixed(2),
  },
  "master-volume": {
    key: "masterVolume",
    valueId: "master-volume-value",
    formatter: (value) => value.toFixed(2),
  },
  "post-filter-type": {
    key: "postFilterType",
    valueId: "post-filter-type-value",
    formatter: (value) => POST_FILTER_TYPE_LABELS[Math.round(value)] ?? "Off",
  },
  "post-filter-cutoff": {
    key: "postFilterCutoff",
    valueId: "post-filter-cutoff-value",
    // stored as normalized log position t; display as Hz: 20 * 1000^t
    formatter: (value) => String(Math.round(20 * Math.pow(1000, value))),
  },
  "post-filter-q": {
    key: "postFilterQ",
    valueId: "post-filter-q-value",
    formatter: (value) => value.toFixed(2),
  },
  "post-filter-mix": {
    key: "postFilterMix",
    valueId: "post-filter-mix-value",
    formatter: (value) => value.toFixed(2),
  },
};

