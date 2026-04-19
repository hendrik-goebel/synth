import assert from "node:assert/strict";

import { NOTE_OPTIONS, PENTATONIC_NOTE_IDS } from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { state } from "../js/state.js";

assert.equal(NOTE_OPTIONS.length, 48, "arpeggio note source should cover four chromatic octaves");
assert.equal(NOTE_OPTIONS[0]?.id, "note-c3", "lowest arpeggio note should now be C3");
assert.equal(NOTE_OPTIONS.at(-1)?.id, "note-b6", "highest arpeggio note should now be B6");

assert.ok(PENTATONIC_NOTE_IDS.includes("note-c3"), "pentatonic pool should include the new lower octave");
assert.ok(PENTATONIC_NOTE_IDS.includes("note-a6"), "pentatonic pool should include the new higher octave");

const controller = new AudioStateController();
const errors = [];

controller.addEventListener("error", (event) => {
  errors.push(event.detail);
});

controller.initialize();
controller.selectInstrument("warm");
state.instrumentArpeggioOctavesByPresetId.warm = [3, 4, 5, 6];
state.instrumentNoteIdsByPresetId.warm = ["note-c4", "note-e4", "note-g4"];

assert.equal(controller.toggleNote("note-c3"), true, "controller should accept the new lowest note");
assert.ok(state.instrumentNoteIdsByPresetId.warm.includes("note-c3"), "selected notes should include C3 after toggling it on");

assert.equal(controller.toggleNote("note-b6"), true, "controller should accept the new highest note");
assert.ok(state.instrumentNoteIdsByPresetId.warm.includes("note-b6"), "selected notes should include B6 after toggling it on");

assert.equal(errors.length, 0, "range extension should not emit controller errors");

console.log("arpeggio note range checks passed");

