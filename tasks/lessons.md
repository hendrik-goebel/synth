# Lessons Learned

- When a stack selection UI also determines playback targets, introduce a dedicated target selector so adding/removing items does not unexpectedly retarget controls.
- Keep stack membership, currently edited instrument, and currently playing instruments as separate pieces of state.
- When stacked items need toggle, playing, and current-target states at once, button groups are safer than overloaded select elements.
- If a separate current-target control adds friction, let the primary stack buttons set the current target directly and keep the fallback deterministic.
- For fast-scanned musical controls, active and inactive button states should differ through multiple cues at once: fill color, text color, border, and glow.
- For toggle buttons, style both semantic state (`aria-pressed`) and class state so visual feedback remains reliable.
- Keep current-target and playback states visually separate: border for current selection, fill color for playing status.
- When expanding note selection across multiple octaves, include octave numbers in button labels and keep the underlying note list in strict pitch order so the generated arpeggio direction stays predictable.

- When splitting a monolithic module into multiple focused files, use a single shared state module instead of multiple top-level singletons; this keeps import order predictable and makes it easier to trace which module owns which piece of data.
- During a refactor, keep the webpack entry point filename unchanged (`app.js`) and ensure the output path remains the same; this lets the refactor happen transparently without updating HTML or build config.
- Split a monolithic file in order of data flow: extract pure constants first, then shared state, then utility functions, then domain logic, then UI bindings, leaving a thin entry point last that just wires everything up.
- In a multi-instrument mixer, explicitly pass channel identity into voice scheduling and gate channel-scoped effects (like distortion) there; do not assume per-instrument params alone prevent cross-channel perception.
- Keep editor selection (`activeInstrumentPresetId`) out of DSP routing decisions; selection should only control which channel parameters are edited, never change how other running channels sound.
- When startup variation is requested, randomize only during first state initialization and keep all later rebuilds deterministic from stored note IDs.
- When adding boolean controls, treat checkboxes as `checked` state in the UI layer instead of writing to `.value`, and change transport speed by adjusting scheduler timing rather than pattern indexing.
- When a timing control grows beyond on/off behavior, promote it to an explicit finite set of allowed values and compute note duration directly from that value instead of stacking special cases.
- When multiple instruments need different rhythmic subdivisions at the same time, schedule against a shared fine-grained transport grid and let each instrument fire only on its own interval.
- To darken bright presets without losing their identity, lower `filterCutoff`, ease resonant `filterQ`, and lower `distortionTone` before making larger waveform changes.
- For randomized startup rhythm, tie note-length probability to note-count density and apply it exactly once per instrument so later manual edits are never overwritten.
- When a synth needs more preset variety without UI bloat, add preset-only parameters (for example harmonic balance, filter tracking, and transient attack shaping) to the engine defaults and let presets override them selectively.
- When adding a global tone color control, keep it in shared synth state and apply it as proportional scaling around each preset's existing parameters instead of replacing preset values outright.
- When a time-based FX control must stay musical across tempo changes, store the user-facing value as a discrete rhythmic division and derive the actual seconds value centrally from the current BPM.
