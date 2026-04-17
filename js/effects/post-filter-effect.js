import { POST_FILTER_WEB_AUDIO_TYPES } from "../constants.js";
import { clamp } from "../utils.js";

export function applyPostFilterEffect({
  ctx,
  voiceOutput,
  voiceNodes,
  time,
  gainSmoothTime,
  voiceParams,
}) {
  const postFilterTypeIndex = clamp(Math.round(voiceParams.postFilterType ?? 0), 0, 3);
  const postFilterMixValue = clamp(voiceParams.postFilterMix ?? 0, 0, 1);

  if (postFilterTypeIndex === 0 || postFilterMixValue <= 0.001) {
    return voiceOutput;
  }

  const postFilter = ctx.createBiquadFilter();
  const postFilterDry = ctx.createGain();
  const postFilterWet = ctx.createGain();
  const postFilterOut = ctx.createGain();

  voiceNodes.push(postFilter, postFilterDry, postFilterWet, postFilterOut);

  postFilter.type = POST_FILTER_WEB_AUDIO_TYPES[postFilterTypeIndex];
  const postFilterFreqHz = 20 * Math.pow(1000, clamp(voiceParams.postFilterCutoff ?? 0.534, 0, 1));
  postFilter.frequency.setValueAtTime(clamp(postFilterFreqHz, 20, 20000), time);
  postFilter.Q.value = clamp(voiceParams.postFilterQ ?? 1.0, 0.1, 18);

  postFilterDry.gain.setValueAtTime(1, time);
  postFilterDry.gain.linearRampToValueAtTime(1 - postFilterMixValue, time + gainSmoothTime);
  postFilterWet.gain.setValueAtTime(0, time);
  postFilterWet.gain.linearRampToValueAtTime(postFilterMixValue, time + gainSmoothTime);

  voiceOutput.connect(postFilterDry);
  voiceOutput.connect(postFilter);
  postFilter.connect(postFilterWet);
  postFilterDry.connect(postFilterOut);
  postFilterWet.connect(postFilterOut);

  return postFilterOut;
}

