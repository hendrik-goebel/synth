import assert from "node:assert/strict";

import { AudioStateController } from "../js/audio-state-controller.js";
import { ensureInstrumentNoteState, getEnabledArpeggioPitchClasses } from "../js/patterns.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
controller.initialize();
controller.selectInstrument("warm");
ensureInstrumentNoteState("warm");

state.globalArpeggioKeyIndex = 0;
state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "e", "g"];
state.instrumentNoteIdsByPresetId.warm = ["note-c4", "note-e4", "note-g4"];
assert.equal(controller.transposeArpeggioSettingsByKeyStep(1), true, "C major upward settings transpose should succeed");
assert.deepEqual(
  getEnabledArpeggioPitchClasses("warm"),
  ["d", "f", "a"],
  "C major transpose up should move the selected pitch classes by one in-key step",
);
assert.deepEqual(
  state.instrumentNoteIdsByPresetId.warm,
  ["note-c4", "note-e4", "note-g4"],
  "Settings transpose should not directly mutate concrete instrument note IDs",
);

assert.equal(controller.transposeArpeggioSettingsByKeyStep(-1), true, "C major downward settings transpose should succeed");
assert.deepEqual(
  getEnabledArpeggioPitchClasses("warm"),
  ["c", "e", "g"],
  "C major transpose down should return the selected pitch classes to their original positions",
);

assert.equal(controller.stepGlobalArpeggioKey(1), true, "stepping to G major should succeed");
state.instrumentArpeggioPitchClassesByPresetId.warm = ["e", "f", "a"];
state.instrumentNoteIdsByPresetId.warm = ["note-e4", "note-f4", "note-a4"];
assert.equal(controller.transposeArpeggioSettingsByKeyStep(1), true, "G major upward settings transpose should succeed");
assert.deepEqual(
  getEnabledArpeggioPitchClasses("warm"),
  ["fs", "b"],
  "Settings transpose should respect the current key and collapse duplicate in-key targets into one selected pitch class",
);
assert.deepEqual(
  state.instrumentNoteIdsByPresetId.warm,
  ["note-e4", "note-f4", "note-a4"],
  "Settings transpose should still leave the current instrument note IDs unchanged in G major",
);

state.globalArpeggioKeyIndex = 0;
state.instrumentArpeggioPitchClassesByPresetId.warm = ["b", "c", "cs"];
assert.equal(
  controller.transposeArpeggioSettingsByKeyStep(1),
  true,
  "Pitch-class settings transpose should wrap/advance within the current key rather than failing at an octave edge",
);
assert.deepEqual(
  getEnabledArpeggioPitchClasses("warm"),
  ["c", "d"],
  "Out-of-key and in-key settings selections should collapse into the next valid in-key pitch classes",
);

console.log("global settings transpose checks passed");

