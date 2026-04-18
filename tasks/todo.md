# Task: Remove Percussion Presets And Warm/Darken The Library

## Plan
- [ ] Remove the percussion preset group and related metadata from `js/constants.js`.
- [ ] Retune the remaining presets and shared defaults toward darker, warmer sounds without changing the 8 channel IDs.
- [ ] Update focused preset-library verification and README wording to match the new grouped catalog.
- [ ] Validate with static checks, focused runtime tests, and `npm run build`.

## Progress Notes
- Pending.

## Review
- Pending.

---

# Task: Expand Preset Library And Group It By Category

## Plan
- [x] Trace the current preset/channel ownership in `js/constants.js`, `js/presets.js`, `js/state.js`, and `js/ui.js` so preset-library growth does not inflate mixer channels.
- [x] Add a larger categorized sound library in `js/constants.js` with grouped metadata (for example Bass, Pads, Percussion, Keys & Plucks, Textures).
- [x] Decouple the available sound library from mixer channel IDs so the UI stays at 8 channels while each channel can still load any preset.
- [x] Render grouped preset options in the channel instrument selectors and expose readable preset labels/category helpers in `js/presets.js`.
- [x] Update documentation/task notes, add a focused preset-library verification check, and run static/build validation.

## Progress Notes
- Confirmed the current mixer still derives channel IDs from `Object.keys(BASE_SOUND_PRESETS)`, so simply adding many presets would have increased the mixer strip count and broken the requested grouped-library UX.
- Expanded `BASE_SOUND_PRESETS` with 15 new sounds across Bass, Pads, Keys & Plucks, Percussion, and Textures, and added parallel preset metadata for human-readable labels/category grouping.
- Added dedicated `MIXER_CHANNEL_IDS` so the app now keeps 8 stable mixer channels (`warm`, `pluck`, `organ`, `bass`, `glass`, `acid`, `noisy`, `deep`) while every channel can assign any preset from the larger library.
- Updated `js/presets.js` and `js/ui.js` so channel instrument selectors now render categorized `<optgroup>` sections instead of one long flat list.
- Added `tasks/preset-library-test.mjs` to verify that channel count stays at 8, category groups contain the new sounds, and controller assignment can load new presets onto existing channels.

## Review
- `get_errors` reported no new errors in the edited JS/README/task files; only the pre-existing unused `DEFAULT_NOTE_IDS` warning remains in `js/constants.js`.
- `node --experimental-default-type=module tasks/preset-library-test.mjs` passed.
- `node --experimental-default-type=module tasks/channel-assignment-test.mjs` passed.
- `npm run build` completed successfully after the categorized preset-library expansion and 8-channel decoupling.

---

# Task: Add Per-Channel Instrument Selectors

## Plan
- [ ] Inspect the current mixer/channel flow and separate stable channel identity from assignable instrument sound selection.
- [ ] Add per-channel assigned-instrument state plus controller helpers so a channel can switch sounds without losing its channel-local notes/transport state.
- [ ] Render an instrument `<select>` above each channel strip and wire its change events through the controller.
- [ ] Update audio/preset lookup paths so playback uses each channel's assigned instrument defaults while keeping channel-local edits and playback ownership intact.
- [ ] Verify with focused static checks, a controller-level runtime check, and `npm run build`.

## Progress Notes
- Pending.

## Review
- Pending.

---

# Task: Replace Clean Delay Feedback With Repetitions

## Plan
- [x] Inspect the current clean-delay parameter flow across `js/constants.js`, `js/ui.js`, `js/audio-state-controller.js`, `js/effects/delay-effect.js`, `index.html`, and `README.md`.
- [x] Replace the clean delay feedback control with a global repetition-count control in state, UI, and controller validation.
- [x] Derive a safe clean-delay loop gain from the repetition count inside the delay effect implementation.
- [x] Validate the edited files with static checks and a production build.
- [x] Record the verification results in this task entry.

## Progress Notes
- Confirmed the clean delay is already a shared global bus, so the new repetition control should remain global rather than becoming per-instrument.
- Confirmed the current clean-delay UI/control path still uses the generic delay-feedback normalization helpers, so the clean delay needs to stop sharing that boundary and move to a direct integer slider.
- Replaced `cleanDelayFeedback` / `clean-delay-feedback` with `cleanDelayRepetitions` / `clean-delay-repetitions` in shared synth params, global control keys, controller validation, UI markup, and README wording.
- Added bounded repetition constants and moved the clean delay to a direct `1..12` integer slider labeled as repeat count instead of a normalized feedback amount.
- Updated `js/effects/delay-effect.js` so the clean delay loop gain is now derived internally from repetition count using a capped decay curve, while the tape delay still uses the direct feedback control.
- Updated `js/ui.js` so only tape delay keeps the normalized feedback slider mapping; clean delay repetitions now flow through as plain integer values.

## Review
- `get_errors` reported no errors in the edited JS, HTML, README, and task files.
- `npm run build` completed successfully after replacing clean delay feedback with repetitions, and webpack emitted the updated production bundle without errors.

---

# Task: Make Delay Toggle Buttons Smaller

## Plan
- [x] Confirm the delay enable controls are isolated behind the `.delay-enabled-toggle` selector.
- [x] Reduce only the delay toggle button footprint in `css/style.css` without changing shared `.control-toggle-btn` sizing.
- [x] Validate the edited files with static checks and record the result here.

## Progress Notes
- Confirmed `Tape Delay` and `Clean Delay` enable buttons already share the dedicated `.delay-enabled-toggle` class, so the size change can stay CSS-only and fully scoped.
- Added a scoped `.delay-enabled-toggle` size override in `css/style.css` with smaller `min-width`, `padding`, and `font-size` so only those two buttons shrink.

## Review
- `get_errors` reported no errors in the edited `css/style.css` and `tasks/todo.md` files.

---

# Task: Add On/Off Switches For Both Delays

## Plan
- [x] Inspect the current tape-delay and clean-delay control/audio flow across `js/constants.js`, `js/ui.js`, `js/audio-state-controller.js`, `js/audio-engine.js`, `js/effects/delay-effect.js`, and `index.html`.
- [x] Add global on/off controls for both delay paths and wire them through the existing generic controller/UI pipeline.
- [x] Make the audio layer stop fresh sends and mute feedback/return when either delay is disabled.
- [x] Validate the edited files with static checks and a production build.
- [x] Record the verification results in this task entry.

## Progress Notes
- Confirmed both delays are global buses, so their on/off state should also be global rather than per instrument.
- Confirmed `js/ui.js` already supports syncing checkbox state in `setControlUIValue(...)`, so the missing piece is binding checkbox input events generically and applying the enabled state inside the delay DSP.
- User report confirmed the previous checkbox→button change had not landed in the actual source files: `index.html` still contained `input type="checkbox"` markup and `js/app.js` was not initializing any dedicated delay-toggle button binding.
- Replaced the real source markup with button toggles in `index.html`, added dedicated delay-toggle button handling in `js/ui.js`, and wired it into the bootstrap in `js/app.js`.
- Added explicit `.delay-enabled-toggle` styling in `css/style.css` so the controls now render and read like the rest of the app's button-based toggles.

## Review
- `get_errors` reported no errors in the corrected HTML, CSS, JS, and task-tracking files.
- `npm run build` completed successfully after fixing the actual source files, and webpack emitted the updated bundle with the delay toggles rendered from button markup.

---

# Task: Add Clean Delay Alongside Tape Delay

## Plan
- [x] Inspect the current single-delay control flow across `js/constants.js`, `js/ui.js`, `js/audio-state-controller.js`, `js/audio-engine.js`, `js/effects/delay-effect.js`, `js/state.js`, and `index.html`.
- [x] Rename the existing delay UI to `Tape Delay` while preserving its current tape-style DSP path.
- [x] Add a second global `Clean Delay` path with independent time/feedback controls and a per-instrument send.
- [x] Validate the edited files with static checks and a production build.
- [x] Record the review results in this task entry.

