#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { compileTiming, caseTiming } = require("./video-timing.cjs");
const root = path.resolve(__dirname, "..");
const designPath = path.join(root, "docs/astra-human-video-data.json");
const design = JSON.parse(fs.readFileSync(designPath, "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(root, "video.config.json"), "utf8"));
const plan = compileTiming(config, design.fps, design.cases.map((item) => item.key));
design.timing = plan.timing;
design.animations = plan.animations;
design.cases_start_seconds = plan.casesStart;
design.acts[0].start_seconds = 0;
design.acts[0].end_seconds = plan.rankingEnd;
design.acts[1].start_seconds = plan.rankingEnd;
design.acts[1].end_seconds = plan.casesStart;
design.acts[2].start_seconds = plan.casesStart;
design.pause_config_file = "video.config.json";
const destination = path.join(root, "static/video-story");
fs.mkdirSync(destination, { recursive: true });

function command(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`${program}: ${result.error?.message || result.stderr}`);
  return result.stdout;
}

const manifestFile = path.join(destination, "media-manifest.json");
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
const manifest = {};
let cursorFrame = Math.round(design.cases_start_seconds * design.fps);
const cases = design.cases.map((item) => {
  const record = JSON.parse(fs.readFileSync(item.detail_path, "utf8"));
  if (record.video !== item.video_path) throw new Error(`Video/result mismatch for ${item.key}`);
  if (!fs.existsSync(item.video_path)) throw new Error(`Source video is missing: ${item.video_path}`);
  const stat = fs.statSync(item.video_path);
  const cropBottom = item.crop_bottom || 0;
  const frame = design.video_frame;
  const focusY = item.crop_focus_y ?? 0.5;
  const endFrame = item.end_frame_exclusive;
  if (endFrame !== undefined && (!Number.isInteger(endFrame) || endFrame <= 0)) throw new Error(`Invalid end_frame_exclusive for ${item.key}`);
  const signature = `${stat.size}:${stat.mtimeMs}:crop-bottom-${cropBottom}:frame-${frame.width}x${frame.height}:focus-y-${focusY}:end-frame-${endFrame ?? "full"}:crf-16`;
  const filename = `${item.key}.mp4`;
  const output = path.join(destination, filename);
  if (!fs.existsSync(output) || previous[item.key]?.filename !== filename || previous[item.key]?.source_signature !== signature) {
    console.log(`Preparing silent clip: ${item.key}`);
    command("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", item.video_path,
      "-map", "0:v:0", "-an", "-vf", `${cropBottom ? `crop=iw:ih-${cropBottom}:0:0,` : ""}scale=${frame.width}:${frame.height}:force_original_aspect_ratio=increase,crop=${frame.width}:${frame.height}:(iw-${frame.width})/2:(ih-${frame.height})*${focusY},setsar=1,fps=30${endFrame === undefined ? "" : `,trim=end_frame=${endFrame},setpts=PTS-STARTPTS`}`, "-c:v", "libx264", "-preset", "veryfast",
      "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output]);
  }
  const probe = JSON.parse(command("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", output]));
  if (probe.streams.some((stream) => stream.codec_type === "audio")) throw new Error(`Unexpected audio in ${filename}`);
  const stream = probe.streams.find((stream) => stream.codec_type === "video");
  const frameCount = Number(stream.nb_frames) || Math.round(Number(probe.format.duration) * design.fps);
  if (endFrame !== undefined && frameCount !== endFrame) throw new Error(`Trimmed frame count mismatch for ${item.key}`);
  const schedule = caseTiming(cursorFrame, frameCount, plan.pauses[item.key], design.fps);
  cursorFrame = schedule.endFrame;
  Object.assign(item, { question: record.question, original_question: record.question, astra_answer: record.extracted_answer,
    correct_answer: record.ground_truth, is_correct: record.is_correct, start_seconds: schedule.start,
    play_start_seconds: schedule.play, first_play_end_seconds: schedule.firstEnd, answer_reveal_seconds: schedule.reveal, replay_ready_seconds: schedule.replayReady,
    replay_start_seconds: schedule.replay, replay_end_seconds: schedule.replayEnd, end_seconds: schedule.end,
    pause_settings: plan.pauses[item.key] });
  manifest[item.key] = { filename, source_signature: signature, crop_bottom: cropBottom, crop_focus_y: focusY, end_frame_exclusive: endFrame ?? null, frame_count: frameCount, duration: frameCount / design.fps, width: stream.width, height: stream.height };
  return {
    key: item.key, id: item.id, task: item.task_title, question: item.display_question || record.question, originalQuestion: record.question,
    start: item.start_seconds, end: item.end_seconds, play: item.play_start_seconds,
    firstEnd: schedule.firstEnd, reveal: item.answer_reveal_seconds, replayReady: schedule.replayReady, replay: item.replay_start_seconds, replayEnd: item.replay_end_seconds,
    pauses: plan.pauses[item.key],
    frameCount, duration: frameCount / design.fps, cropBottom, asset: `static/video-story/${filename}`,
    astra: item.astra_accuracy, human: item.human_accuracy,
    answer: item.display_astra_answer || record.extracted_answer, correctAnswer: item.display_correct_answer || record.ground_truth,
    originalAnswer: record.extracted_answer, originalCorrectAnswer: record.ground_truth, correct: record.is_correct
  };
});
const firstGapCase = cases.find((item) => !item.correct);
design.acts[2].end_seconds = firstGapCase.start;
design.acts[3].start_seconds = firstGapCase.start;
design.acts[3].end_seconds = cursorFrame / design.fps;
design.duration_seconds = cursorFrame / design.fps;
design.total_frames = cursorFrame;
design.phases = [
  [0, plan.timing.rankingFocus, "ranking-draw"],
  [plan.timing.rankingFocus, plan.timing.rankingConclusion, "astra-highlight"],
  [plan.timing.rankingConclusion, plan.rankingEnd, "ranking-conclusion"],
  [plan.rankingEnd, plan.casesStart, "four-dimensions-with-conclusions"]
].filter(([start, end]) => end > start).map(([start_seconds, end_seconds, key]) => ({ start_seconds, end_seconds, key }))
  .concat(cases.map((item) => ({ start_seconds: item.start, end_seconds: item.end, key: item.key })));
fs.writeFileSync(designPath, `${JSON.stringify(design, null, 2)}\n`);

const chartHtml = fs.readFileSync(path.join(root, "model-chart.html"), "utf8");
const iconsMatch = chartHtml.match(/<script id="vendor-icons" type="application\/json">([\s\S]*?)<\/script>/);
if (!iconsMatch) throw new Error("Embedded brand icons not found in model-chart.html");
const allIcons = JSON.parse(iconsMatch[1]);
const icons = Object.fromEntries(["openai", "bytedance-color", "claude-color"].map((key) => {
  if (!allIcons[key]) throw new Error(`Missing icon: ${key}`);
  return [key, allIcons[key]];
}));
const license = chartHtml.match(/<!-- (Brand icons:[\s\S]*?) -->/);
if (license) fs.writeFileSync(path.join(destination, "ICON-LICENSE.txt"), `${license[1].trimEnd()}\n`);

const data = {
  width: design.width, height: design.height, fps: design.fps, duration: design.duration_seconds,
  export: design.export,
  audio: design.audio,
  version: design.version, totalFrames: cursorFrame, timing: design.timing, animations: plan.animations, highlightGroups: design.highlight_groups,
  acts: design.acts.map((act) => ({ id: act.id, title: act.title, start: act.start_seconds, end: act.end_seconds })),
  ranking: design.ranking.models.map((model) => ({ name: model.name, score: model.accuracy })),
  humanScore: design.ranking.human_accuracy,
  dimensions: design.dimensions.map((item) => ({ key: item.key, name: item.key.replaceAll("_", " "), astra: item.astra, human: item.human })),
  tasks: design.tasks.map((item) => ({ key: item.key, group: item.dimension, name: item.key.replaceAll("_", " "), astra: item.astra, human: item.human })),
  cases, icons
};
const serialized = JSON.stringify(data).replaceAll("<", "\\u003c");
fs.writeFileSync(path.join(destination, "data.js"), `/* Generated by npm run video:prepare. */\n(function (root) {\n  const data = ${serialized};\n  if (typeof module === "object" && module.exports) module.exports = data;\n  else root.ViSTRVideoData = data;\n})(globalThis);\n`);
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Ready: ${cases.length} silent clips, concise questions with original JSON provenance, ${cursorFrame} frames / ${data.duration.toFixed(2)} seconds.`);
