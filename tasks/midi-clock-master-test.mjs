import assert from "node:assert/strict";

import {
  DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
  DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
  DEFAULT_PRESET_ID,
  INITIAL_SYNTH_PARAMS,
  MIXER_CHANNEL_IDS,
} from "../js/constants.js";
import { createMidiCrossTabCoordinator } from "../js/midi-engine.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { state } from "../js/state.js";
import {
  flushMicrotasks,
  installFakeAudioAndMidiEnvironment,
  resetSharedAppState,
} from "./test-helpers/fake-audio-midi.mjs";

const environment = installFakeAudioAndMidiEnvironment({ withInput: false });

try {
  resetSharedAppState(state, {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    INITIAL_SYNTH_PARAMS,
    MIXER_CHANNEL_IDS,
  });

  const controller = new AudioStateController();
  const relayedTransportEvents = [];
  const relaySink = createMidiCrossTabCoordinator({
    tabId: "relay-sink",
    onRemoteEvent(event) {
      relayedTransportEvents.push(event);
    },
  });
  assert.equal(relaySink.start(), true, "the relay sink tab should join the cross-tab channel");
  controller.initialize();
  assert.equal(await controller.initializeMidi(), true, "MIDI initialization should succeed for the fake master-clock environment");
  assert.equal(controller.setMidiClockMode("master"), true, "clock mode should switch to master");

  assert.equal(await controller.playAll(), true, "local playAll should start transport in master clock mode");
  assert.deepEqual(environment.fakeOutput.sentMessages[0].data, [0xfa], "master clock playback should send a MIDI start message first");
  assert.ok(
    relayedTransportEvents.some(({ type }) => type === "transport-start"),
    "local playAll should broadcast an explicit transport-start event to sibling tabs",
  );

  await new Promise((resolve) => setTimeout(resolve, 70));
  const sentClockMessages = environment.fakeOutput.sentMessages.filter(({ data }) => data[0] === 0xf8);
  assert.ok(sentClockMessages.length >= 2, "master clock should emit recurring MIDI clock pulses while transport is playing");

  const pulseCountBeforeStop = sentClockMessages.length;
  assert.equal(await controller.stopAll(), true, "stopAll should stop transport in master clock mode");
  assert.deepEqual(environment.fakeOutput.sentMessages.at(-1).data, [0xfc], "stopping master clock playback should send a MIDI stop message");
  assert.ok(
    relayedTransportEvents.some(({ type }) => type === "transport-stop"),
    "local stopAll should broadcast an explicit transport-stop event to sibling tabs",
  );

  await new Promise((resolve) => setTimeout(resolve, 50));
  const pulseCountAfterStop = environment.fakeOutput.sentMessages.filter(({ data }) => data[0] === 0xf8).length;
  assert.equal(pulseCountAfterStop, pulseCountBeforeStop, "master clock should stop emitting pulses after transport stop");

  relayedTransportEvents.length = 0;
  environment.fakeOutput.sentMessages.length = 0;
  assert.equal(controller.setMidiOutputPort(""), true, "the selected hardware MIDI output should be clearable");
  assert.equal(await controller.playAll(), true, "master send should still start when only cross-tab relay is available");
  assert.equal(state.midi.clockMasterRunning, true, "cross-tab relay alone should still count as an active master clock destination");
  assert.ok(
    relayedTransportEvents.some(({ type }) => type === "transport-start"),
    "transport-start should still be relayed with no hardware output selected",
  );
  assert.ok(
    relayedTransportEvents.some(({ type }) => type === "midi-clock-start"),
    "midi-clock-start should still be relayed with no hardware output selected",
  );

  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.ok(
    relayedTransportEvents.some(({ type }) => type === "midi-clock-pulse"),
    "midi clock pulses should continue to be relayed with no hardware output selected",
  );
  assert.ok(
    relayedTransportEvents.some(({ type, payload }) => type === "midi-note-output"
      && Array.isArray(payload?.noteOnBytes)
      && Array.isArray(payload?.noteOffBytes)),
    "scheduled per-channel MIDI note output should also be relayed across tabs when no hardware output is selected locally",
  );
  assert.equal(environment.fakeOutput.sentMessages.length, 0, "no hardware MIDI messages should be sent when no output port is selected");
  assert.equal(await controller.stopAll(), true, "stop should still succeed after a cross-tab-only master start");

  environment.fakeOutput.sentMessages.length = 0;
  assert.equal(controller.setMidiClockMode("off"), true, "clock mode should be switchable back to off for follower-note-output checks");
  assert.equal(controller.setMidiOutputPort("output-1"), true, "the hardware MIDI output should be reselectable for follower-note-output checks");
  const remoteNoteTab = createMidiCrossTabCoordinator({ tabId: "remote-note-tab" });
  assert.equal(remoteNoteTab.start(), true, "the remote note-output tab should join the shared channel");
  assert.equal(remoteNoteTab.publish("transport-start", { presetIds: ["warm"] }), true, "remote transport start should be publishable");
  await flushMicrotasks();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(state.midi.remoteNoteOutputActive, true, "cross-tab transport start should mark the local tab as a remote note-output follower");
  assert.equal(
    environment.fakeOutput.sentMessages.length,
    0,
    "a follower tab should not emit its own scheduled hardware MIDI notes before the relayed note-output event arrives",
  );

  assert.equal(
    remoteNoteTab.publish("midi-note-output", {
      presetId: "warm",
      noteOnBytes: [0x91, 60, 96],
      noteOffBytes: [0x81, 60, 0],
      startDelayMs: 0,
      endDelayMs: 25,
    }),
    true,
    "remote per-channel note-output events should be publishable",
  );
  await flushMicrotasks();

  assert.deepEqual(
    environment.fakeOutput.sentMessages.slice(0, 2).map(({ data }) => data),
    [
      [0x91, 60, 96],
      [0x81, 60, 0],
    ],
    "the follower tab should replay the relayed per-channel MIDI note bytes on its selected hardware output",
  );
  assert.equal(remoteNoteTab.publish("transport-stop", {}), true, "remote transport stop should be publishable");
  await flushMicrotasks();
  assert.equal(state.midi.remoteNoteOutputActive, false, "cross-tab transport stop should clear follower note-output mode");
  remoteNoteTab.stop();

  const remoteEvents = [];
  const tabA = createMidiCrossTabCoordinator({ tabId: "tab-a" });
  const tabB = createMidiCrossTabCoordinator({
    tabId: "tab-b",
    onRemoteEvent(event) {
      remoteEvents.push(event);
    },
  });

  assert.equal(tabA.start(), true, "first fake tab should open the cross-tab channel");
  assert.equal(tabB.start(), true, "second fake tab should open the cross-tab channel");
  assert.equal(tabA.publish("midi-clock-start", { from: "master" }), true, "publishing a cross-tab clock start should succeed");
  assert.equal(tabA.publish("midi-clock-pulse", { timestampMs: 1234 }), true, "publishing a cross-tab clock pulse should succeed");
  assert.equal(tabA.publish("midi-note-message", { type: "noteon", midiChannel: 3, noteNumber: 67, velocity: 101 }), true, "publishing a cross-tab note should succeed");

  assert.deepEqual(
    remoteEvents.map(({ type, payload }) => ({ type, payload })),
    [
      { type: "midi-clock-start", payload: { from: "master" } },
      { type: "midi-clock-pulse", payload: { timestampMs: 1234 } },
      { type: "midi-note-message", payload: { type: "noteon", midiChannel: 3, noteNumber: 67, velocity: 101 } },
    ],
    "cross-tab MIDI relay should deliver published events to sibling tabs in order",
  );

  const duplicateHandled = tabB.handleEnvelope({
    eventId: "tab-a:duplicate",
    originTabId: "tab-a",
    type: "midi-clock-stop",
    payload: {},
  });
  const duplicateHandledAgain = tabB.handleEnvelope({
    eventId: "tab-a:duplicate",
    originTabId: "tab-a",
    type: "midi-clock-stop",
    payload: {},
  });
  assert.equal(duplicateHandled, true, "the first occurrence of a remote cross-tab envelope should be handled");
  assert.equal(duplicateHandledAgain, false, "duplicate cross-tab envelopes should be ignored to prevent loops");

  tabA.stop();
  tabB.stop();
  relaySink.stop();

  console.log("midi clock master checks passed");
} finally {
  environment.restore();
}