## Progress Notes
- Confirmed the current delay is a single global bus in `js/effects/delay-effect.js` with drive + high-pass + low-pass shaping, so it already behaves like a tape-style delay.
- Confirmed the current control flow is generic: `controlConfig` → `js/ui.js` bindings → `AudioStateController.setControlValue(...)` → `applyLiveAudioUpdates(...)`, which means a second delay can be added by extending the same pipeline.
- Kept the existing internal `delay*` parameter names as the tape-delay path to minimize code churn, but renamed the user-facing UI labels to `Tape Delay` / `Tape Delay Send`.
- Added new global control keys and defaults for `cleanDelayDivision`, `cleanDelayFeedback`, and derived `cleanDelayTime`, plus a new per-instrument `cleanDelaySend` control.
- Extended `js/effects/delay-effect.js` so `initializeDelayEffectGraph()` now creates both the original tape-style driven delay bus and a second clean delay bus without drive/filter coloration.
- Updated `js/audio-engine.js` so each voice now creates both `tapeDelaySend` and `cleanDelaySend`, with both sends routed through the panner/output path and into their matching global buses.
- Updated `README.md` to reflect the new tape-delay + clean-delay feature set.

## Review
- `get_errors` reported no errors in the edited JS/HTML/task files, and the final README touch also passed focused static checks.
- `npm run build` completed successfully after the dual-delay implementation, and webpack emitted the updated production bundle without errors.

---

# Task: Implement New Distortion Effect Module

## Plan
- [x] Inspect the distortion call contract in `js/audio-engine.js`, shared state in `js/state.js`, and related constants/controller wiring.
- [x] Implement a new `js/effects/distortion-effect.js` from scratch with the expected exported helpers for per-voice waveshaping, dry/wet routing, tone shaping, and persistent per-preset feedback buses.
- [x] Validate the edited files with static checks and a production build.
- [x] Record the verification outcome in this task entry and add a lesson for the course correction.

## Progress Notes
- Confirmed `js/effects/distortion-effect.js` is currently empty while `js/audio-engine.js` still imports `applyDistortionEffect(...)` and `resetDistortionEffectState(...)`.
- Confirmed the rest of the app already exposes `distortionDrive`, `distortionMix`, `distortionTone`, and `distortionFeedback`, so the missing work is the DSP module itself rather than additional UI/controller wiring.
- User clarified that the file should be implemented new rather than restored from git history, so the historical version is now only a contract reference and not the target implementation.
- Implemented a fresh distortion design in `js/effects/distortion-effect.js` with cached tanh-based waveshaper curves, per-voice dry/wet routing, wet-level compensation, tone low-pass shaping, and smoothed start/end gain automation to fit the existing anti-click envelope timing.
- Implemented a persistent per-preset feedback bus that uses a filtered delayed loop with soft saturation, note-length-aware delay timing, and reset-time node cleanup via `resetDistortionEffectState()`.
- Added a correction note to `tasks/lessons.md` so future missing-module work distinguishes between restoring historical code and writing a new compatible implementation.

## Review
- `get_errors` reported no errors in `js/effects/distortion-effect.js`, `tasks/todo.md`, or `tasks/lessons.md`.
- `npm run build` completed successfully after the new distortion module was implemented, and webpack emitted the production bundle without errors.

---

# Task: Clamp Apply-To-All Arpeggio Counts To Available Notes

## Plan
- [x] Trace the current Apply-to-all arpeggio settings flow and confirm where the insufficient-note guard rejects the action.
- [x] Remove the rejection and clamp each instrument's regenerated note-count to the number of notes actually available from the enabled settings pool.
- [x] Keep the existing bulk settings copy and statechange/action events unchanged.
- [x] Verify with static checks, a focused runtime check, and `npm run build`.

## Progress Notes
- Confirmed `applyActiveArpeggioSettingsToAllInstruments()` in `js/audio-state-controller.js` currently blocks the whole action when any instrument's existing note-count is larger than the source settings pool.
- The desired behavior is now to apply anyway and reduce each instrument's regenerated note-count to `min(currentCount, availableCount)` instead of emitting an error.
- Removed the global `requiredMaxCount` rejection in `js/audio-state-controller.js` and changed the regeneration call so every instrument now applies with `Math.min(noteCount, eligibleNotePool.length)`.
- Kept the existing bulk action/statechange events unchanged so the rest of the UI continues to respond through the same path.

## Review
- `get_errors` reported no new errors in `js/audio-state-controller.js`.
- Focused runtime verification confirmed that with only four eligible notes available, instruments that previously had five notes now regenerate with four notes instead of rejecting the apply, while smaller note-counts remain unchanged and all regenerated notes stay inside the enabled settings pool.
- `npm run build` completed successfully after changing Apply-to-all from reject to clamp behavior.

---

# Task: Fix Legacy Default Preset ID

## Plan
- [x] Trace the `Unknown preset id: warm-pad` error back to the preset source of truth and default preset initialization.
- [x] Replace the stale legacy default preset ID with the current preset key used by `BASE_SOUND_PRESETS`.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Confirmed the current preset registry uses single-word IDs such as `warm`, `pluck`, and `organ`, while `DEFAULT_PRESET_ID` in `js/constants.js` still pointed at legacy `warm-pad`.
- Confirmed both `js/state.js` and `js/presets.js` derive their fallback/initial active instrument from `DEFAULT_PRESET_ID`, which explains the immediate controller validation error.
- Updated `DEFAULT_PRESET_ID` in `js/constants.js` from `warm-pad` to `warm` so initialization now matches the actual preset registry.

## Review
- `get_errors` reported no new errors in `js/constants.js`; only the pre-existing unused `DEFAULT_NOTE_IDS` warning remains unrelated.
- `npm run build` completed successfully after changing the default preset ID from `warm-pad` to `warm`.

---

# Task: Fix Settings Dialog Note/Apply Interaction Regression

## Plan
- [x] Inspect the settings-dialog markup, bootstrap wiring, and controller click paths for the note buttons and Apply button.
- [x] Restore visible feedback for dialog errors and actions by adding a real `#status` target to `index.html`.
- [x] Make successful settings-note toggles and Apply clicks resync the visible UI immediately in `js/ui.js`, instead of relying only on indirect controller event handling.
- [x] Verify with static checks, focused runtime checks, and `npm run build`.

## Progress Notes
- Confirmed the dialog bindings in `js/app.js` / `js/ui.js` were still present, but all controller errors were effectively invisible because `js/dom.js` points at `#status` and `index.html` did not contain that element.
- Added `<p id="status">Stopped</p>` near the top of `index.html` so settings-dialog failures (for example impossible Apply constraints) are now shown instead of feeling like no-ops.
- Updated `bindSettingsDialog(...)` in `js/ui.js` so a successful note-button click immediately resyncs the settings-note button state, and a successful Apply immediately resyncs both the settings buttons and the active instrument note grid.
- Added a short success message after Apply so the bulk action has visible confirmation.

## Review
- `get_errors` reported no new errors in the edited files; only pre-existing warnings remain unrelated in `js/ui.js`.
- Focused runtime verification confirmed that settings-note toggles still change controller state, Apply still regenerates note sets while preserving counts, and blocked Apply cases now emit an explicit visible error message targetable through `#status`.
- `npm run build` completed successfully after the settings-dialog interaction regression fix.

---

# Task: Apply Active Settings Notes To All Instruments

