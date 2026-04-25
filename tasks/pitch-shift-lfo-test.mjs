import assert from "node:assert/strict";

import {
  DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
  DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
  DEFAULT_PRESET_ID,
  INITIAL_SYNTH_PARAMS,
  MIXER_CHANNEL_IDS,
} from "../js/constants.js";
import { ensureAudioContext, scheduleInstrumentStackNote } from "../js/audio-engine.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { rebuildInstrumentPattern } from "../js/patterns.js";
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
  withOutput: true,
});

try {
  resetState();

  const controller = new AudioStateController();
  controller.initialize();
  controller.selectInstrument("warm");

  assert.equal(controller.setControlValue("lfo-target", 3), true, "the LFO target control should accept the new pitch-shift target");
  assert.equal(controller.setControlValue("lfo-rate", 1), true, "the LFO rate should remain configurable");
  assert.equal(controller.setControlValue("lfo-depth", 0.5), true, "the LFO depth should remain configurable");
  assert.equal(state.synthParams.lfoTarget, 3, "pitch-shift should be stored as the active LFO target");

  assert.equal(await controller.initializeMidi(), true, "fake MIDI initialization should succeed");
  await ensureAudioContext();

  state.instrumentNoteIdsByPresetId.warm = ["note-c4"];
  rebuildInstrumentPattern("warm");
  state.playingPresetIds.add("warm");
  state.transportState = "playing";
  environment.fakeOutput.sentMessages.length = 0;

  const scheduledTime = 0.25;
  const oscillatorCountBefore = state.audioContext.createdOscillators.length;
  scheduleInstrumentStackNote(scheduledTime, 1, 0);
  const createdOscillators = state.audioContext.createdOscillators.slice(oscillatorCountBefore);

  assert.equal(createdOscillators.length, 3, "one scheduled note should still create exactly one synth voice when pitch LFO is enabled");

  const expectedPitchShiftSemitones = 2;
  const expectedFrequency = 261.63 * Math.pow(2, expectedPitchShiftSemitones / 12);
  assertClose(
    createdOscillators[0].frequency.value,
    expectedFrequency,
    "pitch-targeted LFO should modulate the scheduled oscillator frequency by the expected semitone amount at the LFO peak",
  );

  assert.equal(environment.fakeOutput.sentMessages.length, 2, "pitch-targeted LFO should still emit matching MIDI note-on/note-off messages");
  assert.equal(
    environment.fakeOutput.sentMessages[0].data[1],
    62,
    "pitch-targeted LFO should round the modulated pitch to the corresponding outgoing MIDI note number",
  );

  assert.equal(controller.setControlValue("lfo-target", 0), true, "the LFO target should still be switchable back to Off");
  environment.fakeOutput.sentMessages.length = 0;
  const oscillatorCountAfterTargetOff = state.audioContext.createdOscillators.length;
  scheduleInstrumentStackNote(scheduledTime, 1, 0);
  const oscillatorsWithoutPitchLfo = state.audioContext.createdOscillators.slice(oscillatorCountAfterTargetOff);
  assertClose(
    oscillatorsWithoutPitchLfo[0].frequency.value,
    261.63,
    "turning the LFO target back off should restore the unmodulated pitch",
  );
  assert.equal(
    environment.fakeOutput.sentMessages[0].data[1],
    60,
    "turning the LFO target back off should restore the unmodulated MIDI note number",
  );

  console.log("pitch shift LFO checks passed");
} finally {
  environment.restore();
}

