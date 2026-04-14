import { AudioStateController } from "./audio-state-controller.js";
import { bindControllerEvents, bindControls, bindNoteSelector, bindMixerChannels } from "./ui.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindNoteSelector(audioStateController);
bindMixerChannels(audioStateController);

audioStateController.initialize();

window.audioStateController = audioStateController;

