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
  constructor({ id = null, tagName = "DIV", type = "", value = "" } = {}) {
    this.id = id;
    this.tagName = tagName;
    this.type = type;
    this.value = value;
    this.textContent = "";
    this.checked = false;
    this.disabled = false;
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener() {}

  removeEventListener() {}
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
fakeDocument.registerElement(new FakeElement({ id: "status" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-target", tagName: "SELECT", value: "0" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-rate", tagName: "INPUT", type: "range", value: "0" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-depth", tagName: "INPUT", type: "range", value: "0" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-target-value" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-rate-value" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-depth-value" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-2-target", tagName: "SELECT", value: "0" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-2-rate", tagName: "INPUT", type: "range", value: "0" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-2-depth", tagName: "INPUT", type: "range", value: "0" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-2-target-value" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-2-rate-value" }));
fakeDocument.registerElement(new FakeElement({ id: "lfo-2-depth-value" }));

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
  const [
    constantsModule,
    { AudioStateController },
    { state },
    { bindControllerEvents },
    { resetSharedAppState },
  ] = await Promise.all([
    import("../js/constants.js"),
    import("../js/audio-state-controller.js"),
    import("../js/state.js"),
    import("../js/ui.js"),
    import("./test-helpers/fake-audio-midi.mjs"),
  ]);

  const {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    formatLfoDepth,
    INITIAL_SYNTH_PARAMS,
    LFO_TARGET_OPTIONS,
    MIXER_CHANNEL_IDS,
    normalizedFromLfoRate,
  } = constantsModule;

  resetSharedAppState(state, {
    DEFAULT_GLOBAL_ARPEGGIO_KEY_INDEX,
    DEFAULT_MIDI_CHANNEL_SETTINGS_BY_PRESET_ID,
    DEFAULT_PRESET_ID,
    INITIAL_SYNTH_PARAMS,
    MIXER_CHANNEL_IDS,
  });

  const controller = new AudioStateController();
  bindControllerEvents(controller);
  controller.initialize();
  controller.selectInstrument("warm");

  const pitchTargetIndex = LFO_TARGET_OPTIONS.findIndex((option) => option.key === "pitchShiftSemitones");
  const detuneTargetIndex = LFO_TARGET_OPTIONS.findIndex((option) => option.key === "detuneSpread");
  assert.ok(pitchTargetIndex > 0, "pitch shift should be available as an LFO target");
  assert.ok(detuneTargetIndex > 0, "detune spread should be available as an LFO target");

  controller.setControlValue("lfo-target", pitchTargetIndex);
  controller.setControlValue("lfo-rate", 1);
  controller.setControlValue("lfo-depth", 0.5);
  controller.setControlValue("lfo-2-target", detuneTargetIndex);
  controller.setControlValue("lfo-2-rate", 0.35);
  controller.setControlValue("lfo-2-depth", 0.2);

  controller.selectInstrument("bass");
  controller.setControlValue("lfo-target", 0);
  controller.setControlValue("lfo-rate", 0.4);
  controller.setControlValue("lfo-depth", 0);
  controller.setControlValue("lfo-2-target", pitchTargetIndex);
  controller.setControlValue("lfo-2-rate", 0.75);
  controller.setControlValue("lfo-2-depth", 0.33);

  assert.equal(fakeDocument.getElementById("lfo-target").value, "0", "the active instrument should show its own LFO 1 target value");
  assert.equal(fakeDocument.getElementById("lfo-target-value").textContent, "Off", "the active instrument should show its own LFO 1 target label");
  assert.equal(fakeDocument.getElementById("lfo-rate").value, String(normalizedFromLfoRate(0.4)), "the active instrument should show its own normalized LFO 1 rate");
  assert.equal(fakeDocument.getElementById("lfo-depth-value").textContent, formatLfoDepth(0, 0), "the active instrument should show its own LFO 1 depth label");
  assert.equal(fakeDocument.getElementById("lfo-2-target").value, String(pitchTargetIndex), "the active instrument should show its own LFO 2 target value");
  assert.equal(fakeDocument.getElementById("lfo-2-target-value").textContent, "Pitch Shift", "the active instrument should show its own LFO 2 target label");
  assert.equal(fakeDocument.getElementById("lfo-2-rate").value, String(normalizedFromLfoRate(0.75)), "the active instrument should show its own normalized LFO 2 rate");
  assert.equal(fakeDocument.getElementById("lfo-2-depth-value").textContent, formatLfoDepth(0.33, pitchTargetIndex), "pitch-targeted depth labels should follow the current instrument too");

  controller.selectInstrument("warm");

  assert.equal(fakeDocument.getElementById("lfo-target").value, String(pitchTargetIndex), "switching back should restore warm's LFO 1 target");
  assert.equal(fakeDocument.getElementById("lfo-target-value").textContent, "Pitch Shift", "switching back should restore warm's LFO 1 label");
  assert.equal(fakeDocument.getElementById("lfo-rate").value, String(normalizedFromLfoRate(1)), "switching back should restore warm's normalized LFO 1 rate");
  assert.equal(fakeDocument.getElementById("lfo-depth-value").textContent, formatLfoDepth(0.5, pitchTargetIndex), "switching back should restore warm's pitch depth label");
  assert.equal(fakeDocument.getElementById("lfo-2-target").value, String(detuneTargetIndex), "switching back should restore warm's LFO 2 target");
  assert.equal(fakeDocument.getElementById("lfo-2-target-value").textContent, "Detune Spread", "switching back should restore warm's LFO 2 label");
  assert.equal(fakeDocument.getElementById("lfo-2-rate").value, String(normalizedFromLfoRate(0.35)), "switching back should restore warm's normalized LFO 2 rate");
  assert.equal(fakeDocument.getElementById("lfo-2-depth-value").textContent, formatLfoDepth(0.2, detuneTargetIndex), "switching back should restore warm's LFO 2 depth label");

  console.log("current instrument LFO UI sync checks passed");
} finally {
  global.document = previousDocument;
  global.window = previousWindow;
  global.CustomEvent = previousCustomEvent;
}

