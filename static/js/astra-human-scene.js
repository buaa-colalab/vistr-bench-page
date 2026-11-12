/* Shared deterministic SVG renderer for the browser preview and MP4 export. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ViSTRVideoScene = api;
})(globalThis, function () {
  "use strict";
  const C = { ink: "#20252B", muted: "#687382", grid: "#E5E9EF", human: "#A58C5E", other: "#C9D1DC", gap: "#808080", green: "#2F7D57", red: "#BF5947" };
  const VIDEO = { x: 96, y: 196, width: 1008, height: 630 };
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const ease = (value) => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const fade = (time, start, duration = 0.35) => duration <= 0 ? Number(time >= start) : ease((time - start) / duration);
  const mix = (a, b, amount) => a + (b - a) * amount;
  const mixColor = (a, b, amount) => "#" + [1, 3, 5].map((i) => Math.round(mix(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), amount)).toString(16).padStart(2, "0")).join("").toUpperCase();
  const fmt = (number) => Number(number.toFixed(3));
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function text(x, y, value, options = {}) {
    return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${options.size || 32}" font-weight="${options.weight || 400}" fill="${options.fill || C.ink}" text-anchor="${options.anchor || "start"}"${options.opacity === undefined ? "" : ` opacity="${fmt(options.opacity)}"`}>${esc(value)}</text>`;
  }
  function rect(x, y, width, height, fill, extra = "") {
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(Math.max(0, width))}" height="${height}" fill="${fill}" ${extra}/>`;
  }
  function coloredConclusion(y, prefix, tasks, color, weight) {
    return `<text x="112" y="${y}" font-size="35" font-weight="${weight}" fill="${C.ink}">${esc(prefix)}<tspan fill="${color}">${esc(tasks[0])}</tspan> and <tspan fill="${color}">${esc(tasks[1])}</tspan>.</text>`;
  }
  function answerMark(correct, baseline) {
    // The longest answer, Counterclockwise, ends at x=1523 at 40px Arial Bold.
    const x = 1600;
    const color = correct ? C.green : C.red;
    const path = correct ? "M-19 0l13 13L22-17" : "M-16-16L16 16M16-16L-16 16";
    return `<g transform="translate(${x} ${baseline - 14})" role="img" aria-label="${correct ? "Correct" : "Incorrect"}"><path d="${path}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  function group(opacity, content) { return `<g opacity="${fmt(clamp(opacity))}">${content}</g>`; }
  function header(title, subtitle = "") {
    return text(96, 112, title, { size: 56, weight: 700 }) + (subtitle ? text(98, 168, subtitle, { size: 26, fill: C.muted }) : "");
  }
  function grid(x, top, width, bottom, labelY, size = 24) {
    let out = "";
    for (let tick = 0; tick <= 100; tick += 20) {
      const px = x + tick / 100 * width;
      out += `<line x1="${px}" y1="${top}" x2="${px}" y2="${bottom}" stroke="${C.grid}" stroke-width="1"/>`;
      out += text(px, labelY, tick, { size, fill: C.muted, anchor: "middle" });
    }
    return out;
  }
  function icon(data, name, x, y, size, id) {
    const key = /^GPT/.test(name) ? "openai" : /^Seed/.test(name) ? "bytedance-color" : /^Claude/.test(name) ? "claude-color" : null;
    if (!key) {
      return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${C.human}" stroke-width="1.7"><circle cx="12" cy="7" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/></svg>`;
    }
    return data.icons[key]
      .replace(/\bid="([^"]+)"/g, (_, value) => `id="${id}-${value}"`)
      .replace(/url\(#([^)]+)\)/g, (_, value) => `url(#${id}-${value})`)
      .replace("<svg", `<svg x="${x}" y="${y}" width="${size}" height="${size}"`);
  }
  function wrap(value, limit = 32) {
    const lines = []; let line = "";
    for (const word of value.split(/\s+/)) {
      if (line && `${line} ${word}`.length > limit) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  }

  function videoState(item, time) {
    const last = Math.max(0, item.duration - 1 / 30);
    let sourceTime = 0, moving = false, visible = time >= item.start, phase = "question";
    if (time >= item.end) { sourceTime = last; phase = "finished"; }
    else if (time >= item.replayEnd) { sourceTime = last; phase = "after-replay"; }
    else if (time >= item.replay) { sourceTime = Math.min(time - item.replay, last); moving = true; phase = "replay"; }
    else if (time >= item.replayReady) { sourceTime = 0; phase = "replay-ready"; }
    else if (time >= item.reveal) { sourceTime = last; phase = "answer"; }
    else if (time >= item.firstEnd) { sourceTime = last; phase = "before-answer"; }
    else if (time >= item.play) { sourceTime = Math.min(time - item.play, last); moving = true; phase = "first-play"; }
    return { key: item.key, asset: item.asset, time: clamp(sourceTime, 0, last), moving, visible, phase, ...VIDEO };
  }

  function stateAt(data, time) {
    if (!Number.isFinite(time)) throw new TypeError("Timeline time must be finite");
    const t = clamp(time, 0, data.duration - 0.00001);
    const act = data.acts.find((item) => t >= item.start && t < item.end);
    const item = data.cases.find((candidate) => t >= candidate.start && t < candidate.end);
    const a = data.animations;
    const start = item?.start ?? act.start, end = item?.end ?? act.end;
    const fadeIn = item ? Math.min(a.case_fade_in_seconds, item.play - item.start) : Math.min(a.scene_fade_in_seconds, (end - start) / 2);
    const fadeOut = item ? Math.min(a.case_fade_out_seconds, item.end - item.replayEnd) : Math.min(a.scene_fade_out_seconds, (end - start) / 2);
    const opacity = fade(t, start, fadeIn) * (1 - fade(t, end - fadeOut, fadeOut));
    const media = item ? videoState(item, t) : null;
    const video = media?.visible ? { ...media, opacity } : null;
    return { time: t, act, opacity, item, video };
  }

  function ranking(data, t) {
    let out = header(data.acts[0].title, "Overall accuracy (%)");
    const a = data.animations;
    const progress = fade(t, data.timing.rankingDraw, Math.min(a.ranking_draw_seconds, data.timing.rankingFocus - data.timing.rankingDraw)), focus = fade(t, data.timing.rankingFocus, Math.min(a.ranking_highlight_seconds, data.timing.rankingConclusion - data.timing.rankingFocus));
    out += group(fade(t, Math.min(0.5, data.timing.rankingDraw)), grid(620, 236, 1050, 798, 838));
    const rows = [{ name: "Human", score: data.humanScore }, ...data.ranking];
    rows.forEach((row, i) => {
      const y = 266 + i * 67;
      const astra = /^GPT-6-Astra/.test(row.name), human = i === 0;
      const alpha = human || astra ? 1 : mix(1, 0.4, focus);
      const width = row.score / 100 * 1050 * progress;
      const color = human ? C.human : astra ? mixColor(C.other, C.ink, focus) : C.other;
      if (astra) out += group(focus, rect(96, y - 30, 1728, 60, "#F2F4F8", 'rx="8"'));
      let rowSvg = text(112, y + 9, row.name.replace(/-thinking$/i, ""), { size: 29, weight: astra ? Math.round(mix(400, 700, focus)) : 400 });
      rowSvg += icon(data, row.name, 550, y - 19, 34, `ranking-${i}`);
      rowSvg += rect(620, y - 23, width, 44, color, 'rx="4"');
      rowSvg += text(620 + width + 18, y + 10, row.score.toFixed(1), { size: 34, weight: 700, opacity: progress });
      if (astra) rowSvg += group(focus, text(640, y + 7, "#1 model", { size: 24, fill: "#FFFFFF", weight: 700 }));
      out += group(fade(t, Math.min(0.65, data.timing.rankingDraw + 0.05)) * alpha, rowSvg);
    });
    out += group(fade(t, data.timing.rankingConclusion, a.conclusion_fade_seconds), text(112, 960, "GPT-6-Astra ranks first among the evaluated models.", { size: 40, weight: 700 }));
    return out;
  }

  function dimensions(data, t, barOpacity = 1, labels = true) {
    let out = group(barOpacity, grid(610, 224, 1060, 806, 847));
    const progress = fade(t, data.timing.dimensionsDraw, Math.min(data.animations.dimensions_draw_seconds, data.timing.dimensionsConclusion - data.timing.dimensionsDraw));
    data.dimensions.forEach((row, i) => {
      const y = 277 + i * 150;
      if (labels) out += text(96, y + 12, row.name, { size: 32, weight: 600 });
      let bars = "";
      [["Human", row.human, C.human, -22], ["Astra", row.astra, C.ink, 26]].forEach(([label, value, color, offset]) => {
        const width = value / 100 * 1060 * progress;
        bars += icon(data, label === "Astra" ? "GPT-6-Astra" : "Human", 438, y + offset - 19, 28, `dimension-${i}-${label}`);
        bars += text(480, y + offset + 8, label, { size: 25, fill: color });
        bars += rect(610, y + offset - 17, width, 28, color, 'rx="3"');
        bars += text(610 + width + 16, y + offset + 7, value.toFixed(1), { size: 30, weight: 600, opacity: progress });
      });
      out += group(barOpacity, bars);
    });
    return out;
  }

  function comparison(data, t) {
    let out = header(data.acts[1].title, "Overall accuracy (%)");
    out += group(fade(t, data.acts[1].start + 0.2), dimensions(data, t));
    const conclusions = coloredConclusion(934, "Astra performs well in ", ["motion perception", "spatial reasoning"], C.green, 700) + coloredConclusion(993, "Gaps remain in ", ["outcome prediction", "physical dynamics"], C.red, 600);
    out += group(fade(t, data.timing.dimensionsConclusion, data.animations.conclusion_fade_seconds), conclusions);
    return out;
  }

  function questionLayout(item) {
    const lines = wrap(item.question, 35);
    const size = 34;
    const lineHeight = 46;
    const startY = 314;
    const endY = startY + (lines.length - 1) * lineHeight;
    return { lines, size, lineHeight, startY, endY, answerY: Math.max(552, endY + 80) };
  }
  function caseScene(data, state, imageHref) {
    const { time: t, act, item } = state;
    if (!item) return "";
    const categoryColor = act.id === 3 ? C.green : C.red;
    let panel = text(1184, 230, item.task, { size: 36, weight: 700 });
    if (imageHref) panel += `<image x="${VIDEO.x}" y="${VIDEO.y}" width="${VIDEO.width}" height="${VIDEO.height}" href="${esc(imageHref)}" preserveAspectRatio="xMidYMid meet"/>`;
    const layout = questionLayout(item), answerY = layout.answerY;
    let question = "";
    layout.lines.forEach((line, i) => { question += text(1184, layout.startY + i * layout.lineHeight, line, { size: layout.size }); });
    panel += group(fade(t, item.start, data.animations.question_fade_seconds), question);
    const answer = text(1184, answerY, "Astra prediction", { size: 25, fill: C.muted }) + text(1184, answerY + 50, item.answer, { size: 40, weight: 700 }) + answerMark(item.correct, answerY + 50) + text(1184, answerY + 130, "Ground truth", { size: 25, fill: C.muted }) + text(1184, answerY + 180, item.correctAnswer, { size: 40, weight: 600 });
    panel += group(fade(t, item.reveal, Math.min(data.animations.answer_fade_seconds, item.replayReady - item.reveal)), answer);
    panel += `<line x1="96" y1="919" x2="1824" y2="919" stroke="${C.grid}"/>`;
    const delta = Number((item.astra - item.human).toFixed(1));
    panel += text(96, 956, "Astra", { size: 24, fill: C.muted }) + text(96, 1007, `${item.astra.toFixed(1)}%`, { size: 38, weight: 700 });
    panel += text(640, 956, "Human", { size: 24, fill: C.muted }) + text(640, 1007, `${item.human.toFixed(1)}%`, { size: 38, weight: 700, fill: C.human });
    panel += text(1184, 956, "Astra - Human", { size: 24, fill: C.muted }) + text(1184, 1007, `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp`, { size: 38, fill: C.gap, weight: 700 });
    return text(96, 100, act.title, { size: 52, weight: 700, fill: categoryColor }) + panel;
  }

  function render(data, time, imageHref = "") {
    const state = stateAt(data, time);
    const content = state.act.id === 1 ? ranking(data, state.time) : state.act.id === 2 ? comparison(data, state.time) : caseScene(data, state, imageHref);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="scene-title"><title id="scene-title">${esc(state.act.title)}</title><rect width="1920" height="1080" fill="#FFFFFF"/><g font-family="Arial, Helvetica, sans-serif">${group(state.opacity, content)}</g></svg>`;
    return { ...state, svg };
  }
  return { render, stateAt, videoState, questionLayout, colors: C, videoRect: VIDEO };
});
