import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

const oscillatorTitle = '<h3 class="control-group-title">Oscillator</h3>';
const lfoTitle = '<h3 class="control-group-title">LFO</h3>';
const envelopeTitle = '<h3 class="control-group-title">Envelope</h3>';
const filterTitle = '<h3 class="control-group-title">Filter</h3>';
const postFilterTitle = '<h3 class="control-group-title">Post Filter</h3>';

const oscillatorStart = html.indexOf(oscillatorTitle);
const lfoStart = html.indexOf(lfoTitle);
const envelopeStart = html.indexOf(envelopeTitle);
const filterStart = html.indexOf(filterTitle);
const postFilterStart = html.indexOf(postFilterTitle);

assert.notEqual(oscillatorStart, -1, "the Oscillator control group should exist in index.html");
assert.notEqual(lfoStart, -1, "the LFO control group should exist in index.html");
assert.notEqual(envelopeStart, -1, "the Envelope control group should exist in index.html");
assert.notEqual(filterStart, -1, "the Filter control group should exist in index.html");
assert.notEqual(postFilterStart, -1, "the Post Filter control group should exist in index.html");
assert.ok(oscillatorStart < lfoStart, "the Oscillator group should appear before the LFO group");
assert.ok(lfoStart < envelopeStart, "the LFO group should appear before the Envelope group");
assert.ok(filterStart < postFilterStart, "the Filter group should appear before the Post Filter group");

const oscillatorSection = html.slice(oscillatorStart, lfoStart);
const lfoSection = html.slice(lfoStart, envelopeStart);
const filterSection = html.slice(filterStart, postFilterStart);

assert.ok(
  lfoSection.includes('<select id="lfo-target">'),
  "the dedicated LFO section should render lfo-target as a select box",
);

[
  '<option value="0">Off</option>',
  '<option value="1">Filter Cutoff</option>',
  '<option value="2">Filter Resonance</option>',
  '<option value="3">Pitch Shift</option>',
  '<option value="4">Detune Spread</option>',
  '<option value="5">Sub Level</option>',
  '<option value="6">Attack</option>',
  '<option value="7">Decay</option>',
  '<option value="8">Release</option>',
  '<option value="9">Drive</option>',
  '<option value="10">Tone</option>',
  '<option value="11">Tape Delay Send</option>',
].forEach((optionMarkup) => {
  assert.ok(
    lfoSection.includes(optionMarkup),
    `the lfo-target select should include ${optionMarkup}`,
  );
});

["lfo-target", "lfo-rate", "lfo-depth"].forEach((controlId) => {
  assert.ok(
    lfoSection.includes(`id="${controlId}"`),
    `${controlId} should live inside the dedicated LFO section`,
  );
  assert.ok(
    !oscillatorSection.includes(`id="${controlId}"`),
    `${controlId} should no longer live inside the Oscillator section`,
  );
  assert.ok(
    !filterSection.includes(`id="${controlId}"`),
    `${controlId} should no longer live inside the Filter section`,
  );
});

console.log("LFO UI placement checks passed");

