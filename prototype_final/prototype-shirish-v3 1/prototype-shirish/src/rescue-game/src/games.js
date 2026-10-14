// "Rescue your memories" — flight to the UQ Space Faculty.
// Everyone flies their own ship in the same space, live. Every phone builds the same world from
// one seed (public/game/flightworld.js). Phones send their ship ~10x/sec; the server relays
// everyone's ships, shared asteroid hits and saved memories. Simulated crewmates fly too: each
// heads for a fair share of the memories, then waits at the faculty. A human has to dock to
// finish (or use the demo skip).
const crews = require("./rooms");
const shared = require("./sharedship");

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

function glimpseOf(crew, memoryIds) {
  const m = crew.memories.find((x) => x.id === memoryIds[0]);
  if (!m) return { week: null, about: "the group" };
  return { week: m.week, capsule: crew.memories.indexOf(m) + 1, about: m.aboutId ? nameOf(crew, m.aboutId) : "the group", count: memoryIds.length };
}

const FW = require("../public/game/flightworld.js");
const FLIGHT = { botSpeed: 95, collectR: 52 };

/** The memory capsules floating along the route (shared by both game modes). */
function buildCapsules(crew) {
  const mems = shuffle(crew.memories);
  const count = Math.max(1, Math.min(10, mems.length));
  const groups = Array.from({ length: count }, () => []);
  mems.forEach((m, i) => groups[i % count].push(m.id));
  return groups.map((memoryIds, i) => ({ id: `m${i + 1}`, memoryIds, collected: false, by: null, glimpse: glimpseOf(crew, memoryIds) }));
}

function startShared(crew) {
  crew.game = shared.create(crew, buildCapsules(crew), Math.floor(Math.random() * 1e9));
  crews.setPhase(crew, "rescue");
}

function startFlight(crew) {
  const capsules = buildCapsules(crew);
  const count = capsules.length;
  const seed = Math.floor(Math.random() * 1e9);
  const world = FW.gen(seed, capsules.map((c) => ({ id: c.id, glimpse: c.glimpse })));
  const ships = {};
  crew.members.forEach((m, i) => {
    const p = FW.startPos(i, crew.members.length);
    ships[m.id] = { x: p.x, y: p.y, a: Math.atan2(FW.UY, FW.UX), alt: 0, firing: 0, at: 0 };
  });
  const humans = crew.members.filter((m) => !m.isSimulated).length || 1;
  crew.game = {
    type: "flight",
    startedAt: now(),
    seed,
    capsules,
    memPos: Object.fromEntries(world.mems.map((m) => [m.id, { x: m.x, y: m.y }])),
    ships,
    rocksGone: [],
    botShare: Math.max(1, Math.floor(count / crew.members.length)), // memories each bot may grab
    humans,
    notes: {},
    finishedAt: null,
  };
  crews.setPhase(crew, "rescue");
}

function flightView(crew) {
  const g = crew.game;
  return {
    type: "flight",
    serverNow: now(),
    startedAt: g.startedAt,
    seed: g.seed,
    members: crew.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar || "nova", isSimulated: !!m.isSimulated })),
    capsules: g.capsules.map((c) => ({ id: c.id, collected: c.collected, by: c.by, byName: c.by ? nameOf(crew, c.by) : null, glimpse: c.glimpse })),
    rocksGone: g.rocksGone,
    collected: g.capsules.filter((c) => c.collected).length,
    total: g.capsules.length,
    finishedAt: g.finishedAt,
  };
}

function flightCollect(crew, memberId, capsuleId) {
  const g = crew.game;
  if (crew.phase !== "rescue" || g?.type !== "flight") return null;
  const c = g.capsules.find((x) => x.id === capsuleId);
  if (!c || c.collected) return null;
  c.collected = true;
  c.by = memberId;
  c.memoryIds.forEach((id) => (g.notes[id] = { how: "flight", savedBy: [memberId] }));
  crews.save();
  return { type: "flight_collected", capsuleId, by: memberId, byName: nameOf(crew, memberId), glimpse: c.glimpse };
}

