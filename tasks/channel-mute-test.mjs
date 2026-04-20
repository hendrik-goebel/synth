import assert from "node:assert/strict";

import { AudioStateController } from "../js/audio-state-controller.js";
import { getInstrumentParams } from "../js/presets.js";
import { state } from "../js/state.js";

function createTrackedGainNode() {
  return {
    history: [],
    gain: {
      cancelScheduledValues(time) {
        this.lastCancelledAt = time;
      },
      setTargetAtTime(value, time, constant) {
        this.lastTarget = { value, time, constant };
      },
    },
  };
}

const controller = new AudioStateController();
controller.initialize();

const warmParams = getInstrumentParams("warm");
assert.equal(warmParams.channelMuted ?? 0, 0, "channels should start unmuted");

warmParams.channelVolume = 0.37;
state.audioContext = { currentTime: 12.5 };
const trackedGainNode = createTrackedGainNode();
state.activeChannelLevelGainsByPresetId.warm = new Set([trackedGainNode]);

assert.equal(controller.toggleChannelMute("warm"), true, "mute should succeed for a known channel");
assert.equal(warmParams.channelMuted, 1, "mute should flip the channelMuted flag on");
assert.equal(warmParams.channelVolume, 0.37, "mute should preserve the stored channel volume");
assert.deepEqual(
  trackedGainNode.gain.lastTarget,
  { value: 0, time: 12.5, constant: 0.012 },
  "mute should immediately ramp active voice channel level to silence",
);

assert.equal(controller.setChannelVolume("warm", 0.61), true, "channel volume updates should still succeed while muted");
assert.equal(warmParams.channelVolume, 0.61, "volume edits while muted should update the remembered slider value");
assert.deepEqual(
  trackedGainNode.gain.lastTarget,
  { value: 0, time: 12.5, constant: 0.012 },
  "volume changes while muted should keep active voices silent",
);

assert.equal(controller.toggleChannelMute("warm"), true, "second mute toggle should unmute the channel");
assert.equal(warmParams.channelMuted, 0, "second toggle should restore the unmuted state");
assert.deepEqual(
  trackedGainNode.gain.lastTarget,
  { value: 0.61, time: 12.5, constant: 0.012 },
  "unmute should restore the remembered channel volume to active voices",
);

assert.equal(controller.setChannelInstrument("warm", "bell"), true, "changing the assigned instrument should succeed");
const reassignedParams = getInstrumentParams("warm");
assert.equal(reassignedParams.channelVolume, 0.61, "channel reassignment should preserve the remembered channel volume");
assert.equal(reassignedParams.channelMuted, 0, "channel reassignment should preserve the mute state");

assert.equal(controller.toggleChannelMute("warm"), true, "mute should still work after reassignment");
assert.equal(getInstrumentParams("warm").channelMuted, 1, "muted state should remain channel-local after reassignment");

state.audioContext = undefined;
state.activeChannelLevelGainsByPresetId = {};

console.log("channel mute checks passed");

