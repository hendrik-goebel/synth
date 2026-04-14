# Task: Arpeggio Loop App

## Plan
- [x] Review current HTML/CSS/JS scaffold.
- [x] Implement a simple UI for starting/stopping playback.
- [x] Implement Web Audio arpeggio scheduler that plays up and down in a loop.
- [x] Add minimal app-specific styling.
- [x] Verify by running a project build.

## Progress Notes
- Added playback controls in `index.html`.
- Implemented a deterministic up/down pattern scheduler in `js/app.js`.
- Added minimal visual styles in `css/style.css`.
- Added usage/build instructions in `README.md`.

## Review
- `npm install && npm run build` completed successfully.
- Webpack compiled without errors and emitted `dist` assets.
- Noted by npm audit: 2 high vulnerabilities in dependencies (pre-existing toolchain issue).

---

# Task: Richer Synth Tone

## Plan
- [x] Design a richer voice architecture for each note.
- [x] Implement layered oscillators and subtractive filtering in `js/app.js`.
- [x] Add subtle spatial tail using a feedback delay bus.
- [x] Update `README.md` with synthesis details.
- [x] Verify by running a project build.

## Progress Notes
- Replaced the single-oscillator note with a 3-oscillator stack (saw, triangle, sub sine).
- Added per-note low-pass filter and envelope shaping.
- Added shared compression and feedback delay to enrich the loop.

## Review
- `npm run build` completed successfully after the synthesis changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Convolution Reverb

## Plan
- [x] Add impulse-response based reverb configuration to `js/app.js`.
- [x] Introduce reverb nodes and dry/wet routing in the shared audio graph.
- [x] Send each note signal into the reverb bus alongside delay.
- [x] Verify by running a project build.

## Progress Notes
- Added `REVERB_SECONDS`, `REVERB_DECAY`, and `REVERB_MIX` constants.
- Implemented `createImpulseResponse(...)` for generated convolution tails.
- Added reverb nodes (`reverbConvolver`, `reverbInput`, `reverbWetGain`, `reverbDryGain`) in `initializeAudioGraph()`.
- Added per-note `reverbSend` routing in `scheduleNote(...)`.

## Review
- `npm run build` completed successfully after the reverb changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Dynamic Parameter UI

## Plan
- [x] Add a controls panel to `index.html` with sliders for synth parameters.
- [x] Add styles in `css/style.css` for readable slider layout.
- [x] Bind controls in `js/app.js` to live synth parameters.
- [x] Update `README.md` feature list for parameter UI.
- [x] Verify by running a project build.

## Progress Notes
- Added slider controls for tempo, attack, decay, release, delay send, reverb mix, and master volume.
- Added live value readouts next to each control.
- Added parameter binding and live audio updates in `js/app.js`.

## Review
- `npm run build` completed successfully after the dynamic control changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Advanced Sound Controls

## Plan
- [x] Add additional timbre and FX sliders in `index.html`.
- [x] Extend `synthParams` and `controlConfig` in `js/app.js`.
- [x] Apply new parameters in voice synthesis and live audio updates.
- [x] Update `README.md` feature list.
- [x] Verify by running a project build.

## Progress Notes
- Added controls for filter cutoff, filter resonance, detune spread, sub level, delay time, delay feedback, and reverb send.
- Routed upper oscillators and sub oscillator through separate gains for sub-level control.
- Added live updates for delay time and delay feedback while audio is running.

## Review
- `npm run build` completed successfully after advanced control changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Arpeggio Note Selection UI

## Plan
- [x] Add note checkbox controls in `index.html`.
- [x] Add styles for note selection controls in `css/style.css`.
- [x] Add selected-note state and pattern rebuild logic in `js/app.js`.
- [x] Prevent invalid empty-note state in the UI.
- [x] Update `README.md` feature list.
- [x] Verify by running a project build.

## Progress Notes
- Added a checkbox group for C4, D4, E4, G4, A4, and C5.
- Implemented `selectedArpeggioNotes` plus `updateSelectedNotesFromUI()` and `rebuildArpeggioPattern()`.
- Added runtime guard so playback requires at least one selected note.

## Review
- `npm run build` completed successfully after note selection UI changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: 12-Tone Clickable Note Selection

## Plan
- [x] Replace the note selector with a clickable 12-tone chromatic button grid in `index.html`.
- [x] Update note selector styles in `css/style.css`.
- [x] Update note-selection logic in `js/app.js` for button toggling and defaults.
- [x] Keep the minimum-one-note-selected guard.
- [x] Update `README.md` to mention 12-tone selection.
- [x] Verify by running a project build.

