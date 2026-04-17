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
export const MAX_SIMULTANEOUS_PRESETS = 12;
export const NOTE_LENGTH_OPTIONS = [8, 16, 6, 4, 3];
export const DELAY_FEEDBACK_MAX = 1;
export const DELAY_FEEDBACK_LOG_MIN = 0.001;
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
function extractPitchClass(noteId) {
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
    subLevel: 0.72,
    upperLevel: 0.56,
    filterCutoff: 980,
    filterTracking: 0.62,
    filterQ: 0.95,
    attack: 0.16,
    decay: 0.65,
    release: 0.2,
    reverbSend: 0.48,
    distortionDrive: 0.28,
    distortionMix: 0.16,
    distortionTone: 2600,
  },
  pluck: {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 0.8,
    subLevel: 0.38,
    upperLevel: 0.52,
    filterCutoff: 1500,
    filterTracking: 0.82,
    filterQ: 1.2,
    attack: 0.004,
    decay: 0.12,
    release: 0.07,
    distortionDrive: 0.22,
    distortionMix: 0.12,
    distortionTone: 1900,
    transientAmount: 0.18,
    transientDecay: 0.018,
    transientTone: 1800,
    pitchDropCents: 18,
  },
  organ: {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "triangle",
    detuneSpread: 0.4,
    subLevel: 0.72,
    upperLevel: 0.5,
    filterCutoff: 1250,
    filterTracking: 0.56,
    filterQ: 0.7,
    attack: 0.05,
    decay: 0.28,
    release: 0.14,
    distortionDrive: 0.25,
    distortionMix: 0.16,
    distortionTone: 2100,
  },
  bass: {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "sine",
    detuneSpread: 1.4,
    subLevel: 0.92,
    upperLevel: 0.5,
    filterCutoff: 520,
    filterTracking: 0.45,
    filterQ: 1.2,
    attack: 0.006,
    decay: 0.22,
    release: 0.09,
    distortionDrive: 0.58,
    distortionMix: 0.36,
    distortionTone: 1700,
    transientAmount: 0.1,
    transientDecay: 0.028,
    transientTone: 900,
    pitchDropCents: 40,
  },
  "glass": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 4.5,
    subLevel: 0.52,
    upperLevel: 0.42,
    filterCutoff: 1350,
    filterTracking: 0.78,
    filterQ: 1.3,
    attack: 0.01,
    decay: 0.01,
    release: 0.10,
    stereoPan: 0.2,
    reverbSend: 0,
    delaySend: 0,
    distortionDrive: 0.18,
    distortionMix: 0.1,
    distortionTone: 2100,
    transientAmount: 0.08,
    transientDecay: 0.022,
    transientTone: 2600,
    pitchDropCents: 10,
  },
  "acid": {
    oscAWave: "sawtooth",
    oscBWave: "square",
    subWave: "triangle",
    detuneSpread: 1.1,
    subLevel: 0.4,
    upperLevel: 0.74,
    filterCutoff: 720,
    filterTracking: 0.58,
    filterQ: 3.8,
    attack: 0.003,
    decay: 0.14,
    release: 0.06,
    delaySend: 0.09,
    reverbSend: 0.18,
    distortionDrive: 0.78,
    distortionMix: 0.58,
    distortionTone: 1800,
    transientAmount: 0.16,
    transientDecay: 0.015,
    transientTone: 1500,
    pitchDropCents: 26,
  },

  "noisy": {
    oscAWave: "square",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 8.5,
    subLevel: 0.34,
    upperLevel: 0.66,
    filterCutoff: 980,
    filterTracking: 0.7,
    filterQ: 2.4,
    attack: 0.002,
    decay: 0.1,
    release: 0.04,
    delaySend: 0.12,
    stereoPan: 0.35,
    distortionDrive: 0.72,
    distortionMix: 0.48,
    distortionTone: 1400,
    transientAmount: 0.3,
    transientDecay: 0.012,
    transientTone: 2400,
    pitchDropCents: 32,
  },
  "deep": {
    oscAWave: "sine",
    oscBWave: "triangle",
    subWave: "sine",
    detuneSpread: 0.5,
    subLevel: 0.98,
    upperLevel: 0.38,
    filterCutoff: 480,
    filterTracking: 0.32,
    filterQ: 0.85,
    attack: 0.3,
    decay: 0.7,
    release: 0.34,
    delaySend: 0.44,
    reverbSend: 0.72,
    stereoPan: -0.12,
    distortionDrive: 0.3,
    distortionMix: 0.18,
    distortionTone: 1400,
  },
  "rubber": {
    oscAWave: "sawtooth",
    oscBWave: "triangle",
    subWave: "triangle",
    detuneSpread: 2.4,
    subLevel: 0.58,
    upperLevel: 0.62,
    filterCutoff: 900,
    filterTracking: 0.62,
    filterQ: 2.1,
    attack: 0.006,
    decay: 0.11,
    release: 0.05,
    delaySend: 0.14,
    distortionDrive: 0.34,
    distortionMix: 0.2,
    distortionTone: 1900,
    transientAmount: 0.14,
    transientDecay: 0.016,
    transientTone: 1300,
    pitchDropCents: 22,
  },
  "velvet": {
    oscAWave: "triangle",
    oscBWave: "sine",
    subWave: "sine",
    detuneSpread: 4.5,
    subLevel: 0.78,
    upperLevel: 0.4,
    filterCutoff: 760,
    filterTracking: 0.38,
    filterQ: 0.7,
    attack: 0.18,
    decay: 0.62,
    release: 0.32,
    delaySend: 0.16,
    reverbSend: 0.74,
    distortionDrive: 0.22,
    distortionMix: 0.12,
    distortionTone: 1700,
  },
};
export const DEFAULT_PRESET_ID = "warm-pad";
export const GLOBAL_CONTROL_KEYS = new Set([
  "tempoBpm",
  "globalTimbre",
  "lfoTarget",
  "lfoRate",
  "lfoDepth",
  "masterVolume",
  "reverbMix",
  "delayDivision",
  "delayFeedback",
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
  attack: 0.1,
  decay: 0.5,
  release: 0.08,
  filterCutoff: 1200,
  filterTracking: 0.72,
  filterQ: 1.1,
  detuneSpread: 3,
  subLevel: 0.55,
  upperLevel: 0.68,
  stereoPan: 0,
  distortionDrive: 0.45,
  distortionMix: 0.32,
  distortionTone: 4500,
  distortionFeedback: 0,
  transientAmount: 0,
  transientDecay: 0.02,
  transientTone: 2200,
  pitchDropCents: 0,
  delaySend: 0.35,
  delayDivision: 4,
  delayTime: 0.25,
  delayFeedback: 0.06,
  reverbMix: 0.4,
  reverbSend: 0.35,
  masterVolume: 0.75,
  oscAWave: "sawtooth",
  oscBWave: "triangle",
  subWave: "sine",
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

