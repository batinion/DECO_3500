// Shared ship — ONE ship, flown by the whole room.
//
// The server simulates it (the same rules as the classic flight: black holes, debris, asteroids)
// and every phone just draws it. The five controls are dealt out at random; with fewer than five
// players, some players get several:
//
//   steer     left / right
//   throttle  forward / back
//   altitude  up (high) / down (low)
//   pickup    save the memory in reach
//   gun       fire at asteroids
const FW = require("../public/game/flightworld.js");
const crews = require("./rooms");

const MAX_PLAYERS = 5;
const ROLES = ["steer", "throttle", "altitude", "pickup", "gun"];
const PICKUP_R = 95; // how close a memory must be for the grabber to save it
const STALE_MS = 600; // a held control resets if its phone stops reporting
const DOCK_R = 140;

const now = () => Date.now();
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const nameOf = (crew, id) => crews.findMember(crew, id)?.name || "Someone";

/** role -> memberId. Players and roles are both shuffled, then dealt round-robin. */
function dealRoles(crew) {
  const players = shuffle(crew.members.filter((m) => !m.isSimulated));
  const roles = {};
  shuffle(ROLES).forEach((role, i) => (roles[role] = players[i % players.length].id));
  return roles;
}

/** capsules: the same shape the classic flight uses ({ id, memoryIds, collected, by, glimpse }). */
function create(crew, capsules, seed) {
  const p = FW.startPos(0, 1);
  const t = now();
  return {
    type: "shared",
    startedAt: t,
    seed,
    capsules,
    world: FW.gen(seed, capsules.map((c) => ({ id: c.id, glimpse: c.glimpse }))), // rebuilt from the seed, never sent
    roles: dealRoles(crew),
    ship: { x: p.x, y: p.y, vx: 0, vy: 0, a: Math.atan2(FW.UY, FW.UX), av: 0, alt: 0 },
    inputs: { steer: 0, throttle: 0, alt: 0, fire: 0 },
    inputAt: { steer: 0, throttle: 0, fire: 0 },
    bullets: [],
    rockHp: {},
    rocksGone: [],
    fireCd: 0,
    inv: 1.5,
    sayCd: 0,
    debrisAcc: 0,
    pen: 0,
    hits: 0,
    warps: 0,
    lastStep: t,
    notes: {},
    finishedAt: null,
  };
}

function view(crew) {
  const g = crew.game;
  return {
    type: "shared",
    serverNow: now(),
    startedAt: g.startedAt,
    seed: g.seed,
    members: crew.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar || "nova", isSimulated: !!m.isSimulated })),
    roles: g.roles,
    capsules: g.capsules.map((c) => ({ id: c.id, collected: c.collected, by: c.by, byName: c.by ? nameOf(crew, c.by) : null, glimpse: c.glimpse })),
    rocksGone: g.rocksGone,
    collected: g.capsules.filter((c) => c.collected).length,
    total: g.capsules.length,
    pen: g.pen,
    finishedAt: g.finishedAt,
  };
}

/** What every phone needs ~15x/sec to draw the one ship. */
function shipState(crew) {
  const g = crew.game;
  const s = g.ship;
  const r = (v, d = 0) => +v.toFixed(d);
  return {
    t: now(),
    x: r(s.x, 1),
    y: r(s.y, 1),
    vx: r(s.vx, 1),
    vy: r(s.vy, 1),
    a: r(s.a, 3),
    alt: r(s.alt, 2),
    inv: r(g.inv, 2),
    pen: g.pen,
    inputs: { ...g.inputs },
    bullets: g.bullets.map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), r(b.life, 2)]),
  };
}

const running = (crew) => crew.phase === "rescue" && crew.game?.type === "shared" && !crew.game.finishedAt;

