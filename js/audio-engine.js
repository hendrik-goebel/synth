import { clampLfoRateHz, HUMANIZE, LFO_TARGET_OPTIONS, MAX_SIMULTANEOUS_PRESETS } from "./constants.js";
import {
  getTempoSyncedDelayTime,
  handleDelayLiveAudioUpdate,
  initializeDelayEffectGraph,
  syncDelayTimeToTempo,
} from "./effects/delay-effect.js";
import { applyDistortionEffect, resetDistortionEffectState } from "./effects/distortion-effect.js";
import { applyPostFilterEffect } from "./effects/post-filter-effect.js";
import {
  applyReverbMix,
  createImpulseResponse,
  handleReverbLiveAudioUpdate,
  initializeReverbEffectGraph,
} from "./effects/reverb-effect.js";
import { getInstrumentPattern } from "./patterns.js";
import { getInstrumentParams, getPlayablePresetIds } from "./presets.js";
import { state } from "./state.js";
import { clamp, randomCentered } from "./utils.js";

const SCHEDULER_GRID_DIVISION = 48;
const noiseBufferCache = new Map();

export { applyReverbMix, createImpulseResponse, getTempoSyncedDelayTime, syncDelayTimeToTempo };

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

function getLfoTargetOption(targetIndex = state.synthParams.lfoTarget) {
  const normalizedIndex = clamp(Math.round(targetIndex ?? 0), 0, LFO_TARGET_OPTIONS.length - 1);
  return LFO_TARGET_OPTIONS[normalizedIndex];
}

function getLfoModulationAtTime(time) {
  const targetOption = getLfoTargetOption();
  if (!targetOption.key) {
    return { key: null, amount: 0 };
  }

  const rate = clampLfoRateHz(state.synthParams.lfoRate ?? 1.2);
  const depth = clamp(state.synthParams.lfoDepth ?? 0, 0, 1);
  const phase = time * Math.PI * 2 * rate;
  return {
    key: targetOption.key,
    amount: Math.sin(phase) * depth,
  };
}

export function getStepDuration() {
  return 240 / (state.synthParams.tempoBpm * SCHEDULER_GRID_DIVISION);
}

export function getNoteDuration(noteLength = 8) {
  return 240 / (state.synthParams.tempoBpm * noteLength) + 0.05;
}

export function initializeAudioGraph() {
  resetDistortionEffectState();
  state.masterGain = state.audioContext.createGain();
  state.compressor = state.audioContext.createDynamicsCompressor();

  state.masterGain.gain.value = state.synthParams.masterVolume;

  state.compressor.threshold.value = -20;
  state.compressor.knee.value = 12;
  state.compressor.ratio.value = 2.5;
  state.compressor.attack.value = 0.004;
  state.compressor.release.value = 0.16;

  initializeDelayEffectGraph();
  initializeReverbEffectGraph();
  state.compressor.connect(state.audioContext.destination);
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
  presetId,
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
  const tapeDelaySend = ctx.createGain();
  const cleanDelaySend = ctx.createGain();
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
    tapeDelaySend,
    cleanDelaySend,
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
  const lfoModulation = getLfoModulationAtTime(time);
  if (lfoModulation.key === "filterCutoff") {
    cutoffWithVariation = clamp(cutoffWithVariation + lfoModulation.amount * 2200, 250, 8000);
  }
  if (lfoModulation.key === "filterQ") {
    filterQValue = clamp(filterQValue + lfoModulation.amount * 2.5, 0.2, 12);
  }
  const tapeDelaySendValue = Number(state.synthParams.tapeDelayEnabled)
    ? clamp(
      voiceParams.delaySend * (1 + randomCentered(HUMANIZE.fxSendAmount)),
      0,
      1,
    )
    : 0;
  const cleanDelaySendValue = Number(state.synthParams.cleanDelayEnabled)
    ? clamp(
      (voiceParams.cleanDelaySend ?? 0) * (1 + randomCentered(HUMANIZE.fxSendAmount)),
      0,
      1,
    )
    : 0;
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

    tapeDelaySend.gain.setValueAtTime(0, preStartTime);
   tapeDelaySend.gain.linearRampToValueAtTime(tapeDelaySendValue, time + gainSmoothTime);
    cleanDelaySend.gain.setValueAtTime(0, preStartTime);
   cleanDelaySend.gain.linearRampToValueAtTime(cleanDelaySendValue, time + gainSmoothTime);
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

  voiceOutput = applyDistortionEffect({
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
    noteDurationSeconds: noteDuration,
    voiceParams,
    warmAmount,
    coldAmount,
  });

  voiceOutput.connect(toneFilter);
  voiceOutput = toneFilter;
  channelOutputGain.gain.setValueAtTime(0, preStartTime);
  channelOutputGain.gain.linearRampToValueAtTime(channelVolume, time + gainSmoothTime);
  channelOutputGain.gain.setTargetAtTime(0, releaseStartTime, releaseTimeConstant);
  channelOutputGain.gain.linearRampToValueAtTime(0, voiceFadeOutTime);
  voiceOutput.connect(channelOutputGain);
  voiceOutput = channelOutputGain;

  voiceOutput = applyPostFilterEffect({
    ctx,
    voiceOutput,
    voiceNodes,
    time,
    gainSmoothTime,
    voiceParams,
  });

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
    stereoPanner.connect(tapeDelaySend);
    stereoPanner.connect(cleanDelaySend);
    stereoPanner.connect(reverbSend);
  } else {
    voiceOutput.connect(state.masterGain);
    voiceOutput.connect(tapeDelaySend);
    voiceOutput.connect(cleanDelaySend);
    voiceOutput.connect(reverbSend);
  }
  tapeDelaySend.connect(state.delayNode);
  if (state.cleanDelayNode) {
    cleanDelaySend.connect(state.cleanDelayNode);
  }
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
    }, 12);
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
    if (layerFrequency == null) {
      continue;
    }
    scheduleNote(
      layerFrequency,
      time,
      voiceParams,
      currentLayerIndex,
      layerCount,
      presetId,
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


  if (paramKey === "masterVolume" && state.masterGain) {
    state.masterGain.gain.setValueAtTime(value, now);
    return;
  }

  if (handleDelayLiveAudioUpdate(paramKey, value, now)) {
    return;
  }

  if (paramKey === "lfoRate" || paramKey === "lfoDepth") {
    return;
  }

  if (paramKey === "lfoTarget") {
    return;
  }

  handleReverbLiveAudioUpdate(paramKey);
}