## Progress Notes
- Added 12 note buttons (`C` through `B` including sharps) for easy clicking.
- Switched selection detection from checkbox state to `.is-active` button state.
- Added `DEFAULT_NOTE_IDS` for deterministic startup selection.

## Review
- `npm run build` completed successfully after 12-tone selector changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Subtle Humanization

## Plan
- [x] Add small helper utilities for bounded random modulation.
- [x] Apply subtle per-note variation to detune, filter, and envelope in `js/app.js`.
- [x] Add tiny stereo movement and FX send variation where supported.
- [x] Update `README.md` features list.
- [x] Verify by running a project build.

## Progress Notes
- Added `HUMANIZE` settings for controlled random ranges.
- Added `clamp(...)` and `randomCentered(...)` helpers.
- Updated `scheduleNote(...)` to modulate timbre and dynamics slightly per note while keeping timing stable.

## Review
- `npm run build` completed successfully after humanization changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Stereo Pan UI Parameter

## Plan
- [x] Add a stereo pan slider in `index.html`.
- [x] Add `stereoPan` to `synthParams` and `controlConfig` in `js/app.js`.
- [x] Apply base pan plus subtle humanization in the panner node.
- [x] Update `README.md` feature list.
- [x] Verify by running a project build.

## Progress Notes
- Added `stereo-pan` range control with live value output.
- Added `stereoPan` parameter wiring in control bindings.
- Updated per-note panning to use `synthParams.stereoPan` with bounded variation.

## Review
- `npm run build` completed successfully after stereo pan UI changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Base Sound Presets

## Plan
- [x] Add a preset selector to `index.html`.
- [x] Add instrument-like preset definitions in `js/app.js`.
- [x] Apply preset values to oscillator and tone parameters.
- [x] Sync existing sliders after preset changes.
- [x] Update `README.md` feature list.
- [x] Verify by running a project build.

## Progress Notes
- Added `sound-preset` dropdown with Warm Pad, Pluck, Organ, and Bass.
- Added `BASE_SOUND_PRESETS`, `applyPreset(...)`, and `bindPresetSelector()`.
- Presets now set waveform types and core synth-shaping parameters.

## Review
- `npm run build` completed successfully after preset changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Expanded Preset Library

## Plan
- [x] Extend preset dropdown options in `index.html`.
- [x] Add many more distinct synthetic presets in `js/app.js`.
- [x] Ensure preset IDs in UI and `BASE_SOUND_PRESETS` stay aligned.
- [x] Update `README.md` wording for expanded presets.
- [x] Verify by running a project build.

## Progress Notes
- Added additional presets such as `glass-shimmer`, `acid-bite`, `deep-space`, `metal-cloud`, and `sub-rumble`.
- Presets are intentionally diverse and not constrained to realistic instrument simulation.
- Kept existing preset-application flow (`applyPreset`) unchanged for low risk.

## Review
- `npm run build` completed successfully after preset library expansion.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: 12-Instrument Stack Playback

## Plan
- [x] Switch preset selector to multi-select in `index.html`.
- [x] Add active preset stack state in `js/app.js`.
- [x] Schedule each note across all selected presets with safe gain scaling.
- [x] Keep UI selection constrained to max 12 active presets.
- [x] Update `README.md` feature list.
- [x] Verify by running a project build.

## Progress Notes
- Preset picker now supports selecting multiple presets simultaneously.
- Added `activePresetIds` and stack scheduling via `scheduleInstrumentStackNote(...)`.
- Added per-layer stereo spread and stack headroom scaling to reduce clipping risk.

## Review
- `npm run build` completed successfully after multi-instrument stack changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Per-Instrument Page Controls

## Plan
- [x] Add instrument page selector UI and reset action in `index.html`.
- [x] Add page selector styling in `css/style.css`.
- [x] Introduce per-instrument parameter state in `js/app.js`.
- [x] Route control edits to active instrument page while keeping global controls shared.
- [x] Update `README.md` feature list.
- [x] Verify by running a project build.

## Progress Notes
- Added `instrument-page` selector plus `reset-instrument-page` action.
- Added `instrumentParamsByPresetId` state and synchronization helpers for page switching.
- Updated control bindings so each selected instrument can be edited independently.

## Review
- `npm run build` completed successfully after per-instrument page updates.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Per-Page Arpeggio Notes

## Plan
- [x] Store note selections per instrument page in `js/app.js`.
- [x] Sync note-button UI when switching instrument pages.
- [x] Use each instrument's own arpeggio pattern during scheduling.
- [x] Keep note selection guard (at least one note per page).
- [x] Update `README.md` with per-page note behavior.
- [x] Verify by running a project build.

