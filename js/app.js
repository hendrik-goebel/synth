import { AudioStateController } from "./audio-state-controller.js";
import {
  bindControllerEvents,
  bindControls,
  bindDeadNoteToggle,
  bindDelayToggleButtons,
  bindGlobalKeyActions,
  bindStateSeedControls,
  bindGlobalTransportControls,
  bindMidiControls,
  bindNoteSelector,
  bindMixerChannels,
  bindKeyboardShortcuts,
  bindPitchShiftModeToggle,
  bindPostFilterTypeToggle,
  bindSettingsDialog,
} from "./ui.js";
import { getStateSeedFromLocation } from "./state-seed.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindDelayToggleButtons(audioStateController);
bindPitchShiftModeToggle(audioStateController);
bindGlobalKeyActions(audioStateController);
bindStateSeedControls(audioStateController);
bindGlobalTransportControls(audioStateController);
bindMidiControls(audioStateController);
bindNoteSelector(audioStateController);
bindDeadNoteToggle(audioStateController);
bindSettingsDialog(audioStateController);
bindMixerChannels(audioStateController);
bindKeyboardShortcuts(audioStateController);
bindPostFilterTypeToggle(audioStateController);

audioStateController.initialize({ seed: getStateSeedFromLocation() });
audioStateController.initializeMidi();

window.audioStateController = audioStateController;

