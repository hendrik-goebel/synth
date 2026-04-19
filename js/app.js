import { AudioStateController } from "./audio-state-controller.js";
import {
  bindControllerEvents,
  bindControls,
  bindDeadNoteToggle,
  bindDelayToggleButtons,
  bindGlobalKeyActions,
  bindNoteSelector,
  bindMixerChannels,
  bindKeyboardShortcuts,
  bindPostFilterTypeToggle,
  bindSettingsDialog,
} from "./ui.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindDelayToggleButtons(audioStateController);
bindGlobalKeyActions(audioStateController);
bindNoteSelector(audioStateController);
bindDeadNoteToggle(audioStateController);
bindSettingsDialog(audioStateController);
bindMixerChannels(audioStateController);
bindKeyboardShortcuts(audioStateController);
bindPostFilterTypeToggle(audioStateController);

audioStateController.initialize();

window.audioStateController = audioStateController;

