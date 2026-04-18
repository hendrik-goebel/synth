import { AudioStateController } from "./audio-state-controller.js";
import { bindControllerEvents, bindControls, bindDeadNoteToggle, bindNoteSelector, bindMixerChannels, bindKeyboardShortcuts, bindPostFilterTypeToggle, bindSettingsDialog } from "./ui.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindNoteSelector(audioStateController);
bindDeadNoteToggle(audioStateController);
bindSettingsDialog(audioStateController);
bindMixerChannels(audioStateController);
bindKeyboardShortcuts(audioStateController);
bindPostFilterTypeToggle(audioStateController);

audioStateController.initialize();

window.audioStateController = audioStateController;

