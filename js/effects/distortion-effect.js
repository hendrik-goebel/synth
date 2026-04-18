import { DISTORTION_FEEDBACK_MAX, HUMANIZE } from "../constants.js";
import { state } from "../state.js";
import { clamp, randomCentered } from "../utils.js";

const DISTORTION_CURVE_BUCKETS = 96;
const DISTORTION_CURVE_SAMPLES = 4096;
const DISTORTION_FEEDBACK_DELAY_MIN_SECONDS = 0.075;
const DISTORTION_FEEDBACK_DELAY_MAX_SECONDS = 0.22;
const DISTORTION_FEEDBACK_HIGHPASS_HZ = 55;
const DISTORTION_FEEDBACK_SEND_MAX = 0.24;
const DISTORTION_FEEDBACK_LOOP_MAX = 0.29;
const DISTORTION_FEEDBACK_RETURN_MAX = 0.2;

const distortionCurveCache = new Map();

function disconnectNode(node) {
  if (!node || typeof node.disconnect !== "function") {
    return;
  }

  try {
    node.disconnect();
  } catch (_) {
    // Ignore already-disconnected nodes.
  }
}

function resetBus(bus) {
  if (!bus) {
    return;
  }

  disconnectNode(bus.inputGain);
  disconnectNode(bus.dcFilter);
  disconnectNode(bus.delayNode);
  disconnectNode(bus.dampingFilter);
  disconnectNode(bus.feedbackGain);
  disconnectNode(bus.returnGain);
  disconnectNode(bus.saturator);
}

function getDistortionCurve(drive) {
  const bucket = Math.round(clamp(drive, 0, 1) * DISTORTION_CURVE_BUCKETS);
  if (distortionCurveCache.has(bucket)) {
    return distortionCurveCache.get(bucket);
  }

  const normalizedDrive = bucket / DISTORTION_CURVE_BUCKETS;
  const intensity = 1 + normalizedDrive * 80;
  const curve = new Float32Array(DISTORTION_CURVE_SAMPLES);

  for (let i = 0; i < DISTORTION_CURVE_SAMPLES; i += 1) {
    const x = (i / (DISTORTION_CURVE_SAMPLES - 1)) * 2 - 1;
    curve[i] = Math.tanh(intensity * x) / Math.tanh(intensity);
  }

  distortionCurveCache.set(bucket, curve);
  return curve;
}

function getFeedbackDelayTime(noteDurationSeconds) {
  return clamp(
    noteDurationSeconds * 0.38,
    DISTORTION_FEEDBACK_DELAY_MIN_SECONDS,
    DISTORTION_FEEDBACK_DELAY_MAX_SECONDS,
  );
}

function getFeedbackLoopGain(feedbackAmount) {
  return clamp(feedbackAmount * 0.82, 0, DISTORTION_FEEDBACK_LOOP_MAX);
}

function getFeedbackSendGain(feedbackAmount, mixAmount) {
  return clamp(feedbackAmount * mixAmount * 0.95, 0, DISTORTION_FEEDBACK_SEND_MAX);
}

function getFeedbackReturnGain(feedbackAmount) {
  return clamp(feedbackAmount * 0.72, 0, DISTORTION_FEEDBACK_RETURN_MAX);
}

function ensureDistortionFeedbackBus(presetId) {
  if (!state.audioContext || !state.masterGain) {
    return null;
  }

  if (state.distortionFeedbackBusByPresetId[presetId]) {
    return state.distortionFeedbackBusByPresetId[presetId];
  }

  const inputGain = state.audioContext.createGain();
  const dcFilter = state.audioContext.createBiquadFilter();
  const delayNode = state.audioContext.createDelay(DISTORTION_FEEDBACK_DELAY_MAX_SECONDS + 0.05);
  const dampingFilter = state.audioContext.createBiquadFilter();
  const saturator = state.audioContext.createWaveShaper();
  const feedbackGain = state.audioContext.createGain();
  const returnGain = state.audioContext.createGain();

  inputGain.gain.value = 1;
  dcFilter.type = "highpass";
  dcFilter.frequency.value = DISTORTION_FEEDBACK_HIGHPASS_HZ;
  dcFilter.Q.value = 0.25;
  delayNode.delayTime.value = DISTORTION_FEEDBACK_DELAY_MIN_SECONDS;
  dampingFilter.type = "lowpass";
  dampingFilter.frequency.value = 2200;
  dampingFilter.Q.value = 0.55;
  saturator.curve = getDistortionCurve(0.18);
  saturator.oversample = "4x";
  feedbackGain.gain.value = 0;
  returnGain.gain.value = 0;

  inputGain.connect(dcFilter);
  dcFilter.connect(delayNode);
  delayNode.connect(dampingFilter);
  dampingFilter.connect(saturator);
  saturator.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  saturator.connect(returnGain);
  returnGain.connect(state.masterGain);

  const bus = {
    inputGain,
    dcFilter,
    delayNode,
    dampingFilter,
    saturator,
    feedbackGain,
    returnGain,
  };

  state.distortionFeedbackBusByPresetId[presetId] = bus;
  return bus;
}

