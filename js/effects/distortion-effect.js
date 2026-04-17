import { DISTORTION_FEEDBACK_MAX, HUMANIZE } from "../constants.js";
import { state } from "../state.js";
import { clamp, randomCentered } from "../utils.js";

const DISTORTION_CURVE_STEPS = 100;
const DISTORTION_FEEDBACK_MIN_DELAY_SECONDS = 0.06;
const DISTORTION_FEEDBACK_MAX_DELAY_SECONDS = 0.16;
const DISTORTION_FEEDBACK_HIGHPASS_HZ = 45;
const DISTORTION_FEEDBACK_LOOP_MAX = 0.32;
const DISTORTION_FEEDBACK_SEND_MAX = 0.22;
const DISTORTION_FEEDBACK_RETURN_MAX = 0.28;
const distortionCurveCache = new Map();

function getDistortionCurve(amount) {
  const clamped = clamp(amount, 0, 1);
  const bucket = Math.round(clamped * DISTORTION_CURVE_STEPS);

  if (distortionCurveCache.has(bucket)) {
    return distortionCurveCache.get(bucket);
  }

  const normalized = bucket / DISTORTION_CURVE_STEPS;
  const k = normalized * 500;
  const samples = 2048;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }

  distortionCurveCache.set(bucket, curve);
  return curve;
}

function getDistortionFeedbackDelayTime(noteDurationSeconds) {
  return clamp(
    noteDurationSeconds * 0.45,
    DISTORTION_FEEDBACK_MIN_DELAY_SECONDS,
    DISTORTION_FEEDBACK_MAX_DELAY_SECONDS,
  );
}

function getDistortionFeedbackLoopGain(value) {
  return clamp(value * 0.9, 0, DISTORTION_FEEDBACK_LOOP_MAX);
}

function getDistortionFeedbackSendGain(value, mix = 1) {
  return clamp(value * mix * 0.7, 0, DISTORTION_FEEDBACK_SEND_MAX);
}

function getDistortionFeedbackReturnGain(value) {
  return clamp(value * 0.8, 0, DISTORTION_FEEDBACK_RETURN_MAX);
}

function ensureDistortionFeedbackBus(presetId) {
  if (!state.audioContext || !state.masterGain) {
    return null;
  }

  if (state.distortionFeedbackBusByPresetId[presetId]) {
    return state.distortionFeedbackBusByPresetId[presetId];
  }

  const inputGain = state.audioContext.createGain();
  const delayNode = state.audioContext.createDelay(DISTORTION_FEEDBACK_MAX_DELAY_SECONDS + 0.05);
  const highpass = state.audioContext.createBiquadFilter();
  const toneFilter = state.audioContext.createBiquadFilter();
  const feedbackGain = state.audioContext.createGain();
  const returnGain = state.audioContext.createGain();

  inputGain.gain.value = 1;
  delayNode.delayTime.value = DISTORTION_FEEDBACK_MIN_DELAY_SECONDS;
  highpass.type = "highpass";
  highpass.frequency.value = DISTORTION_FEEDBACK_HIGHPASS_HZ;
  highpass.Q.value = 0.35;
  toneFilter.type = "lowpass";
  toneFilter.frequency.value = 2400;
  toneFilter.Q.value = 0.6;
  feedbackGain.gain.value = 0;
  returnGain.gain.value = 0;

  inputGain.connect(delayNode);
  delayNode.connect(highpass);
  highpass.connect(toneFilter);
  toneFilter.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  toneFilter.connect(returnGain);
  returnGain.connect(state.masterGain);

  const bus = {
    inputGain,
    delayNode,
    highpass,
    toneFilter,
    feedbackGain,
    returnGain,
  };

  state.distortionFeedbackBusByPresetId[presetId] = bus;
  return bus;
}

function updateDistortionFeedbackBus(
  presetId,
  distortionFeedbackValue,
  distortionToneValue,
  noteDurationSeconds,
) {
  const bus = ensureDistortionFeedbackBus(presetId);
  if (!bus || !state.audioContext) {
    return null;
  }

  const now = state.audioContext.currentTime;

  bus.delayNode.delayTime.setTargetAtTime(getDistortionFeedbackDelayTime(noteDurationSeconds), now, 0.04);
  bus.highpass.frequency.setTargetAtTime(DISTORTION_FEEDBACK_HIGHPASS_HZ, now, 0.04);
  bus.toneFilter.frequency.setTargetAtTime(clamp(distortionToneValue * 0.72, 900, 5200), now, 0.04);
  bus.feedbackGain.gain.setTargetAtTime(getDistortionFeedbackLoopGain(distortionFeedbackValue), now, 0.08);
  bus.returnGain.gain.setTargetAtTime(getDistortionFeedbackReturnGain(distortionFeedbackValue), now, 0.08);

  return bus;
}

