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

  const detuneSpreadTargetIndex = LFO_TARGET_OPTIONS.findIndex((option) => option.key === "detuneSpread");
  const tapeDelaySendTargetIndex = LFO_TARGET_OPTIONS.findIndex((option) => option.key === "delaySend");
  assert.ok(detuneSpreadTargetIndex > 0, "detune spread should be exposed as an LFO target");
  assert.ok(tapeDelaySendTargetIndex > detuneSpreadTargetIndex, "tape delay send should be exposed as one of the appended LFO targets");

  assert.equal(
    controller.setControlValue("lfo-target", tapeDelaySendTargetIndex),
    true,
    "the controller should accept the highest appended LFO target index",
  );
  assert.equal(getInstrumentParams("warm").lfoTarget, tapeDelaySendTargetIndex, "the newly added target index should be stored on the current instrument");

  assert.equal(controller.setControlValue("lfo-target", detuneSpreadTargetIndex), true, "the controller should accept the detune spread LFO target");
  assert.equal(controller.setControlValue("lfo-rate", 1), true, "the LFO rate should remain configurable with the new target list");
  assert.equal(controller.setControlValue("lfo-depth", 0.5), true, "the LFO depth should remain configurable with the new target list");

  await ensureAudioContext();
  state.instrumentNoteIdsByPresetId.warm = ["note-c4"];
  rebuildInstrumentPattern("warm");
  state.playingPresetIds.add("warm");
  state.transportState = "playing";

  Math.random = () => 0.5;
  const scheduledTime = 0.25;
  const oscillatorCountBefore = state.audioContext.createdOscillators.length;
  scheduleInstrumentStackNote(scheduledTime, 1, 0);
  const createdOscillators = state.audioContext.createdOscillators.slice(oscillatorCountBefore);
  assert.equal(createdOscillators.length, 3, "detune spread LFO should still schedule exactly one synth voice");

  const baseDetuneSpread = getInstrumentParams("warm").detuneSpread;
  const detuneSpreadTarget = LFO_TARGET_OPTIONS[detuneSpreadTargetIndex];
  const expectedDetuneSpread = baseDetuneSpread + (detuneSpreadTarget.modulationAmount * 0.5);

  assertClose(
    createdOscillators[0].detune.value,
    -expectedDetuneSpread,
    "detune spread LFO should increase oscillator A detune by the expected amount at the LFO peak",
  );
  assertClose(
    createdOscillators[1].detune.value,
    expectedDetuneSpread,
    "detune spread LFO should increase oscillator B detune by the expected amount at the LFO peak",
  );

  console.log("additional LFO target checks passed");
} finally {
  Math.random = originalRandom;
  environment.restore();
}