## Progress Notes
- Added instrument-specific note state maps and per-page pattern rebuilding.
- Switching instrument page now restores the correct note-button state.
- Scheduler now reads each layer's own pattern instead of one shared pattern.

## Review
- `npm run build` completed successfully after per-page note changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Per-Page Start/Stop Transport

## Plan
- [x] Make Start/Stop operate on the currently selected instrument page only.
- [x] Keep page switching free of automatic start/stop side effects.
- [x] Ensure scheduler only renders currently playing pages.
- [x] Update `README.md` to describe per-page transport.
- [x] Verify by running a project build.

## Progress Notes
- Replaced global transport state with `playingPresetIds` set.
- Added `toggleCurrentPagePlayback()` and per-page transport UI refresh logic.
- Preset selection now only prunes removed pages from playback, without auto-starting/stopping page switches.

## Review
- `npm run build` completed successfully after per-page transport changes.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Remove Instrument Page UI

## Plan
- [x] Remove instrument page selector and reset controls from `index.html`.
- [x] Remove related styles from `css/style.css`.
- [x] Remove page-switch logic from `js/app.js` and keep first selected preset as editable target.
- [x] Update `README.md` wording.
- [x] Verify by running a project build.

## Progress Notes
- Deleted `instrument-page` UI controls and related JS bindings.
- Simplified selected-instrument editing flow to use the first selected preset.
- Kept per-instrument note/transport behavior and stack playback intact.

## Review
- `npm run build` completed successfully after removing instrument page controls.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Keep Playing Instruments When Selecting Another

## Plan
- [x] Make preset stack selection togglable by single click.
- [x] Keep already-playing presets running when selecting another preset.
- [x] Keep stopping behavior only for explicitly deselected presets.
- [x] Verify by running a project build.

## Progress Notes
- Added custom `mousedown` toggle handling for `#sound-preset` options.
- Added preferred target logic so the last clicked preset becomes active for editing.

## Review
- `npm run build` completed successfully after stack-selection persistence fix.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Current Instrument Selector

## Plan
- [x] Add a current-instrument selector to `index.html`.
- [x] Style the selector in `css/style.css`.
- [x] Decouple current-instrument targeting from stack selection clicks in `js/app.js`.
- [x] Keep Start/Stop and control editing bound to the explicit selector.
- [x] Verify by running a project build.

## Progress Notes
- Added `#active-instrument` as a dedicated selector below the instrument stack.
- Added selector synchronization so stacked instruments show current play state markers.
- Stack clicks no longer implicitly change the currently edited/controlled instrument.

## Review
- `npm run build` completed successfully after adding the current-instrument selector.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Remove Separate Current Instrument Section

## Plan
- [x] Remove the extra current-instrument section from `index.html`.
- [x] Remove related styles from `css/style.css`.
- [x] Make stack button clicks set the current instrument in `js/app.js`.
- [x] Update `README.md` wording.
- [x] Verify by running a project build.

## Progress Notes
- Simplified the UI so the stack buttons alone handle both membership and current-target selection.
- Clicking a newly added preset now makes it the current instrument automatically.
- Removing the current instrument falls back to the first remaining selected preset.

## Review
- `npm run build` completed successfully after removing the separate current-instrument section.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Stronger Active Note Contrast

## Plan
- [x] Increase the contrast of inactive note buttons in `css/style.css`.
- [x] Make active note buttons visually much stronger in `css/style.css`.
- [x] Verify by running a project build.

## Progress Notes
- Darkened the inactive note-button palette and muted its text color.
- Switched active note buttons to a vivid amber highlight with a stronger border and glow.

## Review
- `npm run build` completed successfully after strengthening active note contrast.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Button-Based Instrument Controls

## Plan
- [x] Replace select boxes in `index.html` with button containers.
- [x] Add button-grid styling in `css/style.css`.
- [x] Refactor stack/current-instrument logic in `js/app.js` to use button events.
- [x] Update `README.md` wording.
- [x] Verify by running a project build.

## Progress Notes
- Replaced both instrument select boxes with button groups.
- Added visual states for selected, current, and playing presets.
- Kept stack membership and current instrument as separate states in the JS model.

## Review
- `npm run build` completed successfully after replacing instrument selects with buttons.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Note Active Color Not Updating

## Plan
- [x] Ensure active note styles apply via both class and ARIA state.
- [x] Keep inactive/active contrast unchanged while fixing trigger reliability.
- [x] Verify by running a project build.

## Progress Notes
- Extended active note CSS selector to include `aria-pressed="true"`.
- This ensures visual state follows accessibility state even if class state lags.

## Review
- `npm run build` completed successfully after the note active-color reliability fix.
- Webpack compiled without errors and emitted updated `dist` assets.

---

