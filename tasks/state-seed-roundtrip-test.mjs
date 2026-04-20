import assert from "node:assert/strict";

import {
  DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
  DEFAULT_PRESET_ID,
  INITIAL_SYNTH_PARAMS,
  MIXER_CHANNEL_IDS,
} from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { rebuildInstrumentPattern } from "../js/patterns.js";
import { createStateSeedSnapshot, getStateSeedFromLocation, replaceStateSeedInLocation } from "../js/state-seed.js";
import { state } from "../js/state.js";

function resetSharedState() {
  state.synthParams = { ...INITIAL_SYNTH_PARAMS };
  state.audioContext = undefined;
  state.transportState = "stopped";
  state.schedulerId = null;
  state.schedulerChannel = null;
  state.nextNoteTime = 0;
  state.stepIndex = 0;
  state.masterGain = null;
  state.compressor = null;
  state.delayNode = null;
  state.delayFeedback = null;
  state.delayDrive = null;
  state.delayHighpass = null;
  state.delayReturnGain = null;
  state.delayTone = null;
  state.cleanDelayNode = null;
  state.cleanDelayFeedback = null;
  state.cleanDelayReturnGain = null;
  state.reverbConvolver = null;
  state.reverbInput = null;
  state.reverbWetGain = null;
  state.reverbDryGain = null;
  state.distortionFeedbackBusByPresetId = {};
  state.activeChannelLevelGainsByPresetId = {};
  state.activePresetIds = MIXER_CHANNEL_IDS.slice();
  state.channelAssignedPresetIdById = Object.fromEntries(MIXER_CHANNEL_IDS.map((channelId) => [channelId, channelId]));
  state.instrumentParamsByPresetId = {};
  state.instrumentArpeggioPitchClassesByPresetId = {};
  state.instrumentArpeggioOctavesByPresetId = {};
  state.instrumentNoteIdsByPresetId = {};
  state.instrumentNoteLengthInitializedByPresetId = {};
  state.instrumentPatternsByPresetId = {};
  state.globalArpeggioKeyIndex = DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX;
  state.startupRandomizationApplied = false;
  state.currentStateSeed = "";
  state.arpeggioHistorySnapshots = [];
  state.arpeggioHistoryIndex = 0;
  state.activeInstrumentPresetId = DEFAULT_PRESET_ID;
  state.playingPresetIds = new Set();
}

resetSharedState();

const controller = new AudioStateController();
const errors = [];
controller.addEventListener("error", (event) => {
  errors.push(event.detail);
});
controller.initialize();

controller.selectInstrument("warm");
controller.setChannelInstrument("warm", "bell");
controller.setControlValue("tempo-bpm", 173);
controller.setControlValue("global-timbre", 0.31);
controller.setControlValue("delay-feedback", 0.42);
controller.setControlValue("clean-delay-repetitions", 9);
controller.setControlValue("filter-cutoff", 2410);
controller.setControlValue("distortion-drive", 0.44);
controller.setControlValue("delay-send", 0.07);
controller.setDeadNotePauseCount(4, "warm");
controller.toggleDeadNoteAtEnd("warm");
controller.setChannelVolume("warm", 0.58);
controller.toggleChannelMute("warm");
state.instrumentArpeggioPitchClassesByPresetId.warm = ["c", "f", "a"];
state.instrumentArpeggioOctavesByPresetId.warm = [3, 5];
state.instrumentNoteIdsByPresetId.warm = ["note-c3", "note-f3", "note-a5"];
rebuildInstrumentPattern("warm");

controller.setChannelInstrument("acid", "vapor");
controller.setChannelVolume("acid", 0.83);
state.instrumentArpeggioPitchClassesByPresetId.acid = ["d", "g", "as"];
state.instrumentArpeggioOctavesByPresetId.acid = [4, 6];
state.instrumentNoteIdsByPresetId.acid = ["note-d4", "note-g4", "note-as6"];
rebuildInstrumentPattern("acid");
state.globalArpeggioKeyIndex = 5;
state.activeInstrumentPresetId = "acid";

const expectedSnapshot = createStateSeedSnapshot();
const seed = controller.getStateSeed();
assert.ok(seed.length > 24, "generated seed should be a non-trivial encoded string");
assert.equal(state.currentStateSeed, seed, "generating a seed should cache the canonical value in shared state");

controller.selectInstrument("pluck");
controller.setChannelInstrument("warm", "sub-bass");
controller.setControlValue("tempo-bpm", 92);
controller.setControlValue("global-timbre", -0.6);
controller.setControlValue("delay-feedback", 0.05);
state.instrumentArpeggioPitchClassesByPresetId.warm = ["e"];
state.instrumentArpeggioOctavesByPresetId.warm = [4];
state.instrumentNoteIdsByPresetId.warm = ["note-e4"];
rebuildInstrumentPattern("warm");
state.globalArpeggioKeyIndex = 1;

assert.equal(controller.loadStateSeed(seed), true, "loading a generated seed should succeed");
assert.deepEqual(createStateSeedSnapshot(), expectedSnapshot, "loading a generated seed should restore the exact saved state snapshot");
assert.equal(state.currentStateSeed, seed, "loading should keep the canonical seed string available for the UI");

assert.equal(controller.loadStateSeed("not-a-valid-seed"), false, "invalid seeds should be rejected");
assert.equal(errors.at(-1)?.message, "Invalid state seed", "invalid seed rejection should emit a clear error message");
assert.deepEqual(createStateSeedSnapshot(), expectedSnapshot, "rejecting an invalid seed should leave the current state untouched");

assert.equal(getStateSeedFromLocation(`https://example.com/app?seed=${seed}`), seed, "startup helper should read the seed from the URL query string");
const replaceCalls = [];
replaceStateSeedInLocation(seed, {
  locationLike: "https://example.com/app?foo=1",
  historyLike: {
    state: { ok: true },
    replaceState(nextState, _unusedTitle, nextUrl) {
      replaceCalls.push({ nextState, nextUrl });
    },
  },
});
assert.equal(replaceCalls[0]?.nextUrl, `/app?foo=1&seed=${seed}`, "URL replacement helper should preserve existing query params while adding the seed");

resetSharedState();
const hydratedController = new AudioStateController();
const initializeResult = hydratedController.initialize({ seed });
assert.equal(initializeResult.seedLoaded, true, "controller initialization should report successful startup seed hydration");
assert.deepEqual(createStateSeedSnapshot(), expectedSnapshot, "startup seed hydration should restore the same saved state snapshot");
assert.equal(state.startupRandomizationApplied, true, "successful seed hydration should suppress later startup randomization");

console.log("state seed round-trip checks passed");

