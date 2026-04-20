import { AudioStateController } from "./audio-state-controller.js";
import {
  bindControllerEvents,
  bindControls,
  bindDeadNoteToggle,
  bindDelayToggleButtons,
  bindGlobalKeyActions,
  bindStateSeedControls,
  bindGlobalTransportControls,
  bindNoteSelector,
  bindMixerChannels,
  bindKeyboardShortcuts,
  bindPostFilterTypeToggle,
  bindSettingsDialog,
} from "./ui.js";
import { getStateSeedFromLocation } from "./state-seed.js";

const audioStateController = new AudioStateController();

bindControllerEvents(audioStateController);
bindControls();
bindDelayToggleButtons(audioStateController);
bindGlobalKeyActions(audioStateController);
bindStateSeedControls(audioStateController);
bindGlobalTransportControls(audioStateController);
bindNoteSelector(audioStateController);
bindDeadNoteToggle(audioStateController);
bindSettingsDialog(audioStateController);
bindMixerChannels(audioStateController);
bindKeyboardShortcuts(audioStateController);
bindPostFilterTypeToggle(audioStateController);

audioStateController.initialize({ seed: getStateSeedFromLocation() });

window.audioStateController = audioStateController;