function getDistortionSettings(voiceParams, warmAmount, coldAmount) {
  return {
    drive: clamp(
      (voiceParams.distortionDrive ?? 0) * (1 + randomCentered(HUMANIZE.fxSendAmount)),
      0,
      1,
    ),
    mix: clamp(
      (voiceParams.distortionMix ?? 0) * (1 + randomCentered(HUMANIZE.fxSendAmount)),
      0,
      1,
    ),
    tone: clamp(
      (voiceParams.distortionTone ?? 4500) *
        (1 + randomCentered(HUMANIZE.cutoffAmount * 0.5)) *
        (1 - warmAmount * 0.28 + coldAmount * 0.38),
      500,
      12000,
    ),
    feedback: clamp(voiceParams.distortionFeedback ?? 0, 0, DISTORTION_FEEDBACK_MAX),
  };
}

export function resetDistortionEffectState() {
  state.distortionFeedbackBusByPresetId = {};
}

export function applyDistortionEffect({
  ctx,
  voiceOutput,
  voiceNodes,
  time,
  preStartTime,
  gainSmoothTime,
  releaseStartTime,
  voiceFadeOutTime,
  attackTime,
  presetId,
  noteDurationSeconds,
  voiceParams,
  warmAmount,
  coldAmount,
}) {
  const distortion = getDistortionSettings(voiceParams, warmAmount, coldAmount);
  if (distortion.drive <= 0.001 || distortion.mix <= 0.001) {
    return voiceOutput;
  }

  const distortionIn = ctx.createGain();
  const distortionDry = ctx.createGain();
  const distortionWet = ctx.createGain();
  const distortionOut = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const distortionToneFilter = ctx.createBiquadFilter();
  const distortionFeedbackBus = updateDistortionFeedbackBus(
    presetId,
    distortion.feedback,
    distortion.tone,
    noteDurationSeconds,
  );

  voiceNodes.push(distortionIn, distortionDry, distortionWet, distortionOut, shaper, distortionToneFilter);

  shaper.curve = getDistortionCurve(distortion.drive);
  shaper.oversample = "4x";
  distortionToneFilter.type = "lowpass";
  distortionToneFilter.frequency.setValueAtTime(distortion.tone, time);
  distortionToneFilter.Q.value = 0.7;

  const distortionFadeOutStart = Math.max(releaseStartTime, voiceFadeOutTime - 0.01);
  distortionDry.gain.setValueAtTime(0, preStartTime);
  distortionDry.gain.linearRampToValueAtTime(1 - distortion.mix, time + gainSmoothTime);
  distortionDry.gain.setValueAtTime(1 - distortion.mix, distortionFadeOutStart);
  distortionDry.gain.linearRampToValueAtTime(0, voiceFadeOutTime);
  distortionWet.gain.setValueAtTime(0, preStartTime);
  distortionWet.gain.linearRampToValueAtTime(distortion.mix, time + gainSmoothTime);
  distortionWet.gain.setValueAtTime(distortion.mix, distortionFadeOutStart);
  distortionWet.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

  if (distortionFeedbackBus) {
    const distortionFeedbackSend = ctx.createGain();
    const distortionFeedbackSendEnd = time + Math.max(0.03, attackTime * 0.9, gainSmoothTime * 8);
    const feedbackSendGain = getDistortionFeedbackSendGain(distortion.feedback, distortion.mix);

    voiceNodes.push(distortionFeedbackSend);

    distortionFeedbackSend.gain.setValueAtTime(0, preStartTime);
    distortionFeedbackSend.gain.linearRampToValueAtTime(feedbackSendGain, distortionFeedbackSendEnd);
    distortionFeedbackSend.gain.setValueAtTime(feedbackSendGain, distortionFadeOutStart);
    distortionFeedbackSend.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

    distortionWet.connect(distortionFeedbackSend);
    distortionFeedbackSend.connect(distortionFeedbackBus.inputGain);
  }

  voiceOutput.connect(distortionIn);
  distortionIn.connect(distortionDry);
  distortionIn.connect(shaper);
  shaper.connect(distortionToneFilter);
  distortionToneFilter.connect(distortionWet);
  distortionDry.connect(distortionOut);
  distortionWet.connect(distortionOut);

  return distortionOut;
}

