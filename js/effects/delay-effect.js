import { DELAY_DIVISION_OPTIONS, DELAY_FEEDBACK_MAX } from "../constants.js";
import { state } from "../state.js";
import { clamp } from "../utils.js";

const DELAY_DRIVE_CURVE_AMOUNT = 0.22;
const DELAY_DRIVE_CURVE_STEPS = 100;
const delayDriveCurveCache = new Map();

function getDelayDriveCurve(amount = DELAY_DRIVE_CURVE_AMOUNT) {
  const clamped = clamp(amount, 0, 1);
  const bucket = Math.round(clamped * DELAY_DRIVE_CURVE_STEPS);

  if (delayDriveCurveCache.has(bucket)) {
    return delayDriveCurveCache.get(bucket);
  }

  const normalized = bucket / DELAY_DRIVE_CURVE_STEPS;
  const k = normalized * 500;
  const samples = 2048;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }

  delayDriveCurveCache.set(bucket, curve);
  return curve;
}

function getGlobalTimbreBias() {
  return clamp(state.synthParams.globalTimbre ?? 0, -1, 1);
}

function getDelayToneFrequencyForTimbre(timbreBias = getGlobalTimbreBias()) {
  const warmAmount = Math.max(0, -timbreBias);
  const coldAmount = Math.max(0, timbreBias);
  return clamp(2400 * (1 - warmAmount * 0.4 + coldAmount * 0.7), 900, 5600);
}

function getDelayHighpassFrequencyForTimbre(timbreBias = getGlobalTimbreBias()) {
  const warmAmount = Math.max(0, -timbreBias);
  const coldAmount = Math.max(0, timbreBias);
  return clamp(170 * (1 - warmAmount * 0.18 + coldAmount * 0.45), 110, 380);
}

function getDelayFeedbackGain(value = state.synthParams.delayFeedback) {
  return clamp(value, 0, DELAY_FEEDBACK_MAX);
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

export function syncDelayTimeToTempo() {
  const delayTime = getTempoSyncedDelayTime();
  state.synthParams.delayTime = delayTime;
  return delayTime;
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

  state.delayNode.delayTime.value = syncDelayTimeToTempo();
  state.delayFeedback.gain.value = getDelayFeedbackGain();
  state.delayDrive.curve = getDelayDriveCurve();
  state.delayDrive.oversample = "4x";
  state.delayHighpass.type = "highpass";
  state.delayHighpass.frequency.value = getDelayHighpassFrequencyForTimbre();
  state.delayHighpass.Q.value = 0.35;
  state.delayTone.type = "lowpass";
  state.delayTone.frequency.value = getDelayToneFrequencyForTimbre();
  state.delayTone.Q.value = 0.85;
  state.delayReturnGain.gain.value = 1.2;

  state.delayNode.connect(state.delayHighpass);
  state.delayHighpass.connect(state.delayDrive);
  state.delayDrive.connect(state.delayTone);
  state.delayTone.connect(state.delayFeedback);
  state.delayFeedback.connect(state.delayNode);
  state.delayTone.connect(state.delayReturnGain);
  state.delayReturnGain.connect(state.masterGain);
}

export function handleDelayLiveAudioUpdate(paramKey, value, now = state.audioContext?.currentTime ?? 0) {
  if ((paramKey === "tempoBpm" || paramKey === "delayDivision") && state.delayNode) {
    state.delayNode.delayTime.setValueAtTime(syncDelayTimeToTempo(), now);
    return true;
  }

  if (paramKey === "delayTime" && state.delayNode) {
    state.delayNode.delayTime.setValueAtTime(value, now);
    return true;
  }

  if (paramKey === "delayFeedback" && state.delayFeedback) {
    state.delayFeedback.gain.setValueAtTime(getDelayFeedbackGain(value), now);
    return true;
  }

  if (paramKey === "globalTimbre" && state.delayTone) {
    if (state.delayHighpass) {
      state.delayHighpass.frequency.setValueAtTime(getDelayHighpassFrequencyForTimbre(value), now);
    }
    state.delayTone.frequency.setValueAtTime(getDelayToneFrequencyForTimbre(value), now);
    return true;
  }

  return false;
}

