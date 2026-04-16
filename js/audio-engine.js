import {
  DELAY_FEEDBACK_MAX,
  DELAY_DIVISION_OPTIONS,
  clampLfoRateHz,
  getOverdriveToneFrequency,
  HUMANIZE,
  LFO_TARGET_OPTIONS,
  MAX_SIMULTANEOUS_PRESETS,
  POST_FILTER_WEB_AUDIO_TYPES,
  REVERB_DECAY,
  REVERB_SECONDS,
} from "./constants.js";
import { getInstrumentPattern } from "./patterns.js";
import { getInstrumentParams, getPlayablePresetIds } from "./presets.js";
import { state } from "./state.js";
import { clamp, randomCentered } from "./utils.js";

const SCHEDULER_GRID_DIVISION = 48;
const noiseBufferCache = new Map();
const overdriveCurveCache = new Map();

function getNoiseBuffer(context) {
  const key = context.sampleRate;
  if (noiseBufferCache.has(key)) {
    return noiseBufferCache.get(key);
  }

  const length = Math.floor(context.sampleRate * 0.12);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    channelData[i] = Math.random() * 2 - 1;
  }

  noiseBufferCache.set(key, buffer);
  return buffer;
}

function getOverdriveCurve(driveAmount = 0, stageIndex = 1) {
  const normalizedDrive = clamp(driveAmount, 0, 1);
  const normalizedStage = stageIndex === 2 ? 2 : 1;
  const key = `${normalizedStage}:${Math.round(normalizedDrive * 256)}`;
  if (overdriveCurveCache.has(key)) {
    return overdriveCurveCache.get(key);
  }

  const curveLength = 2048;
  const curve = new Float32Array(curveLength);
  const intensity = normalizedStage === 1
    ? 1.45 + normalizedDrive * 5.2
    : 1.9 + normalizedDrive * 7.4;
  const asymmetry = normalizedStage === 1
    ? 0.1 + normalizedDrive * 0.18
    : 0.04 + normalizedDrive * 0.1;
  const edgeBlend = normalizedStage === 1 ? 0.36 : 0.12;
  let sum = 0;

  for (let i = 0; i < curveLength; i += 1) {
    const x = (i / (curveLength - 1)) * 2 - 1;
    const biased = x + asymmetry * (1 - x * x);
    const soft = Math.tanh(biased * intensity);
    const grain = biased / (1 + Math.abs(biased) * (0.95 + normalizedDrive * (normalizedStage === 1 ? 1.45 : 1.5)));
    curve[i] = clamp(soft * (1 - edgeBlend) + grain * edgeBlend, -1, 1);
    sum += curve[i];
  }

  const averageOffset = sum / curveLength;
  if (Math.abs(averageOffset) > 0.000001) {
    for (let i = 0; i < curveLength; i += 1) {
      curve[i] = clamp(curve[i] - averageOffset, -1, 1);
    }
  }

  overdriveCurveCache.set(key, curve);
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

function getLfoTargetOption(targetIndex = state.synthParams.lfoTarget) {
  const normalizedIndex = clamp(Math.round(targetIndex ?? 0), 0, LFO_TARGET_OPTIONS.length - 1);
  return LFO_TARGET_OPTIONS[normalizedIndex];
}

function getLfoModulationAtTime(time, voiceParams = state.synthParams) {
  const targetOption = getLfoTargetOption(voiceParams.lfoTarget);
  if (!targetOption.key) {
    return { key: null, amount: 0 };
  }

  const rate = clampLfoRateHz(voiceParams.lfoRate ?? state.synthParams.lfoRate ?? 1.2);
  const depth = clamp(voiceParams.lfoDepth ?? state.synthParams.lfoDepth ?? 0, 0, 1);
  const phase = time * Math.PI * 2 * rate;
  return {
    key: targetOption.key,
    amount: Math.sin(phase) * depth,
  };
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

export function getStepDuration() {
  return 240 / (state.synthParams.tempoBpm * SCHEDULER_GRID_DIVISION);
}

export function getNoteDuration(noteLength = 8) {
  return 240 / (state.synthParams.tempoBpm * noteLength) + 0.05;
}

export function createImpulseResponse(context, durationSeconds, decay) {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * durationSeconds);
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel);

    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      const envelope = Math.pow(1 - progress, decay);
      channelData[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

export function applyReverbMix() {
  if (!state.reverbDryGain || !state.reverbWetGain || !state.audioContext) {
    return;
  }

  const clamped = Math.max(0, Math.min(1, state.synthParams.reverbMix));
  state.reverbDryGain.gain.setValueAtTime(1 - clamped, state.audioContext.currentTime);
  state.reverbWetGain.gain.setValueAtTime(clamped, state.audioContext.currentTime);
}

export function initializeAudioGraph() {
  state.masterGain = state.audioContext.createGain();
  state.compressor = state.audioContext.createDynamicsCompressor();
  state.delayNode = state.audioContext.createDelay(1.0);
  state.delayFeedback = state.audioContext.createGain();
  state.delayHighpass = state.audioContext.createBiquadFilter();
  state.delayReturnGain = state.audioContext.createGain();
  state.delayTone = state.audioContext.createBiquadFilter();
  state.reverbConvolver = state.audioContext.createConvolver();
  state.reverbInput = state.audioContext.createGain();
  state.reverbWetGain = state.audioContext.createGain();
  state.reverbDryGain = state.audioContext.createGain();

  state.masterGain.gain.value = state.synthParams.masterVolume;

  state.compressor.threshold.value = -20;
  state.compressor.knee.value = 12;
  state.compressor.ratio.value = 2.5;
  state.compressor.attack.value = 0.004;
  state.compressor.release.value = 0.16;

  state.delayNode.delayTime.value = syncDelayTimeToTempo();
  state.delayFeedback.gain.value = getDelayFeedbackGain();
  state.delayHighpass.type = "highpass";
  state.delayHighpass.frequency.value = getDelayHighpassFrequencyForTimbre();
  state.delayHighpass.Q.value = 0.35;
  state.delayTone.type = "lowpass";
  state.delayTone.frequency.value = getDelayToneFrequencyForTimbre();
  state.delayTone.Q.value = 0.85;
  state.delayReturnGain.gain.value = 1.2;

  state.reverbConvolver.buffer = createImpulseResponse(
    state.audioContext,
    REVERB_SECONDS,
    REVERB_DECAY,
  );
  applyReverbMix();

  state.masterGain.connect(state.reverbDryGain);
  state.reverbDryGain.connect(state.compressor);
  state.masterGain.connect(state.reverbInput);
  state.reverbInput.connect(state.reverbConvolver);
  state.reverbConvolver.connect(state.reverbWetGain);
  state.reverbWetGain.connect(state.compressor);
  state.compressor.connect(state.audioContext.destination);

  state.delayNode.connect(state.delayHighpass);
  state.delayHighpass.connect(state.delayTone);
  state.delayTone.connect(state.delayFeedback);
  state.delayFeedback.connect(state.delayNode);
  state.delayTone.connect(state.delayReturnGain);
  state.delayReturnGain.connect(state.masterGain);
}

export function ensureAudioContext() {
  if (!state.audioContext) {
    syncDelayTimeToTempo();
    state.audioContext = new window.AudioContext();
    initializeAudioGraph();
  }

  if (state.audioContext.state === "suspended") {
    return state.audioContext.resume();
  }

  return Promise.resolve();
}

export function scheduleNote(
  frequency,
  time,
  voiceParams,
  layerIndex,
  layerCount,
  noteLength = 8,
) {
  const ctx = state.audioContext;
  const channelVolume = clamp(voiceParams.channelVolume ?? 1, 0, 1);
  if (channelVolume <= 0.0001) {
    // Hard-skip muted channels so no transient/click can leak into dry or FX paths.
    return;
  }

  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const subOsc = ctx.createOscillator();

  const voiceGain = ctx.createGain();
  const upperMix = ctx.createGain();
  const subMix = ctx.createGain();
  const toneFilter = ctx.createBiquadFilter();
  const delaySend = ctx.createGain();
  const reverbSend = ctx.createGain();
  const channelOutputGain = ctx.createGain();
  const stereoPanner = ctx.createStereoPanner
    ? ctx.createStereoPanner()
    : null;

  // Track all nodes for cleanup after playback ends
  const voiceNodes = [
    oscA,
    oscB,
    subOsc,
    voiceGain,
    upperMix,
    subMix,
    toneFilter,
    delaySend,
    reverbSend,
    channelOutputGain,
  ];
  if (stereoPanner) {
    voiceNodes.push(stereoPanner);
  }

  const noteDuration = getNoteDuration(noteLength);
  const preStartTime = Math.max(0, time - 0.002);
  const releaseStartTime = Math.max(time + 0.02, time + noteDuration - voiceParams.release);
  const releaseTimeConstant = Math.max(0.008, voiceParams.release / 3);
  const stopTime = releaseStartTime + Math.max(0.08, releaseTimeConstant * 6);
  const voiceFadeOutTime = Math.max(releaseStartTime + 0.01, stopTime - 0.004);
  const layerGainScale = 1 / Math.sqrt(layerCount);
  const timbreBias = getGlobalTimbreBias();
  const warmAmount = Math.max(0, -timbreBias);
  const coldAmount = Math.max(0, timbreBias);
  const driftCents = randomCentered(HUMANIZE.detuneCents);
  const filterTracking = clamp(voiceParams.filterTracking ?? 0.8, 0, 2);
  const upperLevelBase = clamp(
    (voiceParams.upperLevel ?? 0.7) * (1 + randomCentered(HUMANIZE.upperAmount)),
    0.05,
    1.2,
  );
  const upperLevel = clamp(
    upperLevelBase * (1 - warmAmount * 0.24 + coldAmount * 0.28),
    0.03,
    1.3,
  );
  const subLevel = clamp(
    (voiceParams.subLevel ?? 0.55) * (1 + warmAmount * 0.18 - coldAmount * 0.12),
    0,
    1.3,
  );
  const transientAmount = clamp(
    (voiceParams.transientAmount ?? 0) *
      (1 + randomCentered(HUMANIZE.transientAmount)) *
      (1 - warmAmount * 0.12 + coldAmount * 0.14),
    0,
    0.7,
  );
  const transientDecay = clamp(voiceParams.transientDecay ?? 0.02, 0.005, 0.08);
  const transientTone = clamp(
    (voiceParams.transientTone ?? 2200) *
      (1 + randomCentered(HUMANIZE.cutoffAmount)) *
      (1 - warmAmount * 0.32 + coldAmount * 0.42),
    300,
    6000,
  );
  const pitchDropCents = clamp(
    (voiceParams.pitchDropCents ?? 0) * (1 + randomCentered(HUMANIZE.pitchDropCents)),
    0,
    240,
  );
  const attackTime = clamp(
    voiceParams.attack + randomCentered(HUMANIZE.attackSeconds),
    0.005,
    0.8,
  );
  const decayTime = clamp(
    voiceParams.decay + randomCentered(HUMANIZE.decaySeconds),
    0.01,
    1.2,
  );
  const basePeakGain = clamp(
    0.19 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale,
    0.03,
    0.26,
  );
  const baseSustainGain = clamp(
    0.11 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale,
    0.02,
    0.16,
  );
  const peakGain = basePeakGain;
  const sustainGain = baseSustainGain;
  let cutoffWithVariation = clamp(
    (Math.min(8000, voiceParams.filterCutoff + frequency * filterTracking)) *
      (1 - warmAmount * 0.35 + coldAmount * 0.55) *
      (1 + randomCentered(HUMANIZE.cutoffAmount)),
    250,
    8000,
  );
  let filterQValue = clamp(
    voiceParams.filterQ * (1 - warmAmount * 0.12 + coldAmount * 0.18),
    0.2,
    12,
  );
  const lfoModulation = getLfoModulationAtTime(time, voiceParams);
  if (lfoModulation.key === "filterCutoff") {
    cutoffWithVariation = clamp(cutoffWithVariation + lfoModulation.amount * 2200, 250, 8000);
  }
  if (lfoModulation.key === "filterQ") {
    filterQValue = clamp(filterQValue + lfoModulation.amount * 2.5, 0.2, 12);
  }
  const delaySendValue = clamp(
    voiceParams.delaySend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );
  const overdriveDriveBase = clamp(voiceParams.overdriveDrive ?? 0, 0, 1);
  const overdriveToneBase = clamp(voiceParams.overdriveTone ?? 0.55, 0, 1);
  const overdriveMix = clamp(voiceParams.overdriveMix ?? 0, 0, 1);
  const overdriveOutputBase = clamp(voiceParams.overdriveOutput ?? 1, 0, 1.5);
  const overdriveDrive = clamp(overdriveDriveBase * (1 + randomCentered(0.08)), 0, 1);
  const overdriveTone = clamp(overdriveToneBase + randomCentered(0.06), 0, 1);
  const overdriveOutput = clamp(overdriveOutputBase * (1 + randomCentered(0.03)), 0, 1.5);
  const overdriveHighpassFrequency = clamp(55 + overdriveDrive * 130, 55, 190);
  const overdrivePreToneFrequency = clamp(
    950 + Math.pow(overdriveTone, 0.82) * 2500 * (1 - warmAmount * 0.14 + coldAmount * 0.08),
    700,
    4300,
  );
  const overdriveBodyFrequency = clamp(420 + overdriveTone * 420, 320, 980);
  const overdriveToneFrequency = clamp(
    getOverdriveToneFrequency(overdriveTone) * (1 - warmAmount * 0.3 + coldAmount * 0.1),
    260,
    4600,
  );
  const reverbSendValue = clamp(
    voiceParams.reverbSend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );

  const oscABaseDetune = -voiceParams.detuneSpread + driftCents;
  const oscBBaseDetune = voiceParams.detuneSpread + driftCents;
  const subBaseDetune = driftCents * 0.35;
  const pitchDropRampTime = time + Math.max(0.01, transientDecay * 1.5);

  oscA.type = voiceParams.oscAWave;
  oscA.frequency.setValueAtTime(frequency, preStartTime);
  oscA.detune.setValueAtTime(oscABaseDetune + pitchDropCents, preStartTime);
  oscA.detune.linearRampToValueAtTime(oscABaseDetune, pitchDropRampTime);

  oscB.type = voiceParams.oscBWave;
  oscB.frequency.setValueAtTime(frequency, preStartTime);
  oscB.detune.setValueAtTime(oscBBaseDetune + pitchDropCents, preStartTime);
  oscB.detune.linearRampToValueAtTime(oscBBaseDetune, pitchDropRampTime);

  subOsc.type = voiceParams.subWave;
  subOsc.frequency.setValueAtTime(frequency / 2, preStartTime);
  subOsc.detune.setValueAtTime(subBaseDetune + pitchDropCents * 0.6, preStartTime);
  subOsc.detune.linearRampToValueAtTime(subBaseDetune, pitchDropRampTime);

   toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(cutoffWithVariation, preStartTime);
   toneFilter.Q.value = filterQValue;

   // Smooth all mixer gains to prevent clicks
   const gainSmoothTime = Math.max(0.001, attackTime * 0.05);
    upperMix.gain.setValueAtTime(0, preStartTime);
   upperMix.gain.linearRampToValueAtTime(upperLevel, time + gainSmoothTime);
    subMix.gain.setValueAtTime(0, preStartTime);
   subMix.gain.linearRampToValueAtTime(subLevel, time + gainSmoothTime);

    delaySend.gain.setValueAtTime(0, preStartTime);
   delaySend.gain.linearRampToValueAtTime(delaySendValue, time + gainSmoothTime);
    reverbSend.gain.setValueAtTime(0, preStartTime);
   reverbSend.gain.linearRampToValueAtTime(reverbSendValue, time + gainSmoothTime);

  // Start at true zero and use linear ramps to avoid edge discontinuities.
  voiceGain.gain.cancelScheduledValues(preStartTime);
  voiceGain.gain.setValueAtTime(0, preStartTime);
  voiceGain.gain.setValueAtTime(0, time);
  voiceGain.gain.linearRampToValueAtTime(peakGain, time + attackTime);
  // Decay ramp
  voiceGain.gain.linearRampToValueAtTime(
    sustainGain,
    time + attackTime + decayTime,
  );
  // Release and end near silence before oscillator stop time.
  voiceGain.gain.setTargetAtTime(
    0,
    releaseStartTime,
    releaseTimeConstant,
  );
  voiceGain.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

  oscA.connect(upperMix);
  oscB.connect(upperMix);
  subOsc.connect(subMix);
  upperMix.connect(voiceGain);
  subMix.connect(voiceGain);

  if (transientAmount > 0.001) {
    const transientSource = ctx.createBufferSource();
    const transientFilter = ctx.createBiquadFilter();
    const transientGain = ctx.createGain();
    const transientPeakGain = clamp(transientAmount * 0.24, 0.0001, 0.24);
    const transientRiseEnd = time + Math.max(0.002, transientDecay * 0.15);

    voiceNodes.push(transientSource, transientFilter, transientGain);

    transientSource.buffer = getNoiseBuffer(ctx);
    transientFilter.type = "lowpass";
    transientFilter.frequency.setValueAtTime(transientTone, time);
    transientFilter.Q.value = 0.4;

      // Start from exact zero to avoid a discontinuity when the noise buffer begins.
      transientGain.gain.setValueAtTime(0, time);
      transientGain.gain.linearRampToValueAtTime(transientPeakGain, transientRiseEnd);
      transientGain.gain.setValueAtTime(transientPeakGain, transientRiseEnd);
      transientGain.gain.exponentialRampToValueAtTime(0.0001, time + transientDecay);

    transientSource.connect(transientFilter);
    transientFilter.connect(transientGain);
    transientGain.connect(voiceGain);
    transientSource.start(time);
    transientSource.stop(Math.min(stopTime, time + transientDecay + 0.02));
  }

  let voiceOutput = voiceGain;


  voiceOutput.connect(toneFilter);
  voiceOutput = toneFilter;
  channelOutputGain.gain.setValueAtTime(0, preStartTime);
  channelOutputGain.gain.linearRampToValueAtTime(channelVolume, time + gainSmoothTime);
  channelOutputGain.gain.setTargetAtTime(0, releaseStartTime, releaseTimeConstant);
  channelOutputGain.gain.linearRampToValueAtTime(0, voiceFadeOutTime);
  voiceOutput.connect(channelOutputGain);
  voiceOutput = channelOutputGain;

  if (overdriveMix > 0.001) {
    const overdriveDry = ctx.createGain();
    const overdriveWet = ctx.createGain();
    const overdriveInputHighpass = ctx.createBiquadFilter();
    const overdriveInputTone = ctx.createBiquadFilter();
    const overdrivePreGain = ctx.createGain();
    const overdriveStageOne = ctx.createWaveShaper();
    const overdriveBody = ctx.createBiquadFilter();
    const overdriveStageTwoGain = ctx.createGain();
    const overdriveStageTwo = ctx.createWaveShaper();
    const overdriveDcBlock = ctx.createBiquadFilter();
    const overdriveToneFilter = ctx.createBiquadFilter();
    const overdriveOut = ctx.createGain();
    const overdriveMixAngle = overdriveMix * Math.PI * 0.5;
    const autoTrim = clamp(1 - overdriveDrive * 0.22, 0.78, 1);

    voiceNodes.push(
      overdriveDry,
      overdriveWet,
      overdriveInputHighpass,
      overdriveInputTone,
      overdrivePreGain,
      overdriveStageOne,
      overdriveBody,
      overdriveStageTwoGain,
      overdriveStageTwo,
      overdriveDcBlock,
      overdriveToneFilter,
      overdriveOut,
    );

    const overdriveDryGainValue = Math.cos(overdriveMixAngle);
    const overdriveWetGainValue = Math.sin(overdriveMixAngle) * overdriveOutput * autoTrim;

    overdriveDry.gain.setValueAtTime(0, preStartTime);
    overdriveDry.gain.linearRampToValueAtTime(overdriveDryGainValue, time + gainSmoothTime);
    overdriveDry.gain.setTargetAtTime(0, releaseStartTime, releaseTimeConstant);
    overdriveDry.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

    overdriveWet.gain.setValueAtTime(0, preStartTime);
    overdriveWet.gain.linearRampToValueAtTime(overdriveWetGainValue, time + gainSmoothTime);
    overdriveWet.gain.setTargetAtTime(0, releaseStartTime, releaseTimeConstant);
    overdriveWet.gain.linearRampToValueAtTime(0, voiceFadeOutTime);

    overdriveInputHighpass.type = "highpass";
    overdriveInputHighpass.frequency.setValueAtTime(overdriveHighpassFrequency, preStartTime);
    overdriveInputHighpass.Q.value = 0.22;
    overdriveInputTone.type = "lowpass";
    overdriveInputTone.frequency.setValueAtTime(overdrivePreToneFrequency, preStartTime);
    overdriveInputTone.Q.value = 0.18;
    overdrivePreGain.gain.setValueAtTime(1.35 + overdriveDrive * 6.2, preStartTime);
    overdriveStageOne.curve = getOverdriveCurve(overdriveDrive, 1);
    overdriveStageOne.oversample = "4x";
    overdriveBody.type = "peaking";
    overdriveBody.frequency.setValueAtTime(overdriveBodyFrequency, preStartTime);
    overdriveBody.Q.value = 0.75;
    overdriveBody.gain.setValueAtTime(2.4 + overdriveDrive * 6.4, preStartTime);
    overdriveStageTwoGain.gain.setValueAtTime(0.95 + overdriveDrive * 4.2, preStartTime);
    overdriveStageTwo.curve = getOverdriveCurve(overdriveDrive, 2);
    overdriveStageTwo.oversample = "4x";
    overdriveDcBlock.type = "highpass";
    overdriveDcBlock.frequency.setValueAtTime(42, preStartTime);
    overdriveDcBlock.Q.value = 0.1;
    overdriveToneFilter.type = "lowpass";
    overdriveToneFilter.frequency.setValueAtTime(overdriveToneFrequency, preStartTime);
    overdriveToneFilter.Q.value = 0.14;
    overdriveOut.gain.setValueAtTime(1, preStartTime);

    voiceOutput.connect(overdriveDry);
    voiceOutput.connect(overdriveInputHighpass);
    overdriveInputHighpass.connect(overdriveInputTone);
    overdriveInputTone.connect(overdrivePreGain);
    overdrivePreGain.connect(overdriveStageOne);
    overdriveStageOne.connect(overdriveBody);
    overdriveBody.connect(overdriveStageTwoGain);
    overdriveStageTwoGain.connect(overdriveStageTwo);
    overdriveStageTwo.connect(overdriveDcBlock);
    overdriveDcBlock.connect(overdriveToneFilter);
    overdriveToneFilter.connect(overdriveWet);
    overdriveDry.connect(overdriveOut);
    overdriveWet.connect(overdriveOut);
    voiceOutput = overdriveOut;
  }

  // Per-instrument post-filter (LP / HP / BP) at the end of the signal chain
  const postFilterTypeIndex = clamp(Math.round(voiceParams.postFilterType ?? 0), 0, 3);
  const postFilterMixValue = clamp(voiceParams.postFilterMix ?? 0, 0, 1);

  if (postFilterTypeIndex > 0 && postFilterMixValue > 0.001) {
    const postFilter = ctx.createBiquadFilter();
    const postFilterDry = ctx.createGain();
    const postFilterWet = ctx.createGain();
    const postFilterOut = ctx.createGain();

    voiceNodes.push(postFilter, postFilterDry, postFilterWet, postFilterOut);

      postFilter.type = POST_FILTER_WEB_AUDIO_TYPES[postFilterTypeIndex];
      // postFilterCutoff is stored as a 0-1 log position; convert to Hz: 20 * 1000^t
      const postFilterFreqHz = 20 * Math.pow(1000, clamp(voiceParams.postFilterCutoff ?? 0.534, 0, 1));
      postFilter.frequency.setValueAtTime(clamp(postFilterFreqHz, 20, 20000), time);
      postFilter.Q.value = clamp(voiceParams.postFilterQ ?? 1.0, 0.1, 18);

      postFilterDry.gain.setValueAtTime(1, time);
      postFilterDry.gain.linearRampToValueAtTime(1 - postFilterMixValue, time + gainSmoothTime);
      postFilterWet.gain.setValueAtTime(0, time);
      postFilterWet.gain.linearRampToValueAtTime(postFilterMixValue, time + gainSmoothTime);

    voiceOutput.connect(postFilterDry);
    voiceOutput.connect(postFilter);
    postFilter.connect(postFilterWet);
    postFilterDry.connect(postFilterOut);
    postFilterWet.connect(postFilterOut);
    voiceOutput = postFilterOut;
  }

  if (stereoPanner) {
    const layerSpread = layerCount > 1
      ? ((layerIndex / (layerCount - 1)) * 2 - 1) * 0.35
      : 0;
    stereoPanner.pan.value = clamp(
      voiceParams.stereoPan + layerSpread + randomCentered(HUMANIZE.panAmount),
      -1,
      1,
    );
    voiceOutput.connect(stereoPanner);
    stereoPanner.connect(state.masterGain);
    stereoPanner.connect(delaySend);
    stereoPanner.connect(reverbSend);
  } else {
    voiceOutput.connect(state.masterGain);
    voiceOutput.connect(delaySend);
    voiceOutput.connect(reverbSend);
  }
  delaySend.connect(state.delayNode);
  reverbSend.connect(state.reverbInput);

  oscA.start(preStartTime);
  oscB.start(preStartTime);
  subOsc.start(preStartTime);

  oscA.stop(stopTime);
  oscB.stop(stopTime);
  subOsc.stop(stopTime);

  // Auto-disconnect all nodes once oscA finishes to free audio graph memory
  oscA.onended = () => {
    // Allow automation tails to settle before disconnecting this voice graph.
    setTimeout(() => {
      for (let i = 0; i < voiceNodes.length; i += 1) {
        try {
          voiceNodes[i].disconnect();
        } catch (_) {
          // Already disconnected — safe to ignore
        }
      }
    }, 24);
  };
}

export function scheduleInstrumentStackNote(time, layerCount, stepIndex = state.stepIndex) {
  if (!layerCount) {
    return;
  }

  const activePresetIds = state.activePresetIds;
  const playingPresetIds = state.playingPresetIds;
  let layerIndex = 0;

  for (let i = 0; i < activePresetIds.length; i += 1) {
    const presetId = activePresetIds[i];
    if (!playingPresetIds.has(presetId)) {
      continue;
    }

    const currentLayerIndex = layerIndex;
    layerIndex += 1;

    const voiceParams = getInstrumentParams(presetId);
    const pattern = getInstrumentPattern(presetId);
    const noteLength = voiceParams.noteLength || 8;
    const stepInterval = SCHEDULER_GRID_DIVISION / noteLength;

    if (pattern.length === 0 || stepIndex % stepInterval !== 0) {
      continue;
    }

    const patternStepIndex = Math.floor(stepIndex / stepInterval);
    const layerFrequency = pattern[patternStepIndex % pattern.length];
    scheduleNote(
      layerFrequency,
      time,
      voiceParams,
      currentLayerIndex,
      layerCount,
      noteLength,
    );
  }
}

export function scheduleAhead() {
  const lookaheadSeconds = 0.18;

  if (state.playingPresetIds.size === 0 || !state.audioContext) {
    return;
  }

  const layerCount = getPlayablePresetIds().length;
  const lookaheadEndTime = state.audioContext.currentTime + lookaheadSeconds;
  const stepDuration = getStepDuration();
  let nextNoteTime = state.nextNoteTime;
  let stepIndex = state.stepIndex;

  while (nextNoteTime < lookaheadEndTime) {
    scheduleInstrumentStackNote(nextNoteTime, layerCount, stepIndex);
    nextNoteTime += stepDuration;
    stepIndex += 1;
  }

  state.nextNoteTime = nextNoteTime;
  state.stepIndex = stepIndex;
}

export function startPresetPlayback(presetId) {
  if (!state.playingPresetIds.has(presetId) && state.playingPresetIds.size >= MAX_SIMULTANEOUS_PRESETS) {
    return {
      started: false,
      reason: `Maximum ${MAX_SIMULTANEOUS_PRESETS} playing instruments`,
    };
  }

  state.playingPresetIds.add(presetId);

  if (state.schedulerId === null) {
    state.stepIndex = 0;
    state.nextNoteTime = state.audioContext.currentTime + 0.05;
    scheduleAhead();

    // Use MessageChannel for precise, throttle-resistant scheduling.
    // A small setTimeout throttles the loop to avoid busy-spinning.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (state.schedulerId === null) {
        return;
      }
      scheduleAhead();
      setTimeout(() => channel.port2.postMessage(null), 20);
    };
    state.schedulerChannel = channel;
    state.schedulerId = true; // non-null sentinel
    channel.port2.postMessage(null);
  }

  return { started: true };
}

