import { ensureAudioContext, startPresetPlayback, stopPresetPlayback } from "./audio-engine.js";
import { statusLabel } from "./dom.js";
import { hasPatternForPreset } from "./patterns.js";
import { state } from "./state.js";
import { updateTransportUI } from "./ui.js";

export async function toggleCurrentPagePlayback() {
  if (state.playingPresetIds.has(state.activeInstrumentPresetId)) {
    stopPresetPlayback(state.activeInstrumentPresetId);
    updateTransportUI();
    return;
  }

  if (!hasPatternForPreset(state.activeInstrumentPresetId)) {
    if (statusLabel) {
      statusLabel.textContent = "Select at least one note";
    }
    return;
  }

  await ensureAudioContext();
  const result = startPresetPlayback(state.activeInstrumentPresetId);

  if (!result.started) {
    if (statusLabel) {
      statusLabel.textContent = result.reason;
    }
    return;
  }

  updateTransportUI();
}

export function handleTransportStartError(error) {
  console.error("Unable to start audio:", error);
  stopPresetPlayback(state.activeInstrumentPresetId);
  updateTransportUI();

  if (statusLabel) {
    statusLabel.textContent = "Audio start failed (see console)";
  }
}

