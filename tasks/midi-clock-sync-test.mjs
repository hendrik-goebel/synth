import assert from "node:assert/strict";

import {
  DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
  DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
  DEFAULT_PRESET_ID,
  INITIAL_SYNTH_PARAMS,
  MIXER_CHANNEL_IDS,
} from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { getPresetIds } from "../js/presets.js";
import { state } from "../js/state.js";
import {
  flushMicrotasks,
  installFakeAudioAndMidiEnvironment,
  resetSharedAppState,
} from "./test-helpers/fake-audio-midi.mjs";

const environment = installFakeAudioAndMidiEnvironment({ withOutput: false });

try {
  resetSharedAppState(state, {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    INITIAL_SYNTH_PARAMS,
    MIXER_CHANNEL_IDS,
  });

  const controller = new AudioStateController();
  controller.initialize();
  assert.equal(await controller.initializeMidi(), true, "MIDI initialization should succeed for the fake slave-clock environment");

  assert.equal(controller.setMidiClockMode("slave"), true, "clock mode should switch to slave");
  assert.equal(await controller.playAll(), true, "playAll should arm channels when waiting for external MIDI clock");
  assert.equal(state.transportState, "stopped", "slave mode should not start the local transport immediately");
  assert.equal(state.midi.awaitingExternalClockStart, true, "slave mode should wait for an external MIDI start message");
  assert.equal(state.playingPresetIds.size, getPresetIds().length, "all channels should be armed while waiting for the external clock");

  environment.fakeInput.emit([0xfa], 1000);
  await flushMicrotasks();
  assert.equal(state.transportState, "playing", "external MIDI start should move the transport into the playing state");
  assert.equal(state.midi.awaitingExternalClockStart, false, "external MIDI start should clear the waiting flag");
  assert.equal(state.stepIndex, 1, "external MIDI start should schedule the first transport step immediately");

  environment.fakeInput.emit([0xf8], 1020);
  await flushMicrotasks();
  assert.equal(state.stepIndex, 1, "one MIDI clock pulse should not advance the 48-step transport yet");

  environment.fakeInput.emit([0xf8], 1040);
  await flushMicrotasks();
  assert.equal(state.stepIndex, 2, "two MIDI clock pulses should advance one transport step");
  assert.ok(state.midi.externalClockTempoBpm > 0, "clock pulses should estimate an external tempo");
  assert.notEqual(state.synthParams.tempoBpm, INITIAL_SYNTH_PARAMS.tempoBpm, "external clock pulses should update the internal tempo reference");

  environment.fakeInput.emit([0xfc], 1060);
  await flushMicrotasks();
  assert.equal(state.transportState, "stopped", "external MIDI stop should stop the transport");
  assert.equal(state.midi.awaitingExternalClockStart, true, "external MIDI stop should keep the armed channels waiting for the next start");
  assert.equal(state.playingPresetIds.size, getPresetIds().length, "external MIDI stop should preserve the armed channel set");

  console.log("midi clock slave checks passed");
} finally {
  environment.restore();
}

