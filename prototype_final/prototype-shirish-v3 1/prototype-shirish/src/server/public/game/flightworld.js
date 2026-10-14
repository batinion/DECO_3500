// Flight to the UQ Space Faculty — the world, built the same way on every phone and on the
// server (for the simulated crewmates). Same seed + same memory list = the same space for
// everyone: black holes, debris fields, asteroids and where each memory capsule floats.
(function (root) {
  const GOAL = { x: 4200, y: -5600 };
  const PL = Math.hypot(GOAL.x, GOAL.y), UX = GOAL.x / PL, UY = GOAL.y / PL, PX = -UY, PY = UX;
  const along = (t, o) => ({ x: UX * t + PX * o, y: UY * t + PY * o });

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** caps: [{id, glimpse}] in the server's order. */
  function gen(seed, caps) {
    const R = mulberry32(seed), rr = (a, b) => a + R() * (b - a);
    const holes = [], debris = [], rocks = [], mems = [];
    let tries = 0;
    while (holes.length < 8 && tries++ < 800) {
      const p = along(rr(1000, PL - 800), rr(-750, 750));
      if (holes.every((h) => Math.hypot(h.x - p.x, h.y - p.y) > 1150)) holes.push({ x: p.x, y: p.y, R: rr(280, 360), core: 26, spin: R() * 6 });
    }
    // memory capsules, spread along the route (away from black-hole cores)
    (caps || []).forEach((c, i) => {
      let p, k = 0;
      do p = along(800 + ((PL - 1400) * (i + 0.5)) / caps.length + rr(-250, 250), rr(-650, 650));
      while (k++ < 60 && !holes.every((h) => Math.hypot(h.x - p.x, h.y - p.y) > h.R * 0.75));
      mems.push({ id: c.id, x: p.x, y: p.y, glimpse: c.glimpse, bob: R() * 6 });
    });
    const clearOf = (p, m) =>
      Math.hypot(p.x, p.y) > m && Math.hypot(p.x - GOAL.x, p.y - GOAL.y) > m &&
      holes.every((h) => Math.hypot(h.x - p.x, h.y - p.y) > 110) && mems.every((c) => Math.hypot(c.x - p.x, c.y - p.y) > 90);
    tries = 0;
    while (debris.length < 42 && tries++ < 800) {
      const p = along(rr(500, PL - 300), rr(-850, 850));
      if (!clearOf(p, 320)) continue;
      const r = rr(110, 200), shards = [];
      for (let i = 0; i < Math.round(r / 5); i++) {
        const ang = R() * 6.28, d = Math.sqrt(R()) * r * 0.92;
        shards.push({ dx: Math.cos(ang) * d, dy: Math.sin(ang) * d, s: rr(2, 6), rot: R() * 6, vr: rr(-1.5, 1.5) });
      }
      debris.push({ x: p.x, y: p.y, r, layer: R() < 0.5 ? 1 : 0, shards });
    }
    tries = 0;
    while (rocks.length < 170 && tries++ < 2000) {
      const p = along(rr(350, PL - 250), rr(-1050, 1050));
      if (!clearOf(p, 260)) continue;
      const r = rr(14, 42), verts = [];
      for (let i = 0; i < 9; i++) verts.push(rr(0.72, 1.12));
      rocks.push({ id: "r" + rocks.length, x0: p.x, y0: p.y, x: p.x, y: p.y, r, hp: Math.ceil(r / 12), vx: rr(-18, 18), vy: rr(-18, 18), rot0: R() * 6, vr: rr(-0.8, 0.8), verts });
    }
    return { holes, debris, rocks, mems };
  }

  /** Where each crewmate's ship starts: side by side at the launch point. */
  function startPos(i, n) {
    return along(0, (i - (n - 1) / 2) * 80);
  }

  const API = { GOAL, PL, UX, UY, PX, PY, along, gen, mulberry32, startPos };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.FlightWorld = API;
})(this);
