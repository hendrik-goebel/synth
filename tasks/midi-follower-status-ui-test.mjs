import assert from "node:assert/strict";

class FakeClassList {
  constructor() {
    this.classNames = new Set();
  }

  add(...classNames) {
    classNames.forEach((className) => this.classNames.add(className));
  }

  remove(...classNames) {
    classNames.forEach((className) => this.classNames.delete(className));
  }

  contains(className) {
    return this.classNames.has(className);
  }

  toggle(className, force) {
    if (force === undefined) {
      if (this.classNames.has(className)) {
        this.classNames.delete(className);
        return false;
      }
      this.classNames.add(className);
      return true;
    }

    if (force) {
      this.classNames.add(className);
      return true;
    }

    this.classNames.delete(className);
    return false;
  }
}

class FakeElement {
  constructor({ id = null, classNames = [], dataset = {}, tagName = "DIV", type = "" } = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.tagName = tagName;
    this.type = type;
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
    this.textContent = "";
    this.disabled = false;
    this.value = "";
    this.checked = false;
    this.controllerRef = null;
    classNames.forEach((className) => this.classList.add(className));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  append(...children) {
    this.children.push(...children);
  }

  addEventListener() {}

  removeEventListener() {}

  get options() {
    return this.children;
  }
}

class FakeDocument {
  constructor() {
    this.elementsById = new Map();
    this.selectorMap = new Map();
    this.activeElement = null;
  }

  registerElement(element, selectors = []) {
    if (element.id) {
      this.elementsById.set(element.id, element);
    }

    selectors.forEach((selector) => {
      if (!this.selectorMap.has(selector)) {
        this.selectorMap.set(selector, []);
      }
      this.selectorMap.get(selector).push(element);
    });

    return element;
  }

  getElementById(id) {
    return this.elementsById.get(id) ?? null;
  }

  createElement(tagName = "div") {
    return new FakeElement({ tagName: String(tagName).toUpperCase() });
  }

  querySelectorAll(selector) {
    return this.selectorMap.get(selector)?.slice() || [];
  }

  addEventListener() {}
}

const fakeDocument = new FakeDocument();
const statusLabel = fakeDocument.registerElement(new FakeElement({ id: "status" }));
const globalPlayButton = fakeDocument.registerElement(new FakeElement({ id: "global-play", tagName: "BUTTON", type: "button" }));
const globalStopButton = fakeDocument.registerElement(new FakeElement({ id: "global-stop", tagName: "BUTTON", type: "button" }));
const midiStatus = fakeDocument.registerElement(new FakeElement({ id: "midi-status" }));
const midiClockStatus = fakeDocument.registerElement(new FakeElement({ id: "midi-clock-status" }));
const midiFollowerStatus = fakeDocument.registerElement(new FakeElement({ id: "midi-output-follower-status" }));
const midiInputPort = fakeDocument.registerElement(new FakeElement({ id: "midi-input-port", tagName: "SELECT" }));
const midiOutputPort = fakeDocument.registerElement(new FakeElement({ id: "midi-output-port", tagName: "SELECT" }));
const midiClockMode = fakeDocument.registerElement(new FakeElement({ id: "midi-clock-mode", tagName: "SELECT" }));

midiClockMode.append(
  Object.assign(new FakeElement({ tagName: "OPTION" }), { value: "off", textContent: "Off" }),
  Object.assign(new FakeElement({ tagName: "OPTION" }), { value: "slave", textContent: "External" }),
  Object.assign(new FakeElement({ tagName: "OPTION" }), { value: "master", textContent: "Send" }),
);

const previousDocument = global.document;
const previousWindow = global.window;
const previousCustomEvent = global.CustomEvent;

global.document = fakeDocument;
global.window = { document: fakeDocument };
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, params = {}) {
    super(type);
    this.detail = params.detail;
  }
};

try {
  const [{ AudioStateController }, { state }, { bindControllerEvents }] = await Promise.all([
    import("../js/audio-state-controller.js"),
    import("../js/state.js"),
    import("../js/ui.js"),
  ]);

  state.midi.supported = true;
  state.midi.accessGranted = true;
  state.midi.availableInputs = [{ id: "input-1", name: "Input 1", manufacturer: "Test" }];
  state.midi.availableOutputs = [{ id: "output-1", name: "Output 1", manufacturer: "Test" }];
  state.midi.inputPortId = "input-1";
  state.midi.outputPortId = "output-1";
  state.midi.clockMode = "off";
  state.midi.remoteNoteOutputActive = false;
  state.transportState = "stopped";
  state.playingPresetIds.clear();

  const controller = new AudioStateController();
  bindControllerEvents(controller);

  controller.emitStateChange("midi-settings-updated", {});
  assert.equal(midiStatus.textContent, "Ready", "MIDI status should sync from the current MIDI runtime state");
  assert.equal(midiClockStatus.textContent, "Off", "clock status should stay in sync with the current MIDI mode");
  assert.equal(midiFollowerStatus.textContent, "Local output", "the follower label should default to local output mode");
  assert.equal(midiFollowerStatus.classList.contains("is-active"), false, "local output mode should not use the active follower highlight");
  assert.equal(midiFollowerStatus.getAttribute("aria-label"), "Local MIDI output mode active", "the local output aria label should be descriptive");
  assert.equal(midiInputPort.value, "input-1", "the MIDI input select should stay synced");
  assert.equal(midiOutputPort.value, "output-1", "the MIDI output select should stay synced");

  state.midi.remoteNoteOutputActive = true;
  controller.emitStateChange("transport-state-updated", {});
  assert.equal(midiFollowerStatus.textContent, "Remote follower active", "transport updates should surface remote follower mode in the MIDI panel");
  assert.equal(midiFollowerStatus.classList.contains("is-active"), true, "remote follower mode should use the active highlight");
  assert.equal(midiFollowerStatus.getAttribute("aria-label"), "Remote MIDI output follower active", "the remote follower aria label should be descriptive");

  state.midi.remoteNoteOutputActive = false;
  controller.emitStateChange("transport-state-updated", {});
  assert.equal(midiFollowerStatus.textContent, "Local output", "leaving follower mode should reset the label back to local output");
  assert.equal(midiFollowerStatus.classList.contains("is-active"), false, "leaving follower mode should remove the active highlight");
  assert.equal(statusLabel.textContent, "Stopped", "transport UI updates should keep the shared status label in sync as well");

  console.log("midi follower status UI checks passed");
} finally {
  global.document = previousDocument;
  global.window = previousWindow;
  global.CustomEvent = previousCustomEvent;
}

