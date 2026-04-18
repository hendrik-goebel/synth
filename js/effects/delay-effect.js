import {
  CLEAN_DELAY_REPETITIONS_MAX,
  CLEAN_DELAY_REPETITIONS_MIN,
  DELAY_DIVISION_OPTIONS,
  DELAY_FEEDBACK_MAX,
} from "../constants.js";
import { state } from "../state.js";
import { clamp } from "../utils.js";

const TAPE_DELAY_DRIVE_CURVE_AMOUNT = 0.22;
const TAPE_DELAY_DRIVE_CURVE_STEPS = 100;
const CLEAN_DELAY_REPEAT_TARGET_LEVEL = 0.18;
const CLEAN_DELAY_REPEAT_GAIN_CAP = 0.92;
const tapeDelayDriveCurveCache = new Map();

function getTapeDelayDriveCurve(amount = TAPE_DELAY_DRIVE_CURVE_AMOUNT) {
  const clamped = clamp(amount, 0, 1);
  const bucket = Math.round(clamped * TAPE_DELAY_DRIVE_CURVE_STEPS);

  if (tapeDelayDriveCurveCache.has(bucket)) {
    return tapeDelayDriveCurveCache.get(bucket);
  }

  const normalized = bucket / TAPE_DELAY_DRIVE_CURVE_STEPS;
  const k = normalized * 500;
  const samples = 2048;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }

  tapeDelayDriveCurveCache.set(bucket, curve);
  return curve;
}

function getGlobalTimbreBias() {
  return clamp(state.synthParams.globalTimbre ?? 0, -1, 1);
}

function isTapeDelayEnabled(value = state.synthParams.tapeDelayEnabled) {
  return Boolean(Number(value));
}

function isCleanDelayEnabled(value = state.synthParams.cleanDelayEnabled) {
  return Boolean(Number(value));
}

function getTapeDelayToneFrequencyForTimbre(timbreBias = getGlobalTimbreBias()) {
  const warmAmount = Math.max(0, -timbreBias);
  const coldAmount = Math.max(0, timbreBias);
  return clamp(2400 * (1 - warmAmount * 0.4 + coldAmount * 0.7), 900, 5600);
}

function getTapeDelayHighpassFrequencyForTimbre(timbreBias = getGlobalTimbreBias()) {
  const warmAmount = Math.max(0, -timbreBias);
  const coldAmount = Math.max(0, timbreBias);
  return clamp(170 * (1 - warmAmount * 0.18 + coldAmount * 0.45), 110, 380);
}

function getDelayFeedbackGain(value) {
  return clamp(value, 0, DELAY_FEEDBACK_MAX);
}

function getTapeDelayReturnGain(enabled = isTapeDelayEnabled()) {
  return enabled ? 1.2 : 0;
}

function getCleanDelayReturnGain(enabled = isCleanDelayEnabled()) {
  return enabled ? 0.82 : 0;
}

function getTapeDelayLoopGain(
  feedback = state.synthParams.delayFeedback,
  enabled = isTapeDelayEnabled(),
) {
  return enabled ? getDelayFeedbackGain(feedback) : 0;
}

function getCleanDelayLoopGain(
  repetitions = state.synthParams.cleanDelayRepetitions,
  enabled = isCleanDelayEnabled(),
) {
  if (!enabled) {
    return 0;
  }

  const normalizedRepetitions = clamp(
    Math.round(Number.isFinite(repetitions) ? repetitions : CLEAN_DELAY_REPETITIONS_MIN),
    CLEAN_DELAY_REPETITIONS_MIN,
    CLEAN_DELAY_REPETITIONS_MAX,
  );

  return Math.min(
    CLEAN_DELAY_REPEAT_GAIN_CAP,
    Math.pow(CLEAN_DELAY_REPEAT_TARGET_LEVEL, 1 / normalizedRepetitions),
  );
}

function getDelayDivisionOption(divisionIndex = state.synthParams.delayDivision) {
  const normalizedIndex = clamp(Math.round(divisionIndex ?? 4), 0, DELAY_DIVISION_OPTIONS.length - 1);
  return DELAY_DIVISION_OPTIONS[normalizedIndex];
}

export function getTempoSyncedDelayTime(
  tempoBpm = state.synthParams.tempoBpm,
  delayDivision = state.synthParams.delayDivision,
) {
  const beats = getDelayDivisionOption(delayDivision).beats;
  return clamp((60 / tempoBpm) * beats, 0.01, 1);
}

function getCleanTempoSyncedDelayTime(
  tempoBpm = state.synthParams.tempoBpm,
  delayDivision = state.synthParams.cleanDelayDivision,
) {
  return getTempoSyncedDelayTime(tempoBpm, delayDivision);
}

export function syncDelayTimeToTempo() {
  const tapeDelayTime = getTempoSyncedDelayTime();
  const cleanDelayTime = getCleanTempoSyncedDelayTime();
  state.synthParams.delayTime = tapeDelayTime;
  state.synthParams.cleanDelayTime = cleanDelayTime;
  return tapeDelayTime;
}