/** A role holder reports what they're pressing. Altitude is latched; the rest are held. */
function input(crew, memberId, role, value) {
  if (!running(crew)) return false;
  const g = crew.game;
  if (!ROLES.includes(role) || g.roles[role] !== memberId) return false;
  const v = Number(value) || 0;
  if (role === "altitude") {
    g.inputs.alt = v ? 1 : 0;
  } else if (role === "gun") {
    g.inputs.fire = v ? 1 : 0;
    g.inputAt.fire = now();
  } else if (role === "steer" || role === "throttle") {
    g.inputs[role] = Math.max(-1, Math.min(1, Math.round(v)));
    g.inputAt[role] = now();
  } else return false; // "pickup" is a button, see pickup()
  return true;
}

/** The grabber pressed the button: save the nearest memory in reach. */
function pickup(crew, memberId) {
  if (!running(crew)) return null;
  const g = crew.game;
  if (g.roles.pickup !== memberId) return null;
  let best = null, bd = PICKUP_R;
  g.world.mems.forEach((m) => {
    const c = g.capsules.find((x) => x.id === m.id);
    const d = Math.hypot(m.x - g.ship.x, m.y - g.ship.y);
    if (c && !c.collected && d < bd) {
      best = c;
      bd = d;
    }
  });
  if (!best) return { miss: true };
  best.collected = true;
  best.by = memberId;
  best.memoryIds.forEach((id) => (g.notes[id] = { how: "shared", savedBy: [memberId] }));
  crews.save();
  return { type: "flight_collected", capsuleId: best.id, by: memberId, byName: nameOf(crew, memberId), glimpse: best.glimpse };
}

/** Bring every remaining memory home (demo skip). */
function finishNow(crew) {
  const g = crew.game;
  g.capsules.forEach((c) => {
    c.collected = true;
    c.memoryIds.forEach((id) => (g.notes[id] = g.notes[id] || { how: "shared", savedBy: [] }));
  });
  g.finishedAt = now();
  crews.save();
}

