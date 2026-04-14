import { toggleButton } from "./dom.js";
import { handleTransportStartError, toggleCurrentPagePlayback } from "./transport-controller.js";
import { bindControls, bindNoteSelector, bindPresetSelector } from "./ui.js";

if (toggleButton) {
  toggleButton.addEventListener("click", () => {
    toggleCurrentPagePlayback().catch((error) => {
      handleTransportStartError(error);
    });
  });
}

bindControls();
bindNoteSelector();
bindPresetSelector();