export function initializeDelayEffectGraph() {
  if (!state.audioContext || !state.masterGain) {
    return;
  }

  state.delayNode = state.audioContext.createDelay(1.0);
  state.delayFeedback = state.audioContext.createGain();
  state.delayDrive = state.audioContext.createWaveShaper();
  state.delayHighpass = state.audioContext.createBiquadFilter();
  state.delayReturnGain = state.audioContext.createGain();
  state.delayTone = state.audioContext.createBiquadFilter();

  state.cleanDelayNode = state.audioContext.createDelay(1.0);
  state.cleanDelayFeedback = state.audioContext.createGain();
  state.cleanDelayReturnGain = state.audioContext.createGain();

  syncDelayTimeToTempo();

  state.delayNode.delayTime.value = state.synthParams.delayTime;
  state.delayFeedback.gain.value = getTapeDelayLoopGain();
  state.delayDrive.curve = getTapeDelayDriveCurve();
  state.delayDrive.oversample = "4x";
  state.delayHighpass.type = "highpass";
  state.delayHighpass.frequency.value = getTapeDelayHighpassFrequencyForTimbre();
  state.delayHighpass.Q.value = 0.35;
  state.delayTone.type = "lowpass";
  state.delayTone.frequency.value = getTapeDelayToneFrequencyForTimbre();
  state.delayTone.Q.value = 0.85;
  state.delayReturnGain.gain.value = getTapeDelayReturnGain();

  state.cleanDelayNode.delayTime.value = state.synthParams.cleanDelayTime;
  state.cleanDelayFeedback.gain.value = getCleanDelayLoopGain();
  state.cleanDelayReturnGain.gain.value = getCleanDelayReturnGain();

  state.delayNode.connect(state.delayHighpass);
  state.delayHighpass.connect(state.delayDrive);
  state.delayDrive.connect(state.delayTone);
  state.delayTone.connect(state.delayFeedback);
  state.delayFeedback.connect(state.delayNode);
  state.delayTone.connect(state.delayReturnGain);
  state.delayReturnGain.connect(state.masterGain);

  state.cleanDelayNode.connect(state.cleanDelayFeedback);
  state.cleanDelayFeedback.connect(state.cleanDelayNode);
  state.cleanDelayNode.connect(state.cleanDelayReturnGain);
  state.cleanDelayReturnGain.connect(state.masterGain);
}

export function handleDelayLiveAudioUpdate(paramKey, value, now = state.audioContext?.currentTime ?? 0) {
  if ((paramKey === "tempoBpm" || paramKey === "delayDivision" || paramKey === "cleanDelayDivision")) {
    syncDelayTimeToTempo();

    if (state.delayNode) {
      state.delayNode.delayTime.setValueAtTime(state.synthParams.delayTime, now);
    }
    if (state.cleanDelayNode) {
      state.cleanDelayNode.delayTime.setValueAtTime(state.synthParams.cleanDelayTime, now);
    }
    return true;
  }

  if (paramKey === "delayTime" && state.delayNode) {
    state.delayNode.delayTime.setValueAtTime(value, now);
    return true;
  }

  if (paramKey === "cleanDelayTime" && state.cleanDelayNode) {
    state.cleanDelayNode.delayTime.setValueAtTime(value, now);
    return true;
  }

  if (paramKey === "delayFeedback" && state.delayFeedback) {
    state.delayFeedback.gain.setValueAtTime(getTapeDelayLoopGain(value), now);
    return true;
  }

  if (paramKey === "cleanDelayRepetitions" && state.cleanDelayFeedback) {
    state.cleanDelayFeedback.gain.setValueAtTime(getCleanDelayLoopGain(value), now);
    return true;
  }

  if (paramKey === "tapeDelayEnabled") {
    if (state.delayFeedback) {
      state.delayFeedback.gain.setValueAtTime(getTapeDelayLoopGain(state.synthParams.delayFeedback, isTapeDelayEnabled(value)), now);
    }
    if (state.delayReturnGain) {
      state.delayReturnGain.gain.setValueAtTime(getTapeDelayReturnGain(isTapeDelayEnabled(value)), now);
    }
    return true;
  }

  if (paramKey === "cleanDelayEnabled") {
    if (state.cleanDelayFeedback) {
      state.cleanDelayFeedback.gain.setValueAtTime(
        getCleanDelayLoopGain(state.synthParams.cleanDelayRepetitions, isCleanDelayEnabled(value)),
        now,
      );
    }
    if (state.cleanDelayReturnGain) {
      state.cleanDelayReturnGain.gain.setValueAtTime(getCleanDelayReturnGain(isCleanDelayEnabled(value)), now);
    }
    return true;
  }

  if (paramKey === "globalTimbre" && state.delayTone) {
    if (state.delayHighpass) {
      state.delayHighpass.frequency.setValueAtTime(getTapeDelayHighpassFrequencyForTimbre(value), now);
    }
    state.delayTone.frequency.setValueAtTime(getTapeDelayToneFrequencyForTimbre(value), now);
    return true;
  }

  return false;
}
