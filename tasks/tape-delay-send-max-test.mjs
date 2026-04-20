import assert from "node:assert/strict";

import {
  BASE_SOUND_PRESETS,
  INITIAL_SYNTH_PARAMS,
  TAPE_DELAY_SEND_MAX,
} from "../js/constants.js";
import { AudioStateController } from "../js/audio-state-controller.js";
import { getInstrumentParams } from "../js/presets.js";
import { state } from "../js/state.js";

assert.equal(
  INITIAL_SYNTH_PARAMS.delaySend,
  TAPE_DELAY_SEND_MAX,
  "shared startup tape delay send should use the capped maximum",
);

Object.entries(BASE_SOUND_PRESETS).forEach(([presetId, preset]) => {
  const tapeDelaySend = preset.delaySend ?? 0;
  assert.ok(
    tapeDelaySend <= TAPE_DELAY_SEND_MAX,
    `${presetId} tape delay send should not exceed ${TAPE_DELAY_SEND_MAX}`,
  );
});

const controller = new AudioStateController();
controller.initialize();

const warmParams = getInstrumentParams("warm");
assert.ok(
  warmParams.delaySend <= TAPE_DELAY_SEND_MAX,
  "initialized channel params should stay inside the tape delay send cap",
);

assert.equal(controller.setControlValue("delay-send", TAPE_DELAY_SEND_MAX), true, "setting tape delay send to the cap should succeed");
assert.equal(
  getInstrumentParams(state.activeInstrumentPresetId).delaySend,
  TAPE_DELAY_SEND_MAX,
  "the active instrument should store the capped tape delay send value",
);

assert.equal(controller.setControlValue("delay-send", TAPE_DELAY_SEND_MAX + 0.01), false, "setting tape delay send above the cap should be rejected");
assert.equal(
  getInstrumentParams(state.activeInstrumentPresetId).delaySend,
  TAPE_DELAY_SEND_MAX,
  "rejecting an out-of-range tape delay send should leave the previous valid value untouched",
);

console.log("tape delay send max checks passed");

