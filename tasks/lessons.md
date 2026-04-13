# Lessons Learned

- When a stack selection UI also determines playback targets, introduce a dedicated target selector so adding/removing items does not unexpectedly retarget controls.
- Keep stack membership, currently edited instrument, and currently playing instruments as separate pieces of state.
- When stacked items need toggle, playing, and current-target states at once, button groups are safer than overloaded select elements.
- If a separate current-target control adds friction, let the primary stack buttons set the current target directly and keep the fallback deterministic.
- For fast-scanned musical controls, active and inactive button states should differ through multiple cues at once: fill color, text color, border, and glow.
- For toggle buttons, style both semantic state (`aria-pressed`) and class state so visual feedback remains reliable.
- Keep current-target and playback states visually separate: border for current selection, fill color for playing status.

