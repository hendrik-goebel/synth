import assert from "node:assert/strict";

import {
  DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
  DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
  DEFAULT_PRESET_ID,
  INITIAL_SYNTH_PARAMS,
  MIXER_CHANNEL_IDS,
} from "../js/constants.js";
import {
  ENVELOPE_ATTACK_MIN_SECONDS,
  ENVELOPE_DECAY_MIN_SECONDS,
  ENVELOPE_RELEASE_MAX_SECONDS,
  ENVELOPE_RELEASE_MIN_SECONDS,
} from "../js/value-limits.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { ensureAudioContext, scheduleNote, stopAllPlayback } from "../js/audio-engine.js";
import { getInstrumentParams } from "../js/presets.js";
import { state } from "../js/state.js";
import {
  FakeAudioContext,
  FakeAudioParam,
  installFakeAudioAndMidiEnvironment,
  resetSharedAppState,
} from "./test-helpers/fake-audio-midi.mjs";

const createdParams = [];
const originalCreateGain = FakeAudioContext.prototype.createGain;
const originalCreateOscillator = FakeAudioContext.prototype.createOscillator;
const originalCreateBiquadFilter = FakeAudioContext.prototype.createBiquadFilter;
const originalCreateStereoPanner = FakeAudioContext.prototype.createStereoPanner;
const originalSetValueAtTime = FakeAudioParam.prototype.setValueAtTime;
const originalSetTargetAtTime = FakeAudioParam.prototype.setTargetAtTime;
const originalLinearRampToValueAtTime = FakeAudioParam.prototype.linearRampToValueAtTime;
const originalMathRandom = Math.random;

function trackNodeParams(node) {
  Object.values(node).forEach((value) => {
    if (value instanceof FakeAudioParam) {
      createdParams.push(value);
    }
  });
  return node;
}

FakeAudioContext.prototype.createGain = function createGainWithTracking() {
  return trackNodeParams(originalCreateGain.call(this));
};
FakeAudioContext.prototype.createOscillator = function createOscillatorWithTracking() {
  return trackNodeParams(originalCreateOscillator.call(this));
};
FakeAudioContext.prototype.createBiquadFilter = function createBiquadFilterWithTracking() {
  return trackNodeParams(originalCreateBiquadFilter.call(this));
};
FakeAudioContext.prototype.createStereoPanner = function createStereoPannerWithTracking() {
  return trackNodeParams(originalCreateStereoPanner.call(this));
};

FakeAudioParam.prototype.setValueAtTime = function recordSetValueAtTime(value, time) {
  this.history = this.history || [];
  this.history.push({ method: "setValueAtTime", value, time });
  return originalSetValueAtTime.call(this, value, time);
};
FakeAudioParam.prototype.setTargetAtTime = function recordSetTargetAtTime(value, time) {
  this.history = this.history || [];
  this.history.push({ method: "setTargetAtTime", value, time });
  return originalSetTargetAtTime.call(this, value, time);
};
FakeAudioParam.prototype.linearRampToValueAtTime = function recordLinearRampToValueAtTime(value, time) {
  this.history = this.history || [];
  this.history.push({ method: "linearRampToValueAtTime", value, time });
  return originalLinearRampToValueAtTime.call(this, value, time);
};

const environment = installFakeAudioAndMidiEnvironment({
  withInput: false,
  withOutput: false,
});

try {
  resetSharedAppState(state, {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    INITIAL_SYNTH_PARAMS,
    MIXER_CHANNEL_IDS,
  });

  const controller = new AudioStateController();
  const activePresetId = state.activeInstrumentPresetId;

  assert.equal(
    controller.setControlValue("attack", ENVELOPE_ATTACK_MIN_SECONDS),
    true,
    "the controller should accept the new minimum attack time",
  );
  assert.equal(
    controller.setControlValue("decay", ENVELOPE_DECAY_MIN_SECONDS),
    true,
    "the controller should accept the new minimum decay time",
  );
  assert.equal(
    controller.setControlValue("release", ENVELOPE_RELEASE_MIN_SECONDS),
    true,
    "the controller should accept the shared minimum release time",
  );
  assert.equal(
    controller.setControlValue("attack", ENVELOPE_ATTACK_MIN_SECONDS - 0.0005),
    false,
    "the controller should reject attack values below the shared minimum",
  );
  assert.equal(
    controller.setControlValue("decay", ENVELOPE_DECAY_MIN_SECONDS - 0.001),
    false,
    "the controller should reject decay values below the shared minimum",
  );
  assert.equal(
    controller.setControlValue("release", ENVELOPE_RELEASE_MIN_SECONDS - 0.001),
    false,
    "the controller should reject release values below the shared minimum",
  );
  assert.equal(
    controller.setControlValue("release", ENVELOPE_RELEASE_MAX_SECONDS + 0.001),
    false,
    "the controller should reject release values above the shared maximum",
  );

  const voiceParams = getInstrumentParams(activePresetId);
  assert.equal(
    voiceParams.attack,
    ENVELOPE_ATTACK_MIN_SECONDS,
    "the active instrument should store the shorter minimum attack time",
  );
  assert.equal(
    voiceParams.decay,
    ENVELOPE_DECAY_MIN_SECONDS,
    "the active instrument should store the shorter minimum decay time",
  );
  assert.equal(
    voiceParams.release,
    ENVELOPE_RELEASE_MIN_SECONDS,
    "the active instrument should store the shared minimum release time",
  );

  Math.random = () => 0.5;
  await ensureAudioContext();

  const scheduledTime = 0.5;
  scheduleNote(
    440,
    scheduledTime,
    voiceParams,
    0,
    1,
    activePresetId,
    16,
  );

  const envelopeParam = createdParams.find((param) => {
    const history = param.history || [];
    return history.some(
      ({ method, time }) => method === "linearRampToValueAtTime"
        && Math.abs(time - (scheduledTime + ENVELOPE_ATTACK_MIN_SECONDS)) < 1e-9,
    ) && history.some(
      ({ method, time }) => method === "linearRampToValueAtTime"
        && Math.abs(time - (scheduledTime + ENVELOPE_ATTACK_MIN_SECONDS + ENVELOPE_DECAY_MIN_SECONDS)) < 1e-9,
    );
  });

  assert.ok(
    envelopeParam,
    "the voice envelope should ramp using the shorter runtime attack and decay minima",
  );

  await stopAllPlayback();
  console.log("envelope minimum checks passed");
} finally {
  Math.random = originalMathRandom;
  FakeAudioContext.prototype.createGain = originalCreateGain;
  FakeAudioContext.prototype.createOscillator = originalCreateOscillator;
  FakeAudioContext.prototype.createBiquadFilter = originalCreateBiquadFilter;
  FakeAudioContext.prototype.createStereoPanner = originalCreateStereoPanner;
  FakeAudioParam.prototype.setValueAtTime = originalSetValueAtTime;
  FakeAudioParam.prototype.setTargetAtTime = originalSetTargetAtTime;
  FakeAudioParam.prototype.linearRampToValueAtTime = originalLinearRampToValueAtTime;
  environment.restore();
}

