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

  // ---- The future: what happens on Earth while the rocket is away ---------------------------------
  // Drop your gifs into server/public/future/ with these names and they play automatically.
  const FUTURE = [
    { year: 2032, src: "/future/2032.gif" },
    { year: 2040, src: "/future/2040.gif" },
    { year: 2050, src: "/future/2050.gif" },
  ];
  const CLOCK_SVG = `<svg class="f-clock" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="rgba(255,255,255,.08)" stroke="#fff" stroke-width="3"/>
    <path d="M24 7v4M24 37v4M7 24h4M37 24h4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <line class="hh" x1="24" y1="24" x2="24" y2="14" stroke="#ffb84c" stroke-width="3.5" stroke-linecap="round"/>
    <line class="mh" x1="24" y1="24" x2="24" y2="9" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="24" r="2.5" fill="#fff"/></svg>`;
  // timings of the "meanwhile" sequence, in ms from the start of the phase
  const FUT = { textEnd: 0, slideStart: 18600, slideMs: 7200, fadeOut: 1000 };

  // ---- DOM ------------------------------------------------------------------
  root.innerHTML = `
    <canvas id="sky"></canvas>
    <div id="atmo"></div>
    <div id="moon"><i class="crater c1"></i><i class="crater c2"></i><i class="crater c3"></i><i class="crater c4"></i></div>
    <canvas id="bats"></canvas>
    <div id="earth-wrap"><div id="earth">🌍</div><div id="earth-hint">Click Earth to reopen the capsule</div></div>
    <div id="ground"><div id="pad"></div></div>
    <div id="rocket">
      <div class="rocket-body"><div class="rocket-window"></div><div id="cargo" title="Memories on board"><div id="cargo-fill"></div></div></div>
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
      <div class="wh-sub">twenty-four years in nine seconds</div>
    </div>
    <div id="day">
      <div class="day-sun"></div>
      <i class="day-cloud dc1"></i><i class="day-cloud dc2"></i><i class="day-cloud dc3"></i>
      <div class="day-hills far"></div><div class="day-hills near"></div>
    </div>
    <div id="cine-a" class="cine"><span>Memories &amp; avatars into stars...</span></div>
    <div id="cine-d" class="cine"><span>…and on Earth.<br>You all go on your own ways…</span></div>
    <div id="bye" class="fslide"><div class="f-frame"><img alt="Goodbye" data-src="/future/goodbye.gif" /></div></div>
    <div id="cine-c" class="cine"><span>Rocket is coming back to Earth…</span></div>
    <div id="cine-b" class="cine"><span>…and on Earth.</span></div>
    <div id="cine-f" class="cine"><span>You on Earth...</span></div>
    <div id="marquee"><span>This demo in earth is added to show the passing of 24 years in real life</span></div>
    <div id="future">${FUTURE.map((f) => `
      <div class="fslide" data-year="${f.year}">
        <div class="f-year"><span>${f.year}</span>${CLOCK_SVG}</div>
        <div class="f-frame"><img alt="${f.year}" data-src="${f.src}" /><div class="f-missing">Add <b>${f.src.split("/").pop()}</b> to<br>server/public/future/</div></div>
      </div>`).join("")}
    </div>
    <div id="flash"></div>
    <div id="alarm"></div>
  `;
  const $ = (id) => document.getElementById(id);
  const el = {
    sky: $("sky"), atmo: $("atmo"), moon: $("moon"), earthWrap: $("earth-wrap"), earth: $("earth"),
    ground: $("ground"), pad: $("pad"), rocket: $("rocket"),
    warpHud: $("warp-hud"), whDay: $("wh-day"), whDate: $("wh-date"), whFill: $("wh-fill"),
    flash: $("flash"), alarm: $("alarm"), cineA: $("cine-a"), cineB: $("cine-b"), cineC: $("cine-c"), cineD: $("cine-d"), bye: $("bye"), cineF: $("cine-f"), marquee: $("marquee"), day: $("day"), future: $("future"),
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
  const QS = new URLSearchParams(location.search);
  const PREVIEW = QS.get("preview") ? { phase: QS.get("preview"), t: Number(QS.get("t") || 0) } : null;
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
      // An engine only fires once its crewmate has tapped "I'm ready"; until then it stays dark.
      const isReady = (st.readyEngines || []).includes(i + 1);
      e.classList.toggle("lit", isReady);
      e.classList.toggle("ready", isReady);
    });

    // Cargo gauge: how full the capsule is. Aims for ~6 memories per crewmate.
    const target = Math.max(2, (st.members || []).length) * 6;
    el.cargoFill.style.height = Math.min(100, Math.round(((st.memoryTotal || 0) / target) * 100)) + "%";
    lastMemoryTotal = st.memoryTotal || 0;
    syncCrew(st.members || []);

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
    batCv.width = W * dpr; batCv.height = H * dpr;
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

  // ---- Bats: two silhouettes take turns flapping across the moon while the rocket is on the ground.
  // Each one flies through, then a short pause before the next one appears. They are drawn on their
  // own canvas (#bats) which sits just above the moon, so they pass in front of it.
  let batFade = 1; // 1 on the pad, fades to 0 as the ground drops away at liftoff
  let rocketTopY = 0; // top of the rocket in px (bats keep clear of it so they never look like part of it)
  const moonPos = { x: 0.5, y: 0.2, r: 40 }; // updated every frame: centre as a fraction of the screen, radius in px
  const batCv = $("bats"), batCtx = batCv.getContext("2d");
  const bats = [null, null]; // two slots
  const batWake = [0, 3000]; // when each empty slot may spawn again (ms)
  function spawnBat() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    // fly a line that crosses the moon's disc
    const size = 0.8 + Math.random() * 0.5;
    const wobAmp = 5 + Math.random() * 7;
    let y = moonPos.y * H + (Math.random() * 2 - 1) * moonPos.r * 0.8;
    // stay clear of the rocket: on small screens it reaches up to the moon's height
    const maxY = rocketTopY - (14 * size * unit * 2.2 + wobAmp + 6);
    if (y > maxY) y = maxY;
    if (y < 10) return null; // no room above the rocket: try again later
    return {
      x: dir > 0 ? -0.06 : 1.06, y, dir,
      speed: 0.06 + Math.random() * 0.03, // screen widths per second
      size, flap: Math.random() * 6.28, flapRate: 7.5 + Math.random() * 3,
      wob: Math.random() * 6.28, wobAmp,
    };
  }
  function drawBats(dt, now) {
    batCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    batCtx.clearRect(0, 0, W, H);
    if (batFade <= 0.01) { bats[0] = bats[1] = null; return; }
    for (let i = 0; i < 2; i++) {
      if (!bats[i]) {
        if (now < batWake[i]) continue;
        bats[i] = spawnBat();
        if (!bats[i]) { batWake[i] = now + 2000; continue; }
      }
      const b = bats[i];
      b.x += b.dir * b.speed * dt;
      b.wob += dt * 1.8;
      if ((b.dir > 0 && b.x > 1.08) || (b.dir < 0 && b.x < -0.08)) {
        bats[i] = null;
        batWake[i] = now + 1500 + Math.random() * 3000; // a short pause before it comes back
        continue;
      }
      const flap = Math.sin((now / 1000) * b.flapRate + b.flap); // -1..1
      const u = b.size * unit * 2.2;
      const c = batCtx;
      c.save();
      c.translate(b.x * W, b.y + Math.sin(b.wob) * b.wobAmp);
      c.scale(u, u);
      c.globalAlpha = 0.9 * batFade;
      c.fillStyle = "#14112c";
      c.strokeStyle = "rgba(190,180,245,0.7)";
      c.lineWidth = 0.6;
      for (const side of [-1, 1]) {
        c.save();
        c.scale(side, 1);
        const tipY = -3 - flap * 6; // wing tip swings up and down
        c.beginPath();
        c.moveTo(1, -1);
        c.quadraticCurveTo(6, tipY - 3, 14, tipY);
        c.quadraticCurveTo(11, tipY + 4, 9.5, tipY + 6);
        c.quadraticCurveTo(7, tipY + 3, 5.5, tipY + 6.5);
        c.quadraticCurveTo(3.5, 3, 1, 3);
        c.closePath();
        c.fill(); c.stroke();
        c.restore();
      }
      c.beginPath(); c.ellipse(0, 0.5, 2.2, 3.4, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-1.8, -2.4); c.lineTo(-1.2, -5); c.lineTo(-0.2, -2.8); c.moveTo(1.8, -2.4); c.lineTo(1.2, -5); c.lineTo(0.2, -2.8); c.fill();
      c.restore();
    }
  }

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
    drawBats(dt, now);
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
  const HOME_PHASES = ["earth", "lost", "rescue", "revealed"];

  /** Show one future slide at a time; the gif restarts from its first frame each time its slide appears. */
  let shownSlide = -1;
  function updateFuture(idx, t) {
    const slidesEnd = FUT.slideStart + FUT.slideMs * FUTURE.length;
    const out = t > slidesEnd - FUT.fadeOut; // everything fades away at the end
    cls(el.future, "show", idx >= 0 && !out);
    if (idx === shownSlide) return;
    shownSlide = idx;
    el.future.querySelectorAll(".fslide").forEach((n, i) => {
      const on = i === idx;
      cls(n, "show", on);
      if (!on) return;
      const img = n.querySelector("img");
      img.onload = () => n.classList.remove("missing");
      img.onerror = () => n.classList.add("missing");
      img.src = `${img.dataset.src}?play=${Date.now()}`; // fresh load = the gif plays from the start
    });
  }

  /** The goodbye gif restarts from its first frame each time it appears. */
  let byeShown = false;
  function showBye(on) {
    if (on === byeShown) return;
    byeShown = on;
    if (on) el.bye.querySelector("img").src = `${el.bye.querySelector("img").dataset.src}?play=${Date.now()}`;
  }

  function render(now) {
    // Preview aid: /scene?preview=cruising&t=5000 freezes the scene 5 s into that phase (handy for checking the transitions).
    if (PREVIEW) {
      const base = st || { members: [], litEngines: [], readyEngines: [1, 2, 3, 4], engineCount: 4, memoryTotal: 6, timing: { launchMs: 12500, cruiseMs: 7000, warpMs: 44500, earthMs: 13000, boardPerMs: 1500 } };
      st = Object.assign({}, base, { phase: PREVIEW.phase, phaseStartedAt: serverNow() - PREVIEW.t, readyEngines: [1, 2, 3, 4] });
    }
    const phase = st ? st.phase : "collecting";
    const sNow = serverNow();
    const t = st ? Math.max(0, sNow - st.phaseStartedAt) : 0; // ms in phase
    const T = st ? st.timing : { launchMs: 12500, warpMs: 9500, earthMs: 13000, boardPerMs: 1500 };
    const HOLD = 6000; // pad hold while the 6-to-0 countdown runs (matches the countdown in the app)
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const L = layout();

    // --- moon: {x,y (frac), k scale, o opacity}
    let moon = { x: L.moonBase.x, y: L.moonBase.y, k: 0.45, o: 1 };
    // --- rocket: {x,y px, s scale, r deg, z behind moon}
    let rk = { x: 0, y: 0, s: unit, r: 0, behind: false };
    let warp = 0, groundP = 0, atmo = 1, tunnel = 0, flash = 0, hud = false;
    let thrust = false;
    let rocketO = 1, earthT = 0, cineA = false, cineB = false, cineC = false, cineD = false, byeOn = false, cineF = false, marq = false, dayOn = false, headTop = false, slide = -1, enginesOff = false;

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
      const u = clamp01((t - HOLD) / (T.launchMs - HOLD)); // liftoff after the 6 s countdown hold
      moon.o = 1 - clamp01((t - HOLD - 2500) / 2500);
      const cr = cruisePose();
      if (t < HOLD) {
        rk = { ...pad, x: pad.x + Math.sin(t / 22) * 1.5 * unit, y: pad.y + Math.sin(t / 31) * 1.2 * unit };
      } else {
        // One continuous path from the pad to the cruise position (smootherstep: zero speed and
        // acceleration at both ends), so there is no sudden speed change or change of direction.
        const p = u * u * u * (u * (u * 6 - 15) + 10);
        rk = { x: lerp(pad.x, cr.x, p), y: lerp(pad.y, cr.y, p), s: unit, r: lerp(0, cr.r, p) };
      }
      groundP = easeIn(clamp01((t - HOLD) / 3500));
      atmo = 1 - easeInOut(clamp01((t - HOLD) / 4500));
      warp = easeIn(u);
    } else if (phase === "cruising") {
      // Reaching outer space: the thrusters shut down and the rocket drifts away, smaller and smaller, until it vanishes.
      const C = T.cruiseMs || 7000;
      moon.o = 0; atmo = 0; groundP = 1;
      const cr = cruisePose();
      const u = clamp01((t - 900) / (C - 900 - 1500));
      const shrink = Math.pow(1 - easeInOut(u), 1.6);
      rk = { x: cr.x + u * W * 0.16, y: cr.y - u * H * 0.14, s: Math.max(0, unit * shrink), r: cr.r };
      warp = 1 - easeOut(clamp01((t - 500) / 2800)); // the stars slow down once the engines are off
      cineA = t > C - 5500 && t < C - 1500; // "Memories & avatars interstellar…" for 4 s, then about 1 s of empty space
      enginesOff = t > 500;
    } else if (phase === "timejump") {
      // Meanwhile on Earth: a line of text, then the future gifs (2032, 2040, 2050), each with a turning clock.
      moon.o = 0; atmo = 0; groundP = 1;
      rk = { x: L.home.x * W, y: L.home.y * H, s: 0, r: 25 };
      warp = 0.03;
      enginesOff = true;
      const idx = Math.floor((t - FUT.slideStart) / FUT.slideMs);
      const slidesEnd = FUT.slideStart + FUT.slideMs * FUTURE.length;
      // A daylight Earth scene slides in from the left; the heading stays on it while the gifs play.
      dayOn = t > 0; // stays on screen to the end, so the reunite line has the daylight scene to itself
      cineD = byeOn = t > 2500 && t < 9500; // 2. the caption with the goodbye gif below it (7 s)
      cineB = false; // (now one two-line message in cineD)
      cineF = t >= FUT.slideStart && t < slidesEnd - 200; // "You on Earth..." comes in with the first gif and stays until the reunite line appears
      marq = t >= 9600 && t < 17600; // 4. the glass banner, bottom centre, for 8 s (then 1 s before the gifs), then gone; the gifs start after it
      // after the last gif the phones show the "Summon the rocket" email; the scene just keeps the daylight Earth
      headTop = true; // the heading sits at the top from the very start
      if (t >= FUT.slideStart && t < slidesEnd - 200 && idx >= 0 && idx < FUTURE.length) slide = idx;
    } else if (phase === "landing" || phase === "revealed") {
      // Back where it all began. First the empty launch site on Earth (pad, ground, sky, moon, no rocket) for a
      // second; then the rocket comes down from above the screen onto the very pad it took off from, thrusters
      // blazing. They dim and go out once it has settled. Then (revealed) the whole scene fades to near-black
      // behind the memory carousel, the landed rocket only just visible.
      const LAND = T.landingMs || 10000;
      const EMPTY = 1000; // the empty pad, before the rocket appears
      const u = phase === "landing" ? clamp01((t - EMPTY) / (LAND - EMPTY)) : 1;
      const sm = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); }; // smootherstep
      const pad = padPose();
      const p = sm(u / 0.9); // touches down at 90%, then sits still while the thrusters die away
      const hover = (1 - p) * 3 * unit;
      const startY = -(ROCKET_H * unit);
      rk = { x: pad.x + Math.sin(now / 70) * hover, y: lerp(startY, pad.y, p) + Math.sin(now / 55) * hover, s: unit, r: 0 };
      earthT = 0; groundP = 0; atmo = 1; warp = 0;
      enginesOff = u >= 0.9;
      thrust = phase === "landing" && u > 0 && u < 0.9;
    } else {
      // earth: the rocket comes back into view and heads for Earth · lost: the hatch blows · games / revealed: parked by Earth
      // Order of events: the rocket appears out of deep space at the centre of the screen, then
      // heads for Earth as Earth fades into view.
      // "Your memories are coming back to Earth…" over empty space first, then the rocket drifts in slowly from the centre
      // and settles near Earth (which fades in as it gets close). Then straight to the cargo hatch breach.
      const E = T.earthMs || 13000;
      const approach = phase === "earth" ? clamp01((t - 1800) / (E - 1800 - 600)) : 1;
      earthT = phase === "earth" ? clamp01((t - 1800 - (E - 2400) * 0.45) / 2800) : 1;
      rocketO = phase === "earth" ? easeOut(clamp01((t - 1800) / 1800)) : 1;
      cineC = phase === "earth" && t > 300 && t < E - 900;
      moon.o = 0; atmo = 0; groundP = 1;
      const far = { x: W * 0.5, y: H * 0.5, s: unit * 0.07, r: 25 };
      rk = mixPose(far, homePose(), easeInOut(approach));
      warp = lerp(0.3, 0.08, easeOut(approach));
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
    el.rocket.style.opacity = rocketO;
    el.moon.style.transform = `translate(${moon.x * W - MOON_D / 2}px, ${moon.y * H - MOON_D / 2}px) scale(${moon.k * unit})`;
    el.moon.style.opacity = moon.o;
    rocketTopY = rk.y - (ROCKET_H / 2) * rk.s;
    moonPos.x = moon.x; moonPos.y = moon.y; moonPos.r = (MOON_D / 2) * moon.k * unit;
    el.atmo.style.opacity = atmo;
    el.ground.style.transform = `translateY(${groundP * (H - groundY + 60)}px)`;
    batFade = 1 - groundP;
    cls(el.ground, "gone", groundP >= 1);
    const e = easeInOut(earthT);
    el.earthWrap.style.opacity = e;
    el.earthWrap.style.transform = `scale(${0.3 + 0.7 * e})`;
    el.flash.style.opacity = flash.toFixed(3);
    cls(el.warpHud, "show", hud);
    cls(root, "engines-off", enginesOff);
    cls(root, "boost", phase === "launching" || thrust);
    cls(el.cineA, "show", cineA);
    cls(el.cineB, "show", cineB);
    cls(el.cineC, "show", cineC);
    cls(el.cineD, "show", cineD);
    cls(el.bye, "show", byeOn);
    showBye(byeOn);
    cls(el.cineF, "show", cineF);
    cls(el.marquee, "run", marq);
    cls(el.cineB, "top", headTop);
    cls(el.cineF, "top", headTop);
    cls(el.day, "show", dayOn);
    updateFuture(slide, phase === "timejump" ? t : 0);
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