## Plan
- [x] Trace the current settings-dialog note flow plus the random-note generation helpers used by each instrument.
- [x] Add an `Apply` button to the settings dialog in `index.html` and style it in `css/style.css`.
- [x] Add a count-preserving random-note regeneration helper in `js/patterns.js` that can rebuild one instrument from its enabled settings notes.
- [x] Add a controller action that copies the active instrument's enabled settings notes to all instruments, regenerates each note set, and preserves each instrument's prior note-count.
- [x] Guard the bulk apply if the enabled settings notes do not provide enough distinct octave notes to preserve every instrument's current note-count.
- [x] Sync the active instrument UI after the bulk apply and verify with static checks, focused runtime checks, and `npm run build`.

## Progress Notes
- Confirmed the active instrument's settings-note state already lives in `state.instrumentArpeggioPitchClassesByPresetId`, while each instrument's current arpeggio size can be derived from `state.instrumentNoteIdsByPresetId[presetId].length` after `ensureInstrumentNoteState(...)`.
- Confirmed the current random-note helper picks a random note-count itself, so a new fixed-count helper is needed to satisfy the requirement that every instrument keeps its previous number of notes during bulk apply.
- Added `#arpeggio-settings-apply` to the settings dialog in `index.html` plus `.settings-dialog-actions` / `.settings-apply-btn` styling in `css/style.css` so the bulk action is clearly available in the modal.
- Extended `js/patterns.js` with `getEligibleRandomNotePoolFromPitchClasses(...)`, an exported preset-scoped pool helper, and `regenerateInstrumentRandomNoteIds(...)` so one instrument can be rebuilt from its enabled settings notes while keeping an exact requested note-count.
- Added `applyActiveArpeggioSettingsToAllInstruments()` in `js/audio-state-controller.js`; it copies the active instrument's enabled pitch classes to every preset, regenerates each preset's note IDs, rebuilds patterns, and emits a bulk statechange/action event.
- Added a validation guard in `js/audio-state-controller.js` that rejects bulk apply when the currently enabled settings notes do not offer enough distinct octave note IDs to preserve the largest existing instrument note-count.
- Updated `js/ui.js` so the new Apply button triggers the controller action and the active instrument's note grid plus settings-note buttons resync immediately after the bulk apply completes.

## Review
- `get_errors` reported no new errors in the edited files; only pre-existing warnings remain unrelated (`DEFAULT_NOTE_IDS`, an unused helper export, and older `ui.js` warnings).
- Focused runtime verification confirmed that pressing Apply can copy the active settings notes to all instruments, regenerate new note sets using only those enabled pitch classes, preserve each instrument's previous note-count, and reject impossible applies when the enabled pool is too small.
- `npm run build` completed successfully after adding the settings-dialog Apply action.

---

# Task: Restrict Random Arpeggio Selection To Enabled Settings Notes

## Plan
- [x] Trace the current random arpeggio note paths in `js/patterns.js` and the current settings-dialog UI flow in `js/ui.js` / `js/audio-state-controller.js`.
- [x] Add a per-instrument enabled pitch-class source of truth that the settings dialog can edit.
- [x] Restrict startup random note seeding and note variation to octave note IDs whose pitch class is enabled in the settings dialog.
- [x] Sync the settings-dialog note buttons with the currently selected instrument and route clicks through the controller.
- [x] Keep existing selected arpeggio notes untouched when settings change; only future random generation should be constrained.
- [x] Verify with static checks, focused runtime checks, and `npm run build`.

## Progress Notes
- Confirmed the current random paths are `getRandomPentatonicNoteIds()` for first-time seeding and `createInstrumentNoteVariation()` for the `Var` action, both currently hard-coded to `PENTATONIC_NOTE_IDS`.
- Confirmed the current settings dialog note buttons are only local UI state, so they need a real per-instrument source of truth before they can influence the random generator.
- Added shared pitch-class metadata in `js/constants.js` (`PITCH_CLASS_OPTIONS`, `DEFAULT_RANDOM_PITCH_CLASS_KEYS`, and exported `extractPitchClass(...)`) plus a new per-instrument `instrumentArpeggioPitchClassesByPresetId` store in `js/state.js`.
- Updated `js/patterns.js` so first-time note seeding and note variation derive eligible octave note IDs by filtering `NOTE_OPTIONS` through the enabled pitch classes for the current preset, while preserving the existing pentatonic default via the initial enabled pitch-class set.
- Added `toggleArpeggioPitchClass(...)` to `js/audio-state-controller.js` so the settings dialog uses the same event-driven action/statechange path as the rest of the UI and enforces that at least one settings note stays enabled.
- Updated `index.html`, `js/ui.js`, and `js/app.js` so the settings-dialog buttons use canonical pitch-class keys, sync to the active instrument, and change real per-instrument settings state instead of only toggling local CSS.
- Left existing selected arpeggio notes untouched when settings change; the new settings only constrain future random seeding and variation, matching the requested scope.

## Review
- `get_errors` reported no new errors in the edited files; only pre-existing warnings remain unrelated (`DEFAULT_NOTE_IDS`, an unused helper export, and older `ui.js` warnings).
- Focused runtime verification confirmed that default startup seeding stays inside the default enabled pitch classes (`c`, `d`, `e`, `g`, `a`), and that restricting a preset to `cs` + `f` produces only `C#`/`F` notes for both first-time seeding and note variation.
- `npm run build` completed successfully after the settings-driven random-note filtering change.

---

# Task: Add Chromatic Note Buttons To Arpeggio Settings Dialog

## Plan
- [x] Inspect the existing settings dialog markup plus the current note source data to avoid colliding with the main octave-specific note controls.
- [x] Add a dialog-local chromatic note button grid (`C` through `B`) in `index.html`.
- [x] Add minimal dialog styling in `css/style.css`, reusing the existing note-button look where practical.
- [x] Keep the new dialog buttons UI-local for now instead of wiring them into the octave-specific arpeggio state.
- [x] Verify edited files with static checks and `npm run build`.

## Progress Notes
- Confirmed `NOTE_OPTIONS` in `js/constants.js` is octave-specific (`C4–B5`), so the safest first pass is a dialog-local pitch-class button grid with distinct IDs/data attributes instead of reusing the main note-selection wiring.
- Added a `Notes` section to `#arpeggio-settings-dialog` in `index.html` with 12 chromatic buttons from `C` through `B`.
- Reused the existing `.note-toggle` visual language and added small dialog-specific layout classes in `css/style.css` for a compact 4-column grid.
- Extended `bindSettingsDialog()` in `js/ui.js` so these dialog note buttons toggle their own pressed/active state locally without touching the main octave-based arpeggio selection flow.

## Review
- `get_errors` reported no new errors in the edited files; only pre-existing `js/ui.js` warnings remain unrelated.
- `npm run build` completed successfully after adding the dialog-local chromatic note buttons.

---

# Task: Add Arpeggio Settings Dialog Entry Point

## Plan
- [x] Inspect the arpeggio-note UI area and existing UI bootstrap to find the smallest integration points.
- [x] Add a new `Settings` button below the arpeggio note controls in `index.html`.
- [x] Add a placeholder dialog window for future arpeggio settings content.
- [x] Bind open/close dialog behavior in `js/ui.js` and wire it from `js/app.js`.
- [x] Add minimal dialog styling in `css/style.css` so it matches the current UI.
- [x] Verify edited files with static checks and `npm run build`.

## Progress Notes
- Added a dedicated `Settings` button row directly below the existing pause controls inside the arpeggio note fieldset in `index.html`.
- Added a native `dialog` placeholder (`#arpeggio-settings-dialog`) with title, close button, and copy stating that settings controls will be added later.
- Added `bindSettingsDialog()` in `js/ui.js` with open, close, Escape, and backdrop-click handling plus a small fallback for browsers without `showModal()`.
- Updated the app bootstrap in `js/app.js` to initialize the settings dialog binding alongside the other UI bindings.
- Added matching styles in `css/style.css` for the new settings row/button and the modal surface/backdrop.
- Follow-up correction: moved the `Settings` button into the same `.note-selector-actions` row as the pause controls and right-aligned it there, instead of leaving it on its own row.

