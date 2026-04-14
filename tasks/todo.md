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

---

# Task: Audio Mixer UI Redesign

## Plan
- [x] Replace preset selector dropdown with horizontal mixer-style channel strips.
- [x] Display all 12 instruments as vertical channel strips arranged horizontally.
- [x] Add per-channel play/stop and select buttons.
- [x] Show visual indicator (LED-style) for playing channels.
- [x] Keep note selector and controls below mixer for currently selected channel.
- [x] Update HTML structure to support mixer layout.
- [x] Create CSS styles for channel strips (grid, colors, hover states).
- [x] Bind click handlers to mixer channels for select and play/stop actions.
- [x] Rebuild and verify.

## Progress Notes
- Replaced `<div id="sound-preset-buttons">` with `<div id="mixer-channels">` in HTML.
- Created `.mixer` and `.mixer-channels` container styles for horizontal scrollable layout.
- Created `.channel-strip` styles: vertical flex layout, 90px width, dark background with border.
- Added `.channel-name` to display preset label in 3-line truncated text.
- Added `.channel-indicator` (16px circular LED) that lights up red when playing.
- Created `.channel-select-btn` (blue) and `.channel-play-btn` (gray/red toggle) styles.
- Updated `renderMixerChannels()` to dynamically create 12 channel strips from preset IDs.
- Updated `bindMixerChannels()` to handle per-channel select (border highlight) and play/stop (red background).
- Removed old `renderPresetStackButtons()` and `bindPresetSelector()` functions.
- Updated `app.js` bootstrap to call `bindMixerChannels()` instead.
- Rebuilt successfully: 15.6 KiB bundle.

## Review
- Mixer layout complete: all 12 instruments visible horizontally with channel strip UI.
- Each channel has clear play/stop button (red when playing) and select button (yellow border when selected).
- Visual feedback is immediate: LED indicator and button color changes reflect real-time state.
- Controls panel below now says "Controls for Selected Channel" to clarify scope.
- Horizontal scrolling allows full 12-channel visibility even on smaller screens.
- No errors during build; webpack successfully bundled the new UI code.

---

# Task: Add Distortion Effect

## Plan
- [x] Add distortion parameters to synth defaults and control mapping.
- [x] Add distortion sliders to the controls UI.
- [x] Implement a Web Audio waveshaper distortion stage with dry/wet mix in the voice path.
- [x] Seed a few presets with non-zero distortion defaults for clearly different tones.
- [x] Verify by running a project build.

## Progress Notes
- Added `distortionDrive` and `distortionMix` to `INITIAL_SYNTH_PARAMS` and `controlConfig` in `js/constants.js`.
- Added `distortion-drive` and `distortion-mix` sliders with live value labels in `index.html`.
- Implemented per-voice distortion in `js/audio-engine.js` using `WaveShaperNode` plus dry/wet routing before panning and FX sends.
- Added cached distortion curves to avoid regenerating waveshaper curves for every note.
- Updated several presets (`acid-bite`, `noisy-spark`, `metal-cloud`) with non-zero distortion defaults.

## Review
- `npm run build` completed successfully after distortion integration.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Add Distortion Tone Control

## Plan
- [x] Add `distortionTone` defaults in synth params and selected presets.
- [x] Add a `distortion-tone` UI slider and value display.
- [x] Route distortion wet signal through a tone low-pass filter in the audio engine.
- [x] Verify by running a project build.

## Progress Notes
- Added `distortionTone` to `INITIAL_SYNTH_PARAMS` and `controlConfig` in `js/constants.js`.
- Added preset defaults for `acid-bite`, `noisy-spark`, and `metal-cloud` to emphasize distinct distortion colors.
- Added `distortion-tone` slider in `index.html` with a 500-12000 Hz range.
- Updated `scheduleNote(...)` in `js/audio-engine.js` so distortion wet path is now `WaveShaper -> Lowpass -> WetMix`.

## Review
- `npm run build` completed successfully after distortion tone integration.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Restrict Distortion to Current Instrument

## Plan
- [x] Verify where distortion is applied in the voice scheduling path.
- [x] Gate distortion so it runs only for `activeInstrumentPresetId`.
- [x] Keep all other synthesis and FX sends unchanged for non-selected instruments.
- [x] Verify by running a project build.

## Progress Notes
- Updated `scheduleNote(...)` in `js/audio-engine.js` to accept an `isActiveInstrument` flag.
- In `scheduleInstrumentStackNote(...)`, passed `presetId === state.activeInstrumentPresetId` into `scheduleNote(...)`.
- Distortion drive/mix/tone are now only evaluated when the voice belongs to the currently selected instrument; other instruments bypass distortion.

## Review
- `npm run build` completed successfully after the distortion scope fix.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Prevent Sound Changes on Instrument Selection

## Plan
- [x] Identify why selecting another instrument changes audible tone.
- [x] Remove UI selection state from DSP decisions in `scheduleNote(...)`.
- [x] Keep distortion fully per-instrument via each channel's own `voiceParams`.
- [x] Verify by running a project build.

## Progress Notes
- Removed `isActiveInstrument` from `scheduleNote(...)` in `js/audio-engine.js`.
- Distortion drive/mix/tone now always derive from the scheduled instrument's `voiceParams`.
- Updated `scheduleInstrumentStackNote(...)` call site to stop passing `activeInstrumentPresetId` into audio routing logic.

## Review
- `npm run build` completed successfully after decoupling selection from sound.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Move Cutoff Filter Behind Distortion

