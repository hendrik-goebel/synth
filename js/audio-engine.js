import {
  DELAY_DIVISION_OPTIONS,
  HUMANIZE,
  MAX_SIMULTANEOUS_PRESETS,
  REVERB_DECAY,
  REVERB_SECONDS,
} from "./constants.js";
import { getInstrumentPattern } from "./patterns.js";
import { getInstrumentParams, getPlayablePresetIds } from "./presets.js";
import { state } from "./state.js";
import { clamp, randomCentered } from "./utils.js";

const DISTORTION_CURVE_STEPS = 100;
const SCHEDULER_GRID_DIVISION = 48;
const distortionCurveCache = new Map();
const noiseBufferCache = new Map();

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
  return clamp(value, 0, 0.88);
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
  state.delayDrive = state.audioContext.createWaveShaper();
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
  state.delayDrive.curve = getDistortionCurve(0.22);
  state.delayDrive.oversample = "4x";
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
  state.delayHighpass.connect(state.delayDrive);
  state.delayDrive.connect(state.delayTone);
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
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const subOsc = ctx.createOscillator();

  const voiceGain = ctx.createGain();
  const upperMix = ctx.createGain();
  const subMix = ctx.createGain();
  const toneFilter = ctx.createBiquadFilter();
  const delaySend = ctx.createGain();
  const reverbSend = ctx.createGain();
  const stereoPanner = ctx.createStereoPanner
    ? ctx.createStereoPanner()
    : null;

  // Track all nodes for cleanup after playback ends
  const voiceNodes = [oscA, oscB, subOsc, voiceGain, upperMix, subMix, toneFilter, delaySend, reverbSend];
  if (stereoPanner) {
    voiceNodes.push(stereoPanner);
  }

  const noteDuration = getNoteDuration(noteLength);
  const stopTime = time + noteDuration + 0.04;
  const releaseStartTime = Math.max(time + 0.02, time + noteDuration - voiceParams.release);
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
  const peakGain = clamp(
    0.19 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale,
    0.03,
    0.26,
  );
  const sustainGain = clamp(
    0.11 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale,
    0.02,
    0.16,
  );
  const cutoffWithVariation = clamp(
    (Math.min(8000, voiceParams.filterCutoff + frequency * filterTracking)) *
      (1 - warmAmount * 0.35 + coldAmount * 0.55) *
      (1 + randomCentered(HUMANIZE.cutoffAmount)),
    250,
    8000,
  );
  const filterQValue = clamp(
    voiceParams.filterQ * (1 - warmAmount * 0.12 + coldAmount * 0.18),
    0.2,
    12,
  );
  const delaySendValue = clamp(
    voiceParams.delaySend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );
  const reverbSendValue = clamp(
    voiceParams.reverbSend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );
  const distortionDriveValue = clamp(
    voiceParams.distortionDrive * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );
  const distortionMixValue = clamp(
    voiceParams.distortionMix * (1 + randomCentered(HUMANIZE.fxSendAmount)),
    0,
    1,
  );
  const distortionToneValue = clamp(
    voiceParams.distortionTone *
      (1 + randomCentered(HUMANIZE.cutoffAmount * 0.5)) *
      (1 - warmAmount * 0.28 + coldAmount * 0.38),
    500,
    12000,
  );

  const oscABaseDetune = -voiceParams.detuneSpread + driftCents;
  const oscBBaseDetune = voiceParams.detuneSpread + driftCents;
  const subBaseDetune = driftCents * 0.35;
  const pitchDropRampTime = time + Math.max(0.01, transientDecay * 1.5);

  oscA.type = voiceParams.oscAWave;
  oscA.frequency.setValueAtTime(frequency, time);
  oscA.detune.setValueAtTime(oscABaseDetune + pitchDropCents, time);
  oscA.detune.linearRampToValueAtTime(oscABaseDetune, pitchDropRampTime);

  oscB.type = voiceParams.oscBWave;
  oscB.frequency.setValueAtTime(frequency, time);
  oscB.detune.setValueAtTime(oscBBaseDetune + pitchDropCents, time);
  oscB.detune.linearRampToValueAtTime(oscBBaseDetune, pitchDropRampTime);

  subOsc.type = voiceParams.subWave;
  subOsc.frequency.setValueAtTime(frequency / 2, time);
  subOsc.detune.setValueAtTime(subBaseDetune + pitchDropCents * 0.6, time);
  subOsc.detune.linearRampToValueAtTime(subBaseDetune, pitchDropRampTime);

  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(cutoffWithVariation, time);
  toneFilter.Q.value = filterQValue;

  upperMix.gain.value = upperLevel;
  subMix.gain.value = subLevel;

  delaySend.gain.value = delaySendValue;
  reverbSend.gain.value = reverbSendValue;

  voiceGain.gain.setValueAtTime(0.0001, time);
  voiceGain.gain.linearRampToValueAtTime(peakGain, time + attackTime);
  voiceGain.gain.linearRampToValueAtTime(
    sustainGain,
    time + attackTime + decayTime,
  );
  voiceGain.gain.setTargetAtTime(
    0.0001,
    releaseStartTime,
    Math.max(0.01, voiceParams.release / 2),
  );

  oscA.connect(upperMix);
  oscB.connect(upperMix);
  subOsc.connect(subMix);
  upperMix.connect(voiceGain);
  subMix.connect(voiceGain);

  if (transientAmount > 0.001) {
    const transientSource = ctx.createBufferSource();
    const transientFilter = ctx.createBiquadFilter();
    const transientGain = ctx.createGain();

    voiceNodes.push(transientSource, transientFilter, transientGain);

    transientSource.buffer = getNoiseBuffer(ctx);
    transientFilter.type = "lowpass";
    transientFilter.frequency.setValueAtTime(transientTone, time);
    transientFilter.Q.value = 0.4;

    transientGain.gain.setValueAtTime(clamp(transientAmount * 0.24, 0.0001, 0.24), time);
    transientGain.gain.exponentialRampToValueAtTime(0.0001, time + transientDecay);

    transientSource.connect(transientFilter);
    transientFilter.connect(transientGain);
    transientGain.connect(voiceGain);
    transientSource.start(time);
    transientSource.stop(Math.min(stopTime, time + transientDecay + 0.02));
  }

  let voiceOutput = voiceGain;

  if (distortionDriveValue > 0.001 && distortionMixValue > 0.001) {
    const distortionIn = ctx.createGain();
    const distortionDry = ctx.createGain();
    const distortionWet = ctx.createGain();
    const distortionOut = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const distortionToneFilter = ctx.createBiquadFilter();

    voiceNodes.push(distortionIn, distortionDry, distortionWet, distortionOut, shaper, distortionToneFilter);

    shaper.curve = getDistortionCurve(distortionDriveValue);
    shaper.oversample = "4x";
    distortionToneFilter.type = "lowpass";
    distortionToneFilter.frequency.setValueAtTime(distortionToneValue, time);
    distortionToneFilter.Q.value = 0.7;
    distortionDry.gain.value = 1 - distortionMixValue;
    distortionWet.gain.value = distortionMixValue;

    voiceGain.connect(distortionIn);
    distortionIn.connect(distortionDry);
    distortionIn.connect(shaper);
    shaper.connect(distortionToneFilter);
    distortionToneFilter.connect(distortionWet);
    distortionDry.connect(distortionOut);
    distortionWet.connect(distortionOut);
    voiceOutput = distortionOut;
  }

  voiceOutput.connect(toneFilter);
  voiceOutput = toneFilter;

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

  oscA.start(time);
  oscB.start(time);
  subOsc.start(time);

  oscA.stop(stopTime);
  oscB.stop(stopTime);
  subOsc.stop(stopTime);

  // Auto-disconnect all nodes once oscA finishes to free audio graph memory
  oscA.onended = () => {
    for (let i = 0; i < voiceNodes.length; i += 1) {
      try {
        voiceNodes[i].disconnect();
      } catch (_) {
        // Already disconnected — safe to ignore
      }
    }
  };
}

