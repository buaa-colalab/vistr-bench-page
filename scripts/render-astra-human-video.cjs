#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const { Resvg } = require("@resvg/resvg-js");
const root = path.resolve(__dirname, "..");
const data = require("../static/video-story/data.js");
const renderer = require("../static/js/astra-human-scene.js");
const subtitleReport = JSON.parse(fs.readFileSync(path.join(root, "docs/astra-human-audio-timing.json"), "utf8"));
const args = process.argv.slice(2);
const burnSubtitles = !args.includes("--selectable-subtitles");
function arg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}
const width = Number(arg("--width", data.export?.width || 3840)), fps = Number(arg("--fps", 30));
const start = Number(arg("--start", 0)), end = Number(arg("--end", data.duration));
if (!Number.isInteger(width) || width < 320 || width % 32 !== 0) throw new Error("Width must be a multiple of 32, at least 320");
if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error("FPS must be an integer between 1 and 60");
if (!(start >= 0 && end > start && end <= data.duration)) throw new Error("Invalid start/end times");
const outputDir = path.join(root, "outputs/astra-human");
const cache = path.join(root, ".video-cache/astra-human");
fs.mkdirSync(outputDir, { recursive: true }); fs.mkdirSync(cache, { recursive: true });

function checked(command, params) {
  const result = spawnSync(command, params, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result.stdout;
}
const jpegFrames = new Map();
function prepareFrames() {
  for (const item of data.cases) {
    const source = path.join(root, item.asset), stat = fs.statSync(source);
    const directory = path.join(cache, item.key);
    fs.mkdirSync(directory, { recursive: true });
    const signature = `${stat.size}:${stat.mtimeMs}:30fps`;
    const marker = path.join(directory, "signature.txt");
    if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8") !== signature) {
      for (const name of fs.readdirSync(directory).filter((name) => /^\d{5}\.jpg$/.test(name))) fs.unlinkSync(path.join(directory, name));
      checked("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", source, "-an", "-vf", "fps=30", "-q:v", "2", path.join(directory, "%05d.jpg")]);
      fs.writeFileSync(marker, signature);
    }
    const files = fs.readdirSync(directory).filter((name) => /^\d{5}\.jpg$/.test(name)).sort();
    if (!files.length) throw new Error(`No frames extracted for ${item.key}`);
    if (files.length !== item.frameCount) throw new Error(`Cached frame count mismatch for ${item.key}: ${files.length} != ${item.frameCount}`);
    jpegFrames.set(item.key, files.map((name) => `data:image/jpeg;base64,${fs.readFileSync(path.join(directory, name)).toString("base64")}`));
  }
}
const fonts = ["Arial.ttf", "Arial Bold.ttf"].map((name) => `/System/Library/Fonts/Supplemental/${name}`).filter((file) => fs.existsSync(file));
const options = { fitTo: { mode: "width", value: width }, font: { fontFiles: fonts, loadSystemFonts: fonts.length === 0, defaultFontFamily: "Arial" } };
const rasterCache = new Map();
function xmlEscape(value) { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])); }
function wrapSubtitle(value, maxChars) {
  const lines = []; let line = "";
  for (const word of value.split(/\s+/)) {
    if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
function subtitleOverlay(time, act) {
  const cue = subtitleReport.cues.find((item) => time >= item.speech_start && time < item.speech_end);
  if (!cue) return "";
  const lines = wrapSubtitle(cue.text, 78);
  const x = 160;
  const y = 966;
  const width = 1600;
  const lineHeight = 30;
  const height = lines.length * lineHeight + 26;
  const textY = y + 34;
  const text = lines.map((line, index) => `<text x="${x + 24}" y="${textY + index * lineHeight}" font-size="26" font-weight="500" fill="#20252B">${xmlEscape(line)}</text>`).join("");
  return `<g id="burned-subtitles"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#F1F3F6" stroke="#D8DEE6" stroke-width="1" opacity="0.96"/>${text}</g>`;
}
function pngAt(time) {
  const state = renderer.stateAt(data, time);
  let image = "";
  if (state.video) {
    const frames = jpegFrames.get(state.video.key);
    image = frames[Math.min(frames.length - 1, Math.max(0, Math.floor(state.video.time * 30 + 0.0001)))];
  }
  const scene = renderer.render(data, time, image);
  const svg = burnSubtitles ? scene.svg.replace("</g></svg>", `${subtitleOverlay(time, scene.act)}</g></svg>`) : scene.svg;
  if (rasterCache.has(svg)) return rasterCache.get(svg);
  const png = new Resvg(svg, options).render().asPng();
  if (rasterCache.size >= 48) rasterCache.delete(rasterCache.keys().next().value);
  rasterCache.set(svg, png);
  return png;
}

async function main() {
  prepareFrames();
  if (args.includes("--stills")) {
    const directory = path.join(outputDir, "stills"); fs.mkdirSync(directory, { recursive: true });
    const times = args.includes("--at") ? arg("--at").split(",").map(Number) : [(data.timing.rankingDraw + data.timing.rankingFocus) / 2, data.timing.rankingConclusion + 0.5, data.timing.dimensionsConclusion + 0.5, ...data.cases.flatMap((item) => [item.start + (item.play - item.start) / 2, item.play + item.duration / 2, item.reveal + (item.replay - item.reveal) / 2, item.replay + item.duration / 2])].map((time) => Number(time.toFixed(3)));
    for (const time of times) {
      if (!Number.isFinite(time) || time < 0 || time > data.duration) throw new Error(`Invalid still time: ${time}`);
      const target = path.join(directory, `frame-${String(time).padStart(6, "0")}.png`);
      fs.writeFileSync(target, pngAt(time)); console.log(`Still: ${time}s → ${target}`);
    }
    return;
  }
  const target = path.resolve(root, arg("--output", path.join(outputDir, "astra-human-final.mp4")));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const process = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-vcodec", "png", "-framerate", String(fps), "-i", "pipe:0", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", String(data.export?.crf ?? 16), "-pix_fmt", "yuv420p", "-threads", "4", "-movflags", "+faststart", target], { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "", failure = null;
  process.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-12000); });
  process.on("error", (error) => { failure = error; });
  process.stdin.on("error", (error) => { failure = error; });
  const completion = new Promise((resolve) => process.on("close", resolve));
  const total = Math.round((end - start) * fps);
  for (let frame = 0; frame < total; frame++) {
    if (failure || process.exitCode !== null) throw new Error(failure?.message || stderr || "Encoder stopped");
    const png = pngAt(start + frame / fps);
    if (!process.stdin.write(png)) await once(process.stdin, "drain");
    if (frame % (fps * 10) === 0) console.log(`Rendering ${(frame / fps).toFixed(0)} / ${(end - start).toFixed(0)} seconds`);
  }
  process.stdin.end();
  const code = await completion;
  if (code !== 0 || failure) throw new Error(stderr || failure?.message || `Encoder exit ${code}`);
  const probe = JSON.parse(checked("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", target]));
  if (probe.streams.some((stream) => stream.codec_type === "audio")) throw new Error("Export unexpectedly contains audio");
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  if (Math.abs(Number(probe.format.duration) - (end - start)) > 1 / fps + 0.01) throw new Error("Export duration mismatch");
  console.log(`Verified: ${video.width}×${video.height}, ${video.r_frame_rate} fps, ${probe.format.duration}s, no audio track.`);
  if (data.audio?.enabled) {
    const result = require("./mux-astra-human-video.cjs").muxVideo({ video: target, start, duration: end - start, includeSubtitles: !burnSubtitles });
    const subtitleStatus = burnSubtitles ? "subtitles burned into video frames" : `selectable subtitles (${result.subtitle})`;
    console.log(`Mux verified: ${result.width}×${result.height}, ${result.duration}s, English narration (${result.audio}) and ${subtitleStatus}.`);
  }
  console.log(target);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
