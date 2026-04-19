import assert from "node:assert/strict";

import {
  extractOctave,
  extractPitchClass,
  INITIAL_CHANNEL_SCENES,
} from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { getInstrumentPattern } from "../js/patterns.js";
import { getInstrumentParams } from "../js/presets.js";
import { state } from "../js/state.js";

const controller = new AudioStateController();
controller.initialize();

assert.equal(state.synthParams.tempoBpm, 118, "startup scene should set the intended global tempo");
assert.equal(state.synthParams.tapeDelayEnabled, 1, "tape delay should start enabled");
assert.equal(state.synthParams.delayDivision, 4, "tape delay should start at the intended rhythmic division");
assert.equal(state.synthParams.delayFeedback, 0.05, "tape delay feedback should use the startup scene value");
assert.equal(state.synthParams.cleanDelayEnabled, 1, "clean delay should start enabled");
assert.equal(state.synthParams.cleanDelayDivision, 5, "clean delay should use its dedicated startup division");
assert.equal(state.synthParams.cleanDelayRepetitions, 3, "clean delay repetitions should come from the startup scene");
assert.equal(state.synthParams.lfoTarget, 1, "startup scene should enable filter-cutoff LFO modulation");
assert.equal(state.synthParams.lfoRate, 0.22, "startup LFO rate should be deterministic");
assert.equal(state.synthParams.lfoDepth, 0.16, "startup LFO depth should be deterministic");

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

  assert.deepEqual(
    state.instrumentArpeggioPitchClassesByPresetId[channelId],
    scene.enabledPitchClasses,
    `${channelId} should hydrate the intended startup pitch classes`,
  );
  assert.deepEqual(
    state.instrumentArpeggioOctavesByPresetId[channelId],
    scene.enabledOctaves,
    `${channelId} should hydrate the intended enabled octave rows`,
  );
  assert.deepEqual(
    state.instrumentNoteIdsByPresetId[channelId],
    scene.noteIds,
    `${channelId} should hydrate the intended startup note IDs`,
  );

  scene.noteIds.forEach((noteId) => {
    assert.ok(
      scene.enabledPitchClasses.includes(extractPitchClass(noteId)),
      `${channelId} startup note ${noteId} should stay inside the enabled pitch-class pool`,
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

assert.equal(getInstrumentParams("bass").delaySend, 0, "bass should not feed the tape delay at startup");
assert.equal(getInstrumentParams("bass").cleanDelaySend, 0, "bass should not feed the clean delay at startup");
assert.equal(getInstrumentParams("glass").cleanDelaySend, 0.28, "glass should lean on the clean delay musically");
assert.equal(getInstrumentParams("acid").postFilterType, 3, "acid should use the resonant band-pass post filter");
assert.equal(getInstrumentParams("warm").distortionMix, 0.05, "warm should stay mostly clean at startup");
assert.equal(getInstrumentParams("noisy").distortionFeedback, 0.1, "noisy should keep a controlled distortion feedback edge");

console.log("initial startup scene checks passed");

