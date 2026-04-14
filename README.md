# Arpeggio Loop

Small Web Audio demo that plays a C major arpeggio up and down in a loop.

## Features
- Start/Stop playback button
- Button-based instrument stack (up to 12 presets at once)
- The last clicked stack button becomes the current instrument for controls and Start/Stop
- Event-driven action layer (`window.audioStateController`) so every UI action can also be triggered programmatically
- Per-instrument note-length cycle control with `8`, `16`, `6`, and `3` timing values
- Randomized initial note length per instrument, weighted by note-count density (fewer notes favor slower lengths)
- Per-instrument arpeggio notes (note buttons are saved per selected instrument)
- Per-instrument "Var" action that mutates only a random fraction of current notes using pentatonic replacements
- Per-instrument transport control: Start/Stop affects only the currently selected instrument
- Up-and-down arpeggio pattern initialized per instrument from a random pentatonic note set (2-5 notes)
- Arpeggio note selection via clickable UI buttons across two chromatic octaves (C4-B5)
- Many base sound presets (from Warm Pad to Acid Bite and Deep Space) for very different synthetic timbres
- Richer synth voice: layered oscillators (saw + triangle + sub sine)
- Tone shaping with low-pass filtering, soft compression, subtle feedback delay, and convolution reverb
- Subtle per-note humanization (detune, envelope, filter, pan, and FX send variation)
- Live controls for tempo, ADSR, filter cutoff/resonance, detune/sub, stereo pan, delay/reverb sends, and master volume
- Browser-safe audio start (requires user interaction)

## Run
```bash
npm install
npm start
```

## Build
```bash
npm run build
```

## Programmatic Control API
The app exposes `window.audioStateController` (an `EventTarget`) after startup.

Supported actions:
- `selectInstrument(presetId)`
- `setControlValue(controlId, value)`
- `toggleNote(noteId)`
- `createNoteVariation(presetId?)`
- `togglePlayback(presetId)`

Events:
- `action` - emitted for successful actions
- `statechange` - emitted when state is mutated
- `error` - emitted when an action is rejected or fails

Example:
```js
const controller = window.audioStateController;

controller.addEventListener("statechange", (event) => {
  console.log(event.detail);
});

controller.selectInstrument("acid-bite");
controller.setControlValue("filter-cutoff", 2200);
controller.toggleNote("note-c5");
controller.togglePlayback("acid-bite");
```
# synth