export function scheduleInstrumentStackNote(time) {
  const presetIds = getPlayablePresetIds();

  presetIds.forEach((presetId, layerIndex) => {
    const voiceParams = getInstrumentParams(presetId);
    const pattern = getInstrumentPattern(presetId);
    const noteLength = voiceParams.noteLength || 8;
    const stepInterval = SCHEDULER_GRID_DIVISION / noteLength;

    if (pattern.length === 0) {
      return;
    }

    if (state.stepIndex % stepInterval !== 0) {
      return;
    }

    const patternStepIndex = Math.floor(state.stepIndex / stepInterval);
    const layerFrequency = pattern[patternStepIndex % pattern.length];
    scheduleNote(
      layerFrequency,
      time,
      voiceParams,
      layerIndex,
      presetIds.length,
      noteLength,
    );
  });
}

export function scheduleAhead() {
  const lookaheadSeconds = 0.18;

  if (getPlayablePresetIds().length === 0 || !state.audioContext) {
    return;
  }

  while (state.nextNoteTime < state.audioContext.currentTime + lookaheadSeconds) {
    scheduleInstrumentStackNote(state.nextNoteTime);
    state.nextNoteTime += getStepDuration();
    state.stepIndex += 1;
  }
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

  if (paramKey === "reverbMix") {
    applyReverbMix();
  }
}