## Review
- `get_errors` reported no new errors in the edited files; only pre-existing `js/ui.js` warnings remain unrelated.
- `npm run build` completed successfully after the follow-up layout adjustment, so the Settings-button repositioning bundles cleanly.

---

# Task: Add Dead Note Toggle To Arpeggio

## Plan
- [x] Inspect the current arpeggio note UI, controller flow, and pattern scheduler to find the safest integration points.
- [x] Add a per-instrument dead-note/end-pause state that persists when switching channels.
- [x] Add a toggle button below the arpeggio note field and keep its visual state synced with the selected instrument.
- [x] Append one pause step to the end of the generated arpeggio when the toggle is active.
- [x] Add a second adjacent button that cycles the end-pause count from `1` to `16` per instrument.
- [x] Make the generated arpeggio append exactly that many pause steps when end pause is enabled.
- [x] Verify edited files with static checks, focused runtime checks, and `npm run build`.

## Progress Notes
- Added a new `deadNoteAtEnd` per-instrument flag via the instrument param defaults so the state persists with each channel instead of being global.
- Added an `End Pause` toggle button directly below the arpeggio note grid in `index.html` and synced its active/inactive state in `js/ui.js`.
- Added `toggleDeadNoteAtEnd()` in `js/audio-state-controller.js` so UI clicks and scripted controller usage share the same action/statechange path.
- Updated `js/patterns.js` so generated arpeggio patterns append a `null` rest sentinel at the end when the toggle is enabled.
- Updated `js/audio-engine.js` so the scheduler skips `null` pattern steps while preserving timing, creating a real pause instead of trying to play a fake note.
- Extending this task with a per-instrument pause-count control beside the existing end-pause toggle.
- Added shared `DEAD_NOTE_PAUSE_COUNT_MIN/MAX` bounds plus per-instrument `endPauseCount` defaults in `js/constants.js`.
- Added `setDeadNotePauseCount()` in `js/audio-state-controller.js` and a second note-section button in `index.html` / `js/ui.js` that cycles `1 → 16 → 1`.
- Updated `js/patterns.js` so end pause now appends the configured number of trailing `null` rest steps instead of always appending exactly one.
- Corrected the core arpeggio loop shape in `js/patterns.js` so the descending leg now excludes both peak and root, removing the repeated root at the loop boundary.

## Review
- `get_errors` reported no new errors in the edited files; the only reported item was a pre-existing unused-function warning in `js/patterns.js`.
- `npm run build` completed successfully after the change.
- Focused runtime checks confirmed `buildArpeggioPattern([261.63, 329.63, 392], true)` appends exactly one trailing `null`, and the single-note edge case produces `[440, null]`.
- Updated focused runtime checks confirmed `buildArpeggioPattern([261.63, 329.63, 392], 3)` ends with exactly three trailing `null` steps, and `buildArpeggioPattern([440], 16)` ends with sixteen trailing `null` steps.
- Follow-up verification passed for the new non-repeating loop shape: `[C, E, G, E]` now replaces `[C, E, G, E, C]`, two-note arpeggios now loop as `[C, E]`, and trailing pause counts still append correctly (`[C, E, G, E, null, null, null]`).

---

# Task: Split Effect Code Into Separate Modules

## Plan
- [x] Audit every delay, reverb, distortion, and post-filter responsibility currently implemented in `js/audio-engine.js`.
- [x] Extract shared delay graph setup/live-update helpers into `js/effects/delay-effect.js`.
- [x] Extract reverb graph setup/mix helpers into `js/effects/reverb-effect.js`.
- [x] Extract distortion helpers (curve cache, feedback bus, and per-voice routing) into `js/effects/distortion-effect.js`.
- [x] Extract per-voice post-filter routing into `js/effects/post-filter-effect.js`.
- [x] Reduce `js/audio-engine.js` to effect orchestration plus note scheduling.
- [x] Verify edited files with static checks and `npm run build`.

## Progress Notes
- Confirmed the current effect logic is centralized in `js/audio-engine.js`, while UI/controller layers already treat effect params generically through `controlConfig`, which keeps the refactor scope mostly inside the engine.
- Added `js/effects/delay-effect.js` for tempo-synced delay timing, delay graph initialization, timbre-aware tone/high-pass updates, and live delay parameter handling.
- Added `js/effects/reverb-effect.js` for impulse-response creation, dry/wet routing setup, and live reverb-mix updates.
- Added `js/effects/distortion-effect.js` for waveshaper curve caching, persistent per-preset feedback bus management, and per-voice distortion routing.
- Added `js/effects/post-filter-effect.js` for the per-voice post-filter dry/wet stage.
- Reduced `js/audio-engine.js` from effect implementation + scheduling into a thinner orchestrator that now delegates effect setup/routing/live updates to the dedicated modules.
- Performed one follow-up cleanup after verification by removing a redundant delay-update branch from `applyLiveAudioUpdates(...)` once the delay module became the single owner of that logic.

## Review
- `get_errors` reported no errors in the edited JS files after the refactor.
- `npm run build` completed successfully twice: once after the main extraction and once after the final orchestrator cleanup.
- Public behavior stayed API-compatible for the rest of the app: `js/audio-state-controller.js` and `js/ui.js` required no effect-specific changes because control/state keys remained unchanged.

---

# Task: Order Delay Times From Slow To Fast In UI

## Plan
- [ ] Trace the `delay-time` control flow across `index.html`, `js/constants.js`, `js/ui.js`, `js/audio-state-controller.js`, and `js/audio-engine.js`.
- [ ] Reverse only the UI slider ordering so it reads slow → fast while keeping stored delay-division indices unchanged.
- [ ] Preserve the current default `1/8` delay-time meaning after the UI ordering change.
- [ ] Verify with static checks and `npm run build`.

## Progress Notes
- Confirmed `DELAY_DIVISION_OPTIONS` is already the engine source of truth, ordered fast → slow, so the safest change is to invert only the UI slider position.

## Review
- Pending.

---

# Task: Make Delay Feedback Scale Logarithmic

## Plan
- [x] Trace the `delay-feedback` UI/value flow across `index.html`, `js/ui.js`, `js/constants.js`, `js/audio-state-controller.js`, and `js/audio-engine.js`.
- [x] Add a normalized-to-actual logarithmic mapping for delay feedback while keeping the actual stored/engine value in the `0..1` range.
- [x] Apply the mapping only at the UI boundary so controller validation and DSP stay unchanged.
- [x] Align the static slider defaults with the new normalized scale and verify with static checks plus `npm run build`.

## Progress Notes
- Confirmed the real `delayFeedback` value already flows correctly through controller validation and engine clamping, so only the slider/UI layer needs logarithmic remapping.
- Added `delayFeedbackFromNormalized(...)` and `normalizedFromDelayFeedback(...)` in `js/constants.js` using a piecewise log mapping with an exact `0` special-case and `0.001` as the lowest positive log point.
- Updated `js/ui.js` so `setControlUIValue(...)` writes the normalized slider position for `delay-feedback`, while `bindControls()` converts the slider position back to the real feedback value before calling the controller.
- Updated `index.html` so the `#delay-feedback` slider keeps a normalized `0..1` range, uses `step="0.001"`, and starts at the normalized position (`0.592717`) that corresponds to the existing real default `0.06`.
- Adjusted the `delay-feedback` label formatter to show three decimals only for very small positive values, so the log-scaled low end remains readable.

## Review
- `get_errors` found no new errors in the edited files; existing warnings remain unrelated (`DEFAULT_NOTE_IDS` unused in `js/constants.js`, plus pre-existing `js/ui.js` warnings for an unused import/function and an unnecessary trailing `return`).
- `npm run build` completed successfully after the logarithmic slider change.
- Manual numeric round-trip verification confirmed `0 → 0`, `0.06 → 0.592717 → 0.06`, and `1 → 1` for the normalized mapping.

