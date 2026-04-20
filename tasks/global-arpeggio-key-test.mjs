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

const initialKeyIndex = state.globalArpeggioKeyIndex;
assert.ok(
  initialKeyIndex >= 0 && initialKeyIndex < CIRCLE_OF_FIFTHS_KEY_ORDER.length,
  "startup should choose a valid global arpeggio key index",
);
assert.equal(
  getPitchClassesForMajorKey(initialKeyIndex).length,
  7,
  "every startup major key should expose exactly seven pitch classes",
);

assert.equal(controller.stepGlobalArpeggioKey(1), true, "next key step should succeed");
const steppedForwardIndex = (initialKeyIndex + 1) % CIRCLE_OF_FIFTHS_KEY_ORDER.length;
assert.equal(state.globalArpeggioKeyIndex, steppedForwardIndex, "next key step should advance through the circle of fifths");
assert.equal(
  getCircleOfFifthsKeyLabel(state.globalArpeggioKeyIndex),
  getCircleOfFifthsKeyLabel(steppedForwardIndex),
  "key label should match the stepped-forward circle position",
);

assert.equal(controller.stepGlobalArpeggioKey(-1), true, "previous key step should succeed");
assert.equal(state.globalArpeggioKeyIndex, initialKeyIndex, "stepping backward should return to the initial startup key");

state.globalArpeggioKeyIndex = 0;
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

