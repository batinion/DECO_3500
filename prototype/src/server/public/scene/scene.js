// Launch Sequence — the shared live scene.
//
// One module, rendered everywhere: Mission Control ("/", role "mc", interactive) and every
// participant's background layer ("/scene?role=participant", non-interactive). It owns no
// state of its own: the server sends a `scene_state` snapshot (on connect and on every phase
// change) and every frame is derived from (phase, elapsed since phaseStartedAt) on a
// server-synced clock — so all screens stay in step and a reloaded screen lands mid-scene.
(function () {
  const role = document.body.dataset.role === "mc" ? "mc" : "participant";
  const isMc = role === "mc";
  const root = document.getElementById("scene-root");
  root.classList.add(`role-${role}`);

  // ---- DOM ------------------------------------------------------------------
  root.innerHTML = `
    <canvas id="sky"></canvas>
    <div id="atmo"></div>
    <div id="moon"><i class="crater c1"></i><i class="crater c2"></i><i class="crater c3"></i><i class="crater c4"></i></div>
    <div id="earth-wrap"><div id="earth">🌍</div><div id="earth-hint">Click Earth to reopen the capsule</div></div>
    <div id="ground"><div id="pad"></div></div>
    <div id="rocket">
      <div class="rocket-body"><div class="rocket-window"></div></div>
      <div class="rocket-fin fin-left"></div>
      <div class="rocket-fin fin-right"></div>
      <div id="engines">
        <div class="engine" data-slot="1"><div class="flame"></div></div>
        <div class="engine" data-slot="2"><div class="flame"></div></div>
        <div class="engine" data-slot="3"><div class="flame"></div></div>
        <div class="engine" data-slot="4"><div class="flame"></div></div>
      </div>
    </div>
    <div id="join-panel">
      <img id="qr-image" alt="Join QR code" />
      <div class="label">JOIN CODE</div>
      <div id="join-code">------</div>
      <div id="join-manual">IP <span id="join-ip">-</span> · Port <span id="join-port">-</span></div>
    </div>
    <div id="txt-cooking" class="scene-text">Cooking the space!</div>
    <div id="txt-years" class="scene-text"><div class="clock-icon">🕐</div><div>3 years have passed</div></div>
    <div id="txt-puzzle" class="scene-text">Puzzle sent to your crew's devices — solve it together and upload the answer.</div>
    <div id="txt-advance" class="scene-text">click anywhere to continue</div>
    <div id="reveal-overlay" class="hidden"><h2>MISSION KEYS ASSIGNED</h2><div id="reveal-grid"></div></div>
    <div id="capsule-overlay" class="hidden"><h2>THE CAPSULE IS OPEN</h2><div id="capsule-grid"></div></div>
  `;
  const $ = (id) => document.getElementById(id);
  const el = {
    sky: $("sky"), atmo: $("atmo"), moon: $("moon"), earthWrap: $("earth-wrap"), earth: $("earth"),
    ground: $("ground"), pad: $("pad"), rocket: $("rocket"),
    txtCooking: $("txt-cooking"), txtYears: $("txt-years"),
    txtPuzzle: $("txt-puzzle"), txtAdvance: $("txt-advance"),
    revealOverlay: $("reveal-overlay"), revealGrid: $("reveal-grid"),
    capsuleOverlay: $("capsule-overlay"), capsuleGrid: $("capsule-grid"),
    qr: $("qr-image"), joinCode: $("join-code"), joinIp: $("join-ip"), joinPort: $("join-port"),
  };
  const engines = [1, 2, 3, 4].map((n) => root.querySelector(`.engine[data-slot="${n}"]`));

  // ---- Socket + clock -------------------------------------------------------
  const socket = io({ query: { role } });
  let st = null; // latest scene_state snapshot
  let clockOffset = 0; // server ms - local ms
  const serverNow = () => Date.now() + clockOffset;
  const listeners = [];

  async function syncClock() {
    let best = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const sNow = await new Promise((res) => socket.emit("time_sync", res));
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (!best || rtt < best.rtt) best = { rtt, offset: sNow - (t0 + rtt / 2) };
    }
    clockOffset = best.offset;
  }
  socket.on("connect", syncClock);

  socket.on("scene_state", (next) => {
    const first = !st;
    if (first) clockOffset = next.serverNow - Date.now(); // rough until the ping sync lands
    const prevPhase = st && st.phase;
    st = next;
    applyState(prevPhase);
    listeners.forEach((fn) => fn(st));
  });

  // ---- State -> DOM (event driven; per-frame stuff lives in render) ------------
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderReveal(list) {
    el.revealGrid.innerHTML = (list || [])
      .map(
        (p) => `<div class="reveal-card"><div class="name">${esc(p.name)}</div><div class="reveal-swatches">${(p.colors || [])
          .map((c) => `<div><div class="reveal-swatch" style="background:${c.hex}"></div><div class="reveal-swatch-label">${esc(c.name)}</div></div>`)
          .join("")}</div></div>`
      )
      .join("");
  }

  function renderCapsule(list) {
    el.capsuleGrid.innerHTML = (list || [])
      .map((p) => {
        const entries = (p.entries || [])
          .map((e) => `<div class="capsule-entry"><div class="capsule-prompt">${esc(e.prompt)}</div><div class="capsule-value">${e.value ? esc(e.value) : "— no answer —"}</div></div>`)
          .join("");
        const media = [p.drawing ? `<img src="${esc(p.drawing)}" alt="drawing" />` : "", ...(p.uploadedImages || []).map((u) => `<img src="${esc(u)}" alt="photo" />`)].filter(Boolean);
        return `<div class="capsule-card">
          <div class="capsule-name">${esc(p.name)}</div>
          <div class="capsule-colors">${(p.colors || []).map((c) => `<div class="capsule-swatch" style="background:${c.hex}"></div>`).join("")}</div>
          ${entries}
          <div class="capsule-media-section"><div class="capsule-media-label">Photos</div>
          ${media.length ? `<div class="capsule-media">${media.join("")}</div>` : `<div class="capsule-media-empty">No photos added</div>`}</div>
        </div>`;
      })
      .join("");
  }

  let renderedKey = "";
  function applyState(prevPhase) {
    el.qr.src = st.join.qrDataUrl || "";
    el.joinCode.textContent = st.code;
    el.joinIp.textContent = st.join.ip;
    el.joinPort.textContent = st.join.port;
    root.classList.toggle("joining", st.phase === "joining");

    engines.forEach((e, i) => e.classList.toggle("lit", st.litEngines.includes(i + 1)));
    root.classList.toggle("boost", st.phase === "launching");

    if (isMc) {
      // Only rebuild the heavy overlays when their data actually changes.
      const key = st.phase + "|" + JSON.stringify(st.reveal) + "|" + (st.capsule ? st.capsule.length : 0);
      if (key !== renderedKey) {
        renderedKey = key;
        renderReveal(st.reveal);
        renderCapsule(st.capsule);
      }
      el.capsuleOverlay.classList.toggle("hidden", st.phase !== "revealed");
    }

    const tj = st.phase === "timejump";
    el.txtCooking.classList.toggle("show", tj && st.timeJumpStep === 1);
    el.txtYears.classList.toggle("show", tj && st.timeJumpStep === 2);
    el.txtPuzzle.classList.toggle("show", st.phase === "puzzle");
    if (prevPhase !== st.phase) lastDraw = 0; // repaint immediately on phase change
  }

  // ---- Interaction (Mission Control only) -----------------------------------
  if (isMc) {
    root.addEventListener("click", () => {
      if (st && st.phase === "timejump" && st.timeJumpStep >= 1) socket.emit("advance_scene");
    });
    el.earth.addEventListener("click", (e) => {
      if (!earthReady) return;
      e.stopPropagation();
      socket.emit("start_puzzle");
    });
  }

  // ---- Starfield (canvas, parallax) -----------------------------------------
  // Background stars are deliberately small, white and low-alpha so they never read as the
  // coloured, glowing Memory Stars the participant app draws on top.
  const ctx = el.sky.getContext("2d");
  const STAR_COUNT = isMc ? 240 : 90;
  const LAYERS = [{ speed: 30, size: 0.7, alpha: 0.35 }, { speed: 80, size: 1.1, alpha: 0.5 }, { speed: 170, size: 1.7, alpha: 0.7 }];
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    x: Math.random(), y: Math.random(), l: i % 3, tw: Math.random() * 6.28,
  }));
  // Rocket flies up-right toward the moon, so the stars stream down-left past it.
  const FLOW = { x: -0.42, y: 0.91 };

  let W = 0, H = 0, dpr = 1, narrow = false, unit = 1, groundY = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, isMc ? 2 : 1);
    el.sky.width = W * dpr; el.sky.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    narrow = !isMc && W < 640;
    unit = Math.max(0.5, Math.min(1.15, Math.min(W / 900, H / 700))) * (isMc ? 1 : 0.8);
    groundY = H * (narrow ? 0.46 : 0.86); // phones: bottom sheet covers the lower half
    el.ground.style.top = groundY + "px";
    el.pad.style.left = padX() + "px";
    el.pad.style.width = 150 * unit + "px";
    el.rocket.style.setProperty("--u", unit);
  }
  window.addEventListener("resize", resize);

  function drawSky(dt, warp, now) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    for (const s of stars) {
      const L = LAYERS[s.l];
      const v = L.speed * warp * dt;
      s.x += (FLOW.x * v) / W; s.y += (FLOW.y * v) / H;
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
      if (s.x < 0) s.x += 1;
      const px = s.x * W, py = s.y * H;
      const tw = 0.75 + 0.25 * Math.sin(now / 900 + s.tw);
      ctx.fillStyle = ctx.strokeStyle = `rgba(255,255,255,${(L.alpha * tw).toFixed(3)})`;
      const len = L.speed * warp * 0.045;
      if (len > 1.5) {
        ctx.lineWidth = L.size;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - FLOW.x * len, py - FLOW.y * len); ctx.stroke();
      } else {
        ctx.fillRect(px, py, L.size, L.size);
      }
    }
  }

  // ---- Per-frame pose --------------------------------------------------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIn = (t) => t * t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const MOON_D = 200; // px, moon element diameter at scale 1
  const ROCKET_H = 180; // px, rocket box height (engines included, flames hang below)
  const ROCKET_W = 70;

  const padX = () => W * (isMc ? 0.5 : narrow ? 0.5 : 0.32);
  const layout = () => ({
    cruise: isMc ? { x: 0.5, y: 0.62 } : narrow ? { x: 0.3, y: 0.82 } : { x: 0.3, y: 0.74 },
    moonBase: isMc ? { x: 0.74, y: 0.24 } : narrow ? { x: 0.76, y: 0.15 } : { x: 0.72, y: 0.22 },
    arrive: isMc ? { x: 0.62, y: 0.42 } : narrow ? { x: 0.5, y: 0.3 } : { x: 0.62, y: 0.4 },
    wander: isMc ? { x: 0.45, y: 0.5 } : narrow ? { x: 0.45, y: 0.4 } : { x: 0.4, y: 0.45 },
    home: isMc ? { x: 0.7, y: 0.62 } : narrow ? { x: 0.6, y: 0.2 } : { x: 0.68, y: 0.24 }, // participant: up by Earth, clear of the centred capsule notice
  });

  let earthReady = false;
  let lastDraw = 0, lastFrame = 0;
  const cls = (node, name, on) => { if (node.classList.contains(name) !== on) node.classList.toggle(name, on); };

  function render(now) {
    const phase = st ? st.phase : "joining";
    const sNow = serverNow();
    const t = st ? Math.max(0, sNow - st.phaseStartedAt) : 0; // ms in phase
    const T = st ? st.timing : { launchMs: 8000, arriveMs: 4500, revealMs: 4000, leaveMs: 3000 };
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const L = layout();

    // --- moon: {x,y (frac), k scale, o opacity}
    let moon = { x: L.moonBase.x, y: L.moonBase.y, k: 0.45, o: 1 };
    // --- rocket: {x,y px, s scale, r deg, z behind moon}
    let rk = { x: 0, y: 0, s: unit, r: 0, behind: false };
    let warp = 0, groundP = 0, atmo = 1;
    earthReady = false;
    let earthT = 0;
    let revealOn = false;

    const padPose = () => ({ x: padX(), y: groundY - (ROCKET_H / 2) * unit + 6, s: unit, r: 0 });
    const cruisePose = () => {
      const x = L.cruise.x * W + Math.sin(now / 1100) * 6 * unit;
      const y = L.cruise.y * H + Math.sin(now / 900) * 8 * unit;
      return { x, y, s: unit, r: 25 + Math.sin(now / 1500) * 2 }; // flies up-right; the stars stream down-left
    };
    const mixPose = (a, b, p) => ({
      x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: lerp(a.s, b.s, p), r: lerp(a.r, b.r, p), behind: b.behind,
    });

    if (phase === "joining" || phase === "countdown") {
      rk = padPose();
      warp = 0; atmo = 1;
    } else if (phase === "launching") {
      const pad = padPose();
      const u = clamp01((t - 1500) / (T.launchMs - 1500)); // liftoff after a 1.5 s hold
      // The moon stays in view through liftoff and fades once the rocket is out in space.
      moon.o = 1 - clamp01((t - 4000) / 2500);
      const top = { x: lerp(pad.x, L.cruise.x * W, 0.5), y: H * 0.3 };
      const cr = cruisePose();
      if (t < 1500) {
        rk = { ...pad, x: pad.x + Math.sin(t / 22) * 1.5 * unit, y: pad.y + Math.sin(t / 31) * 1.2 * unit };
      } else if (u < 0.6) {
        const p = easeIn(u / 0.6);
        rk = { x: lerp(pad.x, top.x, p), y: lerp(pad.y, top.y, p), s: unit, r: lerp(0, cr.r * 0.4, p) };
      } else {
        const p = easeOut((u - 0.6) / 0.4);
        rk = { x: lerp(top.x, cr.x, p), y: lerp(top.y, cr.y, p), s: unit, r: lerp(cr.r * 0.4, cr.r, p) };
      }
      groundP = easeIn(clamp01((t - 1500) / 3500));
      atmo = 1 - easeInOut(clamp01((t - 1500) / 4500));
      warp = easeIn(u);
    } else if (phase === "cruising") {
      moon.o = 0;
      rk = cruisePose(); warp = 1; atmo = 0; groundP = 1;
    } else if (phase === "arrived") {
      moon.o = 0;
      rk = cruisePose();
      warp = lerp(1, 0.3, easeInOut(clamp01(t / 2500))); atmo = 0; groundP = 1;
      revealOn = isMc && t > T.arriveMs;
    } else if (phase === "timejump") {
      moon.o = 0;
      const w = { x: L.wander.x * W + Math.sin(now / 1300) * 6, y: L.wander.y * H + Math.sin(now / 1000) * 9, s: unit * 0.9, r: 25 + Math.sin(now / 1500) * 3 };
      rk = mixPose(cruisePose(), w, easeInOut(clamp01(t / 3000)));
      warp = lerp(0.3, 1.8, easeOut(clamp01(t / 2000))); atmo = 0; groundP = 1;
    } else {
      // earth / puzzle / revealed: the rocket arrives home
      const settled = phase !== "earth";
      const e = settled ? 1 : clamp01(t / 3400);
      earthT = settled ? 1 : clamp01(t / 2800);
      moon.o = 0;
      const w = { x: L.wander.x * W, y: L.wander.y * H, s: unit * 0.9, r: 25 };
      const home = { x: L.home.x * W, y: L.home.y * H, s: unit * 0.5, r: 25 };
      rk = mixPose(w, home, easeInOut(e));
      warp = lerp(1.8, 0.1, easeOut(settled ? 1 : clamp01(t / 3000))); atmo = 0; groundP = 1;
      earthReady = isMc && phase === "earth" && t > 2800;
    }

    // --- apply
    if (now - lastDraw >= (isMc ? 0 : 30)) {
      lastDraw = now;
      drawSky(Math.max(dt, 0.016), warp, now);
    }
    el.rocket.style.transform = `translate(${rk.x - ROCKET_W / 2}px, ${rk.y - ROCKET_H / 2}px) rotate(${rk.r}deg) scale(${rk.s})`;
    el.rocket.style.zIndex = rk.behind ? 3 : 5;
    el.moon.style.transform = `translate(${moon.x * W - MOON_D / 2}px, ${moon.y * H - MOON_D / 2}px) scale(${moon.k * unit})`;
    el.moon.style.opacity = moon.o;
    el.atmo.style.opacity = atmo;
    el.ground.style.transform = `translateY(${groundP * (H - groundY + 60)}px)`;
    cls(el.ground, "gone", groundP >= 1);
    const e = easeInOut(earthT);
    el.earthWrap.style.opacity = e;
    el.earthWrap.style.transform = `scale(${0.3 + 0.7 * e})`;
    cls(el.earthWrap, "clickable", earthReady);
    cls(root, "advance-ready", isMc && phase === "timejump" && st.timeJumpStep >= 1);
    cls(el.revealOverlay, "hidden", !revealOn);
  }

  // ---- Single rAF loop; paused while the page is hidden ------------------------
  let raf = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    render(now);
  }
  function start() { if (!raf) { lastFrame = 0; raf = requestAnimationFrame(loop); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  resize();
  start();

  window.LaunchScene = { role, socket, onState: (fn) => { listeners.push(fn); if (st) fn(st); } };
})();
