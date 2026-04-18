import assert from "node:assert/strict";
import { AudioStateController } from "../js/audio-state-controller.js";
import { getAssignedPresetId, getInstrumentParams } from "../js/presets.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
controller.initialize();

controller.selectInstrument("warm");
const warmBefore = { ...getInstrumentParams("warm") };
const pluckBefore = { ...getInstrumentParams("pluck") };

assert.equal(controller.setChannelVolume("warm", 0.42), true);
assert.equal(controller.setControlValue("filter-cutoff", 4321), true);
assert.equal(controller.setChannelInstrument("warm", "bass"), true);

const warmAfter = getInstrumentParams("warm");
assert.equal(getAssignedPresetId("warm"), "bass");
assert.equal(state.activeInstrumentPresetId, "warm");
assert.equal(warmAfter.channelVolume, 0.42);
assert.equal(warmAfter.stereoPan, warmBefore.stereoPan);
assert.equal(warmAfter.noteLength, warmBefore.noteLength);
assert.equal(warmAfter.filterCutoff, 430);
assert.equal(warmAfter.distortionDrive, 0.58);
assert.equal(warmAfter.deadNoteAtEnd, warmBefore.deadNoteAtEnd);
assert.equal(warmAfter.endPauseCount, warmBefore.endPauseCount);

assert.equal(controller.setChannelInstrument("pluck", "bass"), true);
const pluckAfter = getInstrumentParams("pluck");
assert.equal(getAssignedPresetId("pluck"), "bass");
assert.equal(pluckAfter.stereoPan, pluckBefore.stereoPan);
assert.notEqual(pluckAfter.stereoPan, warmAfter.stereoPan);
assert.equal(pluckAfter.filterCutoff, 430);

console.log("controller assignment checks passed");

