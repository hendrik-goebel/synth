import assert from "node:assert/strict";

import {
  DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
  DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
  DEFAULT_PRESET_ID,
  INITIAL_SYNTH_PARAMS,
  LFO_TARGET_OPTIONS,
  MIXER_CHANNEL_IDS,
} from "../js/constants.js";
import { ensureAudioContext, scheduleInstrumentStackNote } from "../js/audio-engine.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { rebuildInstrumentPattern } from "../js/patterns.js";
import { getInstrumentParams } from "../js/presets.js";
import { state } from "../js/state.js";
import {
  installFakeAudioAndMidiEnvironment,
  resetSharedAppState,
} from "./test-helpers/fake-audio-midi.mjs";

function resetState() {
  resetSharedAppState(state, {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    INITIAL_SYNTH_PARAMS,
    MIXER_CHANNEL_IDS,
  });
}

function assertClose(actual, expected, message, tolerance = 0.03) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} (expected ${expected}, got ${actual})`,
  );
}

const environment = installFakeAudioAndMidiEnvironment({
  withInput: false,
  withOutput: false,
});

const originalRandom = Math.random;

try {
  resetState();

  const controller = new AudioStateController();
  controller.initialize();
  controller.selectInstrument("warm");

  const pitchTargetIndex = LFO_TARGET_OPTIONS.findIndex((option) => option.key === "pitchShiftSemitones");
  const detuneTargetIndex = LFO_TARGET_OPTIONS.findIndex((option) => option.key === "detuneSpread");
  assert.ok(pitchTargetIndex > 0, "pitch shift should be available as an LFO target");
  assert.ok(detuneTargetIndex > 0, "detune spread should be available as an LFO target");

  assert.equal(controller.setControlValue("lfo-target", pitchTargetIndex), true, "LFO 1 should accept the pitch target");
  assert.equal(controller.setControlValue("lfo-rate", 1), true, "LFO 1 rate should be configurable");
  assert.equal(controller.setControlValue("lfo-depth", 0.5), true, "LFO 1 depth should be configurable");

  assert.equal(controller.setControlValue("lfo-2-target", detuneTargetIndex), true, "LFO 2 should accept the detune target");
  assert.equal(controller.setControlValue("lfo-2-rate", 1), true, "LFO 2 rate should be configurable");
  assert.equal(controller.setControlValue("lfo-2-depth", 0.5), true, "LFO 2 depth should be configurable");

  assert.equal(controller.setControlValue("lfo-3-target", pitchTargetIndex), true, "LFO 3 should also accept the pitch target independently");
  assert.equal(controller.setControlValue("lfo-3-rate", 1), true, "LFO 3 rate should be configurable");
  assert.equal(controller.setControlValue("lfo-3-depth", 0.25), true, "LFO 3 depth should be configurable independently from LFO 1");

  assert.equal(controller.setControlValue("lfo-4-target", 0), true, "LFO 4 should be independently switchable off");
  assert.equal(controller.setControlValue("lfo-4-depth", 0.9), true, "LFO 4 depth should still be storable while the target is off");

  controller.selectInstrument("bass");
  assert.equal(controller.setControlValue("lfo-target", 0), true, "bass LFO 1 should stay independently switchable off");
  assert.equal(controller.setControlValue("lfo-rate", 0.35), true, "bass LFO 1 rate should stay instrument-local");
  assert.equal(controller.setControlValue("lfo-depth", 0), true, "bass LFO 1 depth should stay instrument-local");
  assert.equal(controller.setControlValue("lfo-2-target", 0), true, "bass LFO 2 should stay independently switchable off");
  assert.equal(controller.setControlValue("lfo-2-depth", 0), true, "bass LFO 2 depth should stay instrument-local");
  assert.equal(controller.setControlValue("lfo-3-target", 0), true, "bass LFO 3 should stay independently switchable off");
  assert.equal(controller.setControlValue("lfo-3-depth", 0), true, "bass LFO 3 depth should stay instrument-local");

  controller.selectInstrument("warm");

  await ensureAudioContext();
  state.instrumentNoteIdsByPresetId.warm = ["note-c4"];
  rebuildInstrumentPattern("warm");
  state.instrumentNoteIdsByPresetId.bass = ["note-c3"];
  rebuildInstrumentPattern("bass");
  state.transportState = "playing";

  Math.random = () => 0.5;
  const scheduledTime = 0.25;
  state.activePresetIds = ["warm"];
  state.playingPresetIds = new Set(["warm"]);
  const oscillatorCountBeforeWarm = state.audioContext.createdOscillators.length;
  scheduleInstrumentStackNote(scheduledTime, 1, 0);
  const warmOscillators = state.audioContext.createdOscillators.slice(oscillatorCountBeforeWarm);
  assert.equal(warmOscillators.length, 3, "multiple configured warm LFOs should still schedule exactly one synth voice");

  const warmParams = getInstrumentParams("warm");
  const pitchAmount1 = LFO_TARGET_OPTIONS[pitchTargetIndex].modulationAmount * 0.5;
  const pitchAmount2 = LFO_TARGET_OPTIONS[pitchTargetIndex].modulationAmount * 0.25;
  const expectedPitchShiftSemitones = pitchAmount1 + pitchAmount2;
  const expectedFrequency = 261.63 * Math.pow(2, expectedPitchShiftSemitones / 12);
  assertClose(
    warmOscillators[0].frequency.value,
    expectedFrequency,
    "two independent pitch-targeted LFOs should sum their modulation amounts on the scheduled note",
  );

  const expectedDetuneSpread = warmParams.detuneSpread + (LFO_TARGET_OPTIONS[detuneTargetIndex].modulationAmount * 0.5);
  assertClose(
    warmOscillators[0].detune.value,
    -expectedDetuneSpread,
    "a separate detune-targeted LFO should modulate oscillator A independently of the pitch-targeted LFOs",
  );
  assertClose(
    warmOscillators[1].detune.value,
    expectedDetuneSpread,
    "a separate detune-targeted LFO should modulate oscillator B independently of the pitch-targeted LFOs",
  );

  state.activePresetIds = ["bass"];
  state.playingPresetIds = new Set(["bass"]);
  const oscillatorCountBeforeBass = state.audioContext.createdOscillators.length;
  scheduleInstrumentStackNote(scheduledTime, 1, 0);
  const bassOscillators = state.audioContext.createdOscillators.slice(oscillatorCountBeforeBass);
  assert.equal(bassOscillators.length, 3, "a second instrument should still schedule exactly one synth voice");

  const bassParams = getInstrumentParams("bass");
  assertClose(
    bassOscillators[0].frequency.value,
    130.81,
    "warm pitch LFO settings should not leak into bass when bass LFOs are off",
  );
  assertClose(
    bassOscillators[0].detune.value,
    -bassParams.detuneSpread,
    "warm detune LFO settings should not leak into bass oscillator A when bass LFOs are off",
  );
  assertClose(
    bassOscillators[1].detune.value,
    bassParams.detuneSpread,
    "warm detune LFO settings should not leak into bass oscillator B when bass LFOs are off",
  );

  console.log("multi LFO independent checks passed");
} finally {
  Math.random = originalRandom;
  environment.restore();
}

