import { REVERB_DECAY, REVERB_SECONDS } from "../constants.js";
import { state } from "../state.js";
import { clamp } from "../utils.js";

export function createImpulseResponse(context, durationSeconds = REVERB_SECONDS, decay = REVERB_DECAY) {
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

  const mix = clamp(state.synthParams.reverbMix ?? 0, 0, 1);
  state.reverbDryGain.gain.setValueAtTime(1 - mix, state.audioContext.currentTime);
  state.reverbWetGain.gain.setValueAtTime(mix, state.audioContext.currentTime);
}

export function initializeReverbEffectGraph() {
  if (!state.audioContext || !state.masterGain || !state.compressor) {
    return;
  }

  state.reverbConvolver = state.audioContext.createConvolver();
  state.reverbInput = state.audioContext.createGain();
  state.reverbWetGain = state.audioContext.createGain();
  state.reverbDryGain = state.audioContext.createGain();

  state.reverbConvolver.buffer = createImpulseResponse(state.audioContext);
  applyReverbMix();

  state.masterGain.connect(state.reverbDryGain);
  state.reverbDryGain.connect(state.compressor);
  state.masterGain.connect(state.reverbInput);
  state.reverbInput.connect(state.reverbConvolver);
  state.reverbConvolver.connect(state.reverbWetGain);
  state.reverbWetGain.connect(state.compressor);
}

export function handleReverbLiveAudioUpdate(paramKey) {
  if (paramKey !== "reverbMix") {
    return false;
  }

  applyReverbMix();
  return true;
}

