/* Silent Sitting — player engine.
 *
 * How timing works: every recording for the whole sitting is scheduled up front on the
 * Web Audio clock (AudioContext.currentTime). Opening clips start at 0, the closing clip
 * is placed so it ends exactly at the chosen length, and nothing plays in between.
 * Because the audio clock (not a JS timer) drives playback, it keeps time when the
 * screen is locked or the tab is in the background. The UI just reads the clock.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const AUDIO_CACHE = "sitting-audio-v1";
  const ANAPANA_LEN = 600; // in combined sittings, Anapana always lasts 10 minutes before Vipassana begins
  const MIN_SILENCE = 60; // seconds of silence required between clips
  // After the last recording: a bowl struck three times, each softer.
  const BOWLS = [{ at: 1.5, gain: 1 }, { at: 8, gain: 0.45 }, { at: 14.5, gain: 0.18 }];
  const END_LEN = 24; // seconds the closing bells take
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const fmt = s => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(r).padStart(2, "0");
  };
  const mb = b => (b / 1e6).toFixed(1) + " MB";
  const abs = f => new URL(f, location.href).href;

  const TECH = {
    A: { dev: "आनापान", hint: "Natural breath at the nostrils, as it comes in and goes out." },
    V: { dev: "विपश्यना", hint: "Sensations through the body, part by part, with equanimity." },
    AV: { dev: "आनापान → विपश्यना", hint: "Settle the mind on the breath, then move to body sensations." },
    AVM: { dev: "आनापान → विपश्यना → मैत्री", hint: "Breath, then sensations, then close with maitri for all beings." },
    FULL: { dev: "पुराने साधक · पूर्ण निर्देश", hint: "The complete recorded sitting with Goenkaji's instructions, about 45 minutes." },
  };

  const S = Object.assign({ tech: "A", min: 60, chant: true, dark: true },
    store.get("settings-v3", {}));
  let CLIPS = {};
  let P = null;

  /* ---------------- plan ---------------- */
  function plan() {
    if (S.tech === "FULL") {
      const len = CLIPS.full.duration, T = Math.round(len);
      return { T, segs: [{ type: "clip", key: "full", start: 0, len }], endStart: T, bad: false, needMin: 0, fixed: true };
    }
    const T = S.min * 60, segs = [];
    const openKey = S.tech === "V" ? "vipassanaOpen" : "anapanaOpen";
    // every sitting ends with the blessing, just before the bells
    // Every sitting ends with the blessing exactly once. The Anapana recording's own closing already is that blessing.
    const endKeys = S.tech === "A" ? ["anapanaClose"]
      : S.tech === "AVM" ? ["vipassanaClose", "metta", "mangal"] : ["vipassanaClose", "mangal"];
    const startKeys = (S.chant ? ["chant"] : []).concat(openKey);
    let t = 0;
    for (const k of startKeys) { segs.push({ type: "clip", key: k, start: t, len: CLIPS[k].duration }); t += CLIPS[k].duration; }
    const closeLen = endKeys.reduce((a, k) => a + CLIPS[k].duration, 0), closeStart = T - closeLen;
    if (S.tech === "AV" || S.tech === "AVM") {
      const m = t - CLIPS[openKey].duration + ANAPANA_LEN, vLen = CLIPS.vipassanaOpen.duration;
      segs.push({ type: "silence", start: t, len: m - t, note: "Anapana" });
      segs.push({ type: "clip", key: "vipassanaOpen", start: m, len: vLen });
      segs.push({ type: "silence", start: m + vLen, len: closeStart - m - vLen, note: "Vipassana" });
    } else {
      segs.push({ type: "silence", start: t, len: closeStart - t });
    }
    let ct = closeStart;
    for (const k of endKeys) { segs.push({ type: "clip", key: k, start: ct, len: CLIPS[k].duration }); ct += CLIPS[k].duration; }
    const clipTotal = segs.filter(s => s.type === "clip").reduce((a, s) => a + s.len, 0);
    const silences = segs.filter(s => s.type === "silence").length;
    const needSec = (S.tech === "AV" || S.tech === "AVM")
      ? (t - CLIPS[openKey].duration) + ANAPANA_LEN + CLIPS.vipassanaOpen.duration + MIN_SILENCE + closeLen
      : clipTotal + silences * MIN_SILENCE;
    const needMin = Math.ceil(needSec / 300) * 5;
    return { T, segs, endStart: closeStart, bad: segs.some(s => s.type === "silence" && s.len < MIN_SILENCE), needMin };
  }
  const neededKeys = () => [...new Set(P.segs.filter(s => s.type === "clip").map(s => s.key))];

  /* ---------------- ring ---------------- */
  const R = 124, C = 2 * Math.PI * R;
  function buildTicks() {
    let h = "";
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * 2 * Math.PI - Math.PI / 2, r1 = i % 5 ? 142 : 137, r2 = 146;
      h += `<line class="tick" x1="${150 + r1 * Math.cos(a)}" y1="${150 + r1 * Math.sin(a)}" x2="${150 + r2 * Math.cos(a)}" y2="${150 + r2 * Math.sin(a)}" stroke-width="${i % 5 ? 1 : 1.6}"/>`;
    }
    $("ticks").innerHTML = h;
    $("prog").setAttribute("stroke-dasharray", C);
  }
  function buildArcs() {
    $("arcs").innerHTML = P.bad ? "" : P.segs.filter(s => s.type === "clip").map(s =>
      `<circle class="arc" cx="150" cy="150" r="${R}" stroke-dasharray="${Math.max(3, C * s.len / P.T)} ${C}" stroke-dashoffset="${-C * s.start / P.T}" transform="rotate(-90 150 150)"/>`).join("");
  }
  function drawRing(f) {
    const a = f * 2 * Math.PI - Math.PI / 2;
    $("prog").setAttribute("stroke-dashoffset", C * (1 - f));
    $("dot").setAttribute("cx", 150 + R * Math.cos(a));
    $("dot").setAttribute("cy", 150 + R * Math.sin(a));
  }

  /* ---------------- audio ---------------- */
  let ctx = null, keepAlive = null, sources = [], t0 = 0;
  const buffers = new Map();
  let running = false, paused = false, raf = 0, wake = null;

  function getCtx() {
    if (ctx) return ctx;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC({ sampleRate: 24000, latencyHint: "playback" }); } catch (e) { ctx = new AC(); }
    ctx.onstatechange = () => {
      if (!running) return;
      if (ctx.state !== "running" && !paused) { paused = true; showPaused(); }
    };
    return ctx;
  }
  async function getResponse(url) {
    if ("caches" in window) {
      try { const hit = await caches.match(url); if (hit) return hit; } catch (e) {}
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status + " " + url);
    return r;
  }
  function decode(ab) {
    return new Promise((ok, no) => {
      const p = ctx.decodeAudioData(ab, ok, no);
      if (p && p.then) p.then(ok, no);
    });
  }
  async function loadBuffer(key) {
    if (buffers.has(key)) return buffers.get(key);
    const ab = await (await getResponse(abs(CLIPS[key].file))).arrayBuffer();
    const buf = await decode(ab);
    buffers.set(key, buf);
    CLIPS[key].duration = buf.duration; // trust the real file over clips.json
    return buf;
  }
  /* Long recordings (the 45-minute full instructions) stream through an audio element instead of being
     decoded into memory, which would need about 260 MB on a phone. The file comes from the saved copy
     as a blob, so it plays offline and seeks on every phone. */
  let media = null, mediaKey = null, mediaURL = null, endAt = null;
  async function loadMedia(key) {
    if (mediaKey === key && media) return media;
    const blob = await (await getResponse(abs(CLIPS[key].file))).blob();
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    mediaURL = URL.createObjectURL(blob);
    if (!media) {
      media = new Audio(); media.preload = "auto";
      media.addEventListener("ended", () => {
        if (!running || !P.fixed) return;
        endAt = ctx.currentTime; // the bells ring after the recording ends
        BOWLS.forEach(b => bowl(endAt + b.at, b.gain));
      });
      media.addEventListener("pause", () => { // paused by the phone (a call, headphones unplugged)
        if (running && P.fixed && !paused && !media.ended && !seekingMedia) { paused = true; showPaused(); }
      });
    }
    media.src = mediaURL; mediaKey = key;
    await new Promise((ok, no) => { media.onloadedmetadata = ok; media.onerror = () => no(new Error("media")); media.load(); });
    CLIPS[key].duration = media.duration;
    return media;
  }
  let seekingMedia = false;
  const loadClip = k => CLIPS[k].stream ? loadMedia(k) : loadBuffer(k);
  function stopSources() { sources.forEach(s => { try { s.stop(); } catch (e) {} }); sources = []; }
  function schedule(from) {
    stopSources();
    if (P.fixed) {
      endAt = null;
      seekingMedia = true; media.currentTime = Math.min(from, media.duration - 0.05);
      media.play().catch(() => {}).finally(() => { seekingMedia = false; });
      if (from >= P.T - 0.05) { endAt = ctx.currentTime; BOWLS.forEach(b => bowl(endAt + b.at, b.gain)); }
      return;
    }
    if (media) media.pause();
    const now = ctx.currentTime + 0.08;
    t0 = now - from;
    for (const s of P.segs) {
      if (s.type !== "clip" || s.start + s.len <= from) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffers.get(s.key);
      src.connect(ctx.destination);
      const offset = Math.max(0, from - s.start);
      src.start(t0 + s.start + offset, offset);
      sources.push(src);
    }
    const end = t0 + P.T;
    BOWLS.forEach(b => { if (end + b.at >= now) bowl(end + b.at, b.gain); });
  }
  /* closing sounds, synthesised so they need no files */
  function bowl(when, level) {
    // a singing-bowl tone: inharmonic partials, each pair slightly detuned so it shimmers as it fades
    const out = ctx.createGain(); out.gain.value = 0.32 * level; out.connect(ctx.destination);
    [[1, 1, 9], [2.71, 0.42, 6.5], [5.15, 0.2, 4], [8.2, 0.08, 2.5]].forEach(([ratio, amp, decay]) => {
      [0, 1.6].forEach(detune => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = 196 * ratio + detune * ratio;
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(amp / 2, when + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
        o.connect(g).connect(out); o.start(when); o.stop(when + decay + 0.1);
        sources.push(o);
      });
    });
  }
  const elapsed = () => !running ? startAt
    : P.fixed ? (endAt !== null ? Math.min(P.T + END_LEN, P.T + ctx.currentTime - endAt) : media.currentTime)
    : Math.min(P.T + END_LEN, Math.max(0, ctx.currentTime - t0));
  let startAt = 0, seeking = false;

  async function begin() {
    if (P.bad) return;
    const c = getCtx();
    c.resume(); // must be called inside the tap on iPhone
    $("play").classList.add("busy"); $("play").disabled = true; $("playLabel").textContent = "Preparing";
    $("next").textContent = "Preparing the recordings…";
    try {
      for (const k of neededKeys()) await loadClip(k);
    } catch (e) {
      $("play").classList.remove("busy"); $("play").disabled = false; $("playLabel").textContent = "Begin";
      $("next").textContent = noSiteAudio ? "The recordings aren't on this site, so there is nothing to play yet."
        : neededKeys().some(k => missing.has(k)) ? "This recording isn't on the site yet. Pick another option for now."
        : navigator.onLine ? "Couldn't load the recordings. Tap the badge above to try saving them again."
        : "The recordings aren't saved on this device yet. Open the app once with internet.";
      return;
    }
    P = plan(); buildArcs(); renderPlan();
    if (P.bad) { $("play").classList.remove("busy"); render(); return; }
    await c.resume();
    try { keepAlive = c.createConstantSource(); keepAlive.offset.value = 0; keepAlive.connect(c.destination); keepAlive.start(); } catch (e) {}
    running = true; paused = false;
    schedule(Math.min(startAt, P.T - 1));
    document.body.classList.add("sitting"); document.body.classList.remove("paused");
    $("play").classList.remove("busy"); $("play").disabled = false;
    setPlayIcon(true); $("playLabel").textContent = "Pause"; $("end").disabled = false;
    requestWake(); setupMediaSession();
    loop();
  }
  async function pause() {
    paused = true; if (media) media.pause(); await ctx.suspend(); showPaused();
  }
  function showPaused() {
    cancelAnimationFrame(raf); setPlayIcon(false); $("playLabel").textContent = "Resume";
    document.body.classList.add("paused"); releaseWake(); draw();
    try { navigator.mediaSession.playbackState = "paused"; } catch (e) {}
  }
  async function resume() {
    await ctx.resume(); paused = false;
    if (P.fixed && endAt === null) { seekingMedia = true; media.play().catch(() => {}).finally(() => { seekingMedia = false; }); } document.body.classList.remove("paused");
    setPlayIcon(true); $("playLabel").textContent = "Pause"; requestWake();
    try { navigator.mediaSession.playbackState = "playing"; } catch (e) {}
    loop();
  }
  function toggle() { if (!running) begin(); else if (paused) resume(); else pause(); }
  function skip() {
    if (!running) return;
    const e = elapsed(), nx = P.segs.find(s => s.type === "clip" && s.start > e + 1);
    if (!nx || e >= P.T) return;
    if (paused) { ctx.resume().then(() => { paused = false; document.body.classList.remove("paused"); setPlayIcon(true); $("playLabel").textContent = "Pause"; schedule(Math.max(e, nx.start - 2)); loop(); }); }
    else { schedule(Math.max(e, nx.start - 2)); }
  }
  function finish(done) {
    cancelAnimationFrame(raf);
    stopSources(); endAt = null;
    if (media) { seekingMedia = true; media.pause(); seekingMedia = false; }
    try { keepAlive && keepAlive.stop(); } catch (e) {} keepAlive = null;
    running = false; paused = false; startAt = 0;
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
    document.body.classList.remove("sitting", "paused");
    setPlayIcon(false); $("playLabel").textContent = "Begin"; $("end").disabled = true; $("skip").disabled = true;
    releaseWake();
    try { navigator.mediaSession.playbackState = "none"; } catch (e) {}
    render();
    $("next").textContent = done ? "Sitting complete. भवतु सब्ब मङ्गलं" : "Sitting ended early.";
    if (done) drawRing(1);
  }
  function loop() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!running || paused) return;
      if (elapsed() >= P.T + END_LEN - 0.05) { finish(true); return; }
      draw(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* ---------------- screen + lock-screen controls ---------------- */
  async function requestWake() {
    try { if ("wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {}
  }
  function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${TECH[S.tech].dev} · ${Math.floor(P.T / 60)} min`, artist: "Vipassana",
        artwork: [{ src: abs("icons/icon-512.png"), sizes: "512x512", type: "image/png" }],
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("play", () => paused && resume());
      navigator.mediaSession.setActionHandler("pause", () => running && !paused && pause());
      navigator.mediaSession.setActionHandler("stop", () => running && finish(false));
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !running) return;
    if (!paused) { requestWake(); loop(); }
    draw();
  });

  /* ---------------- UI ---------------- */
  function setPlayIcon(playing) {
    $("playIcon").innerHTML = playing
      ? '<rect x="7" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2"/>'
      : '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/>';
    $("play").setAttribute("aria-label", playing ? "Pause" : running ? "Resume" : "Begin sitting");
  }
  const segName = s => s.type === "clip" ? CLIPS[s.key].title : "Silence" + (s.note ? " · " + s.note : "");
  let lastPos = -1;
  function draw() {
    const e = elapsed(), f = Math.min(1, e / P.T), bells = running && e >= P.T;
    const i = P.segs.findIndex(s => e >= s.start && e < s.start + s.len), cur = P.segs[i];
    drawRing(f);
    $("time").textContent = fmt(P.T - Math.min(e, P.T));
    const live = running && !paused && cur && cur.type === "clip";
    $("state").className = "state" + (live || (bells && !paused) ? " live" : running ? " plain" : "");
    $("stateText").textContent = !running ? TECH[S.tech].dev : paused ? "Paused" : bells ? "Closing bells" : live ? CLIPS[cur.key].title : "Silent sitting";
    $("sub").textContent = running || e > 0 ? `${fmt(Math.min(e, P.T))} of ${fmt(P.T)}` : `${S.min} minute sitting`;
    if (!seeking) { $("seek").value = Math.min(e, P.T); paintSeek(); }
    $("miniTimer").hidden = !(running && section !== "timer");
    if (running && section !== "timer") $("miniTime").textContent = paused ? "Paused" : fmt(P.T - Math.min(e, P.T));
    if (running) {
      const nx = P.segs.find(s => s.type === "clip" && s.start > e + 1);
      $("next").innerHTML = bells ? "Sitting complete. भवतु सब्ब मङ्गलं"
        : nx ? `Next: <b>${CLIPS[nx.key].title}</b> in ${fmt(nx.start - e)}`
        : live && P.fixed ? "Goenkaji's full instructions. Sit with the recording."
        : live ? "Closing. Sit until it ends." : "Closing comes next.";
      $("skip").disabled = !nx || bells;
      document.querySelectorAll("#plan li").forEach(li => li.classList.toggle("now", +li.dataset.i === i));
      const sec = Math.floor(e);
      if (sec !== lastPos && sec % 5 === 0) {
        lastPos = sec;
        try { navigator.mediaSession.setPositionState({ duration: P.T, position: Math.min(e, P.T), playbackRate: 1 }); } catch (err) {}
      }
    }
  }
  /* timeline slider: drag to any point; works before starting and during a sitting */
  function paintSeek() {
    const el = $("seek"), T = P.T, pct = v => (v / T * 100).toFixed(3) + "%";
    const stops = [];
    P.segs.filter(s => s.type === "clip").forEach(s => {
      stops.push(`transparent ${pct(s.start)}`, `var(--accent) ${pct(s.start)}`, `var(--accent) ${pct(s.start + s.len)}`, `transparent ${pct(s.start + s.len)}`);
    });
    el.style.setProperty("--clips", `linear-gradient(90deg, ${stops.join(", ")})`);
    el.style.setProperty("--fill", pct(+el.value));
    $("seekAt").textContent = fmt(+el.value);
    $("seekEnd").textContent = fmt(T);
  }
  function seekTo(sec) {
    sec = Math.max(0, Math.min(P.T - 1, sec));
    if (!running) { startAt = sec; draw(); return; }
    schedule(sec);
    if (!paused) loop();
    draw();
  }
  function renderPlan() {
    $("plan").innerHTML = P.bad ? "" : P.segs.map((s, i) =>
      `<li data-i="${i}" class="${s.type}"><span class="t">${fmt(s.start)}</span><span class="pd"></span><span>${segName(s)}</span><span class="l">${fmt(s.len)}</span></li>`).join("");
  }
  function render() {
    store.set("settings-v3", S);
    const np = plan();
    // During a sitting, a change that doesn't fit keeps the current plan and shows why.
    const apply = !running || !np.bad, changed = running && apply;
    if (apply) P = np;
    $("tech").value = S.tech;
    $("techhint").innerHTML = `<b>${TECH[S.tech].dev}</b>${TECH[S.tech].hint}`;
    const fixed = !!np.fixed;
    document.querySelectorAll("#chips .chip").forEach(c => c.setAttribute("aria-pressed", !fixed && +c.dataset.min === S.min));
    document.querySelectorAll("#chips button").forEach(b => b.disabled = fixed);
    $("chips").classList.toggle("fixed", fixed);
    $("mins").textContent = (fixed ? Math.floor(np.T / 60) : S.min) + " min";
    $("fixedNote").hidden = !fixed;
    $("chant").checked = S.chant && !fixed; $("chant").disabled = fixed;
    $("chantRow").classList.toggle("off", fixed);
    showSelected();
    $("chantLen").textContent = `Opening chanting, ${fmt(CLIPS.chant.duration)}, before the instructions`;
    $("warn").hidden = !np.bad;
    $("warn").textContent = np.bad ? `This combination needs at least ${np.needMin} minutes.${running ? " The current sitting carries on unchanged." : ""}` : "";
    $("play").disabled = P.bad && !running;
    $("seek").max = Math.round(P.T); if (startAt > P.T - 1) startAt = 0;
    buildArcs(); renderPlan();
    if (!running) { draw(); $("next").textContent = P.bad ? "" : "Press Begin. Instructions play first, then silence."; }
    if (changed) applyMidSitting();
  }
  /* Settings changed during a sitting: keep the current position and rebuild the plan around it. */
  let applying = 0;
  async function applyMidSitting() {
    const ticket = ++applying, pos = elapsed();
    try { for (const k of neededKeys()) await loadClip(k); } catch (e) { return; }
    if (ticket !== applying || !running) return;
    P = plan(); buildArcs(); renderPlan(); $("seek").max = Math.round(P.T);
    schedule(Math.min(pos, P.endStart)); // a shorter sitting that has already passed its silence goes straight to the closing
    setupMediaSession();
    if (!paused) loop();
    draw();
  }
  function setTheme(dark) {
    S.dark = dark; store.set("settings-v3", S);
    document.documentElement.classList.toggle("dark", dark);
    $("thDark").setAttribute("aria-pressed", dark); $("thLight").setAttribute("aria-pressed", !dark);
    $("themeColor").setAttribute("content", dark ? "#111513" : "#EDEFEA");
    if (typeof learnLoaded !== "undefined" && learnLoaded) postSection(section);
  }

  /* The chosen technique, shown over the dropdown; a name too long for the box scrolls slowly. */
  function showSelected() {
    const box = $("selval"), opt = $("tech").selectedOptions[0];
    if (!box || !opt) return;
    const t = opt.textContent;
    box.classList.remove("marq");
    box.innerHTML = `<span class="selin"><span></span></span>`;
    box.querySelector(".selin span").textContent = t;
    requestAnimationFrame(() => {
      const inner = box.querySelector(".selin");
      if (inner.scrollWidth <= box.clientWidth + 1) return;
      inner.innerHTML = "<span></span><span aria-hidden=\"true\"></span>";
      inner.querySelectorAll("span").forEach(sp => sp.textContent = t);
      box.style.setProperty("--dur", Math.max(8, inner.scrollWidth / 2 / 28) + "s"); // about 28px a second
      box.classList.add("marq");
    });
  }
  window.addEventListener("resize", () => showSelected());

  /* ---------------- offline audio ----------------
   The recordings save themselves into the browser on the first online visit. Progress and
   status show in the small badge on the player; tapping the badge retries if a save failed. */
  let noSiteAudio = false, saving = false;
  const missing = new Set(); // clips not on the site (for example a recording not uploaded yet)
  const allFiles = () => Object.values(CLIPS);
  const totalBytes = () => allFiles().reduce((a, c) => a + c.bytes, 0);
  async function savedStatus() {
    if (!("caches" in window)) return null;
    const cache = await caches.open(AUDIO_CACHE);
    const out = {};
    for (const [k, c] of Object.entries(CLIPS)) {
      if (missing.has(k)) continue;
      const hit = await cache.match(abs(c.file));
      out[k] = !!hit && +(hit.headers.get("X-Clip-Bytes") || 0) === c.bytes;
    }
    return out;
  }
  function badge(text, ok, act) {
    $("offbadgeText").textContent = text;
    $("offbadge").classList.toggle("ok", !!ok);
    $("offbadge").classList.toggle("act", !!act);
  }
  async function renderOffline() {
    if (window.__STANDALONE) { badge("Works offline", true); return; }
    if (saving) return;
    const st = await savedStatus().catch(() => null);
    const all = st && Object.values(st).every(Boolean);
    if (!st) badge("Online only");
    else if (all) badge("Works offline", true);
    else if (noSiteAudio) badge("Audio not on site");
    else if (!navigator.onLine) badge("Connect once to save audio");
    else badge("Save for offline", false, true);
  }
  async function download() {
    if (saving || !("caches" in window)) return;
    saving = true;
    const total = totalBytes(); let got = 0;
    const show = () => badge(`Saving audio ${Math.min(99, Math.round(got / total * 100))}%`);
    show();
    try {
      try { await navigator.storage?.persist?.(); } catch (e) {}
      const cache = await caches.open(AUDIO_CACHE);
      const have = await savedStatus().catch(() => ({})) || {};
      for (const [k, c] of Object.entries(CLIPS)) {
        if (have[k]) { got += c.bytes; show(); continue; } // already saved on this phone
        const res = await fetch(abs(c.file), { cache: "reload" });
        if (res.status === 404) { missing.add(k); got += c.bytes; show(); continue; }
        if (!res.ok) throw new Error(res.status);
        const chunks = [];
        if (res.body && res.body.getReader) {
          const reader = res.body.getReader();
          for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; show(); }
        } else { const buf = await res.arrayBuffer(); chunks.push(new Uint8Array(buf)); got += buf.byteLength; show(); }
        const blob = new Blob(chunks, { type: "audio/mpeg" });
        await cache.put(abs(c.file), new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size), "X-Clip-Bytes": String(c.bytes) } }));
      }
    } catch (e) {}
    noSiteAudio = missing.size === Object.keys(CLIPS).length;
    saving = false;
    await renderOffline();
  }
  // Save the recordings in the background whenever some are missing and the phone is online.
  async function autoDownload() {
    if (!("caches" in window) || !navigator.onLine) return;
    const st = await savedStatus().catch(() => null);
    if (st && !Object.values(st).every(Boolean)) download();
  }

  /* ---------------- menu and the learn view ---------------- */
  const SECTIONS = { concept: "Concept", vp: "Vipassana", hi: "History", gu: "Gurus", tt: "Timetable", fe: "Fees & centres" };
  let section = "timer", learnLoaded = false;
  function drawer(open) {
    const d = $("drawer"), sc = $("scrim");
    $("menuBtn").setAttribute("aria-expanded", open);
    if (open) {
      d.hidden = sc.hidden = false;
      requestAnimationFrame(() => { d.classList.add("on"); sc.classList.add("on"); });
      setTimeout(() => d.querySelector('[aria-current="page"]')?.focus(), 60);
    } else {
      d.classList.remove("on"); sc.classList.remove("on");
      setTimeout(() => { if (!d.classList.contains("on")) d.hidden = sc.hidden = true; }, 300);
    }
  }
  function postSection(k) { try { $("learnFrame").contentWindow.postMessage({ learnSection: k, learnTheme: S.dark ? "dark" : "light" }, "*"); } catch (e) {} }
  function showSection(k, fromHistory) {
    drawer(false);
    const wasTimer = section === "timer";
    section = k in SECTIONS ? k : "timer";
    document.querySelectorAll(".navitem").forEach(b => b.setAttribute("aria-current", b.dataset.go === section ? "page" : "false"));
    if (section === "timer") {
      $("learn").hidden = true; document.body.classList.remove("learning", "learnfull");
      if (!fromHistory && history.state && history.state.learn) history.back();
      draw(); return;
    }
    $("learnTitle").textContent = SECTIONS[section];
    $("learn").hidden = false; document.body.classList.add("learning");
    if (!fromHistory && wasTimer) { try { history.pushState({ learn: true }, ""); } catch (e) {} }
    const fr = $("learnFrame");
    if (!learnLoaded) {
      learnLoaded = true;
      fr.addEventListener("load", () => postSection(section));
      if (window.__LEARN_HTML) fr.srcdoc = window.__LEARN_HTML; // single-file test copy
      else fr.src = "learn.html" + (S.dark ? "?theme=dark" : "") + "#" + section;
    } else postSection(section);
    draw();
  }
  window.addEventListener("popstate", () => { if (section !== "timer") showSection("timer", true); });
  // the concept page asks for these: hide the top bar while it is turned sideways, and its own menu/close buttons
  window.addEventListener("message", e => {
    if (e.source !== $("learnFrame").contentWindow || !e.data) return;
    if ("learnFull" in e.data) document.body.classList.toggle("learnfull", !!e.data.learnFull);
    if (e.data.learnAction === "menu") drawer(true);
    if (e.data.learnAction === "close") showSection("timer");
  });

  /* ---------------- install as an app ----------------
   A banner under the header and an item in the menu. Android Chrome gets a real Install button;
   iPhone, in-app browsers (WhatsApp, Instagram…) and other browsers get the right instructions. */
  let installEvt = null;
  const UA = navigator.userAgent;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(UA);
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|; wv\)|GSA\//.test(UA);
  function installHelp() {
    if (installEvt) return { text: "Install Vipassana on this phone. It opens like an app and works offline.", action: "Install" };
    if (inApp) return { text: "To install, open this page in " + (isIOS ? "Safari" : "Chrome") + ": tap ⋮ or the share icon, then “Open in browser”.", action: "Copy link" };
    if (isIOS) return { text: "To install: tap the Share button, then “Add to Home Screen”." };
    if (isAndroid) return { text: "To install: open the browser menu ⋮ and tap “Install app” or “Add to Home screen”." };
    return null;
  }
  function renderInstall() {
    const box = $("installBar"), h = installHelp();
    const show = h && !standalone() && !store.get("installDismissed", false);
    box.hidden = !show;
    $("installNav").hidden = !h || standalone();
    if (!show) return;
    $("installText").textContent = h.text;
    $("installGo").hidden = !h.action; $("installGo").textContent = h.action || "";
  }
  async function doInstall() {
    if (installEvt) {
      installEvt.prompt();
      const r = await installEvt.userChoice.catch(() => null);
      installEvt = null;
      if (r && r.outcome === "accepted") store.set("installDismissed", true);
      renderInstall(); return;
    }
    if (inApp) {
      try { await navigator.clipboard.writeText(location.href); $("installText").textContent = "Link copied. Paste it into " + (isIOS ? "Safari" : "Chrome") + " to install."; }
      catch (e) { $("installText").textContent = location.href; }
    }
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; store.set("installDismissed", false); renderInstall(); });
  window.addEventListener("appinstalled", () => { installEvt = null; store.set("installDismissed", true); renderInstall(); });

  /* ---------------- wiring ---------------- */
  function wire() {
    $("thLight").onclick = () => setTheme(false);
    $("thDark").onclick = () => setTheme(true);
    $("tech").onchange = e => { S.tech = e.target.value; render(); };
    document.querySelectorAll("#chips .chip").forEach(c => c.onclick = () => { S.min = +c.dataset.min; render(); });
    $("minus").onclick = () => { S.min = Math.max(10, S.min - 5); render(); };
    $("plus").onclick = () => { S.min = Math.min(180, S.min + 5); render(); };
    $("chant").onchange = e => { S.chant = e.target.checked; render(); };
    $("play").onclick = toggle;
    $("end").onclick = () => finish(false);
    $("skip").onclick = skip;
    $("menuBtn").onclick = () => drawer(true);
    $("learnMenu").onclick = () => drawer(true);
    $("drawerClose").onclick = () => drawer(false);
    $("scrim").onclick = () => drawer(false);
    $("learnClose").onclick = () => showSection("timer");
    $("miniTimer").onclick = () => showSection("timer");
    document.querySelectorAll(".navitem").forEach(b => b.onclick = () => showSection(b.dataset.go));
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (!$("drawer").hidden) drawer(false); else if (section !== "timer") showSection("timer");
    });
    const sk = $("seek");
    sk.addEventListener("input", () => { seeking = true; paintSeek(); $("time").textContent = fmt(P.T - +sk.value); });
    sk.addEventListener("change", () => { seeking = false; seekTo(+sk.value); });
    sk.addEventListener("pointerup", () => { if (seeking) { seeking = false; seekTo(+sk.value); } });
    $("installGo").onclick = doInstall;
    $("installX").onclick = () => { store.set("installDismissed", true); renderInstall(); };
    $("installNav").onclick = () => { drawer(false); store.set("installDismissed", false); renderInstall();
      if (installEvt) doInstall(); else $("installBar").scrollIntoView({ block: "center" }); };
    $("offbadge").onclick = () => { if ($("offbadge").classList.contains("act")) download(); };
    window.addEventListener("online", renderOffline);
    window.addEventListener("offline", renderOffline);
    document.addEventListener("keydown", e => {
      if (e.code === "Space" && section === "timer" && !/SELECT|INPUT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); }
    });
  }

  async function init() {
    setTheme(!!S.dark);
    buildTicks();
    let res; // network first so new cut points arrive; cached copy when offline
    try { res = await fetch(abs("clips.json"), { cache: "no-cache" }); if (!res.ok) throw 0; }
    catch (e) { res = await caches.match(abs("clips.json")); if (!res) throw new Error("clips.json is missing"); }
    CLIPS = (await res.json()).clips;
    wire(); render(); renderInstall(); await renderOffline();
    autoDownload();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }
  // If startup fails (for example a half-updated copy on the phone), clear the saved app files and
  // reload once from the site. The saved recordings are kept.
  init().catch(async err => {
    let healed = false; try { healed = sessionStorage.getItem("healed") === "1"; } catch (e) {}
    if (!healed && location.protocol !== "file:") {
      try { sessionStorage.setItem("healed", "1"); } catch (e) {}
      try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) {}
      try { for (const k of await caches.keys()) if (k.startsWith("sitting-shell-")) await caches.delete(k); } catch (e) {}
      location.reload(); return;
    }
    $("next").textContent = "The app couldn't start: " + err.message;
    badge("Error");
  });

  // exposed for tests only
  window.__sitting = { plan: () => plan(), S, setClips: c => { CLIPS = c; } };
})();
