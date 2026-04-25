import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

const oscillatorTitle = '<h3 class="control-group-title">Oscillator</h3>';
const lfo1Title = '<h3 class="control-group-title">LFO 1</h3>';
const lfo2Title = '<h3 class="control-group-title">LFO 2</h3>';
const lfo3Title = '<h3 class="control-group-title">LFO 3</h3>';
const lfo4Title = '<h3 class="control-group-title">LFO 4</h3>';
const envelopeTitle = '<h3 class="control-group-title">Envelope</h3>';
const filterTitle = '<h3 class="control-group-title">Filter</h3>';
const postFilterTitle = '<h3 class="control-group-title">Post Filter</h3>';

const oscillatorStart = html.indexOf(oscillatorTitle);
const lfo1Start = html.indexOf(lfo1Title);
const lfo2Start = html.indexOf(lfo2Title);
const lfo3Start = html.indexOf(lfo3Title);
const lfo4Start = html.indexOf(lfo4Title);
const envelopeStart = html.indexOf(envelopeTitle);
const filterStart = html.indexOf(filterTitle);
const postFilterStart = html.indexOf(postFilterTitle);

assert.notEqual(oscillatorStart, -1, "the Oscillator control group should exist in index.html");
assert.notEqual(lfo1Start, -1, "the LFO 1 control group should exist in index.html");
assert.notEqual(lfo2Start, -1, "the LFO 2 control group should exist in index.html");
assert.notEqual(lfo3Start, -1, "the LFO 3 control group should exist in index.html");
assert.notEqual(lfo4Start, -1, "the LFO 4 control group should exist in index.html");
assert.notEqual(envelopeStart, -1, "the Envelope control group should exist in index.html");
assert.notEqual(filterStart, -1, "the Filter control group should exist in index.html");
assert.notEqual(postFilterStart, -1, "the Post Filter control group should exist in index.html");
assert.ok(oscillatorStart < lfo1Start, "the Oscillator group should appear before the LFO groups");
assert.ok(lfo1Start < lfo2Start && lfo2Start < lfo3Start && lfo3Start < lfo4Start, "the four LFO groups should appear in numeric order");
assert.ok(lfo4Start < envelopeStart, "the LFO groups should appear before the Envelope group");
assert.ok(filterStart < postFilterStart, "the Filter group should appear before the Post Filter group");

const oscillatorSection = html.slice(oscillatorStart, lfo1Start);
const lfo1Section = html.slice(lfo1Start, lfo2Start);
const lfo2Section = html.slice(lfo2Start, lfo3Start);
const lfo3Section = html.slice(lfo3Start, lfo4Start);
const lfo4Section = html.slice(lfo4Start, envelopeStart);
const filterSection = html.slice(filterStart, postFilterStart);

const lfoSections = [
  { section: lfo1Section, suffix: "", title: "LFO 1" },
  { section: lfo2Section, suffix: "-2", title: "LFO 2" },
  { section: lfo3Section, suffix: "-3", title: "LFO 3" },
  { section: lfo4Section, suffix: "-4", title: "LFO 4" },
];

const expectedOptionMarkup = [
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
];

lfoSections.forEach(({ section, suffix, title }) => {
  assert.ok(
    section.includes(`<select id="lfo${suffix}-target">`),
    `${title} should render its target as a select box`,
  );

  expectedOptionMarkup.forEach((optionMarkup) => {
    assert.ok(
      section.includes(optionMarkup),
      `${title} should include ${optionMarkup}`,
    );
  });

  [`lfo${suffix}-target`, `lfo${suffix}-rate`, `lfo${suffix}-depth`].forEach((controlId) => {
    assert.ok(
      section.includes(`id="${controlId}"`),
      `${controlId} should live inside ${title}`,
    );
    assert.ok(
      !oscillatorSection.includes(`id="${controlId}"`),
      `${controlId} should not live inside the Oscillator section`,
    );
    assert.ok(
      !filterSection.includes(`id="${controlId}"`),
      `${controlId} should not live inside the Filter section`,
    );
  });
});

console.log("LFO UI placement checks passed");

