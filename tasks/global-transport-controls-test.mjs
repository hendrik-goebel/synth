import assert from "node:assert/strict";

import { AudioStateController } from "../js/audio-state-controller.js";
import { getPresetIds } from "../js/presets.js";
import { state } from "../js/state.js";

class FakeAudioParam {
  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  setValueAtTime(value) {
    this.value = value;
  }

  setTargetAtTime(value) {
    this.value = value;
  }

  linearRampToValueAtTime(value) {
    this.value = value;
  }

  cancelScheduledValues() {}
}

class FakeAudioNode {
  constructor(paramKeys = []) {
    this.connections = [];
    paramKeys.forEach((key) => {
      this[key] = new FakeAudioParam();
    });
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections = [];
  }
}

let createdContextCount = 0;
let closedContextCount = 0;

class FakeAudioContext {
  constructor() {
    createdContextCount += 1;
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = "running";
    this.destination = new FakeAudioNode();
  }

  createGain() {
    const node = new FakeAudioNode(["gain"]);
    node.gain.value = 1;
    return node;
  }

  createDynamicsCompressor() {
    return new FakeAudioNode(["threshold", "knee", "ratio", "attack", "release"]);
  }

  createDelay() {
    return new FakeAudioNode(["delayTime"]);
  }

  createWaveShaper() {
    const node = new FakeAudioNode();
    node.curve = null;
    node.oversample = "none";
    return node;
  }

  createBiquadFilter() {
    const node = new FakeAudioNode(["frequency", "Q"]);
    node.type = "lowpass";
    return node;
  }

  createConvolver() {
    const node = new FakeAudioNode();
    node.buffer = null;
    return node;
  }

  createBuffer(numberOfChannels, length) {
    return {
      numberOfChannels,
      getChannelData() {
        return new Float32Array(length);
      },
    };
  }

  close() {
    this.state = "closed";
    closedContextCount += 1;
    return Promise.resolve();
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}

const previousWindow = globalThis.window;
const previousActivePresetIds = state.activePresetIds.slice();

globalThis.window = {
  AudioContext: FakeAudioContext,
};

state.activePresetIds = [];
state.playingPresetIds.clear();
state.transportState = "stopped";
state.audioContext = undefined;
state.schedulerId = null;
state.schedulerChannel = null;
state.nextNoteTime = 0;
state.stepIndex = 0;

const controller = new AudioStateController();
controller.initialize();

state.stepIndex = 999;
assert.equal(await controller.playAll(), true, "global play should succeed");
assert.equal(state.transportState, "playing", "global play should enter the playing state");
assert.equal(state.playingPresetIds.size, getPresetIds().length, "global play should arm every channel");
assert.ok(state.playingPresetIds.has("warm") && state.playingPresetIds.has("deep"), "global play should include the full mixer range");
assert.ok(state.stepIndex < 20, "global play should restart scheduling near step 0 instead of continuing the old timeline");
assert.equal(createdContextCount, 1, "first global play should create one audio context");
assert.ok(state.schedulerId !== null, "global play should start the scheduler loop");

assert.equal(controller.pauseAll(), true, "global pause should succeed while transport is playing");
assert.equal(state.transportState, "paused", "global pause should enter the paused state");
assert.equal(state.playingPresetIds.size, 0, "global pause should stop all channel playback membership");
assert.equal(state.schedulerId, null, "global pause should halt the scheduler loop");
assert.ok(state.audioContext, "global pause should keep the current audio context alive");
assert.equal(state.stepIndex, 0, "global pause should reset the timeline so the next play starts from the beginning");

state.stepIndex = 777;
assert.equal(await controller.playAll(), true, "global play should restart cleanly after pause");
assert.equal(state.transportState, "playing", "play after pause should re-enter the playing state");
assert.equal(state.playingPresetIds.size, getPresetIds().length, "play after pause should again start all channels");
assert.ok(state.stepIndex < 20, "play after pause should restart from the beginning rather than resume the previous step index");
assert.equal(createdContextCount, 2, "play after pause should recreate the audio context for a clean restart");
assert.equal(closedContextCount, 1, "play after pause should close the paused context before restarting");

assert.equal(await controller.stopAll(), true, "global stop should succeed");
assert.equal(state.transportState, "stopped", "global stop should enter the stopped state");
assert.equal(state.playingPresetIds.size, 0, "global stop should clear all playing channels");
assert.equal(state.schedulerId, null, "global stop should clear the scheduler loop");
assert.equal(state.audioContext, undefined, "global stop should fully tear down the audio context");
assert.equal(closedContextCount, 2, "global stop should close the active audio context");

state.activePresetIds = previousActivePresetIds;
globalThis.window = previousWindow;

console.log("global transport control checks passed");

