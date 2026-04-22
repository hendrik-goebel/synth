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
import { state } from "../js/state.js";
import {
  flushMicrotasks,
  installFakeAudioAndMidiEnvironment,
  resetSharedAppState,
} from "./test-helpers/fake-audio-midi.mjs";

const environment = installFakeAudioAndMidiEnvironment();

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
  assert.equal(await controller.initializeMidi(), true, "MIDI initialization should succeed in the fake environment");
  assert.equal(state.midi.inputPortId, "input-1", "the first MIDI input should be auto-selected");
  assert.equal(state.midi.outputPortId, "output-1", "the first MIDI output should be auto-selected");

  assert.equal(controller.setChannelMidiChannel("warm", 2), true, "warm should accept a custom MIDI channel");
  state.playingPresetIds.add("warm");
  state.transportState = "playing";
  await ensureAudioContext();

  scheduleInstrumentStackNote(state.audioContext.currentTime + 0.01, 1, 0);
  const sentMessages = environment.fakeOutput.sentMessages;
  assert.equal(sentMessages.length, 2, "one scheduled arpeggio step should emit MIDI note-on and note-off");
  assert.deepEqual(sentMessages[0].data.slice(0, 3), [0x91, 60, 96], "warm should send its first startup note on MIDI channel 2");
  assert.deepEqual(sentMessages[1].data.slice(0, 3), [0x81, 60, 0], "warm should send a matching MIDI note-off on MIDI channel 2");

  const oscillatorCountBeforeInput = state.audioContext.createdOscillators.length;
  assert.equal(controller.setChannelMidiChannel("warm", 5), true, "warm should allow remapping MIDI receive to channel 5");
  assert.equal(controller.toggleChannelMidiReceive("glass"), true, "the other default channel-5 strip should be disabled for an isolated receive test");
  environment.fakeInput.emit([0x94, 72, 88], 1000);
  await flushMicrotasks();

  const createdOscillators = state.audioContext.createdOscillators.slice(oscillatorCountBeforeInput);
  assert.equal(createdOscillators.length, 3, "one incoming MIDI note should schedule the three-oscillator synth voice once");
  assert.ok(
    createdOscillators.some((oscillator) => Math.abs(oscillator.frequency.value - 523.2511306011972) < 0.01),
    "incoming MIDI note 72 should create an oscillator tuned to C5",
  );

  assert.equal(controller.toggleChannelMidiReceive("warm"), true, "receive should be toggleable per channel");
  const oscillatorCountAfterDisable = state.audioContext.createdOscillators.length;
  environment.fakeInput.emit([0x94, 74, 99], 1020);
  await flushMicrotasks();
  assert.equal(
    state.audioContext.createdOscillators.length,
    oscillatorCountAfterDisable,
    "disabled MIDI receive should ignore note-on messages for that channel",
  );

  console.log("midi note routing checks passed");
} finally {
  environment.restore();
}

