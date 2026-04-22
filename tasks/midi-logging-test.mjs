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
import { createMidiCrossTabCoordinator } from "../js/midi-engine.js";
import { state } from "../js/state.js";
import {
  flushMicrotasks,
  installFakeAudioAndMidiEnvironment,
  resetSharedAppState,
} from "./test-helpers/fake-audio-midi.mjs";

const environment = installFakeAudioAndMidiEnvironment();
const previousConsoleDebug = globalThis.console.debug;
const midiLogs = [];

globalThis.console.debug = (...args) => {
  midiLogs.push(args);
};

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

  assert.equal(controller.setChannelMidiChannel("warm", 2), true, "warm should accept MIDI channel 2 for send logging");
  state.playingPresetIds.add("warm");
  state.transportState = "playing";
  await ensureAudioContext();

  scheduleInstrumentStackNote(state.audioContext.currentTime + 0.01, 1, 0);

  assert.ok(
    midiLogs.some(([, payload]) => payload?.direction === "send"
      && payload?.source === "hardware"
      && payload?.type === "noteon"
      && payload?.midiChannel === 2
      && payload?.noteNumber === 60
      && payload?.presetId === "warm"),
    "scheduled MIDI note-on output should be logged with parsed metadata",
  );
  assert.ok(
    midiLogs.some(([, payload]) => payload?.direction === "send"
      && payload?.source === "hardware"
      && payload?.type === "noteoff"
      && payload?.midiChannel === 2
      && payload?.noteNumber === 60
      && payload?.presetId === "warm"),
    "scheduled MIDI note-off output should also be logged with parsed metadata",
  );

  midiLogs.length = 0;
  assert.equal(controller.setChannelMidiChannel("warm", 5), true, "warm should accept MIDI channel 5 for receive logging");
  assert.equal(controller.toggleChannelMidiReceive("glass"), true, "the other default channel-5 strip should be disabled for an isolated receive log test");
  environment.fakeInput.emit([0x94, 72, 88], 1000);
  await flushMicrotasks();

  assert.ok(
    midiLogs.some(([, payload]) => payload?.direction === "receive"
      && payload?.source === "hardware"
      && payload?.type === "noteon"
      && payload?.midiChannel === 5
      && payload?.noteNumber === 72
      && payload?.velocity === 88),
    "incoming hardware MIDI note-on should be logged with parsed metadata",
  );
  assert.ok(
    midiLogs.some(([, payload]) => payload?.direction === "send"
      && payload?.source === "cross-tab"
      && payload?.type === "midi-note-message"
      && payload?.payload?.type === "noteon"
      && payload?.payload?.midiChannel === 5
      && payload?.payload?.noteNumber === 72
      && payload?.payload?.velocity === 88),
    "incoming hardware MIDI should also log the relayed cross-tab publish event",
  );

  midiLogs.length = 0;
  assert.equal(controller.setMidiInputPort(""), true, "hardware input should be clearable so cross-tab receive stays active");
  const remoteTab = createMidiCrossTabCoordinator({ tabId: "remote-log-test" });
  assert.equal(remoteTab.start(), true, "remote relay test tab should join the shared channel");
  assert.equal(
    remoteTab.publish("midi-note-message", { type: "noteon", midiChannel: 5, noteNumber: 74, velocity: 99 }),
    true,
    "remote tab should be able to publish a relayed MIDI note message",
  );
  await flushMicrotasks();

  assert.ok(
    midiLogs.some(([, payload]) => payload?.direction === "receive"
      && payload?.source === "cross-tab"
      && payload?.type === "midi-note-message"
      && payload?.payload?.type === "noteon"
      && payload?.payload?.midiChannel === 5
      && payload?.payload?.noteNumber === 74
      && payload?.payload?.velocity === 99),
    "incoming cross-tab MIDI relay should be logged on receipt",
  );

  remoteTab.stop();
  console.log("midi logging checks passed");
} finally {
  globalThis.console.debug = previousConsoleDebug;
  environment.restore();
}

