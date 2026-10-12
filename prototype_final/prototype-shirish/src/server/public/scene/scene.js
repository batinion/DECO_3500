// Launch Sequence — the shared live scene.
//
// One module, rendered everywhere: Mission Control ("/", role "mc", interactive) and every
// participant's background layer ("/scene?role=participant", non-interactive). It owns no
// state of its own: the server sends a `scene_state` snapshot (on connect and on every phase
// change) and every frame is derived from (phase, elapsed since phaseStartedAt) on a
// server-synced clock — so all screens stay in step and a reloaded screen lands mid-scene.
(function () {
  // No host screen any more: every copy of the scene is a participant's background layer.
  const role = "participant";
  const isMc = false;
  const crewCode = new URLSearchParams(location.search).get("code") || "";
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
      <div class="rocket-body"><div class="rocket-window"></div><div id="cargo" title="Memories on board"><div id="cargo-fill"></div></div><div id="hatch"></div></div>
      <div class="rocket-fin fin-left"></div>
      <div class="rocket-fin fin-right"></div>
      <div id="engines"></div>
    </div>
    <div id="crew-chars"></div>
    <div id="warp-hud">
      <div class="wh-label">TIME WARP · ENGAGED</div>
      <div id="wh-day">DAY 1</div>
      <div id="wh-date"></div>
      <div class="wh-bar"><i id="wh-fill"></i></div>
      <div class="wh-sub">three years in nine seconds</div>
    </div>
    <div id="flash"></div>
    <div id="alarm"></div>
  `;
  const $ = (id) => document.getElementById(id);
  const el = {
    sky: $("sky"), atmo: $("atmo"), moon: $("moon"), earthWrap: $("earth-wrap"), earth: $("earth"),
    ground: $("ground"), pad: $("pad"), rocket: $("rocket"),
    warpHud: $("warp-hud"), whDay: $("wh-day"), whDate: $("wh-date"), whFill: $("wh-fill"),
    flash: $("flash"), alarm: $("alarm"),
    enginesBox: $("engines"), cargoFill: $("cargo-fill"), crewChars: $("crew-chars"),
  };
  // Engines are built to match the crew size (4 to 6) — one per crewmate.
  let engines = [];
  function buildEngines(n) {
    if (engines.length === n) return;
    el.enginesBox.innerHTML = Array.from({ length: n }, (_, i) => `<div class="engine" data-slot="${i + 1}"><div class="flame"></div></div>`).join("");
    el.enginesBox.classList.toggle("many", n > 4);
    engines = [...el.enginesBox.querySelectorAll(".engine")];
  }
  buildEngines(4);

  // A memory just went into the capsule: a little star flies into the rocket.
  const particles = [];
  let lastMemoryTotal = null;
  let rocketPos = { x: 0, y: 0 };

  // ---- Socket + clock -------------------------------------------------------
  const socket = io({ query: { role, code: crewCode } });
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

  function applyState(prevPhase) {
    root.classList.toggle("joining", st.phase === "collecting");

    buildEngines(Math.min(6, Math.max(4, st.engineCount || 4)));
    engines.forEach((e, i) => {
      e.classList.toggle("lit", st.litEngines.includes(i + 1));
      e.classList.toggle("ready", (st.readyEngines || []).includes(i + 1));
    });

    // Cargo gauge: how full the capsule is. Aims for ~6 memories per crewmate.
    const target = Math.max(2, (st.members || []).length) * 6;
    el.cargoFill.style.height = Math.min(100, Math.round(((st.memoryTotal || 0) / target) * 100)) + "%";
    lastMemoryTotal = st.memoryTotal || 0;
    syncCrew(st.members || []);
    root.classList.toggle("boost", st.phase === "launching");

    // one class per phase, so the CSS can style the big moments (boarding, alarm…)
    root.className = root.className.replace(/\bphase-\S+/g, "").trim() + " phase-" + st.phase;
    if (prevPhase !== st.phase) {
      chars.forEach((c) => (c.loaded = false));
      lostSeed = Math.random() * 6.28;
    }
    if (prevPhase !== st.phase) lastDraw = 0; // repaint immediately on phase change
  }

  // ---- Crew characters: everyone's astronaut waits by the rocket -----------------
  const chars = new Map(); // memberId -> character state
  const AV = window.LaunchAvatars;

  function drawFace(c) {
    const expr = c.until > performance.now() ? c.temp : c.ready ? "yay" : "default";
    const key = c.avatar + ":" + expr;
    if (!AV || c.shown === key) return;
    c.shown = key;
    c.face.innerHTML = AV.avatarSvg(c.avatar, { expr, size: 100 });
  }

  function makeChar(m) {
    const el = document.createElement("div");
    el.className = "crew-char arrive";
    el.innerHTML =
      '<div class="cc-hop"><div class="cc-bob"><div class="cc-cargo"></div><div class="cc-face"></div><div class="cc-ready">✓</div></div></div><div class="cc-name"></div>';
    el.querySelector(".cc-bob").style.animationDelay = "-" + (Math.random() * 2).toFixed(2) + "s";
    el.querySelector(".cc-name").textContent = m.name;
    setTimeout(() => el.classList.remove("arrive"), 800); // so the hop animation can play later
    return el;
  }

  function syncCrew(members) {
    const ids = new Set(members.map((m) => m.id));
    for (const [id, c] of chars) {
      if (!ids.has(id)) {
        c.el.remove();
        chars.delete(id);
      }
    }
    members.forEach((m, i) => {
      let c = chars.get(m.id);
      if (!c) {
        const el = makeChar(m);
        root.querySelector("#crew-chars").appendChild(el);
        c = { el, face: el.querySelector(".cc-face"), hop: el.querySelector(".cc-hop"), shown: "", until: 0, temp: null };
        chars.set(m.id, c);
      }
      c.slot = i;
      c.avatar = m.avatar || "nova";
      c.ready = !!m.ready;
      c.el.classList.toggle("ready", c.ready);
      drawFace(c);
    });
  }

  /** Someone dropped a memory: they hop and throw a star; whoever it's about looks surprised. */
  function onMemoryAdded({ memberId, aboutId }) {
    const now = performance.now();
    const author = chars.get(memberId);
    const about = aboutId ? chars.get(aboutId) : null;
    if (author) {
      author.temp = "yay";
      author.until = now + 1800;
      author.hop.classList.remove("hopping");
      void author.hop.offsetWidth;
      author.hop.classList.add("hopping");
      drawFace(author);
      setTimeout(() => drawFace(author), 1900);
    }
    if (about) {
      about.temp = "wow";
      about.until = now + 2600;
      setTimeout(() => drawFace(about), 450);
      setTimeout(() => drawFace(about), 2700);
    }
    const from = author ? { x: author.x, y: author.y - author.size * 0.6 } : { x: Math.random() * W, y: 0 };
    particles.push({ born: now + 120, sx: from.x, sy: from.y, dur: 1400 });
  }
  let lostSeed = 0;
  socket.on("memory_added", onMemoryAdded);

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
    groundY = H * (narrow ? 0.36 : 0.86); // phones: bottom sheet covers the lower half
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
    moonBase: isMc ? { x: 0.74, y: 0.24 } : narrow ? { x: 0.76, y: 0.15 } : { x: 0.52, y: 0.2 },
    arrive: isMc ? { x: 0.62, y: 0.42 } : narrow ? { x: 0.5, y: 0.3 } : { x: 0.62, y: 0.4 },
    wander: isMc ? { x: 0.45, y: 0.5 } : narrow ? { x: 0.45, y: 0.4 } : { x: 0.4, y: 0.45 },
    home: isMc ? { x: 0.7, y: 0.62 } : narrow ? { x: 0.6, y: 0.2 } : { x: 0.68, y: 0.24 }, // participant: up by Earth, clear of the centred capsule notice
  });

  // ---- Time warp: a tunnel of light rushing past (classic 3D starfield, from the centre) ----
  const TUNNEL = Array.from({ length: 220 }, () => ({ a: Math.random() * Math.PI * 2, z: Math.random(), r: 0.15 + Math.random() * 0.85, h: Math.random() }));
  function drawTunnel(dt, power, now, cx, cy) {
    if (power <= 0.01) return;
    const R = Math.hypot(W, H) * 0.6;
    ctx.save();
    // soft glow in the centre of the tunnel
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5);
    const hue = (now / 25) % 360;
    g.addColorStop(0, `hsla(${hue}, 90%, 75%, ${0.35 * power})`);
    g.addColorStop(0.4, `hsla(${(hue + 60) % 360}, 80%, 45%, ${0.12 * power})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // light rings that rush outwards (the "seasons" flicking past)
    for (let k = 0; k < 4; k++) {
      const ph = ((now / 700 + k / 4) % 1);
      ctx.strokeStyle = `hsla(${(hue + k * 70) % 360}, 90%, 70%, ${(1 - ph) * 0.18 * power})`;
      ctx.lineWidth = 2 + ph * 10;
      ctx.beginPath(); ctx.arc(cx, cy, ph * R, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineCap = "round";
    for (const p of TUNNEL) {
      const speed = 0.25 + 1.7 * power;
      const zPrev = p.z;
      p.z -= dt * speed;
      if (p.z <= 0.02) { p.z = 1; p.a = Math.random() * Math.PI * 2; continue; }
      const k1 = (p.r * 0.09) / p.z, k0 = (p.r * 0.09) / zPrev;
      const x1 = cx + Math.cos(p.a) * k1 * R, y1 = cy + Math.sin(p.a) * k1 * R;
      const x0 = cx + Math.cos(p.a) * k0 * R, y0 = cy + Math.sin(p.a) * k0 * R;
      const alpha = Math.min(1, (1 - p.z) * 1.4) * power;
      ctx.strokeStyle = `hsla(${(hue + p.h * 120) % 360}, 85%, ${70 + p.h * 25}%, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1 - p.z) * 3.2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
  }

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const bump = (t, at, w) => Math.max(0, 1 - Math.abs(t - at) / w);

  let lastDraw = 0, lastFrame = 0;
  const cls = (node, name, on) => { if (node.classList.contains(name) !== on) node.classList.toggle(name, on); };
  const HOME_PHASES = ["earth", "lost", "rescue", "colorgame", "revealed"];

  function render(now) {
    const phase = st ? st.phase : "collecting";
    const sNow = serverNow();
    const t = st ? Math.max(0, sNow - st.phaseStartedAt) : 0; // ms in phase
    const T = st ? st.timing : { launchMs: 8000, warpMs: 9500, earthMs: 4500, boardPerMs: 1500 };
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const L = layout();

    // --- moon: {x,y (frac), k scale, o opacity}
    let moon = { x: L.moonBase.x, y: L.moonBase.y, k: 0.45, o: 1 };
    // --- rocket: {x,y px, s scale, r deg, z behind moon}
    let rk = { x: 0, y: 0, s: unit, r: 0, behind: false };
    let warp = 0, groundP = 0, atmo = 1, tunnel = 0, flash = 0, hud = false;
    let earthT = 0;

    const padPose = () => ({ x: padX(), y: groundY - (ROCKET_H / 2) * unit + 6, s: unit, r: 0 });
    const cruisePose = () => {
      const x = L.cruise.x * W + Math.sin(now / 1100) * 6 * unit;
      const y = L.cruise.y * H + Math.sin(now / 900) * 8 * unit;
      return { x, y, s: unit, r: 25 + Math.sin(now / 1500) * 2 }; // flies up-right; the stars stream down-left
    };
    const warpCentre = () => ({ x: W * 0.5, y: H * (narrow ? 0.26 : 0.5) });
    const warpPose = () => {
      const c = warpCentre();
      return { x: c.x + Math.sin(now / 90) * 1.5 * unit, y: c.y + 40 * unit + Math.sin(now / 70) * 1.5 * unit, s: unit * 0.85, r: 0 };
    };
    const homePose = () => ({ x: L.home.x * W, y: L.home.y * H, s: unit * 0.5, r: 25 });
    const mixPose = (a, b, p) => ({
      x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: lerp(a.s, b.s, p), r: lerp(a.r, b.r, p), behind: b.behind,
    });

    if (phase === "collecting" || phase === "boarding") {
      rk = padPose();
      warp = 0; atmo = 1;
    } else if (phase === "launching") {
      const pad = padPose();
      const u = clamp01((t - 1500) / (T.launchMs - 1500)); // liftoff after a 1.5 s hold
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
    } else if (phase === "timejump") {
      // 0–1.2 s: line up and punch it · 1.2–8.2 s: the tunnel, years flying by · then out
      moon.o = 0; atmo = 0; groundP = 1;
      const W_MS = T.warpMs || 9500;
      const inP = easeInOut(clamp01(t / 1200));
      const outP = easeInOut(clamp01((t - (W_MS - 1300)) / 1300));
      rk = mixPose(cruisePose(), warpPose(), inP);
      tunnel = clamp01(t / 1400) * (1 - outP * 0.95);
      warp = 1 - inP * 0.8;
      flash = Math.max(bump(t, 1150, 380), bump(t, W_MS - 1200, 500) * 0.9, (t > 1500 && t < W_MS - 1500 ? 0.08 * Math.max(0, Math.sin(now / 160)) : 0));
      hud = t > 900 && t < W_MS - 600;
      // the counter: day 1 -> day 1,095, with the date ticking along
      const p = easeInOut(clamp01((t - 1100) / (W_MS - 2600)));
      const days = 1 + Math.round(p * 1094);
      const start = new Date(st.phaseStartedAt);
      const d = new Date(start.getTime() + (days - 1) * 86400000);
      if (el.whDay.dataset.v !== String(days)) {
        el.whDay.dataset.v = String(days);
        el.whDay.textContent = `DAY ${days.toLocaleString("en-AU")}`;
        el.whDate.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        el.whFill.style.width = (p * 100).toFixed(1) + "%";
      }
    } else {
      // earth: Earth comes into view · lost: the hatch blows · games / revealed: parked by Earth
      const approach = phase === "earth" ? clamp01(t / 3400) : 1;
      earthT = phase === "earth" ? clamp01(t / 2800) : 1;
      moon.o = 0; atmo = 0; groundP = 1;
      rk = mixPose(warpPose(), homePose(), easeInOut(approach));
      warp = lerp(0.6, 0.08, easeOut(approach));
      if (phase === "lost" && t < 1600) {
        const k = (1 - t / 1600) * 7 * unit;
        rk.x += (Math.random() - 0.5) * k; rk.y += (Math.random() - 0.5) * k; rk.r += (Math.random() - 0.5) * 6;
        flash = bump(t, 120, 300) * 0.8;
      }
    }

    // --- apply
    if (particles.length || tunnel > 0 || phase === "lost" || now - lastDraw >= 30) {
      lastDraw = now;
      drawSky(Math.max(dt, 0.016), warp, now);
      const c = warpCentre();
      drawTunnel(Math.max(dt, 0.016), tunnel, now, c.x, c.y);
    }
    rocketPos = { x: rk.x, y: rk.y - 30 * rk.s };
    placeCrew(phase, t, T, now);
    drawParticles(now);
    if (phase === "lost") drawScattered(t, now);
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
    el.flash.style.opacity = flash.toFixed(3);
    cls(el.warpHud, "show", hud);
  }

  /** The hatch blew: every memory capsule tumbles out into space around the rocket. */
  function drawScattered(t, now) {
    const n = Math.max(3, Math.min(14, (st && st.memoryTotal) || 6));
    const base = Math.min(W, H);
    for (let i = 0; i < n; i++) {
      const rnd = (Math.sin(i * 12.9898 + lostSeed * 7.1) * 43758.5453) % 1;
      const r01 = Math.abs(rnd);
      const ang = (i / n) * Math.PI * 2 + lostSeed + r01 * 0.6;
      const dist = easeOut(clamp01((t - 200) / 2600)) * base * (0.22 + 0.22 * r01);
      const x = rocketPos.x + Math.cos(ang) * dist + Math.sin(now / (900 + i * 37) + i) * 6;
      const y = rocketPos.y + Math.sin(ang) * dist + Math.cos(now / (1100 + i * 29) + i) * 6;
      const tw = 0.6 + 0.4 * Math.sin(now / 300 + i);
      const r = 4 + 2 * r01;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, `rgba(255,243,196,${0.95 * tw})`);
      g.addColorStop(0.35, `rgba(255,184,76,${0.5 * tw})`);
      g.addColorStop(1, "rgba(255,184,76,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Characters stand on the ground either side of the pad. When the crew is ready, they walk
  // up one by one, slide their memory capsule into the cargo hold, and climb aboard.
  function placeCrew(phase, t, T, now) {
    if (!chars.size) return;
    const size = Math.round((narrow ? 40 : 34) + 28 * clamp01((unit - 0.4) / 0.75));
    const gap = size * (narrow ? 1.02 : 1.12);
    const per = T.boardPerMs || 1500;
    root.classList.toggle("narrow-scene", narrow);
    for (const c of chars.values()) {
      const side = c.slot % 2 === 0 ? -1 : 1;
      const k = Math.floor(c.slot / 2);
      const gx = padX() + side * (62 * unit + size * 0.55 + k * gap);
      const gy = groundY;
      const doorX = padX() + side * (30 * unit + size * 0.3); // right beside the rocket
      let x = gx, y = gy, sc = 1, op = 1, carrying = false;
      if (phase === "boarding") {
        const u = (t - c.slot * per) / per;
        if (u <= 0) {
          carrying = true;
        } else if (u < 0.45) {
          const p = easeInOut(u / 0.45);
          x = lerp(gx, doorX, p);
          y = gy - Math.abs(Math.sin(p * Math.PI * 5)) * size * 0.08; // little steps
          carrying = true;
        } else if (u < 0.68) {
          x = doorX;
          if (!c.loaded) {
            c.loaded = true;
            particles.push({ born: now, sx: x, sy: gy - size * 1.15, dur: 520 });
            c.temp = "yay"; c.until = now + 1200; c.shown = ""; drawFace(c);
          }
        } else if (u < 1) {
          const p = easeIn((u - 0.68) / 0.32);
          x = lerp(doorX, rocketPos.x, p);
          y = lerp(gy, rocketPos.y + 40 * unit, p);
          sc = 1 - 0.8 * p;
          op = 1 - p;
        } else {
          op = 0;
        }
      } else if (phase !== "collecting") {
        op = 0;
      }
      c.size = size;
      c.x = x;
      c.y = y;
      c.el.style.width = c.el.style.height = size + "px";
      c.el.style.transform = `translate(${x - size / 2}px, ${y - size}px) scale(${sc})`;
      c.el.style.opacity = op;
      cls(c.el, "carrying", carrying);
      if (c.until && c.until < performance.now()) { c.until = 0; drawFace(c); }
    }
  }

  function drawParticles(now) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const u = (now - p.born) / (p.dur || 1400);
      if (u < 0) continue;
      if (u >= 1) { particles.splice(i, 1); continue; }
      const e = easeInOut(u);
      const sx = p.sx, sy = p.sy;
      const x = lerp(sx, rocketPos.x, e) + Math.sin(u * 6) * 20 * (1 - u);
      const y = lerp(sy, rocketPos.y, e);
      const r = 3 + 3 * (1 - u);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      g.addColorStop(0, "rgba(255,243,196,0.95)");
      g.addColorStop(0.3, "rgba(255,184,76,0.55)");
      g.addColorStop(1, "rgba(255,184,76,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fill();
    }
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
