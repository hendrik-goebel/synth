import {
  clampPitchShiftSemitones,
  clampLfoRateHz,
  getFrequencyFromMidiNoteNumber,
  getMidiNoteNumberFromNoteId,
  HUMANIZE,
  isContinuousPitchShiftEnabled,
  LFO_SLOT_CONFIGS,
  LFO_TARGET_OPTIONS,
} from "./constants.js";
import {
  ENVELOPE_ATTACK_MAX_SECONDS,
  ENVELOPE_ATTACK_MIN_SECONDS,
  ENVELOPE_DECAY_MAX_SECONDS,
  ENVELOPE_DECAY_MIN_SECONDS,
  ENVELOPE_RELEASE_MAX_SECONDS,
  ENVELOPE_RELEASE_MIN_SECONDS,
  MAX_SIMULTANEOUS_PRESETS,
  MIDI_VELOCITY_MAX,
  TAPE_DELAY_SEND_MAX,
} from "./value-limits.js";
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
import { sendMidiNoteForPreset } from "./midi-engine.js";
import { getInstrumentPattern, getInstrumentPatternNoteIds } from "./patterns.js";
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

function getLfoTargetOption(targetIndex = 0) {
  const normalizedIndex = clamp(Math.round(targetIndex ?? 0), 0, LFO_TARGET_OPTIONS.length - 1);
  return LFO_TARGET_OPTIONS[normalizedIndex];
}

function getLfoModulationsAtTime(time, voiceParams = {}) {
  return LFO_SLOT_CONFIGS
    .map(({ targetKey, rateKey, depthKey, slot }) => {
      const targetOption = getLfoTargetOption(voiceParams[targetKey]);
      if (!targetOption.key) {
        return null;
      }

      const rate = clampLfoRateHz(voiceParams[rateKey] ?? 1.2);
      const depth = clamp(voiceParams[depthKey] ?? 0, 0, 1);
      const phase = time * Math.PI * 2 * rate;
      return {
        slot,
        key: targetOption.key,
        amount: Math.sin(phase) * depth,
        targetOption,
      };
    })
    .filter(Boolean);
}

function getLfoTargetedValue(baseValue, time, fallbackTargetKey = null, voiceParams = {}) {
  const lfoModulations = getLfoModulationsAtTime(time, voiceParams);
  const fallbackModulation = lfoModulations[0] || { key: null };
  const targetKey = fallbackTargetKey ?? fallbackModulation.key;
  const targetOption = LFO_TARGET_OPTIONS.find((option) => option.key === targetKey);
  if (!targetOption) {
    return baseValue;
  }

  const numericBaseValue = Number.parseFloat(baseValue);
  if (!Number.isFinite(numericBaseValue)) {
    return baseValue;
  }

  const totalModulation = lfoModulations
    .filter((lfoModulation) => lfoModulation.key === targetKey)
    .reduce((sum, lfoModulation) => {
      const modulationAmount = Number.parseFloat(lfoModulation.targetOption.modulationAmount);
      if (!Number.isFinite(modulationAmount) || modulationAmount <= 0) {
        return sum;
      }

      return sum + (lfoModulation.amount * modulationAmount);
    }, 0);

  if (Math.abs(totalModulation) <= 0.000001) {
    return numericBaseValue;
  }

  return clamp(
    numericBaseValue + totalModulation,
    targetOption.min,
    targetOption.max,
  );
}

function getPitchShiftSemitones(voiceParams, time = 0) {
  const basePitchShiftSemitones = clampPitchShiftSemitones(voiceParams?.pitchShiftSemitones ?? 0, {
    continuous: isContinuousPitchShiftEnabled(voiceParams?.pitchShiftContinuous),
  });
  return clampPitchShiftSemitones(
    getLfoTargetedValue(basePitchShiftSemitones, time, "pitchShiftSemitones", voiceParams),
    { continuous: true },
  );
}

