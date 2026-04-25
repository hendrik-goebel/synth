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

function assertClose(actual, expected, message, tolerance = 0.02) {
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

  assert.equal(
    controller.setControlValue("pitch-shift", 0.5),
    false,
    "stepped pitch mode should reject fractional semitone values",
  );

  assert.equal(
    controller.setControlValue("pitch-shift-mode", 1),
    true,
    "continuous pitch mode should be toggleable on",
  );
  assert.equal(
    controller.setControlValue("pitch-shift", 0.6),
    true,
    "continuous pitch mode should accept fractional semitone values",
  );

  const warmParams = getInstrumentParams("warm");
  assert.equal(warmParams.pitchShiftContinuous, 1, "the active channel should store the continuous pitch mode flag");
  assert.equal(warmParams.pitchShiftSemitones, 0.6, "the active channel should store the fractional pitch shift value");

  const seed = controller.getStateSeed();

  resetState();
  const seededController = new AudioStateController();
  assert.equal(seededController.loadStateSeed(seed), true, "continuous pitch-shift state should round-trip through seeds");

  const seededWarmParams = getInstrumentParams("warm");
  assert.equal(seededWarmParams.pitchShiftContinuous, 1, "seed loading should restore the continuous pitch mode flag");
  assert.equal(seededWarmParams.pitchShiftSemitones, 0.6, "seed loading should restore the fractional pitch shift value");

  assert.equal(await seededController.initializeMidi(), true, "fake MIDI initialization should succeed");
  await ensureAudioContext();

  state.instrumentNoteIdsByPresetId.warm = ["note-c4"];
  rebuildInstrumentPattern("warm");
  state.playingPresetIds.add("warm");
  state.transportState = "playing";
  environment.fakeOutput.sentMessages.length = 0;

  const oscillatorCountBefore = state.audioContext.createdOscillators.length;
  scheduleInstrumentStackNote(state.audioContext.currentTime + 0.01, 1, 0);
  const createdOscillators = state.audioContext.createdOscillators.slice(oscillatorCountBefore);
  assert.equal(createdOscillators.length, 3, "one scheduled note should still create exactly one synth voice");

  const expectedFrequency = 261.63 * Math.pow(2, 0.6 / 12);
  assertClose(
    createdOscillators[0].frequency.value,
    expectedFrequency,
    "continuous pitch mode should retune the scheduled oscillator frequency fractionally",
  );

  assert.equal(environment.fakeOutput.sentMessages.length, 2, "the scheduled note should still emit matching MIDI note-on/note-off messages");
  assert.equal(
    environment.fakeOutput.sentMessages[0].data[1],
    61,
    "continuous pitch mode should round outgoing MIDI note numbers to the nearest semitone",
  );

  assert.equal(
    seededController.setControlValue("pitch-shift-mode", 0),
    true,
    "continuous pitch mode should be toggleable back to stepped mode",
  );
  assert.equal(
    seededWarmParams.pitchShiftContinuous,
    0,
    "switching back should clear the continuous pitch mode flag",
  );
  assert.equal(
    seededWarmParams.pitchShiftSemitones,
    1,
    "switching back to stepped mode should round the stored pitch shift to the nearest semitone",
  );
  assert.equal(
    seededController.setControlValue("pitch-shift", 0.5),
    false,
    "stepped pitch mode should reject fractional values again after toggling back",
  );

  console.log("pitch shift mode checks passed");
} finally {
  environment.restore();
}