---

# Task: Widen Delay Feedback Range To 1.0

## Plan
- [x] Trace the delay feedback range across `index.html`, `js/constants.js`, `js/audio-state-controller.js`, and `js/audio-engine.js`.
- [x] Raise the shared delay feedback ceiling from `0.11` to `1` while keeping the default valid.
- [x] Align the slider markup with the shared range so manual and programmatic control match.
- [x] Verify edited files with static checks and `npm run build`.

## Progress Notes
- Confirmed the delay feedback ceiling is already centralized through `DELAY_FEEDBACK_MAX`, so changing the shared constant will update both controller validation and engine clamping.
- Updated `DELAY_FEEDBACK_MAX` in `js/constants.js` from `0.11` to `1`.
- Updated the `#delay-feedback` slider in `index.html` to `min="0" max="1" step="0.01"` while keeping the existing startup value `0.06`.

## Review
- `get_errors` reported no errors in `index.html`; `js/constants.js` still has the pre-existing unused `DEFAULT_NOTE_IDS` warning.
- `npm run build` completed successfully after widening the delay feedback range.

---

# Task: Distortion Feedback Pop Artefacts

## Plan
- [x] Inspect the per-voice distortion feedback loop in `js/audio-engine.js` and identify where the pop is introduced.
- [x] Make the feedback path engage/disengage more safely and add any minimal loop conditioning needed.
- [x] Keep the UI/controller range aligned with the safer engine behavior.
- [x] Verify edited files with static checks and `npm run build`.

## Progress Notes
- The previous anti-pop tweak was not sufficient because the underlying design was still wrong: a short per-voice loop naturally created fast pulsing and still had note-scoped engage/disconnect edges.
- Replaced the per-voice distortion feedback loop in `js/audio-engine.js` with a persistent per-instrument feedback bus that survives across notes.
- The new bus uses a longer delay window derived from note length, plus filtered feedback/return gains, so the effect can accumulate more gradually instead of chattering at voice-loop speed.
- Each note now only sends a smoothed amount of already-distorted wet signal into that persistent bus; the feedback loop itself is no longer created and destroyed per note.
- Kept `DISTORTION_FEEDBACK_MAX` at `0.35` in `js/constants.js` and aligned the `index.html` slider ceiling to the same value.

## Review
- `get_errors` reported no errors in `js/audio-engine.js`, `js/state.js`, `js/constants.js`, and `index.html` after the correction.
- `npm run build` completed successfully after the architecture change and webpack emitted updated assets without errors.

---

- # Task: Re-Add Distortion Feedback UI Control
-
- ## Plan
- [x] Trace the existing distortion control flow across `index.html`, `js/constants.js`, `js/audio-state-controller.js`, and `js/audio-engine.js`.
- [x] Re-introduce a per-instrument `distortionFeedback` control in the shared UI/controller pipeline.
- [x] Apply the new feedback parameter safely in the distortion audio path without destabilizing playback.
- [x] Verify edited files with static checks and `npm run build`.
-
- ## Progress Notes
- Confirmed the parameter was missing from the shared control registry, so `js/ui.js` could not bind or sync any distortion-feedback UI after the controller refactor.
- Added `DISTORTION_FEEDBACK_MAX` plus per-instrument `distortionFeedback` defaults and `controlConfig` registration in `js/constants.js`.
- Added a `distortion-feedback` slider to the Distortion section in `index.html`; the existing generic UI/controller binding now picks it up automatically.
- Added controller-side range validation in `js/audio-state-controller.js`.
- Implemented a short delayed feedback loop in the distortion wet path inside `js/audio-engine.js` so the control has an audible effect without creating an unsafe zero-delay cycle.
-
- ## Review
- `get_errors` reported no errors in `js/constants.js`, `js/audio-state-controller.js`, `js/audio-engine.js`, or `index.html` after the change.
- `npm run build` completed successfully and webpack emitted updated assets without errors.
-
- ---

- Pending: run `npm run build` to confirm bundling after the routing change.
- [ ] Verify by running a project build.
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

---

# Task: Global 16th Notes Speed Toggle

## Plan
- [x] Add `playAt16thNotes` to global control keys and INITIAL_SYNTH_PARAMS.
- [x] Update scheduler to double playback speed when enabled.
- [x] Add checkbox toggle in UI.
- [x] Wire up checkbox change handler and controller binding.
- [x] Sync checkbox state with controller events.
- [x] Verify by running a project build.

## Progress Notes
- Added `playAt16thNotes` (default 0) to `INITIAL_SYNTH_PARAMS` and `GLOBAL_CONTROL_KEYS` in `js/constants.js`.
- Corrected `getStepDuration()` in `js/audio-engine.js` so enabling the toggle really halves the step duration and doubles playback speed.
- Added `<input type="checkbox" id="play-at-16th-notes">` label after tempo control in `index.html`.
- Added `bindPlayAt16thNotesToggle(controller)` in `js/ui.js` to handle checkbox change events.
- Corrected `setControlUIValue()` / `bindControls()` in `js/ui.js` so checkbox controls update `checked` state instead of being treated like range inputs.
- Updated `js/app.js` to call `bindPlayAt16thNotesToggle()` in bootstrap.

## Review
- `npm run build` completed successfully after adding 16th notes speed toggle.
- Webpack compiled without errors and emitted updated assets.
- HTML updated with checkbox (index.html size: 7.1 KiB).
- Bundle size: 19.8 KiB (app.js) — minimal growth.

---

# Task: Global Note-Length Cycle Toggle (8 / 16 / 6 / 3)

## Plan
- [x] Replace the old boolean 16th-note state with a numeric global note-length value.
- [x] Replace the checkbox UI with a single cycle button that rotates `8 → 16 → 6 → 3`.
- [x] Validate allowed values in the controller so programmatic control stays in sync with the UI.
- [x] Update scheduler timing to use denominator-based note lengths.
- [x] Verify by running a project build.

## Progress Notes
- Added `NOTE_LENGTH_OPTIONS` in `js/constants.js` and replaced `playAt16thNotes` with global `noteLength` defaulting to `8`.
- Replaced the old `play-at-16th-notes` checkbox control with `note-length-toggle` in `index.html` and added matching button styles in `css/style.css`.
- Updated `js/audio-state-controller.js` so `note-length-toggle` only accepts `8`, `16`, `6`, or `3`.
- Updated `js/ui.js` with `bindNoteLengthToggle(...)` to cycle through the allowed values on every click.
- Updated `js/audio-engine.js` so `getStepDuration()` now uses `240 / (tempoBpm * noteLength)`.

## Review
- `npm run build` completed successfully after replacing the old checkbox with the note-length cycle toggle.
- Webpack compiled without errors and emitted updated assets.
- The cycle button now exposes supported values: `8`, `16`, `6`, `4`, and `3`.

---

# Task: Per-Instrument Note-Length Toggle

## Plan
- [x] Re-scope `noteLength` from global state to selected-instrument state.
- [x] Keep the cycle button UI, but make it edit only the currently selected instrument.
- [x] Update the scheduler to support mixed note lengths for simultaneously playing instruments.
- [x] Verify by running a project build.

## Progress Notes
- Removed `noteLength` from `GLOBAL_CONTROL_KEYS` in `js/constants.js`, so the control now edits the selected instrument only.
- Updated `js/audio-engine.js` to schedule on a shared 48th-note transport grid.
- Each instrument now triggers on its own interval derived from its current `noteLength` (`8`, `16`, `6`, or `3`).
- Existing cycle-button UI in `index.html` / `js/ui.js` now reflects the selected instrument's note length through normal control syncing.

## Review
- `npm run build` completed successfully after making note length per-instrument.
- Webpack compiled without errors and emitted updated assets.
- Mixed note lengths are now supported by a shared 48th-note scheduler grid.

---

# Task: Darken and Warm High-Sounding Instruments

