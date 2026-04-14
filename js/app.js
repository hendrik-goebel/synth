import { AudioStateController } from "./audio-state-controller.js";
import { bindControllerEvents, bindControls, bindNoteSelector, bindMixerChannels, bindNoteLengthToggle } from "./ui.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindNoteLengthToggle(audioStateController);
bindNoteSelector(audioStateController);
bindMixerChannels(audioStateController);

audioStateController.initialize();

window.audioStateController = audioStateController;