## Plan
- [x] Update `scheduleNote(...)` routing so the main cutoff filter is post-distortion.
- [x] Keep `distortionTone` low-pass in the distortion wet path unchanged.
- [x] Ensure non-distorted voices still pass through the main cutoff filter.
- [x] Verify by running a project build.

## Progress Notes
- Changed routing in `js/audio-engine.js` from `voiceGain -> toneFilter -> distortion` to `voiceGain -> (optional distortion) -> toneFilter`.
- Kept distortion wet-tone shaping path as `WaveShaper -> distortionToneFilter -> wet mix`.
- Implemented a shared `voiceOutput` flow so both distorted and non-distorted voices end at the same post-filter stage.

## Review
- `npm run build` completed successfully after moving cutoff behind distortion.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Event-Driven Action Layer For UI Parity

## Plan
- [x] Add a controller class that exposes every UI action as methods and emits events.
- [x] Refactor UI handlers to call controller methods instead of mutating state directly.
- [x] Bind controller events back to UI rendering so programmatic actions stay visible.
- [x] Expose the controller instance for external scripting.
- [x] Verify by running a project build.

## Progress Notes
- Added `js/audio-state-controller.js` with `AudioStateController` (`EventTarget`) and methods for selecting instruments, updating controls, toggling notes, and toggling playback.
- Refactored `js/ui.js` handlers so mixer, note, and control interactions route through the controller layer.
- Added `bindControllerEvents(...)` in `js/ui.js` to keep sliders, note buttons, channel UI, and status text in sync when actions are triggered from code.
- Updated `js/app.js` bootstrap to initialize and expose `window.audioStateController`.
- Updated `README.md` with API and event contract documentation.

## Review
- `npm run build` completed successfully after introducing the controller action layer.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Random Pentatonic Initialization Per Instrument

## Plan
- [x] Add a pentatonic note-id pool derived from existing note options.
- [x] Generate random startup note selections with 2-5 notes per instrument.
- [x] Apply the random selection only at first instrument note-state initialization.
- [x] Update docs to match startup behavior.
- [x] Verify by running a project build.

## Progress Notes
- Added `PENTATONIC_NOTE_IDS` in `js/constants.js` based on pitch classes C, D, E, G, A.
- Added randomized startup note selection in `js/patterns.js` via `getRandomPentatonicNoteIds()`.
- `ensureInstrumentNoteState(...)` now initializes each instrument with a random pentatonic set of 2-5 notes.
- Updated `README.md` feature wording to match new startup arpeggio behavior.

## Review
- `npm run build` completed successfully after random pentatonic startup initialization.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Initial Stereo Spot Per Instrument

## Plan
- [x] Add deterministic initial pan calculation across all presets.
- [x] Apply this pan assignment when instrument params are created the first time.
- [x] Verify by running a project build.

## Progress Notes
- Added `getInitialStereoPan(...)` in `js/presets.js` with a left-to-right spread from `-0.9` to `0.9`.
- Updated `createInstrumentParams(...)` so each instrument starts with its own `stereoPan` spot.
- Existing runtime editing behavior remains unchanged because params are still cached per instrument.

## Review
- `npm run build` completed successfully after per-instrument initial stereo placement.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Warmer and Darker Initial Sounds

## Plan
- [x] Lower filter cutoff values across all presets.
- [x] Increase sub-oscillator levels for bass warmth.
- [x] Boost reverb/delay sends for spatial warmth.
- [x] Adjust global defaults for consistent warmth.
- [x] Verify by running a project build.

## Progress Notes
- Updated all 12 `BASE_SOUND_PRESETS` with warmer/darker parameters:
  - Reduced `filterCutoff` by 30-40% across all presets.
  - Increased `subLevel` by 30-50% to add bass warmth.
  - Boosted `reverbSend` and `delaySend` for spacious character.
  - Adjusted `distortionTone` lower on distorted presets for darker edge.
- Updated `INITIAL_SYNTH_PARAMS` defaults:
  - `filterCutoff` 1600 → 1200 Hz
  - `subLevel` 0.45 → 0.55
  - `reverbMix` 0.7 → 0.8
  - `reverbSend` 0.24 → 0.35

## Review
- `npm run build` completed successfully after warming and darkening initial sounds.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Add More Distortion To All Instruments

## Plan
- [x] Increase distortion drive/mix on all presets with existing distortion.
- [x] Add distortion to presets that didn't have it yet.
- [x] Balance distortion across all 12 instruments for consistent character.
- [x] Update global defaults to reflect increased distortion.
- [x] Verify by running a project build.

## Progress Notes
- Added `distortionDrive`, `distortionMix`, and `distortionTone` to all 12 presets:
  - acid-bite: increased from 0.58/0.38 → 0.75/0.55 (already distorted)
  - noisy-spark: increased from 0.72/0.52 → 0.85/0.65 (already distorted)
  - metal-cloud: increased from 0.44/0.30 → 0.62/0.45 (already distorted)
  - warm-pad, pluck, organ, bass, glass-shimmer, hollow-drift, deep-space, rubber-seq, pixel-tone, wide-chorus, sub-rumble: all now have distortion (0.25–0.52 drive, 0.15–0.38 mix)
- Updated `INITIAL_SYNTH_PARAMS`:
  - `distortionDrive` 0.3 → 0.45
  - `distortionMix` 0.2 → 0.32
- All distortion tones tailored to preset character.

## Review
- `npm run build` completed successfully after adding more distortion to all instruments.
- Webpack compiled without errors and emitted updated assets.
- Bundle size: 19.4 KiB (app.js) — expected growth due to distortion parameters.