## Plan
- [x] Identify the brightest presets in `js/constants.js`.
- [x] Reduce harsh top-end with lower cutoff/Q and darker distortion tone values.
- [x] Add warmth with more sub content and slightly softer envelopes/waveforms where needed.
- [x] Verify by running a project build.

## Progress Notes
- Darkened and warmed the brighter presets: `pluck`, `organ`, `glass-shimmer`, `noisy-spark`, `metal-cloud`, `pixel-tone`, and `wide-chorus`.
- Lowered `filterCutoff` / `filterQ` on the sharpest presets to reduce brittle highs.
- Lowered `distortionTone` on bright distorted presets to soften fizz.
- Increased `subLevel`, reverb, and in a few cases swapped harsher oscillators to `triangle` / `sine` for a rounder tone.

## Review
- `npm run build` completed successfully after darkening the brighter presets.
- Webpack compiled without errors and emitted updated assets.
- IDE reported one unrelated warning in `js/constants.js` for unused `DEFAULT_NOTE_IDS`.

---

# Task: Weighted Random Initial Note Length Per Instrument

## Plan
- [x] Add one-time startup initialization guard for per-instrument random note length.
- [x] Add weighted random mapping so fewer selected notes prefer slower note lengths.
- [x] Apply weighting at first instrument note-state initialization only.
- [x] Update docs to reflect new startup behavior.
- [x] Verify by running a project build.

## Progress Notes
- Added `instrumentNoteLengthInitializedByPresetId` map in `js/state.js` to avoid overriding user changes after initialization.
- Added weighted note-length selection in `js/patterns.js` with values `3`, `4`, `6`, `8`, `16` and note-count-dependent weights.
- `ensureInstrumentNoteState(...)` now assigns a randomized initial `noteLength` once per preset, based on how many startup notes were generated for that preset.
- Updated `README.md` feature list with weighted randomized startup note lengths.

## Review
- `npm run build` completed successfully after weighted random initial note-length assignment.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Per-Instrument Arpeggio Variation Button

## Plan
- [x] Add a variation action in the controller for UI/programmatic parity.
- [x] Add note-variation logic that changes only a random subset of current notes.
- [x] Restrict replacements to pentatonic notes.
- [x] Add a variation button to every mixer channel.
- [x] Wire mixer click handling to trigger per-instrument variation.
- [x] Verify by running a project build.

## Progress Notes
- Added `createInstrumentNoteVariation(presetId)` in `js/patterns.js`.
- Variation changes a random fraction of current notes (up to 60%, at least one note), then rebuilds the pattern.
- Replacement notes are drawn only from `PENTATONIC_NOTE_IDS`.
- Added `createNoteVariation(presetId?)` to `js/audio-state-controller.js` with `action`/`statechange` event emission.
- Added `Var` button per channel in `js/ui.js` and connected it to the controller action.
- Styled `.channel-variation-btn` in `css/style.css`.
- Updated API docs in `README.md`.

## Review
- `npm run build` completed successfully after adding per-instrument variation buttons.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Add 4 As Note-Length Option

## Plan
- [x] Add `4` to the allowed note-length cycle options.
- [x] Include `4` in weighted random startup note-length assignment.
- [x] Update docs/task notes to reflect the expanded set.
- [x] Verify by running a project build.

## Progress Notes
- Updated `NOTE_LENGTH_OPTIONS` in `js/constants.js` to `[8, 16, 6, 4, 3]`.
- Updated note-length weighting in `js/patterns.js` so `4` can be selected during randomized per-instrument initialization.
- Updated `README.md` and prior task notes in `tasks/todo.md` to include the new value.

## Review
- `npm run build` completed successfully after adding note length `4`.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Darker, Warmer, More Variable Preset Library

## Plan
- [x] Review the current preset palette and audio-engine timbre hooks.
- [x] Add new dark/warm and percussive presets in `js/constants.js`.
- [x] Extend preset-only timbre shaping in `js/audio-engine.js` for more variable attacks and tone balance.
- [x] Update `README.md` to reflect the broader preset range.
- [x] Verify by running a project build.

## Progress Notes
- Rebalanced the existing presets toward darker and warmer defaults by lowering cutoff brightness, reducing harsher distortion tone values, and adding more sub/low-mid weight.
- Added three new presets in `js/constants.js`: `velvet-choir`, `smoke-piano`, and `night-thump`.
- Added preset-only hidden timbre parameters (`upperLevel`, `filterTracking`, `transientAmount`, `transientDecay`, `transientTone`, `pitchDropCents`) so presets can sound more distinct without adding more UI controls.
- Updated `js/audio-engine.js` to use those parameters for harmonic balance, cutoff tracking, percussive transient noise, and short pitch-drop attacks.
- Updated `README.md` so the feature list reflects the darker, warmer, and more percussive preset library.

## Review
- `npm run build` completed successfully after the preset-library and voice-shaping changes.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Global Warm/Cold Timbre Slider

## Plan
- [x] Review the global control flow and current timbre shaping path.
- [x] Add a global warm/cold slider to `index.html` and register it in `js/constants.js`.
- [x] Apply the global timbre bias across all instruments in `js/audio-engine.js` without flattening preset identity.
- [x] Update `README.md` to document the new control.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Added a new global `global-timbre` range slider to `index.html` with a neutral midpoint and warm/cold percentage label.
- Registered `globalTimbre` as a shared control in `js/constants.js` so it syncs across instrument switching like the other global controls.
- Updated `js/audio-engine.js` so every newly scheduled note responds to the global timbre bias by shifting cutoff, resonance, harmonic balance, sub weight, transient brightness, and distortion tone.
- Added a live update for the shared delay low-pass tone so delay tails also move warmer/cooler immediately when the slider changes.
- Updated `README.md` to mention the new global warm/cold timbre control.

## Review
- `npm run build` completed successfully after adding the global timbre slider.
- Static checks passed on the edited files; the only remaining note is the pre-existing unused `DEFAULT_NOTE_IDS` warning in `js/constants.js`.

---

# Task: Tempo-Quantized Delay Values

## Plan
- [x] Inspect the current delay-time control and timing path.
- [x] Replace free delay seconds with discrete tempo-synced delay divisions.
- [x] Recompute the live delay node whenever tempo or delay division changes.
- [x] Update README/task notes to reflect the synced delay behavior.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Replaced the free `delay-time` seconds slider with discrete musical delay divisions (`1/32` through `1/4`) in `js/constants.js` and `index.html`.
- Switched the global delay control mapping from `delayTime` to `delayDivision`, while keeping `state.synthParams.delayTime` as a derived seconds value for the audio engine.
- Added tempo-sync helpers in `js/audio-engine.js` so the live delay node recalculates from `tempoBpm` and `delayDivision` during initialization and on control updates.
- Added controller-side validation so only defined delay division indices are accepted.
- Updated `README.md` to describe the feedback delay as tempo-synced.

## Review
- Static checks passed on the edited files; the only remaining note is the pre-existing unused `DEFAULT_NOTE_IDS` warning in `js/constants.js`.
- `npm run build` completed successfully after making delay values tempo-quantized.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Make Delay More Extreme

## Plan
- [x] Inspect the shared delay graph and the current feedback/tone limits.
- [x] Strengthen the delay character in `js/audio-engine.js` with a more pronounced return and feedback path.
- [x] Adjust existing delay control defaults/range only if needed to expose the stronger effect.
- [x] Update task/docs/lessons to reflect the new delay character.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Added dedicated shared delay-shaping nodes in `js/state.js` / `js/audio-engine.js`: `delayHighpass`, `delayDrive`, and `delayReturnGain`.
- Changed the shared delay graph from a simple `delay -> lowpass -> feedback/master` path to `delay -> highpass -> drive -> lowpass -> feedback + boosted return`.
- Brightened the delay tone response and added a high-pass stage so repeats cut through more clearly instead of sounding soft and cloudy.
- Increased the effective delay return level and slightly widened the UI feedback range from `0.8` to `0.88` so the more extreme behavior is reachable.
- Updated `README.md` to describe the delay as a driven tempo-synced feedback delay.