/** Advance the one ship. Returns events for everyone (messages, penalties, rocks, completion). */
function step(crew) {
  const g = crew.game;
  if (!g || g.finishedAt) return [];
  const tn = now();
  const dt = Math.min(0.05, (tn - g.lastStep) / 1000);
  g.lastStep = tn;
  const t = (tn - g.startedAt) / 1000;
  const { UX, UY, PX, PY, PL, GOAL, along } = FW;
  const s = g.ship, I = g.inputs, W = g.world, ev = [];
  for (const k of ["steer", "throttle", "fire"]) if (tn - g.inputAt[k] > STALE_MS) I[k] = 0;
  g.inv = Math.max(0, g.inv - dt);
  g.sayCd = Math.max(0, g.sayCd - dt);
  const say = (text, dur = 2.2, force = false) => {
    if (g.sayCd > 0 && !force) return;
    g.sayCd = dur;
    ev.push({ type: "say", text, dur });
  };
  const penalty = (n, c) => {
    g.pen += n;
    ev.push({ type: "penalty", n, x: s.x, y: s.y, c });
  };

  s.av += (I.steer * 2.7 - s.av) * Math.min(1, dt * 8);
  s.a += s.av * dt;
  const th = (I.throttle > 0 ? 190 : 0) - (I.throttle < 0 ? 120 : 0);
  s.vx += Math.cos(s.a) * th * dt;
  s.vy += Math.sin(s.a) * th * dt;
  const da = I.alt - s.alt;
  s.alt += Math.sign(da) * Math.min(Math.abs(da), 1.3 * dt);

  // the gun is on the nose
  g.fireCd -= dt;
  if (I.fire && g.fireCd <= 0) {
    g.fireCd = 0.16;
    const c = Math.cos(s.a), n = Math.sin(s.a);
    g.bullets.push({ x: s.x + c * 22, y: s.y + n * 22, vx: c * 560 + s.vx, vy: n * 560 + s.vy, life: 1.1 });
  }

  // black holes
  for (const h of W.holes) {
    const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d < h.R) {
      const f = 340 * Math.pow(1 - d / h.R, 2);
      s.vx += (dx / d) * f * dt;
      s.vy += (dy / d) * f * dt;
    }
    if (d < h.core && g.inv <= 0) {
      const tt = h.x * UX + h.y * UY, p = along(Math.max(0, tt - 750), 0);
      s.x = p.x;
      s.y = p.y;
      s.vx = s.vy = 0;
      g.inv = 1.8;
      g.warps++;
      penalty(8, "#c9a0ff");
      ev.push({ type: "warp" });
      say("Pulled into a black hole — warped back.", 2.5, true);
    }
  }

  // debris: high debris catches you when you fly high, low debris when you fly low
  let drag = 0.55, inDebris = 0;
  for (const f of W.debris) {
    if (Math.hypot(f.x - s.x, f.y - s.y) < f.r && (f.layer ? s.alt > 0.35 : s.alt < 0.65)) {
      inDebris = f.layer ? 2 : 1;
      drag = 3.2;
    }
  }
  if (inDebris) {
    g.debrisAcc += dt;
    if (g.debrisAcc >= 1) {
      g.debrisAcc -= 1;
      penalty(1);
    }
    say(inDebris === 2 ? "Stuck in high debris — switch altitude to LOW!" : "Stuck in low debris — switch altitude to HIGH!", 0.8);
  } else g.debrisAcc = Math.min(g.debrisAcc, 0.5);
  s.vx *= Math.exp(-drag * dt);
  s.vy *= Math.exp(-drag * dt);
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > 320) {
    s.vx *= 320 / sp;
    s.vy *= 320 / sp;
  }

  // edge of charted space
  const tt = s.x * UX + s.y * UY, o = s.x * PX + s.y * PY;
  if (Math.abs(o) > 1600 || tt < -700 || tt > PL + 700) {
    const p = along(Math.min(PL, Math.max(0, tt)), 0), dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
    s.vx += (dx / d) * 230 * dt;
    s.vy += (dy / d) * 230 * dt;
    say("Leaving charted space — turn back.", 0.8);
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  // asteroids drift on the shared clock (the phones use the same formula to draw them)
  const gone = new Set(g.rocksGone);
  const rockXY = (r) => ({ x: r.x0 + r.vx * t, y: r.y0 + r.vy * t });
  const breakRock = (r, p) => {
    gone.add(r.id);
    g.rocksGone.push(r.id);
    ev.push({ type: "rock", id: r.id, x: p.x, y: p.y });
  };
  for (const r of W.rocks) {
    if (gone.has(r.id)) continue;
    const p = rockXY(r);
    const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < r.r + 14 && g.inv <= 0) {
      const nx = dx / d, ny = dy / d, vn = s.vx * nx + s.vy * ny;
      if (vn < 0) {
        s.vx -= 1.6 * vn * nx;
        s.vy -= 1.6 * vn * ny;
      }
      s.vx += nx * 120;
      s.vy += ny * 120;
      breakRock(r, p);
      g.hits++;
      g.inv = 0.4;
      penalty(3);
      ev.push({ type: "hit" });
      say("Hull hit! Shoot the rocks ahead.", 1.6, true);
    }
  }
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const r of W.rocks) {
        if (gone.has(r.id)) continue;
        const p = rockXY(r);
        if (Math.hypot(b.x - p.x, b.y - p.y) < r.r) {
          dead = true;
          g.rockHp[r.id] = (g.rockHp[r.id] ?? r.hp) - 1;
          if (g.rockHp[r.id] <= 0) breakRock(r, p);
          else ev.push({ type: "bullet_hit", x: b.x, y: b.y });
          break;
        }
      }
    }
    if (dead) g.bullets.splice(i, 1);
  }

  // dock once every memory is on board
  if (Math.hypot(GOAL.x - s.x, GOAL.y - s.y) < DOCK_R) {
    const left = g.capsules.filter((c) => !c.collected).length;
    if (!left) {
      g.finishedAt = tn;
      crews.save();
      ev.push({ type: "game_complete", time: Math.round((tn - g.startedAt) / 1000) + g.pen });
    } else say(`${left} ${left === 1 ? "memory is" : "memories are"} still out there. Follow the arrow!`, 1.2);
  }
  return ev;
}

module.exports = { MAX_PLAYERS, ROLES, create, view, shipState, input, pickup, finishNow, step, running };
