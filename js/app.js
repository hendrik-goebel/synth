import { AudioStateController } from "./audio-state-controller.js";
import { bindControllerEvents, bindControls, bindNoteSelector, bindMixerChannels, bindKeyboardShortcuts, bindPostFilterTypeToggle } from "./ui.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindNoteSelector(audioStateController);
bindMixerChannels(audioStateController);
bindKeyboardShortcuts(audioStateController);
bindPostFilterTypeToggle(audioStateController);

audioStateController.initialize();

window.audioStateController = audioStateController;

