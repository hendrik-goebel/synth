# Arpeggio Loop

Small Web Audio demo that plays a C major arpeggio up and down in a loop.

## Features
- Start/Stop playback button
- Button-based instrument stack (up to 12 presets at once)
- The last clicked stack button becomes the current instrument for controls and Start/Stop
- Per-instrument arpeggio notes (note buttons are saved per selected instrument)
- Per-instrument transport control: Start/Stop affects only the currently selected instrument
- Up-and-down arpeggio pattern (C4, E4, G4, C5, G4, E4, C4)
- Arpeggio note selection via clickable UI buttons across all 12 chromatic tones
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
# synth
