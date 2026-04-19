import assert from "node:assert/strict";

import { extractPitchClass } from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
const stateChanges = [];
const errors = [];

controller.addEventListener("statechange", (event) => {
  stateChanges.push(event.detail);
});
controller.addEventListener("error", (event) => {
  errors.push(event.detail);
});

controller.initialize();
controller.selectInstrument("warm");

state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "e", "g"];
state.instrumentNoteIdsByPresetId.warm = ["note-c4", "note-e4", "note-g4"];

state.instrumentArpeggioPitchClassesByPresetId.organ = ["d", "f", "a"];
state.instrumentNoteIdsByPresetId.organ = ["note-d4", "note-f4", "note-a4", "note-d5"];

state.instrumentArpeggioPitchClassesByPresetId.bass = ["cs", "ds"];
state.instrumentNoteIdsByPresetId.bass = ["note-cs4", "note-ds4", "note-cs5"];

assert.equal(
  controller.applyActiveArpeggioSettingsToChannels(["warm", "organ"]),
  true,
  "apply should succeed for an explicit selected-channel subset",
);

assert.deepEqual(
  state.instrumentArpeggioPitchClassesByPresetId.warm,
  ["c", "e", "g"],
  "source channel should keep the selected settings pitch classes",
);
assert.deepEqual(
  state.instrumentArpeggioPitchClassesByPresetId.organ,
  ["c", "e", "g"],
  "selected target channel should receive the source settings pitch classes",
);
assert.deepEqual(
  state.instrumentArpeggioPitchClassesByPresetId.bass,
  ["cs", "ds"],
  "unselected channels should keep their prior settings pitch classes",
);

assert.equal(state.instrumentNoteIdsByPresetId.warm.length, 3, "source channel should keep its note count");
assert.equal(state.instrumentNoteIdsByPresetId.organ.length, 4, "selected target channel should keep its note count");
assert.deepEqual(
  state.instrumentNoteIdsByPresetId.bass,
  ["note-cs4", "note-ds4", "note-cs5"],
  "unselected channels should keep their prior concrete note IDs",
);

[state.instrumentNoteIdsByPresetId.warm, state.instrumentNoteIdsByPresetId.organ].forEach((noteIds) => {
  noteIds.forEach((noteId) => {
    assert.ok(
      ["c", "e", "g"].includes(extractPitchClass(noteId)),
      `applied channel note ${noteId} should stay inside the selected settings pool`,
    );
  });
});

const applyStateChange = stateChanges.findLast(({ type }) => type === "arpeggio-settings-applied");
assert.ok(applyStateChange, "targeted apply should emit a dedicated statechange event");
assert.deepEqual(
  applyStateChange.updatedPresetIds,
  ["warm", "organ"],
  "statechange should list only the channels that were updated",
);

assert.equal(
  controller.applyActiveArpeggioSettingsToChannels([]),
  false,
  "apply should reject an empty channel selection",
);
assert.equal(
  errors.at(-1)?.message,
  "Select at least one channel before applying arpeggio settings",
  "empty selection should emit a clear error",
);

console.log("selected-channel arpeggio apply checks passed");

