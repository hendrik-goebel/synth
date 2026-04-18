import assert from "node:assert/strict";
import { AudioStateController } from "../js/audio-state-controller.js";
import { getInstrumentParams, getAssignedPresetId, getAvailablePresetGroups, getAvailablePresetIds, getPresetCategoryLabel, getPresetIds, getPresetLabel } from "../js/presets.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
controller.initialize();

const channelIds = getPresetIds();
const availablePresetIds = getAvailablePresetIds();
const groupedPresets = getAvailablePresetGroups();

assert.equal(channelIds.length, 8);
assert.deepEqual(channelIds, ["warm", "pluck", "organ", "bass", "glass", "acid", "noisy", "deep"]);
assert(availablePresetIds.length > channelIds.length);
assert(availablePresetIds.includes("dusk-pad"));
assert(!availablePresetIds.includes("kick"));
assert.equal(state.activePresetIds.length, 8);

const groupLabels = groupedPresets.map(({ label }) => label);
assert(groupLabels.includes("Bass"));
assert(groupLabels.includes("Pads"));
assert(groupLabels.includes("Keys & Plucks"));
assert(!groupLabels.includes("Percussion"));
assert(groupedPresets.some(({ label, presetIds }) => label === "Pads" && presetIds.includes("choir-pad")));
assert(groupedPresets.some(({ label, presetIds }) => label === "Textures" && presetIds.includes("swarm")));
assert.equal(getPresetLabel("dusk-pad"), "Dusk Pad");
assert.equal(getPresetCategoryLabel("swarm"), "Textures");

assert.equal(controller.selectInstrument("warm"), true);
assert.equal(controller.setChannelInstrument("warm", "sub-bass"), true);
assert.equal(getAssignedPresetId("warm"), "sub-bass");
assert.equal(getInstrumentParams("warm").filterCutoff, 300);

assert.equal(controller.setChannelInstrument("pluck", "choir-pad"), true);
assert.equal(getAssignedPresetId("pluck"), "choir-pad");
assert.equal(getInstrumentParams("pluck").attack, 0.22);
assert.equal(getInstrumentParams("pluck").reverbSend, 0.82);

console.log("preset library checks passed");