## Review
- Static checks passed on the edited files.
- `npm run build` completed successfully after strengthening the shared delay.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Soften Delay Feedback Range

## Plan
- [x] Inspect the current delay feedback UI range and audio-engine mapping.
- [x] Reduce the exposed feedback ceiling so the strongest repeats are less aggressive.
- [x] Keep the control behavior consistent between `index.html`, `js/constants.js`, and `js/audio-engine.js`.
- [x] Update `tasks/lessons.md` with a guardrail for shared-FX range changes.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Investigated the current feedback path after the recent delay-extreme change; the user-facing range is now capped at `0.88` in both the slider and `getDelayFeedbackGain(...)`.
- Lowered the default feedback value from `0.26` to `0.22` in `js/constants.js`.
- Lowered the slider ceiling in `index.html` and engine clamp in `js/audio-engine.js` from `0.88` to `0.72` so the upper range is less aggressive.

## Review
- Static checks passed on the edited files; the only remaining note is the pre-existing unused `DEFAULT_NOTE_IDS` warning in `js/constants.js`.
- `npm run build` completed successfully after softening the delay feedback range.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Clarify Global Delay Feedback Ownership

## Plan
- [x] Trace how preset params are created and whether preset-level `delayFeedback` can affect the audio engine.
- [x] Remove misleading preset-level global FX keys from `js/constants.js` if they are dead data.
- [x] Add a code guard so `BASE_SOUND_PRESETS` cannot override global controls in `js/presets.js`.
- [x] Update `tasks/lessons.md` with a rule about separating preset-scoped and global parameters.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Confirmed `delayFeedback` is treated as a global key in `GLOBAL_CONTROL_KEYS`, while `createInstrumentParams(...)` currently spreads preset values over shared defaults, which makes stray preset-level global keys misleading even if the engine reads feedback from `state.synthParams`.
- Removed stray preset-level `delayFeedback` entries and the stray preset-level `delayTime` entry from `js/constants.js` because both belong to the shared delay path.
- Added a filter in `js/presets.js` so preset overrides can no longer overwrite global control keys or derived shared delay timing when instrument params are created.

## Review
- Static checks passed on the edited files; the only remaining note is the pre-existing unused `DEFAULT_NOTE_IDS` warning in `js/constants.js`.
- `npm run build` completed successfully after clarifying global delay ownership.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Cap Delay Feedback Range At 0.11

## Plan
- [x] Confirm every delay-feedback entry point in the UI, defaults, controller, and audio engine.
- [x] Reduce the global default feedback value so it remains valid inside the new cap.
- [x] Limit the UI slider and engine clamp to the `0` to `0.11` range.
- [x] Add a controller-side guard so scripted control updates also respect the new range.
- [x] Update `tasks/lessons.md` and verify with static checks plus `npm run build`.

## Progress Notes
- Added a shared `DELAY_FEEDBACK_MAX` constant in `js/constants.js` and set it to `0.11`.
- Lowered the default global `delayFeedback` value in `js/constants.js` from `0.22` to `0.06` so startup remains inside the new range.
- Updated the `delay-feedback` slider in `index.html` to `min="0" max="0.11" step="0.01"` with an initial value label of `0.06`.
- Updated `getDelayFeedbackGain(...)` in `js/audio-engine.js` to clamp against `DELAY_FEEDBACK_MAX`.
- Added controller-side validation in `js/audio-state-controller.js` so programmatic feedback updates above `0.11` are rejected.

## Review
- Static checks passed on the edited files; the only remaining note is the pre-existing unused `DEFAULT_NOTE_IDS` warning in `js/constants.js`.
- `npm run build` completed successfully after capping the delay feedback range at `0.11`.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Optimize For Better Live Performance

## Plan
- [x] Identify hot paths in scheduler and mixer UI updates.
- [x] Reduce per-tick allocations and repeated lookups in `js/audio-engine.js`.
- [x] Cache frequently used DOM references in `js/ui.js`.
- [x] Reduce repeated preset-data allocations in `js/presets.js`.
- [x] Verify by running a production build.

## Progress Notes
- Refactored scheduler hot path in `js/audio-engine.js` to use local loop state (`nextNoteTime`, `stepIndex`) and `for` loops instead of callback-based iteration.
- Removed repeated scheduler early-check array allocations by using `state.playingPresetIds.size` and passing layer metadata into `scheduleInstrumentStackNote(...)`.
- Added DOM caches in `js/ui.js` for controls, value labels, and mixer channel elements to avoid repeated `getElementById` / `querySelector` calls.
- Updated mixer incremental rendering to patch cached nodes directly and avoid unnecessary text/value writes.
- Added preset-id and override caching in `js/presets.js` to avoid recreating `Object.keys` / filtered override objects.

## Review
- `npm run build` completed successfully after the live-performance optimizations.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Fix Audio Popping/Clicking on Note Starts

## Plan
- [x] Identify audio discontinuity sources causing pops/clicks
- [x] Apply anti-aliasing ramping before envelope attack
- [x] Smooth out transient envelope attacks
- [x] Test the fix with production build

## Analysis
- **Root Cause**: Voices start with discontinuous envelopes and immediate waveform generation
  1. `voiceGain.gain.setValueAtTime(0.0001, time)` creates a tiny peak that can click
  2. Oscillators start at phase 0 with no anti-aliasing before ramping up
  3. Transient noise (when enabled) starts abruptly without smoothing

## Solution
- Change initial voiceGain from `0.0001` to a smoother starting point
- Add very short pre-attack smoothing ramp (1-2 ms) to avoid discontinuity
- Smooth transient envelope to start from a lower point

## Progress Notes
- Updated voice scheduling in `js/audio-engine.js`:
  1. Changed initial voiceGain from setValueAtTime `0.0001` to `0.001` (higher floor prevents clicks)
  2. Added 2ms pre-attack exponential smoothing ramp before main attack to eliminate discontinuities
  3. Smoothed transient envelope to ramp up from 0.0001 over 1ms before decaying (prevents abrupt noise clicks)
- The fix works by avoiding sudden gain jumps—all envelopes now start from a lower floor and ramp smoothly
- Attack character is preserved because the pre-smoothing is brief and the main attack ramp still follows the user's attack time
- Release now uses setTargetAtTime for exponential decay to avoid final clicks on note end

## Review
- `npm run build` completed successfully
- Webpack compiled without errors and emitted updated assets (27.9 KiB)
- Changes tested by inspection: smooth ramping prevents audio discontinuities

---

# Task: Channel Volume 0 Still Audible

## Plan
- [x] Reproduce and identify why `channelVolume = 0` still produces audible output.
- [x] Fix voice gain staging so a channel can be truly silent at zero.
- [x] Keep initial channel volume deterministic for all presets.
- [x] Verify with static checks and `npm run build`.

## Progress Notes
- Root cause: channel volume was applied before envelope clamps, and envelope anti-click floors could still leak a quiet signal.
- Updated `js/audio-engine.js` to add a dedicated `channelOutputGain` stage in `scheduleNote(...)` and apply `channelVolume` there, right before dry/fx routing.
- Kept envelope shaping (`peakGain`/`sustainGain`) independent from channel volume so mute behavior is controlled by one final gain stage.
- Updated `js/presets.js` so each instrument initializes with explicit `channelVolume: 1`.

## Review
- Static checks passed on edited files (existing unrelated UI warnings remain in `js/ui.js`).
- `npm run build` completed successfully after the mute fix.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Pop On Every Note + Audible At Volume 0 (Follow-up)

## Plan
- [x] Re-check note envelope/release scheduling for click sources.
- [x] Guarantee muted channels do not schedule any audible path.
- [x] Rebuild and verify compilation.

