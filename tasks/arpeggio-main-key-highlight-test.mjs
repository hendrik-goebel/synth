import assert from "node:assert/strict";

import { NOTE_OPTIONS } from "../js/constants.js";
import { syncNoteButtonsFromActiveInstrumentPage } from "../js/patterns.js";
import { state } from "../js/state.js";

function createClassList() {
  const classes = new Set();
  return {
    toggle(name, force) {
      if (force) {
        classes.add(name);
        return true;
      }
      classes.delete(name);
      return false;
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

const buttonsById = new Map(
  NOTE_OPTIONS.map(({ id }) => [id, {
    classList: createClassList(),
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  }]),
);

global.document = {
  getElementById(id) {
    return buttonsById.get(id) || null;
  },
};

state.activeInstrumentPresetId = "warm";
state.instrumentNoteIdsByPresetId.warm = ["note-c4", "note-fs4"];
state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "d", "e", "fs", "g", "a", "b"];
state.instrumentArpeggioOctavesByPresetId.warm = [3, 4, 5, 6];
state.globalArpeggioKeyIndex = 1; // G major: includes F#

syncNoteButtonsFromActiveInstrumentPage();

assert.equal(buttonsById.get("note-c4").classList.contains("is-active"), true, "selected notes should stay active");
assert.equal(buttonsById.get("note-c4").classList.contains("is-in-key"), true, "C should highlight in G major");
assert.equal(buttonsById.get("note-fs4").classList.contains("is-active"), true, "selected F# should stay active");
assert.equal(buttonsById.get("note-fs4").classList.contains("is-in-key"), true, "F# should highlight in G major");
assert.equal(buttonsById.get("note-cs4").classList.contains("is-in-key"), false, "C# should not highlight outside the current key");
assert.equal(buttonsById.get("note-fs4").attributes["aria-pressed"], "true", "active notes should keep pressed state");

state.globalArpeggioKeyIndex = 0; // C major: no F#
syncNoteButtonsFromActiveInstrumentPage();

assert.equal(buttonsById.get("note-c4").classList.contains("is-in-key"), true, "C should stay highlighted in C major");
assert.equal(buttonsById.get("note-fs4").classList.contains("is-in-key"), false, "F# highlight should clear when leaving G major");
assert.equal(buttonsById.get("note-fs4").classList.contains("is-active"), true, "key highlighting should not remove active-note state");

console.log("main arpeggio key highlight checks passed");