function getPitchShiftedFrequency(frequency, voiceParams, time) {
  const numericFrequency = Number.parseFloat(frequency);
  if (!Number.isFinite(numericFrequency) || numericFrequency <= 0) {
    return numericFrequency;
  }

  return numericFrequency * Math.pow(2, getPitchShiftSemitones(voiceParams, time) / 12);
}

function getTransposedMidiNoteNumber(midiNoteNumber, voiceParams, time) {
  const numericMidiNoteNumber = Number.parseInt(midiNoteNumber, 10);
  if (!Number.isInteger(numericMidiNoteNumber)) {
    return null;
  }

  const shiftedMidiNoteNumber = Math.round(numericMidiNoteNumber + getPitchShiftSemitones(voiceParams, time));
  if (shiftedMidiNoteNumber < 0 || shiftedMidiNoteNumber > 127) {
    return null;
  }

  return shiftedMidiNoteNumber;
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

function resetAudioRuntimeState() {
  state.audioContext = undefined;
  state.schedulerId = null;
  state.schedulerChannel = null;
  state.nextNoteTime = 0;
  state.stepIndex = 0;
  state.masterGain = null;
  state.compressor = null;
  state.delayNode = null;
  state.delayFeedback = null;
  state.delayDrive = null;
  state.delayHighpass = null;
  state.delayReturnGain = null;
  state.delayTone = null;
  state.cleanDelayNode = null;
  state.cleanDelayFeedback = null;
  state.cleanDelayReturnGain = null;
  state.reverbConvolver = null;
  state.reverbInput = null;
  state.reverbWetGain = null;
  state.reverbDryGain = null;
  state.activeChannelLevelGainsByPresetId = {};
  resetDistortionEffectState();
}

function getEffectiveChannelLevel(voiceParams) {
  const channelVolume = clamp(voiceParams.channelVolume ?? 1, 0, 1);
  const isMuted = Boolean(Number(voiceParams.channelMuted));
  return isMuted ? 0 : channelVolume;
}

function getActiveChannelLevelGainSet(presetId) {
  if (!state.activeChannelLevelGainsByPresetId[presetId]) {
    state.activeChannelLevelGainsByPresetId[presetId] = new Set();
  }

  return state.activeChannelLevelGainsByPresetId[presetId];
}

function registerActiveChannelLevelGain(presetId, gainNode) {
  const gainSet = getActiveChannelLevelGainSet(presetId);
  gainSet.add(gainNode);

  return () => {
    gainSet.delete(gainNode);
    if (gainSet.size === 0) {
      delete state.activeChannelLevelGainsByPresetId[presetId];
    }
  };
}

export function applyLiveChannelLevelUpdates(presetId, voiceParams) {
  if (!state.audioContext) {
    return;
  }

  const gainSet = state.activeChannelLevelGainsByPresetId[presetId];
  if (!gainSet || gainSet.size === 0) {
    return;
  }

  const now = state.audioContext.currentTime;
  const nextLevel = getEffectiveChannelLevel(voiceParams);
  gainSet.forEach((gainNode) => {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(nextLevel, now, 0.012);
  });
}

export function stopSchedulerLoop() {
  state.schedulerId = null;

  if (!state.schedulerChannel) {
    return;
  }

  state.schedulerChannel.port1.onmessage = null;
  state.schedulerChannel = null;
}

export function resetTransportTimeline(startOffsetSeconds = 0.05) {
  state.stepIndex = 0;
  state.nextNoteTime = state.audioContext
    ? state.audioContext.currentTime + startOffsetSeconds
    : 0;
}

export function startSchedulerLoop() {
  if (!state.audioContext || state.schedulerId !== null) {
    return;
  }

  scheduleAhead();

  // Use MessageChannel for precise, throttle-resistant scheduling.
  // A small setTimeout throttles the loop to avoid busy-spinning.
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    if (state.schedulerId === null || state.transportState !== "playing") {
      return;
    }
    scheduleAhead();
    setTimeout(() => {
      if (state.schedulerId === null || state.schedulerChannel !== channel) {
        return;
      }

      try {
        channel.port2.postMessage(null);
      } catch (_) {
        // The scheduler was torn down between the timeout being queued and firing.
      }
    }, 20);
  };
  state.schedulerChannel = channel;
  state.schedulerId = true; // non-null sentinel
  channel.port2.postMessage(null);
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
  velocity = MIDI_VELOCITY_MAX,
) {
  const ctx = state.audioContext;
  const lfoVoiceParams = {
    ...voiceParams,
    detuneSpread: getLfoTargetedValue(voiceParams.detuneSpread ?? 0, time, "detuneSpread", voiceParams),
    subLevel: getLfoTargetedValue(voiceParams.subLevel ?? 0.55, time, "subLevel", voiceParams),
    distortionDrive: getLfoTargetedValue(voiceParams.distortionDrive ?? 0, time, "distortionDrive", voiceParams),
    distortionTone: getLfoTargetedValue(voiceParams.distortionTone ?? 4500, time, "distortionTone", voiceParams),
  };
  const pitchedFrequency = getPitchShiftedFrequency(frequency, voiceParams, time);
  if (!Number.isFinite(pitchedFrequency) || pitchedFrequency <= 0) {
    return;
  }

  const effectiveChannelLevel = getEffectiveChannelLevel(voiceParams);
  if (effectiveChannelLevel <= 0.0001) {
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
  const channelLevelGain = ctx.createGain();
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
    channelLevelGain,
  ];
  if (stereoPanner) {
    voiceNodes.push(stereoPanner);
  }

  const noteDuration = getNoteDuration(noteLength);
  const preStartTime = Math.max(0, time - 0.002);
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
    (lfoVoiceParams.subLevel ?? 0.55) * (1 + warmAmount * 0.18 - coldAmount * 0.12),
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
    getLfoTargetedValue(voiceParams.attack, time, "attack", voiceParams) + randomCentered(HUMANIZE.attackSeconds),
    ENVELOPE_ATTACK_MIN_SECONDS,
    ENVELOPE_ATTACK_MAX_SECONDS,
  );
  const decayTime = clamp(
    getLfoTargetedValue(voiceParams.decay, time, "decay", voiceParams) + randomCentered(HUMANIZE.decaySeconds),
    ENVELOPE_DECAY_MIN_SECONDS,
    ENVELOPE_DECAY_MAX_SECONDS,
  );
  const releaseTime = clamp(
    getLfoTargetedValue(voiceParams.release, time, "release", voiceParams),
    ENVELOPE_RELEASE_MIN_SECONDS,
    ENVELOPE_RELEASE_MAX_SECONDS,
  );
  const releaseStartTime = Math.max(time + 0.02, time + noteDuration - releaseTime);
  const releaseTimeConstant = Math.max(0.008, releaseTime / 3);
  const stopTime = releaseStartTime + Math.max(0.08, releaseTimeConstant * 6);
  const voiceFadeOutTime = Math.max(releaseStartTime + 0.01, stopTime - 0.004);
  const velocityScale = clamp(
    0.3 + ((Math.max(0, Math.min(MIDI_VELOCITY_MAX, Number(velocity) || MIDI_VELOCITY_MAX)) / MIDI_VELOCITY_MAX) * 0.7),
    0.2,
    1,
  );
  const basePeakGain = clamp(
    0.19 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale * velocityScale,
    0.03,
    0.26,
  );
  const baseSustainGain = clamp(
    0.11 * (1 + randomCentered(HUMANIZE.gainAmount)) * layerGainScale * velocityScale,
    0.02,
    0.16,
  );
  const peakGain = basePeakGain;
  const sustainGain = baseSustainGain;
  let cutoffWithVariation = clamp(
    (Math.min(8000, getLfoTargetedValue(voiceParams.filterCutoff, time, "filterCutoff", voiceParams) + pitchedFrequency * filterTracking)) *
      (1 - warmAmount * 0.35 + coldAmount * 0.55) *
      (1 + randomCentered(HUMANIZE.cutoffAmount)),
    250,
    8000,
  );
  let filterQValue = clamp(
    getLfoTargetedValue(voiceParams.filterQ, time, "filterQ", voiceParams) * (1 - warmAmount * 0.12 + coldAmount * 0.18),
    0.2,
    12,
  );
  const tapeDelaySendValue = Number(state.synthParams.tapeDelayEnabled)
    ? clamp(
      getLfoTargetedValue(voiceParams.delaySend, time, "delaySend", voiceParams) * (1 + randomCentered(HUMANIZE.fxSendAmount)),
      0,
      TAPE_DELAY_SEND_MAX,
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
  const oscABaseDetune = -(lfoVoiceParams.detuneSpread ?? 0) + driftCents;
  const oscBBaseDetune = (lfoVoiceParams.detuneSpread ?? 0) + driftCents;
  const subBaseDetune = driftCents * 0.35;
  const pitchDropRampTime = time + Math.max(0.01, transientDecay * 1.5);

  oscA.type = voiceParams.oscAWave;
  oscA.frequency.setValueAtTime(pitchedFrequency, preStartTime);
  oscA.detune.setValueAtTime(oscABaseDetune + pitchDropCents, preStartTime);
  oscA.detune.linearRampToValueAtTime(oscABaseDetune, pitchDropRampTime);

  oscB.type = voiceParams.oscBWave;
  oscB.frequency.setValueAtTime(pitchedFrequency, preStartTime);
  oscB.detune.setValueAtTime(oscBBaseDetune + pitchDropCents, preStartTime);
  oscB.detune.linearRampToValueAtTime(oscBBaseDetune, pitchDropRampTime);

  subOsc.type = voiceParams.subWave;
  subOsc.frequency.setValueAtTime(pitchedFrequency / 2, preStartTime);
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
    voiceParams: lfoVoiceParams,
    warmAmount,
    coldAmount,
  });

  voiceOutput.connect(toneFilter);
  voiceOutput = toneFilter;
  channelOutputGain.gain.setValueAtTime(0, preStartTime);
  channelOutputGain.gain.linearRampToValueAtTime(1, time + gainSmoothTime);
  channelOutputGain.gain.setTargetAtTime(0, releaseStartTime, releaseTimeConstant);
  channelOutputGain.gain.linearRampToValueAtTime(0, voiceFadeOutTime);
  voiceOutput.connect(channelOutputGain);
  voiceOutput = channelOutputGain;

  channelLevelGain.gain.setValueAtTime(effectiveChannelLevel, preStartTime);
  voiceOutput.connect(channelLevelGain);
  voiceOutput = channelLevelGain;

  const unregisterChannelLevelGain = registerActiveChannelLevelGain(presetId, channelLevelGain);

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
      unregisterChannelLevelGain();
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
    const noteIdPattern = getInstrumentPatternNoteIds(presetId);
    const noteLength = voiceParams.noteLength || 8;
    const stepInterval = SCHEDULER_GRID_DIVISION / noteLength;

    if (pattern.length === 0 || stepIndex % stepInterval !== 0) {
      continue;
    }

    const patternStepIndex = Math.floor(stepIndex / stepInterval);
    const layerFrequency = pattern[patternStepIndex % pattern.length];
    const noteId = noteIdPattern[patternStepIndex % noteIdPattern.length];
    if (layerFrequency == null) {
      continue;
    }

    const midiNoteNumber = noteId ? getMidiNoteNumberFromNoteId(noteId) : null;
    const shiftedMidiNoteNumber = getTransposedMidiNoteNumber(midiNoteNumber, voiceParams, time);
    if (Number.isInteger(shiftedMidiNoteNumber)) {
      sendMidiNoteForPreset(presetId, shiftedMidiNoteNumber, {
        timeSeconds: time,
        durationSeconds: getNoteDuration(noteLength),
        velocity: 96,
      });
    }

    scheduleNote(
      layerFrequency,
      time,
      voiceParams,
      currentLayerIndex,
      layerCount,
      presetId,
      noteLength,
      MIDI_VELOCITY_MAX,
    );
  }
}