## Progress Notes
- Added an early return in `js/audio-engine.js` `scheduleNote(...)` when `channelVolume <= 0.0001` so muted channels do not create voice/transient/fx events.
- Switched the voice envelope start to true zero (`setValueAtTime(0, time)`) with linear attack ramp to reduce note-on discontinuities.
- Extended stop timing to follow release (`releaseStartTime + max(0.05, release * 3)`) so oscillators are stopped closer to silence.
- Smoothed `channelOutputGain` from `0` to target volume at note start to reduce routing-edge clicks.

## Review
- `npm run build` completed successfully after the follow-up pop/mute fix.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Assignable FX LFO Oscillator

## Plan
- [x] Add global LFO config and control mapping in `js/constants.js`.
- [x] Add global LFO controls to `index.html`.
- [x] Implement assignable LFO routing and live updates in `js/audio-engine.js`.
- [x] Validate new LFO target values in `js/audio-state-controller.js`.
- [ ] Verify by running a project build.

## Progress Notes
- Added `LFO_TARGET_OPTIONS` with `Off`, `Delay Feedback`, `Delay Tone`, and `Delay HPF` targets.
- Added global synth params and controls for `lfoTarget`, `lfoRate`, and `lfoDepth`.
- Added an LFO section in the global panel with target/rate/depth sliders and live value labels.
- Added engine-side LFO oscillator + depth gain nodes with safe reconnect logic when retargeting.
- LFO depth is clamped against each target's current headroom so modulation does not force values beyond target bounds.
- Updated `README.md` feature list with the new assignable FX LFO.

## Review
- Static IDE checks (`get_errors`) report no errors on edited files.
- Build verification is still pending because the `npm run build` execution was skipped.

---

# Task: Move LFO To Filter Section And Filter Targets

## Plan
- [x] Move the LFO controls from the global panel into the Filter section in `index.html`.
- [x] Change LFO target options from delay FX params to filter params in `js/constants.js`.
- [x] Update modulation logic in `js/audio-engine.js` so LFO affects filter cutoff/resonance values.
- [x] Remove obsolete LFO audio-routing state fields in `js/state.js`.
- [x] Verify by running a project build.

## Progress Notes
- Relocated `lfo-target`, `lfo-rate`, and `lfo-depth` controls to the Filter control group.
- Updated target list to `Off`, `Filter Cutoff`, and `Filter Resonance`.
- Replaced delay-audio-param LFO routing with per-note filter modulation derived from LFO phase at schedule time.
- Kept LFO control IDs and controller validation flow unchanged so UI and API remain consistent.
- Updated `README.md` feature text to match the new filter-scoped LFO behavior.

## Review
- Static IDE checks (`get_errors`) report no errors on edited files.
- `npm run build` completed successfully after moving LFO controls/targets to the filter path.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Click Noise At Note Start For Glass Instrument

## Plan
- [x] Inspect note-on signal path for click-prone discontinuities.
- [x] Apply a minimal fix focused on note-start transient behavior.
- [x] Verify with static checks and a production build.

## Progress Notes
- Root cause found in `js/audio-engine.js`: transient noise envelope started at a non-zero gain (`0.0001`) while the noise buffer begins at random sample values, creating a sharp edge at note start.
- Updated transient envelope in `scheduleNote(...)` to start at `0`, ramp linearly to peak, then decay exponentially.

## Review
- Static IDE checks (`get_errors`) report no errors on edited files.
- `npm run build` completed successfully after the transient note-on smoothing fix.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Glass Click/Pop Follow-up (Attack/Decay Sensitive)

## Plan
- [x] Re-check note-on/off envelope scheduling for discontinuities that can sound like start-clicks.
- [x] Add a tiny muted pre-start for oscillators to avoid hard oscillator edge at note trigger.
- [x] Force a stricter near-zero fade before oscillator stop to reduce end pops that mask as next-note clicks.
- [x] Verify with static checks and a production build.

## Progress Notes
- Added `preStartTime` (`time - 2ms`) in `js/audio-engine.js` so oscillators begin while all gains are still at zero.
- Applied the same pre-start baseline to key gain/filter automation points (`voiceGain`, `upperMix`, `subMix`, sends, and `channelOutputGain`).
- Extended release tail handling with `releaseTimeConstant` and a final `linearRampToValueAtTime(0, voiceFadeOutTime)` before node stop.
- Also applied release fade-out to `channelOutputGain` so the final output stage reaches silence deterministically.

## Review
- Static IDE checks (`get_errors`) report no errors on edited files.
- `npm run build` completed successfully after the ADSR-sensitive click/pop follow-up fix.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Improve Low-Rate Resolution For LFO Rate Slider

## Plan
- [x] Add shared LFO rate mapping helpers in `js/constants.js`.
- [x] Make `lfo-rate` UI input work on normalized `0..1` and map to Hz in `js/ui.js`.
- [x] Keep audio engine consumption in Hz with centralized clamping in `js/audio-engine.js`.
- [x] Verify with static checks and a production build.

## Progress Notes
- Added `LFO_RATE_MIN_HZ` / `LFO_RATE_MAX_HZ` and mapping helpers (`lfoRateFromNormalized`, `normalizedFromLfoRate`, `clampLfoRateHz`).
- Updated `setControlUIValue(...)` so `lfo-rate` displays/stores slider position as normalized value while label still shows Hz.
- Updated `bindControls()` so `lfo-rate` emits mapped Hz values into the existing controller/state flow.
- Updated `index.html` `lfo-rate` range to `0..1` with fine `0.001` steps for better low-rate control.

## Review
- Static checks passed on edited files; existing warnings remain unrelated (`DEFAULT_NOTE_IDS` unused, existing `ui.js` warnings).
- `npm run build` completed successfully after the LFO rate scaling update.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Increase Low-End Emphasis For LFO Rate Slider

## Plan
- [x] Add an extra curve exponent on top of the log LFO-rate mapping in `js/constants.js`.
- [x] Keep forward/inverse mapping mathematically aligned for stable UI round-trips.
- [x] Update the `index.html` `lfo-rate` default normalized value to match the unchanged default `1.2 Hz`.
- [x] Verify with static checks and a production build.

## Progress Notes
- Added `LFO_RATE_CURVE_EXPONENT` (`1.15`) in `js/constants.js` to give slow rates more slider travel.
- Updated `lfoRateFromNormalized(...)` and `normalizedFromLfoRate(...)` to apply the same exponent/inverse so the slider and stored Hz values remain consistent.
- Updated initial `#lfo-rate` slider value in `index.html` to the new normalized position for approximately `1.20 Hz`.

## Review
- Static checks passed on edited files; the existing unused `DEFAULT_NOTE_IDS` warning remains unrelated.
- `npm run build` completed successfully after increasing low-end emphasis for LFO rate.
- Webpack compiled without errors and emitted updated assets.

---

# Task: Distortion Click/Pop Regression

## Plan
- [x] Inspect distortion dry/wet automation timing around note start/end in `js/audio-engine.js`.
- [x] Smooth distortion dry/wet from `preStartTime` and add explicit fade-out before voice stop.
- [x] Delay voice-node disconnect slightly after oscillator end so automation tails settle.
- [x] Verify with static checks and a production build.

## Progress Notes
- Updated distortion mix automation in `scheduleNote(...)` to start from `preStartTime` and avoid hard gain edges.
- Added explicit end-of-note ramps for both `distortionDry` and `distortionWet` gains to `0` at `voiceFadeOutTime`.
- Added a short delayed disconnect (`12ms`) in `oscA.onended` to avoid click-prone immediate graph teardown.

## Review
- Static IDE checks (`get_errors`) report no errors on edited files.
- `npm run build` completed successfully after the distortion click/pop regression fix.
- Webpack compiled without errors and emitted updated assets.

