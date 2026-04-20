import assert from "node:assert/strict";

import {
  BASE_SOUND_PRESETS,
  extractOctave,
  extractPitchClass,
  getPitchClassesForMajorKey,
  INITIAL_CHANNEL_SCENES,
} from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { getInstrumentPattern } from "../js/patterns.js";
import {
  getAssignedPresetId,
  getAvailablePresetIds,
  getInstrumentParams,
} from "../js/presets.js";
import { state } from "../js/state.js";

const originalRandom = Math.random;
const mockedRandomValues = [0.5, ...Array(600).fill(0)];
let mockedRandomIndex = 0;
Math.random = () => mockedRandomValues[mockedRandomIndex++] ?? 0;

const controller = new AudioStateController();
try {
  controller.initialize();
} finally {
  Math.random = originalRandom;
}

assert.equal(state.synthParams.tempoBpm, 118, "startup scene should set the intended global tempo");
assert.equal(state.synthParams.tapeDelayEnabled, 1, "tape delay should start enabled");
assert.equal(state.synthParams.delayDivision, 4, "tape delay should start at the intended rhythmic division");
assert.equal(state.synthParams.delayFeedback, 0.008, "tape delay feedback should use the shared startup value");
assert.equal(state.synthParams.cleanDelayEnabled, 1, "clean delay should start enabled");
assert.equal(state.synthParams.cleanDelayDivision, 5, "clean delay should use its dedicated startup division");
assert.equal(state.synthParams.cleanDelayRepetitions, 3, "clean delay repetitions should come from the startup scene");
assert.equal(state.synthParams.lfoTarget, 1, "startup scene should enable filter-cutoff LFO modulation");
assert.equal(state.synthParams.lfoRate, 0.22, "startup LFO rate should be deterministic");
assert.equal(state.synthParams.lfoDepth, 0.16, "startup LFO depth should be deterministic");

assert.equal(state.globalArpeggioKeyIndex, 6, "startup randomization should be able to choose a non-default global key");
const startupKeyPitchClasses = new Set(getPitchClassesForMajorKey(state.globalArpeggioKeyIndex));
const availablePresetIds = new Set(getAvailablePresetIds());
const reassignedChannelIds = [];

Object.entries(INITIAL_CHANNEL_SCENES).forEach(([channelId, scene]) => {
  const instrumentParams = getInstrumentParams(channelId);

  assert.equal(
    instrumentParams.channelVolume,
    scene.params.channelVolume,
    `${channelId} should hydrate its startup channel volume`,
  );
  assert.equal(
    instrumentParams.stereoPan,
    scene.params.stereoPan,
    `${channelId} should hydrate its startup stereo pan`,
  );
  assert.equal(
    instrumentParams.noteLength,
    scene.params.noteLength,
    `${channelId} should hydrate its startup note length instead of using random weighting`,
  );
  assert.equal(
    instrumentParams.deadNoteAtEnd,
    scene.params.deadNoteAtEnd,
    `${channelId} should hydrate its startup pause toggle state`,
  );
  assert.equal(
    instrumentParams.endPauseCount,
    scene.params.endPauseCount,
    `${channelId} should hydrate its startup pause count`,
  );

  const assignedPresetId = getAssignedPresetId(channelId);
  assert.ok(
    availablePresetIds.has(assignedPresetId),
    `${channelId} should be assigned to a valid preset after startup randomization`,
  );
  if (assignedPresetId !== channelId) {
    reassignedChannelIds.push(channelId);
  }

  const assignedPresetParams = BASE_SOUND_PRESETS[assignedPresetId] || {};
  Object.entries(assignedPresetParams).forEach(([paramKey, paramValue]) => {
    assert.equal(
      instrumentParams[paramKey],
      paramValue,
      `${channelId} should inherit ${paramKey} from assigned preset ${assignedPresetId}`,
    );
  });

  const enabledPitchClasses = state.instrumentArpeggioPitchClassesByPresetId[channelId];
  assert.ok(
    enabledPitchClasses.length >= 3 && enabledPitchClasses.length <= 5,
    `${channelId} should receive a randomized in-key pitch-class set between 3 and 5 notes`,
  );
  enabledPitchClasses.forEach((pitchClassKey) => {
    assert.ok(
      startupKeyPitchClasses.has(pitchClassKey),
      `${channelId} startup pitch class ${pitchClassKey} should stay inside the selected global key`,
    );
  });

  assert.deepEqual(
    state.instrumentArpeggioOctavesByPresetId[channelId],
    scene.enabledOctaves,
    `${channelId} should preserve the intended enabled octave rows`,
  );

  const noteIds = state.instrumentNoteIdsByPresetId[channelId];
  assert.ok(
    noteIds.length >= 2 && noteIds.length <= 5,
    `${channelId} should receive a randomized startup note count between 2 and 5`,
  );

  noteIds.forEach((noteId) => {
    assert.ok(
      enabledPitchClasses.includes(extractPitchClass(noteId)),
      `${channelId} startup note ${noteId} should stay inside the randomized enabled pitch-class pool`,
    );
    assert.ok(
      startupKeyPitchClasses.has(extractPitchClass(noteId)),
      `${channelId} startup note ${noteId} should stay inside the selected global key`,
    );
    assert.ok(
      scene.enabledOctaves.includes(extractOctave(noteId)),
      `${channelId} startup note ${noteId} should stay inside the enabled octave rows`,
    );
  });

  const pattern = getInstrumentPattern(channelId);
  if (scene.params.deadNoteAtEnd) {
    assert.equal(
      pattern.slice(-scene.params.endPauseCount).every((step) => step === null),
      true,
      `${channelId} should append the configured number of trailing pause steps`,
    );
  } else {
    assert.notEqual(
      pattern.at(-1),
      null,
      `${channelId} should not append a trailing pause when the startup toggle is off`,
    );
  }
});

assert.ok(
  reassignedChannelIds.length > 0,
  "startup randomization should reassign at least one channel instrument when random instrument selection is enabled",
);


console.log("initial startup scene checks passed");