export function scheduleCurrentTransportStep(time = state.audioContext?.currentTime + 0.005) {
  if (!state.audioContext || state.playingPresetIds.size === 0) {
    return false;
  }

  const layerCount = getPlayablePresetIds().length;
  if (layerCount === 0) {
    return false;
  }

  scheduleInstrumentStackNote(time, layerCount, state.stepIndex);
  state.stepIndex += 1;
  state.nextNoteTime = time + getStepDuration();
  return true;
}

export function triggerImmediateMidiNote(presetId, midiNoteNumber, velocity = MIDI_VELOCITY_MAX) {
  if (!state.audioContext) {
    return false;
  }

  const frequency = getFrequencyFromMidiNoteNumber(midiNoteNumber);
  if (!Number.isFinite(frequency)) {
    return false;
  }

  const voiceParams = getInstrumentParams(presetId);
  scheduleNote(
    frequency,
    state.audioContext.currentTime + 0.005,
    voiceParams,
    0,
    1,
    presetId,
    voiceParams.noteLength || 8,
    velocity,
  );
  return true;
}

export function scheduleAhead() {
  const lookaheadSeconds = 0.18;

  if (state.transportState !== "playing" || state.playingPresetIds.size === 0 || !state.audioContext) {
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
  state.transportState = "playing";

  if (state.schedulerId === null) {
    resetTransportTimeline();
    startSchedulerLoop();
  }

  return { started: true };
}

export function startGlobalPlaybackFromBeginning(presetIds = state.activePresetIds) {
  if (!state.audioContext) {
    return {
      started: false,
      reason: "Audio context is not ready",
    };
  }

  const normalizedPresetIds = Array.from(new Set((presetIds || []).filter(Boolean)));
  if (normalizedPresetIds.length === 0) {
    return {
      started: false,
      reason: "No instruments available to play",
    };
  }

  if (normalizedPresetIds.length > MAX_SIMULTANEOUS_PRESETS) {
    return {
      started: false,
      reason: `Maximum ${MAX_SIMULTANEOUS_PRESETS} playing instruments`,
    };
  }

  stopSchedulerLoop();
  state.playingPresetIds.clear();
  normalizedPresetIds.forEach((presetId) => state.playingPresetIds.add(presetId));
  state.transportState = "playing";
  resetTransportTimeline();
  startSchedulerLoop();

  return {
    started: true,
    presetIds: normalizedPresetIds,
  };
}

export function pauseAllPlayback() {
  if (state.transportState !== "playing") {
    return false;
  }

  stopSchedulerLoop();
  state.playingPresetIds.clear();
  state.transportState = "paused";
  resetTransportTimeline();
  return true;
}

export function stopPresetPlayback(presetId) {
  state.playingPresetIds.delete(presetId);

  if (state.playingPresetIds.size === 0 && state.schedulerId !== null) {
    stopSchedulerLoop();
  }

  if (state.playingPresetIds.size === 0) {
    state.transportState = "stopped";
    resetTransportTimeline();
  }
}

export async function stopAllPlayback() {
  const hadAudioRuntime = Boolean(state.audioContext)
    || state.playingPresetIds.size > 0
    || state.transportState !== "stopped"
    || state.schedulerId !== null;

  if (!hadAudioRuntime) {
    return false;
  }

  stopSchedulerLoop();
  state.playingPresetIds.clear();
  state.transportState = "stopped";

  const audioContext = state.audioContext;
  if (audioContext && typeof audioContext.close === "function" && audioContext.state !== "closed") {
    await audioContext.close();
  }

  resetAudioRuntimeState();
  return true;
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