/** A phone reports its ship. Not saved to disk (it changes 10×/sec). */
function flightPos(crew, memberId, p) {
  const g = crew.game;
  if (g?.type !== "flight" || !p) return;
  const n = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  g.ships[memberId] = { x: n(p.x), y: n(p.y), a: n(p.a), alt: Math.max(0, Math.min(1, n(p.alt))), firing: p.firing ? 1 : 0, at: now() };
}

function flightRock(crew, rockId) {
  const g = crew.game;
  if (g?.type !== "flight" || typeof rockId !== "string" || g.rocksGone.includes(rockId)) return false;
  g.rocksGone.push(rockId);
  return true;
}

/** Someone flew into the faculty with every memory on board. */
function flightDock(crew) {
  const g = crew.game;
  if (g?.type !== "flight" || g.finishedAt) return null;
  if (!g.capsules.every((c) => c.collected)) return null;
  g.finishedAt = now();
  crews.save();
  return { type: "game_complete", time: Math.round((g.finishedAt - g.startedAt) / 1000) };
}

/** Ten times a second: simulated crewmates fly; returns events + the ships to relay. */
function flightTick(crew, dt) {
  const g = crew.game;
  const events = [];
  crew.members
    .filter((m) => m.isSimulated)
    .forEach((bot, bi) => {
      const sh = g.ships[bot.id];
      if (!sh) return;
      const mine = g.capsules.filter((c) => c.by === bot.id).length;
      // wait a few seconds so humans get going first
      if (now() - g.startedAt < 5000 + bi * 2000) return;
      let target = null;
      if (mine < g.botShare) {
        // nearest free memory that no other bot is heading to
        const taken = new Set(Object.values(g.botTargets || {}));
        let best = 1e12;
        g.capsules.forEach((c) => {
          if (c.collected || (taken.has(c.id) && (g.botTargets || {})[bot.id] !== c.id)) return;
          const p = g.memPos[c.id];
          const d = Math.hypot(p.x - sh.x, p.y - sh.y);
          if (d < best) { best = d; target = { id: c.id, ...p }; }
        });
      }
      g.botTargets = g.botTargets || {};
      g.botTargets[bot.id] = target ? target.id : null;
      const dest = target || { x: FW.GOAL.x + Math.cos(bi * 2) * 220, y: FW.GOAL.y + Math.sin(bi * 2) * 220 };
      const dx = dest.x - sh.x, dy = dest.y - sh.y, d = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      let da = ((want - sh.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      sh.a += Math.max(-3 * dt, Math.min(3 * dt, da));
      if (d > 30) {
        const sp = FLIGHT.botSpeed * Math.max(0.2, Math.cos(da));
        sh.x += Math.cos(sh.a) * sp * dt;
        sh.y += Math.sin(sh.a) * sp * dt;
      }
      sh.firing = d > 200 && Math.random() < 0.3 ? 1 : 0;
      sh.at = now();
      if (target && d < FLIGHT.collectR) {
        const e = flightCollect(crew, bot.id, target.id);
        if (e) events.push(e);
      }
    });
  return events;
}

function flightShips(crew) {
  const g = crew.game;
  return Object.entries(g.ships).map(([id, s]) => ({ id, x: Math.round(s.x), y: Math.round(s.y), a: +s.a.toFixed(3), alt: +s.alt.toFixed(2), firing: s.firing }));
}

/** crew.mode: "classic" (a ship each) or "shared" (one ship, shared controls). */
function start(crew) {
  if (crew.mode === "shared") startShared(crew);
  else startFlight(crew);
}

function view(crew) {
  if (!crew.game) return null;
  return crew.game.type === "shared" ? shared.view(crew) : flightView(crew);
}

/** Demo: bring every remaining memory home straight away. */
function finishNow(crew) {
  const g = crew.game;
  if (!g) return;
  if (g.type === "shared") return shared.finishNow(crew);
  const crewIds = crew.members.filter((m) => !m.isSimulated).map((m) => m.id);
  g.capsules.forEach((c) => {
    c.collected = true;
    c.memoryIds.forEach((id) => (g.notes[id] = g.notes[id] || { how: "flight", savedBy: crewIds }));
  });
  g.finishedAt = now();
  crews.save();
}

module.exports = { start, view, finishNow, flightCollect, flightPos, flightRock, flightDock, flightTick, flightShips };
