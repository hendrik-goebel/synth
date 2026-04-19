# Arpeggio Loop

Small Web Audio demo that plays an up-and-down arpeggio loop with a shared circle-of-fifths key guide.

## Features
- Start/Stop playback button
- 8 mixer channels with independent Start/Stop, variation, note-length, and volume controls
- Per-channel instrument select box so each channel can load any available instrument sound from a categorized library independently
- The last clicked stack button becomes the current instrument for controls and Start/Stop
- Event-driven action layer (`window.audioStateController`) so every UI action can also be triggered programmatically
- Per-instrument note-length cycle control with `8`, `16`, `6`, `4`, and `3` timing values
- Global warm/cold timbre slider that shifts the full mix between darker body and brighter edge
- LFO in the Filter section with assignable target (Filter Cutoff / Filter Resonance), adjustable rate, and modulation depth
- Randomized initial note length per instrument, weighted by note-count density (fewer notes favor slower lengths)
- Per-instrument arpeggio notes (note buttons are saved per selected instrument)
- Global arpeggio key stepping (`-` / `+`) in the settings dialog, following the circle of fifths and highlighting in-key pitch classes
- Global `t+` / `t-` buttons in the settings panel that transpose the active instrument's selected notes up or down inside the current key
- Per-instrument "Var" action that mutates only a random fraction of current notes using pentatonic replacements
- Per-instrument transport control: Start/Stop affects only the currently selected instrument
- Up-and-down arpeggio pattern initialized per instrument from a random pentatonic note set (2-5 notes)
- Arpeggio note selection via clickable UI buttons across two chromatic octaves (C4-B5)
- Expanded categorized preset library with darker/warm basses, pads, keys/plucks, and texture sounds
- Richer synth voice: layered oscillators (saw + triangle + sub sine)
- Tone shaping with low-pass filtering, soft compression, a driven tape-style tempo-synced feedback delay, a second clean tempo-synced delay, and convolution reverb
- Subtle per-note humanization (detune, envelope, filter, pan, and FX send variation)
- Live controls for tempo, ADSR, filter cutoff/resonance, detune/sub, stereo pan, tape delay on-off/timing/feedback, clean delay on-off/timing/repetitions, per-instrument tape/clean delay sends, reverb send, and master volume
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
- `setChannelInstrument(channelId, presetId)`
- `setControlValue(controlId, value)`
- `toggleNote(noteId)`
- `stepGlobalArpeggioKey(step)`
- `transposeActiveNotesByKeyStep(step, presetId?)`
- `createNoteVariation(presetId?)`
- `togglePlayback(presetId)`

Events:
- `action` - emitted for successful actions
- `statechange` - emitted when state is mutated
- `error` - emitted when an action is rejected or fails

`selectInstrument(...)` / `togglePlayback(...)` address the 8 visible mixer channels (`warm`, `pluck`, `organ`, `bass`, `glass`, `acid`, `noisy`, `deep`). `setChannelInstrument(...)` can load any sound from the larger categorized preset library.

Example:
```js
const controller = window.audioStateController;

controller.addEventListener("statechange", (event) => {
  console.log(event.detail);
});

controller.selectInstrument("acid");
controller.setChannelInstrument("warm", "bass");
controller.setControlValue("filter-cutoff", 2200);
controller.toggleNote("note-c5");
controller.togglePlayback("acid");
```
# synth
