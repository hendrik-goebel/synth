import { AudioStateController } from "./audio-state-controller.js";
import { bindControllerEvents, bindControls, bindDeadNoteToggle, bindNoteSelector, bindMixerChannels, bindKeyboardShortcuts, bindPostFilterTypeToggle } from "./ui.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindNoteSelector(audioStateController);
bindDeadNoteToggle(audioStateController);
bindMixerChannels(audioStateController);
bindKeyboardShortcuts(audioStateController);
bindPostFilterTypeToggle(audioStateController);

audioStateController.initialize();

window.audioStateController = audioStateController;