# Task: Current Instrument Border + Play Blue Background

## Plan
- [x] Make instrument button clicks only switch the current instrument.
- [x] Keep selection clicks from auto-starting or auto-stopping playback.
- [x] Show current instrument via border-only styling.
- [x] Show playing instrument via blue background styling.
- [x] Verify by running a project build.

## Progress Notes
- Simplified stack click behavior to only update `activeInstrumentPresetId`.
- Removed selected-state fill from instrument buttons.
- Applied border highlight to `.preset-button.is-current` and blue fill to `.preset-button.is-playing`.

## Review
- `npm run build` completed successfully after instrument selection/playback visual split.
- Webpack compiled without errors and emitted updated `dist` assets.


---

# Task: Add Another Arpeggio Octave

## Plan
- [x] Review the current note-button markup and note-frequency source of truth.
- [x] Extend the selectable arpeggio note range from one octave to two octaves.
- [x] Keep the default selected notes and up/down arpeggio behavior unchanged.
- [x] Update documentation/text that still says the selector only covers 12 tones.
- [x] Verify by running a project build.

## Progress Notes
- Extended `NOTE_OPTIONS` in `js/app.js` from `C4-B4` to `C4-B5` so scheduling and note-state syncing use a two-octave source of truth.
- Expanded the note-button grid in `index.html` to 24 buttons and labeled every button with its octave number to avoid ambiguity.
- Kept the default selected notes at `C4`, `E4`, and `G4`, so existing startup behavior stays the same.
- Updated `README.md` to describe the two-octave note selector.

## Review
- `npm run build` completed successfully after adding the second octave.
- Webpack compiled without errors and emitted updated assets.


---

# Task: Split App Into Several Files

## Plan
- [x] Review the current bundle entry and `js/app.js` responsibilities.
- [x] Extract shared constants/config into dedicated modules.
- [x] Extract shared mutable runtime state into a dedicated module.
- [x] Split pattern, preset, audio, transport, and UI logic into focused files.
- [x] Keep `js/app.js` as the entry point so webpack/html output remains unchanged.
- [x] Verify the refactor with static checks and a production build.

## Progress Notes
- Extracted `js/constants.js` with all config data: `REVERB_SECONDS`, `HUMANIZE`, `NOTE_OPTIONS`, `BASE_SOUND_PRESETS`, `controlConfig`, etc.
- Created `js/state.js` with a single shared state object holding all mutable runtime data (synthParams, audioContext, playingPresetIds, instrument maps).
- Created `js/dom.js` with DOM element queries (toggleButton, statusLabel, presetButtonsContainer).
- Created `js/utils.js` with pure utility functions (clamp, randomCentered).
- Created `js/patterns.js` with arpeggio pattern logic (buildArpeggioPattern, ensureInstrumentNoteState, getInstrumentPattern, syncNoteButtonsFromActiveInstrumentPage).
- Created `js/presets.js` with preset helpers (getPresetLabel, getPresetIds, getInstrumentParams, getPlayablePresetIds).
- Created `js/audio-engine.js` with Web Audio API logic (ensureAudioContext, initializeAudioGraph, scheduleNote, scheduleAhead, startPresetPlayback, stopPresetPlayback, applyLiveAudioUpdates).
- Created `js/ui.js` with UI binding and rendering (renderPresetStackButtons, bindControls, bindNoteSelector, bindPresetSelector, syncControlsFromActiveInstrumentPage, updateTransportUI).
- Created `js/transport-controller.js` with playback control logic (toggleCurrentPagePlayback, handleTransportStartError).
- Replaced `js/app.js` (969 lines) with a thin 16-line bootstrap that imports modules and wires event listeners.
- All modules validated with zero syntax/import errors; IDE warnings are expected for export boundaries.
- Webpack bundle entry remains `./js/app.js` with output `./dist/js/app.js`, so `index.html` reference unchanged.

## Review
- Split successful: app now has 9 focused domain-specific modules + thin entry point.
- Single shared `state.js` object replaces multiple top-level singletons, improving module independence.
- Each module has a clear responsibility: constants → state → utils → domain logic (patterns, presets, audio) → UI → transport.
- Entry point now delegates all behavior to sub-modules instead of containing everything inline.
- Ready for future feature expansion: adding new controls or presets now requires editing only the relevant module.
- Webpack build verified: all 9 modules bundled into single 13.8 KiB minified `dist/js/app.js` file.
- No import syntax errors; all modules correctly resolve their dependencies.
- Browser loading via webpack dev server (`npm start`) works; the bundled app.js replaces ES module syntax with IIFE closure.
- HTML references remain unchanged at `js/app.js`; dev server serves from `dist` folder automatically.