function updateDistortionFeedbackBus(presetId, feedbackAmount, toneHz, noteDurationSeconds) {
  const bus = ensureDistortionFeedbackBus(presetId);
  if (!bus || !state.audioContext) {
    return null;
  }

  const now = state.audioContext.currentTime;

  bus.delayNode.delayTime.setTargetAtTime(getFeedbackDelayTime(noteDurationSeconds), now, 0.03);
  bus.dampingFilter.frequency.setTargetAtTime(clamp(toneHz * 0.62, 700, 4800), now, 0.04);
  bus.feedbackGain.gain.setTargetAtTime(getFeedbackLoopGain(feedbackAmount), now, 0.08);
  bus.returnGain.gain.setTargetAtTime(getFeedbackReturnGain(feedbackAmount), now, 0.08);

  return bus;
}

function getDistortionSettings(voiceParams, warmAmount, coldAmount) {
  const driveBase = clamp(voiceParams.distortionDrive ?? 0, 0, 1);
  const mixBase = clamp(voiceParams.distortionMix ?? 0, 0, 1);
  const toneBase = clamp(voiceParams.distortionTone ?? 4500, 500, 12000);

  return {
    drive: clamp(
      driveBase *
        (1 + randomCentered(HUMANIZE.fxSendAmount * 0.75)) *
        (1 + warmAmount * 0.08 + coldAmount * 0.04),
      0,
      1,
    ),
    mix: clamp(mixBase * (1 + randomCentered(HUMANIZE.fxSendAmount * 0.65)), 0, 1),
    tone: clamp(
      toneBase *
        (1 + randomCentered(HUMANIZE.cutoffAmount * 0.35)) *
        (1 - warmAmount * 0.3 + coldAmount * 0.34),
      500,
      12000,
    ),
    feedback: clamp(voiceParams.distortionFeedback ?? 0, 0, DISTORTION_FEEDBACK_MAX),
  };
}

export function resetDistortionEffectState() {
  Object.values(state.distortionFeedbackBusByPresetId).forEach(resetBus);
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

  const splitGain = ctx.createGain();
  const dryGain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const toneFilter = ctx.createBiquadFilter();
  const wetTrim = ctx.createGain();
  const wetGain = ctx.createGain();
  const outputGain = ctx.createGain();

  voiceNodes.push(splitGain, dryGain, shaper, toneFilter, wetTrim, wetGain, outputGain);

  shaper.curve = getDistortionCurve(distortion.drive);
  shaper.oversample = "4x";
  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(distortion.tone, preStartTime);
  toneFilter.Q.value = 0.7;
  wetTrim.gain.setValueAtTime(clamp(0.9 - distortion.drive * 0.28, 0.5, 0.9), preStartTime);

  const dryLevel = 1 - distortion.mix;
  const wetLevel = distortion.mix;
  const fadeOutStart = Math.max(releaseStartTime, voiceFadeOutTime - 0.012);

  dryGain.gain.setValueAtTime(0, preStartTime);
  dryGain.gain.linearRampToValueAtTime(dryLevel, time + gainSmoothTime);
  dryGain.gain.setValueAtTime(dryLevel, fadeOutStart);
  dryGain.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

  wetGain.gain.setValueAtTime(0, preStartTime);
  wetGain.gain.linearRampToValueAtTime(wetLevel, time + gainSmoothTime);
  wetGain.gain.setValueAtTime(wetLevel, fadeOutStart);
  wetGain.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

  voiceOutput.connect(splitGain);
  splitGain.connect(dryGain);
  splitGain.connect(shaper);
  shaper.connect(toneFilter);
  toneFilter.connect(wetTrim);
  wetTrim.connect(wetGain);
  dryGain.connect(outputGain);
  wetGain.connect(outputGain);

  if (distortion.feedback > 0.001) {
    const feedbackBus = updateDistortionFeedbackBus(
      presetId,
      distortion.feedback,
      distortion.tone,
      noteDurationSeconds,
    );

    if (feedbackBus) {
      const feedbackSend = ctx.createGain();
      const feedbackRampEnd = time + Math.max(0.025, Math.min(0.09, attackTime * 0.7 + gainSmoothTime * 6));
      const feedbackSendLevel = getFeedbackSendGain(distortion.feedback, distortion.mix);

      voiceNodes.push(feedbackSend);

      feedbackSend.gain.setValueAtTime(0, preStartTime);
      feedbackSend.gain.linearRampToValueAtTime(feedbackSendLevel, feedbackRampEnd);
      feedbackSend.gain.setValueAtTime(feedbackSendLevel, fadeOutStart);
      feedbackSend.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

      wetTrim.connect(feedbackSend);
      feedbackSend.connect(feedbackBus.inputGain);
    }
  }

  return outputGain;
}

