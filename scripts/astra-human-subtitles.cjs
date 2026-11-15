"use strict";
const timing = require("../docs/astra-human-subtitle-timing.json");
const narration = require("../docs/astra-human-audio-timing.json");

// Fail rather than silently reusing sentence timings after a narration change.
for (const [index, cue] of narration.cues.entries()) {
  const sentences = timing.cues.filter((item) => item.narration_cue === index);
  if (sentences.map((item) => item.text).join(" ") !== cue.text ||
      sentences[0]?.start !== cue.speech_start || sentences.at(-1)?.end !== cue.speech_end ||
      sentences.some((item, i) => item.end <= item.start || /\n/.test(item.text) ||
        (i > 0 && item.start !== sentences[i - 1].end))) {
    throw new Error(`Stale sentence subtitle timings for narration cue ${index}`);
  }
}
const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
function subtitleOverlay(time) {
  const cue = timing.cues.find((item) => time >= item.start && time < item.end);
  if (!cue) return "";
  return `<g id="burned-subtitles"><text x="960" y="1005" text-anchor="middle" dominant-baseline="central" font-family="Helvetica Neue" font-size="30" font-weight="500" fill="#343A40">${escape(cue.text)}</text></g>`;
}
module.exports = { cues: timing.cues, subtitleOverlay };
