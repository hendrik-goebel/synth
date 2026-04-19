import assert from "node:assert/strict";

import {
  CIRCLE_OF_FIFTHS_KEY_ORDER,
  getCircleOfFifthsKeyLabel,
  getPitchClassesForMajorKey,
} from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
const stateChanges = [];
controller.addEventListener("statechange", (event) => {
  stateChanges.push(event.detail);
});

controller.initialize();

assert.equal(state.globalArpeggioKeyIndex, 0, "default global arpeggio key should start at C");
assert.equal(getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex), "C");
assert.deepEqual(
  getPitchClassesForMajorKey(state.globalArpeggioKeyIndex),
  ["c", "d", "e", "f", "g", "a", "b"],
  "C major should highlight only the natural notes",
);

assert.equal(controller.stepGlobalArpeggioKey(1), true, "next key step should succeed");
assert.equal(getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex), "G");
assert.deepEqual(
  getPitchClassesForMajorKey(state.globalArpeggioKeyIndex),
  ["g", "a", "b", "c", "d", "e", "fs"],
  "G major should include F#",
);

assert.equal(controller.stepGlobalArpeggioKey(-1), true, "previous key step should succeed");
assert.equal(getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex), "C");

assert.equal(controller.stepGlobalArpeggioKey(-1), true, "stepping backward from C should wrap to F");
assert.equal(getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex), "F");
assert.deepEqual(
  getPitchClassesForMajorKey(state.globalArpeggioKeyIndex),
  ["f", "g", "a", "as", "c", "d", "e"],
  "F major should map Bb to A# in the sharp-based pitch-class UI",
);

state.globalArpeggioKeyIndex = 0;
assert.equal(controller.stepGlobalArpeggioKey(CIRCLE_OF_FIFTHS_KEY_ORDER.length), true, "multi-step movement should normalize through the circle");
assert.equal(getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex), "C");

const lastKeyChange = stateChanges.filter(({ type }) => type === "global-arpeggio-key-updated").at(-1);
assert.ok(lastKeyChange, "controller should emit a key-update statechange event");
assert.equal(lastKeyChange.keyLabel, "C");

assert.equal(controller.stepGlobalArpeggioKey(0), false, "zero-step movement should be rejected");

console.log("global arpeggio key checks passed");

