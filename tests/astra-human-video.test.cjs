"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const data = require("../static/video-story/data.js");
const scene = require("../static/js/astra-human-scene.js");
const design = JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/astra-human-video-data.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../video.config.json"), "utf8"));
const { compileTiming, caseTiming } = require("../scripts/video-timing.cjs");
const plan = compileTiming(config, data.fps, data.cases.map((item) => item.key));
const quantized = (seconds) => Math.round(seconds * data.fps) / data.fps;
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, a + " != " + b);

test("four acts and six cases form a continuous frame-accurate timeline", () => {
  assert.equal(data.version, 8); assert.equal(data.acts.length, 4); assert.equal(data.cases.length, 6);
  assert.equal(data.totalFrames, Math.round(data.duration * 30));
  assert.deepEqual(data.acts.slice(0, 2).map((act) => [act.start, act.end]), [[0, plan.rankingEnd], [plan.rankingEnd, plan.casesStart]]);
  for (let i = 1; i < data.acts.length; i++) close(data.acts[i - 1].end, data.acts[i].start);
  close(data.acts.at(-1).end, data.duration); close(data.cases[0].start, plan.casesStart);
  for (let i = 1; i < data.cases.length; i++) close(data.cases[i - 1].end, data.cases[i].start);
  close(data.cases.at(-1).end, data.duration);
  assert.throws(() => scene.stateAt(data, NaN));
});
test("each case is question, first play, answer, exactly one replay, then finish", () => {
  for (const item of data.cases) {
    close(item.play - item.start, quantized(plan.pauses[item.key].question_seconds)); close(item.firstEnd - item.play, item.duration);
    close(item.reveal - item.firstEnd, quantized(plan.pauses[item.key].before_answer_seconds));
    close(item.replayReady - item.reveal, quantized(plan.pauses[item.key].answer_seconds));
    close(item.replay - item.replayReady, quantized(plan.pauses[item.key].replay_lead_in_seconds)); close(item.replayEnd - item.replay, item.duration);
    close(item.end - item.replayEnd, quantized(plan.pauses[item.key].after_replay_seconds));
    let media;
    if (item.play > item.start) {
      const time = (item.play + item.start) / 2;
      media = scene.videoState(item, time);
      assert.equal(media.phase, "question"); assert.equal(media.visible, true); assert.equal(media.moving, false);
      close(media.time, 0); close(scene.stateAt(data, time).video.time, 0);
    }
    media = scene.videoState(item, item.play + 0.05);
    assert.equal(media.phase, "first-play"); assert.equal(media.moving, true); close(media.time, 0.05);
    if (item.replayReady > item.reveal) {
      media = scene.videoState(item, (item.reveal + item.replayReady) / 2);
      assert.equal(media.phase, "answer"); assert.equal(media.moving, false);
    }
    if (item.reveal > item.firstEnd) assert.equal(scene.videoState(item, (item.firstEnd + item.reveal) / 2).phase, "before-answer");
    if (item.replay > item.replayReady) {
      media = scene.videoState(item, (item.replayReady + item.replay) / 2);
      assert.equal(media.phase, "replay-ready"); assert.equal(media.moving, false); close(media.time, 0);
    }
    media = scene.videoState(item, item.replay + 0.05);
    assert.equal(media.phase, "replay"); assert.equal(media.moving, true); close(media.time, 0.05);
    media = scene.videoState(item, item.end + 0.01);
    assert.equal(media.phase, "finished"); assert.equal(media.moving, false);
  }
});
test("all frame positions stay inside the supplied videos", () => {
  for (let frame = 0; frame <= data.totalFrames; frame++) {
    const state = scene.stateAt(data, frame / 30);
    if (!state.video) continue;
    const clip = data.cases.find((item) => item.key === state.video.key);
    assert.ok(state.video.time >= 0 && state.video.time < clip.duration);
    assert.ok(state.video.opacity >= 0 && state.video.opacity <= 1);
  }
});
test("short questions and display labels retain their original source questions and scored answers", () => {
  assert.deepEqual(data.cases.map((item) => item.correct), [true, true, true, false, false, false]);
  const tasks = [];
  for (const item of data.cases) {
    const source = design.cases.find((candidate) => candidate.key === item.key);
    const original = JSON.parse(fs.readFileSync(source.detail_path, "utf8"));
    assert.equal(item.originalQuestion, original.question); assert.equal(item.question, source.display_question);
    assert.ok(item.question.length < original.question.length);
    assert.equal(item.originalAnswer, original.extracted_answer); assert.equal(item.originalCorrectAnswer, original.ground_truth);
    assert.equal(item.answer, source.display_astra_answer || original.extracted_answer);
    assert.equal(item.correctAnswer, source.display_correct_answer || original.ground_truth); assert.equal(item.correct, original.is_correct);
    if (item.key === "fall-direction") {
      assert.equal(item.answer, "Left"); assert.equal(item.correctAnswer, "Right"); assert.ok(item.question.includes("their own"));
    }
    if (["basketball-shot", "soccer-shot", "fall-direction"].includes(item.key)) assert.ok(!item.task.includes("Prediction"));
    const layout = scene.questionLayout(item);
    assert.equal(layout.lines.join(" "), item.question.replace(/\s+/g, " "));
    assert.ok(layout.answerY > layout.endY + 40); assert.ok(layout.answerY + 215 < 900);
    assert.ok(fs.existsSync(path.join(__dirname, "..", item.asset))); tasks.push(original.task);
  }
  assert.deepEqual(tasks, [...data.highlightGroups.good, ...data.highlightGroups.gaps]);
});
test("ranking uses the requested GPT-5.6-Sol presentation value without thinking suffixes", () => {
  const svg = scene.render(data, data.timing.rankingConclusion + 0.1).svg;
  assert.equal(data.ranking.length, 7);
  assert.equal(data.ranking.find((item) => item.name === "GPT-5.6-Sol").score, 63);
  assert.ok(svg.includes("GPT-5.6-Sol")); assert.ok(svg.includes("63.0"));
  assert.ok(!svg.includes("GPT-5.4")); assert.ok(!svg.includes("thinking"));
  assert.ok(svg.includes("GPT-6-Astra ranks first among the evaluated models."));
  const bar = (time, row) => scene.render(data, time).svg.match(new RegExp(`<rect x="620" y="${266 + row * 67 - 23}"[^>]*fill="([^"]+)"`))[1];
  assert.equal(bar(data.timing.rankingFocus, 1), scene.colors.other);
  assert.equal(bar(data.timing.rankingFocus, 1), bar(data.timing.rankingFocus, 2));
  assert.notEqual(bar(data.timing.rankingFocus + data.animations.ranking_highlight_seconds / 2, 1), scene.colors.other);
  assert.equal(bar(data.timing.rankingFocus + data.animations.ranking_highlight_seconds + 0.01, 1), scene.colors.ink);
});
test("four-dimension comparison leads directly into examples without a per-task comparison page", () => {
  close(data.cases[0].start, data.acts[1].end);
  close(data.cases[0].start, plan.dimensionsEnd);
  assert.ok(!Object.hasOwn(config.pages, "tasks"));
  assert.ok(!Object.hasOwn(data.timing, "expandTasks"));
  assert.ok(!design.phases.some((phase) => /fifteen|task-highlights/.test(phase.key)));
  for (let frame = Math.round(data.acts[1].start * data.fps); frame < Math.round(data.acts[1].end * data.fps); frame++) {
    const svg = scene.render(data, frame / data.fps).svg;
    assert.ok(svg.includes("Motion Perception")); assert.ok(svg.includes("Physical Dynamics"));
    assert.ok(!svg.includes("Passage Feasibility")); assert.ok(!svg.includes("Gap</text>"));
  }
  const svg = scene.render(data, (data.timing.dimensionsConclusion + plan.casesStart) / 2).svg;
  for (const [prefix, first, second, color] of [["Astra performs well in ", "motion perception", "spatial reasoning", scene.colors.green], ["Gaps remain in ", "outcome prediction", "physical dynamics", scene.colors.red]]) {
    const tag = [...svg.matchAll(/<text[^>]*>[\s\S]*?<\/text>/g)].map((m) => m[0]).find((tag) => tag.includes(prefix));
    assert.ok(tag); assert.ok(tag.includes('fill="' + scene.colors.ink + '"'));
    assert.ok(tag.includes(`<tspan fill="${color}">${first}</tspan> and <tspan fill="${color}">${second}</tspan>.`));
  }
});
test("all clips share an 8:5 canvas, caption bands are removed, and only the basketball final frame is trimmed", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../static/video-story/media-manifest.json"), "utf8"));
  assert.equal(manifest["rotation-direction"].crop_bottom, 100);
  assert.equal(manifest["fall-direction"].crop_bottom, 116);
  const frameCounts = [122, 73, 149, 131, 53, 97];
  for (const [i, item] of data.cases.entries()) {
    assert.equal(manifest[item.key].width, 2560); assert.equal(manifest[item.key].height, 1600);
    assert.equal(manifest[item.key].frame_count, frameCounts[i]);
  }
  assert.equal(scene.videoRect.width / scene.videoRect.height, 1.6);
  assert.deepEqual(data.export, { width: 3840, height: 2160, fps: 30, crf: 16 });
  assert.equal(manifest["basketball-shot"].end_frame_exclusive, 131);
  const basketball = data.cases.find((item) => item.key === "basketball-shot");
  close(scene.videoState(basketball, basketball.reveal).time, 130 / 30);
});
test("case category colors remain distinct, gaps are neutral gray, and answer marks are large and placed at the right", () => {
  for (const item of data.cases) {
    const svg = scene.render(data, item.reveal + 0.5).svg;
    assert.ok(!svg.includes("#F1F3F6")); assert.ok(!svg.includes("360°")); assert.ok(!svg.includes("Basketball Fake Out"));
    const delta = Number((item.astra - item.human).toFixed(1));
    assert.ok(svg.includes("Astra - Human"));
    assert.ok(svg.includes((delta > 0 ? "+" : "") + delta.toFixed(1) + " pp"));
    const valueTag = svg.match(/<text x="1184" y="1007"[^>]*>[^<]*<\/text>/)[0];
    assert.ok(valueTag.includes('fill="' + scene.colors.gap + '"'));
    const act = data.acts.find((act) => item.start >= act.start && item.start < act.end);
    assert.ok(svg.includes(act.title));
    const titleColor = act.id === 3 ? scene.colors.green : scene.colors.red;
    for (const [x, y, content, color] of [[96, 100, act.title, titleColor], [1184, 230, item.task, scene.colors.ink]]) {
      const tag = svg.match(new RegExp(`<text x="${x}" y="${y}"[^>]*>[^<]*</text>`))[0];
      assert.ok(tag.includes(content)); assert.ok(tag.includes(`fill="${color}"`));
    }
    assert.equal(data.acts[2].title, "Tasks Where Astra Performs Well");
    assert.ok(!/>Correct<|>Incorrect</.test(svg));
    assert.ok(svg.includes(`aria-label="${item.correct ? "Correct" : "Incorrect"}"`));
    const mark = svg.match(/<g transform="translate\((\d+) [\d.]+\)" role="img"/);
    assert.ok(mark); assert.equal(Number(mark[1]), 1600);
    assert.ok(!svg.includes('<circle r="36"')); assert.ok(svg.includes('stroke-width="5" stroke-linecap="round"'));
    const answer = [...svg.matchAll(/<text[^>]*>[^<]*<\/text>/g)].map((m) => m[0]).filter((tag) => tag.endsWith(`>${item.answer}</text>`) || tag.endsWith(`>${item.correctAnswer}</text>`));
    assert.equal(answer.length, 2); for (const tag of answer) assert.ok(tag.includes(`fill="${scene.colors.ink}"`));
    for (const match of svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"/g)) {
      const x = Number(match[1]), y = Number(match[2]);
      assert.ok(y >= 919 || x >= 1184 || (x === 96 && y === 100), "Unexpected video-column text: " + x + ", " + y);
    }
  }
});
test("timing config shifts chart pages and supports per-case pause overrides", () => {
  const changed = structuredClone(config);
  changed.pages.ranking.conclusion_seconds += 2;
  changed.pages.dimensions.conclusion_seconds += 1;
  changed.examples.overrides["ego-motion"] = { question_seconds: 6.2, answer_seconds: 0.5, after_replay_seconds: 1 };
  const next = compileTiming(changed, data.fps, data.cases.map((item) => item.key));
  close(next.rankingEnd, plan.rankingEnd + 2); close(next.casesStart, plan.casesStart + 3);
  close(next.pauses["ego-motion"].question_seconds, 6.2);
  close(next.pauses["rotation-direction"].question_seconds, config.examples.question_seconds);
  const schedule = caseTiming(300, 60, { question_seconds: 1.5, answer_seconds: 1, after_replay_seconds: 0.5 }, 30);
  assert.deepEqual([schedule.start, schedule.play, schedule.reveal, schedule.replay, schedule.replayEnd, schedule.end], [10, 11.5, 13.5, 14.5, 16.5, 17]);
  const hold = scene.videoState({ ...schedule, key: "test", asset: "test.mp4", duration: 2 }, 16.75);
  assert.equal(hold.phase, "after-replay"); assert.equal(hold.moving, false); close(hold.time, 2 - 1 / 30);
});
test("invalid pause settings fail clearly before preparing media", () => {
  const bad = structuredClone(config); bad.examples.question_seconds = -1;
  assert.throws(() => compileTiming(bad, 30, data.cases.map((item) => item.key)), /question_seconds/);
  const typo = structuredClone(config); typo.examples.overrides["wrong-case-name"] = {};
  assert.throws(() => compileTiming(typo, 30, data.cases.map((item) => item.key)), /Unknown example override/);
  const animation = structuredClone(config); animation.animations.answer_fade_seconds = -1;
  assert.throws(() => compileTiming(animation, 30, data.cases.map((item) => item.key)), /answer_fade_seconds/);
  const zero = structuredClone(config); for (const name of Object.keys(zero.animations)) if (!name.startsWith("_")) zero.animations[name] = 0;
  const zeroPlan = compileTiming(zero, 30, data.cases.map((item) => item.key));
  assert.ok(!/NaN|Infinity/.test(scene.render({ ...data, animations: zeroPlan.animations }, data.cases[0].start).svg));
});
test("configurable transitions keep both video passes fully visible and fade only during the ending hold", () => {
  assert.deepEqual(data.animations, plan.animations);
  for (const item of data.cases) {
    close(scene.stateAt(data, item.play + 0.1).opacity, 1);
    close(scene.stateAt(data, item.firstEnd - 1 / 30).opacity, 1);
    close(scene.stateAt(data, item.replayEnd - 1 / 30).opacity, 1);
    if (item.end > item.replayEnd && data.animations.case_fade_out_seconds > 0) {
      const opacity = scene.stateAt(data, item.end - Math.min(data.animations.case_fade_out_seconds, item.end - item.replayEnd) / 2).opacity;
      assert.ok(opacity > 0 && opacity < 1);
    }
  }
});
test("football uses the adult training clip with its original scored answer", () => {
  const soccer = data.cases.find((item) => item.key === "soccer-shot");
  assert.equal(soccer.id, 629); assert.equal(soccer.answer, "Yes"); assert.equal(soccer.correctAnswer, "No");
});
test("frames are deterministic, finite, English-only, with unique SVG IDs", () => {
  const before = scene.render(data, 12).svg;
  const times = [0.5, 5, 12, 24, 28.5, 35, 42, ...data.cases.flatMap((item) => [item.start + 1, item.play + 0.5, item.reveal + 0.5, item.replay + 0.5])];
  for (const time of times) {
    const svg = scene.render(data, time).svg;
    assert.ok(!/[\u3400-\u9fff]/u.test(svg)); assert.ok(!/NaN|Infinity|undefined/.test(svg));
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.equal(scene.render(data, 12).svg, before);
});
