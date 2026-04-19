import assert from "node:assert/strict";

import { extractOctave, extractPitchClass, NOTE_OPTIONS } from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
const stateChanges = [];
const errors = [];
const noteFrequencyById = new Map(NOTE_OPTIONS.map(({ id, frequency }) => [id, frequency]));

controller.addEventListener("statechange", (event) => {
  stateChanges.push(event.detail);
});
controller.addEventListener("error", (event) => {
  errors.push(event.detail);
});

controller.initialize();
controller.selectInstrument("warm");

state.instrumentArpeggioOctavesByPresetId.warm = [3, 4, 5, 6];
state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "e", "g"];
state.instrumentNoteIdsByPresetId.warm = ["note-c3", "note-e4", "note-g5", "note-c6"];

assert.equal(controller.toggleArpeggioOctaveRow(3), true, "disabling octave row 3 should succeed");
assert.deepEqual(
  state.instrumentArpeggioOctavesByPresetId.warm,
  [4, 5, 6],
  "warm channel should keep all octave rows except the disabled one",
);
assert.deepEqual(
  state.instrumentNoteIdsByPresetId.warm,
  ["note-e4", "note-g5", "note-c6"],
  "disabling an octave row should remove selected notes from that octave",
);
assert.ok(
  !state.instrumentPatternsByPresetId.warm.includes(noteFrequencyById.get("note-c3")),
  "disabled octave notes should not remain in the scheduled arpeggio pattern",
);

assert.equal(controller.toggleNote("note-c3"), false, "manual note toggles should reject disabled octave rows");
assert.equal(
  errors.at(-1)?.message,
  "Enable octave 3 before selecting notes in that row",
  "disabled octave note clicks should emit a clear error",
);

state.instrumentArpeggioOctavesByPresetId.warm = [3, 4, 5];
state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "e", "g"];
state.instrumentNoteIdsByPresetId.warm = ["note-c3", "note-e4", "note-g5"];

assert.equal(controller.createNoteVariation("warm"), true, "variation should still succeed with enabled octave rows");
state.instrumentNoteIdsByPresetId.warm.forEach((noteId) => {
  assert.ok(
    [3, 4, 5].includes(extractOctave(noteId)),
    `variation result ${noteId} should stay inside enabled octave rows`,
  );
});

state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "e", "g"];
state.instrumentNoteIdsByPresetId.warm = ["note-c3", "note-e4", "note-g5"];
state.instrumentArpeggioOctavesByPresetId.organ = [4, 5];
state.instrumentArpeggioPitchClassesByPresetId.organ = ["d", "f", "a"];
state.instrumentNoteIdsByPresetId.organ = ["note-d4", "note-f4", "note-a5"];

assert.equal(
  controller.applyActiveArpeggioSettingsToChannels(["organ"]),
  true,
  "apply should succeed when the target channel keeps its own octave-row mask",
);
state.instrumentNoteIdsByPresetId.organ.forEach((noteId) => {
  assert.ok(
    [4, 5].includes(extractOctave(noteId)),
    `apply result ${noteId} should stay inside the target channel's enabled octave rows`,
  );
  assert.ok(
    ["c", "e", "g"].includes(extractPitchClass(noteId)),
    `apply result ${noteId} should still use the source channel pitch-class settings`,
  );
});

const octaveRowStateChange = stateChanges.findLast(({ type }) => type === "arpeggio-octave-rows-updated");
assert.ok(octaveRowStateChange, "octave row toggle should emit a dedicated statechange event");
assert.deepEqual(
  octaveRowStateChange.enabledOctaves,
  [4, 5, 6],
  "statechange should report the enabled octave rows after the toggle",
);

console.log("arpeggio octave row toggle checks passed");