export function stopPresetPlayback(presetId) {
  state.playingPresetIds.delete(presetId);

  if (state.playingPresetIds.size === 0 && state.schedulerId !== null) {
    state.schedulerId = null;
    if (state.schedulerChannel) {
      state.schedulerChannel.port1.onmessage = null;
      state.schedulerChannel = null;
    }
  }
}

export function applyLiveAudioUpdates(paramKey, value) {
  if (!state.audioContext) {
    return;
  }

  const now = state.audioContext.currentTime;

  if ((paramKey === "tempoBpm" || paramKey === "delayDivision") && state.delayNode) {
    state.delayNode.delayTime.setValueAtTime(syncDelayTimeToTempo(), now);
    return;
  }

  if (paramKey === "masterVolume" && state.masterGain) {
    state.masterGain.gain.setValueAtTime(value, now);
    return;
  }

  if (paramKey === "delayTime" && state.delayNode) {
    state.delayNode.delayTime.setValueAtTime(value, now);
    return;
  }

  if (paramKey === "delayFeedback" && state.delayFeedback) {
    state.delayFeedback.gain.setValueAtTime(getDelayFeedbackGain(value), now);
    return;
  }

  if (paramKey === "globalTimbre" && state.delayTone) {
    if (state.delayHighpass) {
      state.delayHighpass.frequency.setValueAtTime(getDelayHighpassFrequencyForTimbre(value), now);
    }
    state.delayTone.frequency.setValueAtTime(getDelayToneFrequencyForTimbre(value), now);
    return;
  }

  if (paramKey === "lfoRate" || paramKey === "lfoDepth") {
    return;
  }

  if (paramKey === "lfoTarget") {
    return;
  }

  if (paramKey === "reverbMix") {
    applyReverbMix();
  }
}

