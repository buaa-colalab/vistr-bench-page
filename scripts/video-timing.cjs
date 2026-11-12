"use strict";

function seconds(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 300) {
    throw new Error(`Invalid ${label}: use a number from 0 to 300 seconds`);
  }
  return value;
}
const frames = (value, fps) => Math.round(value * fps);
const exampleDefaults = { question_seconds: 3, before_answer_seconds: 0.25, answer_seconds: 2, replay_lead_in_seconds: 0.3, after_replay_seconds: 0.6 };
const animationDefaults = { scene_fade_in_seconds: 0.45, scene_fade_out_seconds: 0.35, ranking_draw_seconds: 0.8, ranking_highlight_seconds: 0.55, dimensions_draw_seconds: 0.8, conclusion_fade_seconds: 0.45, case_fade_in_seconds: 0.45, case_fade_out_seconds: 0.35, question_fade_seconds: 0.4, answer_fade_seconds: 0.4 };

function compileTiming(config, fps, caseKeys) {
  if (!Number.isInteger(fps) || fps < 1) throw new Error("Invalid video FPS");
  const page = (group, key) => frames(seconds(config.pages?.[group]?.[key], `pages.${group}.${key}`), fps);
  const rIntro = page("ranking", "intro_seconds"), rRead = page("ranking", "all_models_seconds");
  const rFocus = page("ranking", "highlight_seconds"), rConclusion = page("ranking", "conclusion_seconds");
  const dIntro = page("dimensions", "intro_seconds"), dRead = page("dimensions", "comparison_seconds"), dConclusion = page("dimensions", "conclusion_seconds");
  const rankingEndFrame = rIntro + rRead + rFocus + rConclusion;
  const casesStartFrame = rankingEndFrame + dIntro + dRead + dConclusion;
  if (rankingEndFrame <= 0 || casesStartFrame <= rankingEndFrame) throw new Error("Each chart page must have a positive total duration");
  const defaults = {};
  for (const [key, fallback] of Object.entries(exampleDefaults)) defaults[key] = seconds(config.examples?.[key] ?? fallback, `examples.${key}`);
  const animations = {};
  for (const [key, fallback] of Object.entries(animationDefaults)) animations[key] = frames(seconds(config.animations?.[key] ?? fallback, `animations.${key}`), fps) / fps;
  for (const key of Object.keys(config.animations || {})) {
    if (!key.startsWith("_") && !Object.hasOwn(animationDefaults, key)) throw new Error(`Unknown animation setting: animations.${key}`);
  }
  for (const key of Object.keys(config.examples || {})) {
    if (!key.startsWith("_") && key !== "overrides" && !Object.hasOwn(exampleDefaults, key)) throw new Error(`Unknown example setting: examples.${key}`);
  }
  const overrides = config.examples?.overrides || {};
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith("_")) continue;
    if (!caseKeys.includes(key)) throw new Error(`Unknown example override: ${key}`);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid example override: ${key}`);
    for (const name of Object.keys(value)) {
      if (name.startsWith("_")) continue;
      if (!Object.hasOwn(defaults, name)) throw new Error(`Unknown pause setting: examples.overrides.${key}.${name}`);
      seconds(value[name], `examples.overrides.${key}.${name}`);
    }
  }
  return {
    rankingEnd: rankingEndFrame / fps, dimensionsEnd: casesStartFrame / fps, casesStart: casesStartFrame / fps, animations,
    timing: {
      rankingDraw: rIntro / fps, rankingFocus: (rIntro + rRead) / fps,
      rankingConclusion: (rIntro + rRead + rFocus) / fps,
      dimensionsDraw: (rankingEndFrame + dIntro) / fps,
      dimensionsConclusion: (rankingEndFrame + dIntro + dRead) / fps
    },
    pauses: Object.fromEntries(caseKeys.map((key) => {
      const entry = overrides[key] || {};
      return [key, Object.fromEntries(Object.keys(defaults).map((name) => [name, seconds(entry[name] ?? defaults[name], `examples.${key}.${name}`)]))];
    }))
  };
}

function caseTiming(startFrame, videoFrames, pauses, fps) {
  const playFrame = startFrame + frames(pauses.question_seconds, fps);
  const firstEndFrame = playFrame + videoFrames;
  const revealFrame = firstEndFrame + frames(pauses.before_answer_seconds ?? 0, fps);
  const replayReadyFrame = revealFrame + frames(pauses.answer_seconds, fps);
  const replayFrame = replayReadyFrame + frames(pauses.replay_lead_in_seconds ?? 0, fps);
  const replayEndFrame = replayFrame + videoFrames;
  const endFrame = replayEndFrame + frames(pauses.after_replay_seconds, fps);
  return { start: startFrame / fps, play: playFrame / fps, firstEnd: firstEndFrame / fps, reveal: revealFrame / fps,
    replayReady: replayReadyFrame / fps, replay: replayFrame / fps, replayEnd: replayEndFrame / fps, end: endFrame / fps, endFrame };
}
module.exports = { compileTiming, caseTiming };
