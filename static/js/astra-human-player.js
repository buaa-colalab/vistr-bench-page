(function () {
  "use strict";
  const data = globalThis.ViSTRVideoData, renderer = globalThis.ViSTRVideoScene;
  const $ = (id) => document.getElementById(id);
  if (!data || !renderer) {
    $("error").hidden = false;
    $("error").textContent = "Scene data is missing. Run npm run video:prepare first.";
    return;
  }
  let currentTime = 0, playing = false, origin = 0, frame = null, activeKey = null;
  $("seek").max = String(data.duration);
  document.querySelectorAll("[data-act]").forEach((button) => { button.dataset.time = String(data.acts.find((act) => act.id === Number(button.dataset.act)).start); });
  const clips = new Map();
  const narration = data.audio?.enabled ? new Audio(data.audio.asset) : null;
  if (narration) narration.preload = "auto";
  const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

  const ready = data.cases.map((item) => new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.className = "clip"; video.muted = true; video.volume = 0;
    const bounds = renderer.videoRect;
    Object.assign(video.style, { left: `${bounds.x / data.width * 100}%`, top: `${bounds.y / data.height * 100}%`, width: `${bounds.width / data.width * 100}%`, height: `${bounds.height / data.height * 100}%` });
    video.playsInline = true; video.preload = "auto";
    video.setAttribute("aria-hidden", "true");
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("seeked", () => syncVideo(renderer.stateAt(data, currentTime).video, false));
    video.addEventListener("error", () => reject(new Error(`Cannot load ${item.asset}`)), { once: true });
    video.src = item.asset;
    $("composition").appendChild(video); clips.set(item.key, video);
  }));

  function syncVideo(info, forceSeek) {
    for (const [key, video] of clips) {
      if (!info || key !== info.key) { video.pause(); video.style.display = "none"; continue; }
      video.style.display = "block";
      video.style.opacity = String(info.opacity);
      const jump = activeKey !== key || forceSeek || Math.abs(video.currentTime - info.time) > (playing && info.moving ? 0.16 : 0.025);
      if (video.readyState >= 1 && jump && !video.seeking) video.currentTime = info.time;
      if (playing && info.moving) {
        if (video.paused) video.play().catch(() => {});
      } else video.pause();
    }
    activeKey = info?.key || null;
  }
  function paint(forceSeek = false) {
    const scene = renderer.render(data, currentTime === 0 && !playing ? 0.4 : currentTime);
    $("art").innerHTML = scene.svg;
    syncVideo(scene.video, forceSeek);
    if (narration) {
      const audioTime = Math.min(currentTime, data.duration - 0.001);
      if (narration.readyState >= 1 && !narration.seeking && (forceSeek || Math.abs(narration.currentTime - audioTime) > (playing ? 0.12 : 0.025))) narration.currentTime = audioTime;
      if (playing) { if (narration.paused) narration.play().catch(() => {}); }
      else narration.pause();
    }
    $("seek").value = String(currentTime);
    $("time").textContent = `${clock(currentTime >= data.duration ? Math.ceil(data.duration) : currentTime)} / ${clock(Math.ceil(data.duration))}`;
    $("play").textContent = playing ? "Pause" : "Play";
    document.querySelectorAll("[data-act]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.act) === scene.act.id)));
  }
  function tick(now) {
    if (!playing) return;
    currentTime = Math.min(data.duration, (now - origin) / 1000);
    if (currentTime >= data.duration) playing = false;
    paint();
    if (playing) frame = requestAnimationFrame(tick);
  }
  function toggle() {
    playing = !playing;
    if (playing) {
      if (currentTime >= data.duration) currentTime = 0;
      origin = performance.now() - currentTime * 1000;
      frame = requestAnimationFrame(tick);
    } else cancelAnimationFrame(frame);
    paint(true);
  }
  function seek(time) {
    currentTime = Math.max(0, Math.min(data.duration, time));
    if (playing) origin = performance.now() - currentTime * 1000;
    paint(true);
  }
  async function fullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($("stage").requestFullscreen) await $("stage").requestFullscreen();
  }
  $("play").addEventListener("click", toggle);
  $("restart").addEventListener("click", () => seek(0));
  $("seek").addEventListener("input", (event) => seek(Number(event.target.value)));
  $("fullscreen").addEventListener("click", fullscreen);
  document.querySelectorAll("[data-time]").forEach((button) => button.addEventListener("click", () => seek(Number(button.dataset.time) + 0.4)));
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input,button,a")) return;
    if (event.code === "Space") { event.preventDefault(); toggle(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); seek(currentTime - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); seek(currentTime + 1); }
    if (event.key.toLowerCase() === "f") fullscreen();
  });
  Promise.all(ready).then(() => { $("status").textContent = `All ${data.cases.length} clips ready. Preview controls are excluded from the MP4.`; paint(true); }).catch((error) => {
    $("status").textContent = "Some clips could not be loaded.";
    $("error").hidden = false; $("error").textContent = error.message;
  });
  paint();
})();
