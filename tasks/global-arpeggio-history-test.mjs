import assert from "node:assert/strict";

import { AudioStateController } from "../js/audio-state-controller.js";
import { state } from "../js/state.js";

function captureComparableState() {
  return {
    globalArpeggioKeyIndex: state.globalArpeggioKeyIndex,
    warm: {
      pitchClasses: state.instrumentArpeggioPitchClassesByPresetId.warm.slice(),
      octaves: state.instrumentArpeggioOctavesByPresetId.warm.slice(),
      noteIds: state.instrumentNoteIdsByPresetId.warm.slice(),
    },
    organ: {
      pitchClasses: state.instrumentArpeggioPitchClassesByPresetId.organ.slice(),
      octaves: state.instrumentArpeggioOctavesByPresetId.organ.slice(),
      noteIds: state.instrumentNoteIdsByPresetId.organ.slice(),
    },
  };
}

function assertComparableState(actual, expected, messagePrefix) {
  assert.equal(actual.globalArpeggioKeyIndex, expected.globalArpeggioKeyIndex, `${messagePrefix}: global key index should match`);
  assert.deepEqual(actual.warm, expected.warm, `${messagePrefix}: warm state should match`);
  assert.deepEqual(actual.organ, expected.organ, `${messagePrefix}: organ state should match`);
}

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

state.arpeggioHistorySnapshots = [];
state.arpeggioHistoryIndex = 0;
state.globalArpeggioKeyIndex = 0;
state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "e", "g"];
state.instrumentArpeggioOctavesByPresetId.warm = [4, 5];
state.instrumentNoteIdsByPresetId.warm = ["note-c4", "note-e4", "note-g4"];
state.instrumentArpeggioPitchClassesByPresetId.organ = ["d", "f", "a"];
state.instrumentArpeggioOctavesByPresetId.organ = [3, 4];
state.instrumentNoteIdsByPresetId.organ = ["note-d3", "note-f3", "note-a3"];

assert.equal(
  controller.applyActiveArpeggioSettingsToChannels(["warm"]),
  true,
  "first apply should create the first applied history entry",
);
const firstAppliedState = captureComparableState();
assert.equal(state.arpeggioHistorySnapshots.length, 1, "first apply should create a 1/1 history");
assert.equal(state.arpeggioHistoryIndex, 0, "after the first apply the current applied entry should be 1/1");
assert.equal(state.arpeggioHistorySnapshots[0].globalArpeggioKeyIndex, firstAppliedState.globalArpeggioKeyIndex, "the first history entry should store the resulting current key");
assert.deepEqual(state.arpeggioHistorySnapshots[0].channels.warm.enabledPitchClasses, firstAppliedState.warm.pitchClasses, "the first history entry should store the resulting current warm pitch classes");
assert.deepEqual(state.arpeggioHistorySnapshots[0].channels.warm.noteIds, firstAppliedState.warm.noteIds, "the first history entry should store the resulting current warm note ids");

state.globalArpeggioKeyIndex = 5;
state.instrumentArpeggioPitchClassesByPresetId.warm = ["d", "f", "a"];
state.instrumentArpeggioOctavesByPresetId.warm = [4];
state.instrumentNoteIdsByPresetId.warm = ["note-d4", "note-f4", "note-a4"];
state.instrumentArpeggioPitchClassesByPresetId.organ = ["c", "e", "g"];
state.instrumentArpeggioOctavesByPresetId.organ = [5];
state.instrumentNoteIdsByPresetId.organ = ["note-c5", "note-e5", "note-g5"];

assert.equal(
  controller.applyActiveArpeggioSettingsToChannels(["warm"]),
  true,
  "second apply should append the new resulting current state",
);
const secondAppliedState = captureComparableState();
assert.equal(state.arpeggioHistorySnapshots.length, 2, "second apply should create a 2/2 history");
assert.equal(state.arpeggioHistoryIndex, 1, "after the second apply the current applied entry should be 2/2");
assert.equal(state.arpeggioHistorySnapshots[1].globalArpeggioKeyIndex, secondAppliedState.globalArpeggioKeyIndex, "the second history entry should store the resulting current key");
assert.deepEqual(state.arpeggioHistorySnapshots[1].channels.warm.enabledPitchClasses, secondAppliedState.warm.pitchClasses, "the second history entry should store the resulting current warm pitch classes");
assert.deepEqual(state.arpeggioHistorySnapshots[1].channels.warm.noteIds, secondAppliedState.warm.noteIds, "the second history entry should store the resulting current warm note ids");

assert.equal(controller.stepArpeggioHistory(-1), true, "prev should move from 2/2 to the previous applied state 1/2");
assertComparableState(captureComparableState(), firstAppliedState, "first prev restore");
assert.equal(state.arpeggioHistoryIndex, 0, "prev should move the history cursor to 1/2");

assert.equal(controller.stepArpeggioHistory(-1), false, "prev should reject when already at the oldest applied state");
assert.equal(errors.at(-1)?.message, "Already at the oldest stored arpeggio preset", "oldest-boundary rejection should emit a clear error");

assert.equal(controller.stepArpeggioHistory(1), true, "next should move forward from 1/2 to the current applied state 2/2");
assertComparableState(captureComparableState(), secondAppliedState, "first next restore");
assert.equal(state.arpeggioHistoryIndex, 1, "next should return the history cursor to 2/2");

assert.equal(controller.stepArpeggioHistory(1), false, "next should reject when already at the newest state");
assert.equal(errors.at(-1)?.message, "Already at the newest arpeggio preset", "newest-boundary rejection should emit a clear error");

const historyStepStateChange = stateChanges.findLast(({ type }) => type === "arpeggio-history-stepped");
assert.ok(historyStepStateChange, "history navigation should emit a dedicated statechange event");
assert.equal(historyStepStateChange.isLivePosition, true, "the last history statechange should report returning to the live state");
assert.equal(historyStepStateChange.historyPosition, historyStepStateChange.historyLength, "the current live state should always be reported as the last logical history element");
assert.equal(historyStepStateChange.historyLength, state.arpeggioHistorySnapshots.length, "the logical history length should match the number of applied history entries");

state.arpeggioHistorySnapshots = [];
state.arpeggioHistoryIndex = 0;
controller.selectInstrument("warm");
for (let i = 0; i < 35; i += 1) {
  state.globalArpeggioKeyIndex = i;
  state.instrumentArpeggioPitchClassesByPresetId.warm = i % 2 === 0 ? ["c"] : ["d"];
  state.instrumentArpeggioOctavesByPresetId.warm = [4];
  state.instrumentNoteIdsByPresetId.warm = [i % 2 === 0 ? "note-c4" : "note-d4"];
  assert.equal(
    controller.applyActiveArpeggioSettingsToChannels(["warm"]),
    true,
    `history-capping apply ${i + 1} should succeed`,
  );
}

assert.equal(state.arpeggioHistorySnapshots.length, 32, "history should keep at most 32 stored snapshots");
assert.equal(state.arpeggioHistoryIndex, 31, "after capped applies the current applied state should be the last stored entry");
assert.equal(state.arpeggioHistorySnapshots[0].globalArpeggioKeyIndex, 3, "when the cap is exceeded the oldest stored snapshots should be dropped first");
assert.equal(state.arpeggioHistorySnapshots.at(-1).globalArpeggioKeyIndex, 34, "the newest stored snapshot should remain available at the end of the capped history");

console.log("global arpeggio history checks passed");

