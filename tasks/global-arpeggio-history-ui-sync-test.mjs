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
  constructor({ id = null, classNames = [], dataset = {} } = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
    this.textContent = "";
    this.disabled = false;
    this.value = "";
    this.type = "button";
    this.tagName = "BUTTON";
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

  createElement() {
    return new FakeElement();
  }

  querySelectorAll(selector) {
    return this.selectorMap.get(selector)?.slice() || [];
  }

  addEventListener() {}
}

const fakeDocument = new FakeDocument();
const statusLabel = fakeDocument.registerElement(new FakeElement({ id: "status" }));
const settingsKeyValue = fakeDocument.registerElement(new FakeElement({ id: "arpeggio-settings-key-value" }));
const globalKeyValue = fakeDocument.registerElement(new FakeElement({ id: "global-key-value" }));
const globalKeyNoteList = fakeDocument.registerElement(new FakeElement({ id: "global-key-note-list" }));
const historyPrev = fakeDocument.registerElement(new FakeElement({ id: "arpeggio-settings-history-prev" }));
const historyNext = fakeDocument.registerElement(new FakeElement({ id: "arpeggio-settings-history-next" }));
const historyPosition = fakeDocument.registerElement(new FakeElement({ id: "arpeggio-settings-history-position" }));

const pitchClassButtons = new Map();
["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"].forEach((pitchClassKey) => {
  const element = fakeDocument.registerElement(
    new FakeElement({
      classNames: ["settings-note-toggle"],
      dataset: { pitchClassKey },
    }),
    [".settings-note-toggle"],
  );
  pitchClassButtons.set(pitchClassKey, element);
});

global.document = fakeDocument;
global.window = { document: fakeDocument };
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, params = {}) {
    super(type);
    this.detail = params.detail;
  }
};

const [{ AudioStateController }, { state }, { bindControllerEvents }] = await Promise.all([
  import("../js/audio-state-controller.js"),
  import("../js/state.js"),
  import("../js/ui.js"),
]);

const controller = new AudioStateController();
bindControllerEvents(controller);
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
controller.applyActiveArpeggioSettingsToChannels(["warm"]);

state.globalArpeggioKeyIndex = 5;
state.instrumentArpeggioPitchClassesByPresetId.warm = ["d", "f", "a"];
state.instrumentArpeggioOctavesByPresetId.warm = [4];
state.instrumentNoteIdsByPresetId.warm = ["note-d4", "note-f4", "note-a4"];
state.instrumentArpeggioPitchClassesByPresetId.organ = ["c", "e", "g"];
state.instrumentArpeggioOctavesByPresetId.organ = [5];
state.instrumentNoteIdsByPresetId.organ = ["note-c5", "note-e5", "note-g5"];
controller.applyActiveArpeggioSettingsToChannels(["warm"]);

assert.equal(controller.stepArpeggioHistory(-1), true, "first history step back should succeed");
assert.equal(settingsKeyValue.textContent, "C", "settings dialog key display should update to the previous applied key");
assert.equal(globalKeyValue.textContent, "C", "persistent global key display should update to the previous applied key");
assert.deepEqual(
  globalKeyNoteList.children.map((child) => child.textContent),
  ["C", "D", "E", "F", "G", "A", "B"],
  "persistent global key note chips should update to the previous applied key",
);
assert.equal(pitchClassButtons.get("c").classList.contains("is-active"), true, "previous applied warm settings should activate C");
assert.equal(pitchClassButtons.get("e").classList.contains("is-active"), true, "previous applied warm settings should activate E");
assert.equal(pitchClassButtons.get("g").classList.contains("is-active"), true, "previous applied warm settings should activate G");
assert.equal(pitchClassButtons.get("d").classList.contains("is-active"), false, "previous applied warm settings should deactivate D");
assert.equal(historyPosition.textContent, "1 / 2", "history position should reflect moving to the previous applied item");
assert.equal(statusLabel.textContent, "Loaded stored arpeggio preset 1 of 2", "history stepping should keep a useful status message");

assert.equal(controller.stepArpeggioHistory(1), true, "history step forward should succeed");
assert.equal(settingsKeyValue.textContent, "B", "settings dialog key display should update again when moving to the current applied snapshot");
assert.equal(globalKeyValue.textContent, "B", "persistent global key display should update again when moving to the current applied snapshot");
assert.equal(pitchClassButtons.get("d").classList.contains("is-active"), true, "moving forward should reactivate D");
assert.equal(pitchClassButtons.get("f").classList.contains("is-active"), true, "moving forward should reactivate F");
assert.equal(pitchClassButtons.get("a").classList.contains("is-active"), true, "moving forward should reactivate A");
assert.equal(historyPosition.textContent, "2 / 2", "history position should show the current applied item as the last entry");
assert.equal(statusLabel.textContent, "Loaded current arpeggio preset 2 of 2", "loading the latest applied history item should keep the status copy in sync");

console.log("global arpeggio history UI sync checks passed");

