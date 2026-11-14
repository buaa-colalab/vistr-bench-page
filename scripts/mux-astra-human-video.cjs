#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function checked(args) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result.stdout;
}
const probe = (file) => JSON.parse(checked(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", file]));

function srtTime(seconds) {
  const total = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function wrapSubtitle(text, maxChars = 46) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines.join("\n");
  const middle = Math.ceil(lines.length / 2);
  return [lines.slice(0, middle).join(" "), lines.slice(middle).join(" ")].join("\n");
}

function writeSubtitles(report, target) {
  const cues = report.cues.map((cue, index) => [
    String(index + 1),
    `${srtTime(cue.speech_start)} --> ${srtTime(cue.speech_end)}`,
    wrapSubtitle(cue.text),
    ""
  ].join("\n"));
  fs.writeFileSync(target, `${cues.join("\n").trimEnd()}\n`);
}

function muxVideo({ video, start = 0, duration, includeSubtitles = true } = {}) {
  const design = JSON.parse(fs.readFileSync(path.join(root, "docs/astra-human-video-data.json"), "utf8"));
  const config = JSON.parse(fs.readFileSync(path.join(root, "narration.config.json"), "utf8"));
  const report = JSON.parse(fs.readFileSync(path.join(root, "docs/astra-human-audio-timing.json"), "utf8"));
  const script = fs.readFileSync(path.join(root, "docs/astra-human-video-narration.md"), "utf8");
  const texts = [...script.matchAll(/^\| \d+:\d+\.\d+–\d+:\d+\.\d+ \| [^|]+ \| (.+) \|$/gm)].map((match) => match[1]);
  if (report.voice !== config.voice || report.cues.length !== texts.length || report.cues.some((cue, i) => cue.text !== texts[i])) {
    throw new Error("Narration audio is stale; run npm run audio:render first");
  }
  if (Math.abs(report.duration_seconds - design.duration_seconds) > 0.001) throw new Error("Narration/video timeline mismatch");
  for (const index of [1, ...Array.from({ length: design.cases.length }, (_, i) => 2 + 2 * i)]) {
    if (report.cues[index].speech_start - report.cues[index - 1].speech_end + 0.001 < (config.minimum_page_gap_seconds || 0)) {
      throw new Error("Insufficient narration pause at page boundary: " + report.cues[index].scene);
    }
  }
  for (const [i, item] of design.cases.entries()) {
    if (Math.abs(report.cues[3 + 2 * i].start - item.answer_reveal_seconds) > 0.001 || report.cues[3 + 2 * i].speech_start < item.answer_reveal_seconds) {
      throw new Error("Narration reveal mismatch: " + item.key);
    }
  }
  duration ??= design.duration_seconds;
  video = path.resolve(root, video || "outputs/astra-human/astra-human-final.mp4");
  const audio = path.resolve(root, design.audio.asset);
  const subtitles = path.join(root, "docs/astra-human-video-subtitles.srt");
  const outputSubtitles = path.join(root, "outputs/astra-human/astra-human-subtitles.srt");
  if (includeSubtitles) {
    writeSubtitles(report, subtitles);
    fs.copyFileSync(subtitles, outputSubtitles);
  }
  const before = probe(video).streams.find((stream) => stream.codec_type === "video");
  if (!before) throw new Error("Input video stream is missing");
  const audioProbe = probe(audio);
  if (Number(audioProbe.format.duration) + 0.001 < start + duration) throw new Error("Narration track is too short");
  const temporary = video.replace(/\.mp4$/i, "") + ".mux.mp4";
  try {
    const ffmpegArgs = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", video,
      "-ss", String(start), "-i", audio];
    if (includeSubtitles) ffmpegArgs.push("-i", subtitles);
    ffmpegArgs.push("-map", "0:v:0", "-map", "1:a:0");
    if (includeSubtitles) ffmpegArgs.push("-map", "2:0");
    ffmpegArgs.push("-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-c:s", "mov_text", "-t", String(duration),
      "-metadata:s:a:0", "language=eng", "-metadata:s:a:0", "title=English male narration");
    if (includeSubtitles) ffmpegArgs.push("-metadata:s:s:0", "language=eng", "-metadata:s:s:0", "title=English subtitles");
    ffmpegArgs.push("-movflags", "+faststart", temporary);
    checked(ffmpegArgs);
    const final = probe(temporary);
    const v = final.streams.find((stream) => stream.codec_type === "video");
    const a = final.streams.find((stream) => stream.codec_type === "audio");
    const s = final.streams.find((stream) => stream.codec_type === "subtitle");
    if (!v || !a || v.width !== before.width || v.height !== before.height || v.nb_frames !== before.nb_frames ||
      (includeSubtitles && (!s || s.codec_name !== "mov_text" || s.tags?.language !== "eng")) ||
      (!includeSubtitles && s) ||
      Math.abs(Number(final.format.duration) - duration) > 0.04 || Math.abs(Number(a.start_time || 0)) > 0.03 ||
      (includeSubtitles && (Math.abs(Number(s.start_time || 0)) > 0.03 || Number(s.duration) > duration + 0.04 ||
        Number(s.duration) + 0.2 < report.cues.at(-1).speech_end))) {
      throw new Error("Muxed video verification failed");
    }
    fs.renameSync(temporary, video);
    return { video, subtitles: includeSubtitles ? subtitles : null, outputSubtitles: includeSubtitles ? outputSubtitles : null, width: v.width, height: v.height, duration: Number(final.format.duration), audio: a.codec_name, subtitle: s?.codec_name || null };
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { muxVideo, writeSubtitles };
if (require.main === module) {
  try { console.log(JSON.stringify(muxVideo(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
