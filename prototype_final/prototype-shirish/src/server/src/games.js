// The two "bring the memories home" activities, played after the cargo hatch blows open.
//
//   flight     — "Flight to the UQ Space Faculty": ONE shared phone, everyone holds a corner
//                (engines / helm / altitude / gunner). Memory capsules are scattered on the route;
//                fly through them to save them, then dock. Runs in public/game/flight.html.
//   rescue     — (older per-phone version, no longer offered) every memory capsule is stuck in an asteroid somewhere in space. Each crewmate
//                gets a few (mostly other people's), blasts the rock away and fends off the
//                Forgetters. A capsule that's too much for one person (heavy, grabbed by a
//                Forgetter, or left alone too long) sends a distress signal to the whole crew.
//                Nothing is ever lost: it just becomes a group job.
//   colorgame  — the capsules have lost their colour. Each round flashes a colour from campus
//                (UQ purple, a jacaranda, a brush turkey's head…); everyone recreates it from
//                memory on their own phone. The crew's average guess restores that round's
//                memories. dial.gg-style scoring, 0–10, nobody "fails".
//
// Simulated crewmates (practice mode) play both games too, so one tester can run the whole
// thing alone. All state lives on crew.game and is saved with the crew.
const crews = require("./crews");
const { UQ_COLORS } = require("./uqColors");

const RESCUE = {
  maxCapsules: 12,
  hp: 24, // hits to free a normal capsule
  heavyHp: 60, // heavy capsules need the crew
  idleToHelpMs: 35000, // nobody touched your capsule for this long -> distress
  recentMs: 4000, // "is here helping" window
};
const COLORS = {
  showMs: 3800,
  guessMs: 25000,
  resultMs: 20000, // or sooner: once every real crewmate taps → next
};

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
  return { week: m.week, about: m.aboutId ? nameOf(crew, m.aboutId) : "the group", count: memoryIds.length };
}

// ---------------------------------------------------------------------------------------------
// Rescue mission
// ---------------------------------------------------------------------------------------------

function startRescue(crew) {
  const mems = shuffle(crew.memories);
  const count = Math.max(1, Math.min(RESCUE.maxCapsules, mems.length));
  const groups = Array.from({ length: count }, () => []);
  mems.forEach((m, i) => groups[i % count].push(m.id));

  const load = Object.fromEntries(crew.members.map((m) => [m.id, 0]));
  const capsules = groups.map((memoryIds, i) => {
    const authors = new Set(memoryIds.map((id) => crew.memories.find((m) => m.id === id)?.authorId));
    // You rescue someone else's memory where possible.
    const pool = crew.members.filter((m) => !authors.has(m.id));
    const candidates = (pool.length ? pool : crew.members).slice().sort((a, b) => load[a.id] - load[b.id]);
    const owner = candidates[0];
    load[owner.id]++;
    const heavy = count >= 4 && i % 4 === 3;
    const maxHp = heavy ? RESCUE.heavyHp : RESCUE.hp;
    return {
      id: `c${i + 1}`,
      memoryIds,
      ownerId: owner.id,
      heavy,
      maxHp,
      hp: maxHp,
      status: heavy ? "help" : "lost", // heavy ones call the crew straight away
      reason: heavy ? "heavy" : null,
      helpers: {}, // memberId -> hits
      lastHit: {}, // memberId -> ms
      createdAt: now(),
      lastHitAt: 0,
      savedAt: null,
      glimpse: glimpseOf(crew, memoryIds),
    };
  });
  crew.game = { type: "rescue", startedAt: now(), capsules, notes: {}, finishedAt: null, botFailed: {} };
  crews.setPhase(crew, "rescue");
}

function rescueView(crew) {
  const g = crew.game;
  const t = now();
  return {
    type: "rescue",
    startedAt: g.startedAt,
    finishedAt: g.finishedAt,
    serverNow: t,
    members: crew.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar || "nova", isSimulated: !!m.isSimulated })),
    capsules: g.capsules.map((c) => ({
      id: c.id,
      ownerId: c.ownerId,
      ownerName: nameOf(crew, c.ownerId),
      heavy: c.heavy,
      hp: Math.max(0, Math.round(c.hp)),
      maxHp: c.maxHp,
      status: c.status,
      reason: c.reason,
      glimpse: c.glimpse,
      helperIds: Object.keys(c.helpers),
      hereIds: Object.entries(c.lastHit)
        .filter(([, at]) => t - at < RESCUE.recentMs)
        .map(([id]) => id),
    })),
    saved: g.capsules.filter((c) => c.status === "saved").length,
    total: g.capsules.length,
  };
}

/** Returns an event to announce, if any. */
function rescueHit(crew, memberId, capsuleId, n) {
  const g = crew.game;
  if (crew.phase !== "rescue" || !g) return null;
  const c = g.capsules.find((x) => x.id === capsuleId);
  if (!c || c.status === "saved") return null;
  const hits = Math.max(0, Math.min(6, Number(n) || 0));
  if (!hits) return null;
  c.hp -= hits;
  c.helpers[memberId] = (c.helpers[memberId] || 0) + hits;
  c.lastHit[memberId] = now();
  c.lastHitAt = now();
  if (c.hp > 0) return null;
  c.hp = 0;
  c.status = "saved";
  c.savedAt = now();
  const savedBy = Object.keys(c.helpers);
  c.memoryIds.forEach((id) => (g.notes[id] = { how: "rescue", heavy: c.heavy, savedBy }));
  crews.save();
  return { type: "rescue_saved", capsuleId: c.id, glimpse: c.glimpse, savedBy: savedBy.map((id) => nameOf(crew, id)), savedByIds: savedBy, heavy: c.heavy };
}

function rescueFail(crew, memberId, capsuleId, reason) {
  const g = crew.game;
  if (crew.phase !== "rescue" || !g) return null;
  const c = g.capsules.find((x) => x.id === capsuleId);
  if (!c || c.status !== "lost") return null;
  c.status = "help";
  c.reason = ["grabbed", "idle", "tough"].includes(reason) ? reason : "tough";
  crews.save();
  return { type: "rescue_distress", capsuleId: c.id, ownerId: c.ownerId, ownerName: nameOf(crew, c.ownerId), reason: c.reason, glimpse: c.glimpse };
}

/** Once a second: simulated crewmates fly their missions; abandoned capsules call for help. */
function rescueTick(crew) {
  const g = crew.game;
  const events = [];
  const t = now();
  // abandoned capsules (owner left, or stuck) -> the crew gets a distress call
  g.capsules.forEach((c) => {
    if (c.status !== "lost") return;
    const owner = crews.findMember(crew, c.ownerId);
    if (owner?.isSimulated) return;
    const quietSince = Math.max(c.lastHitAt, g.startedAt + 6000);
    if (t - quietSince > RESCUE.idleToHelpMs) {
      const e = rescueFail(crew, c.ownerId, c.id, "idle");
      if (e) events.push(e);
    }
  });
  // simulated crewmates
  crew.members
    .filter((m) => m.isSimulated)
    .forEach((bot) => {
      const own = g.capsules.find((c) => c.ownerId === bot.id && c.status === "lost");
      const help = g.capsules.filter((c) => c.status === "help");
      // A bot's first capsule gets grabbed halfway, so a solo tester always sees a distress call.
      if (own && !g.botFailed[bot.id] && own.hp < own.maxHp * 0.55) {
        g.botFailed[bot.id] = true;
        const e = rescueFail(crew, bot.id, own.id, "grabbed");
        if (e) events.push(e);
        return;
      }
      if (own && Math.random() < 0.85) {
        const e = rescueHit(crew, bot.id, own.id, 1 + Math.round(Math.random() * 2));
        if (e) events.push(e);
      } else if (help.length) {
        // Help the capsule a human is already working on, if any: that's where the crew is.
        const hot = help.find((c) => Object.keys(c.lastHit).some((id) => t - c.lastHit[id] < RESCUE.recentMs)) || help[0];
        const e = rescueHit(crew, bot.id, hot.id, 1 + Math.round(Math.random()));
        if (e) events.push(e);
      }
    });
  if (!g.finishedAt && g.capsules.every((c) => c.status === "saved")) {
    g.finishedAt = t;
    crews.save();
    events.push({ type: "game_complete" });
  }
  return events;
}

// ---------------------------------------------------------------------------------------------
// Flight to the UQ Space Faculty — everyone flies their own ship in the same space, live.
// Every phone builds the same world from one seed (public/game/flightworld.js). Phones send their
// ship ~10×/sec; the server relays everyone's ships, shared asteroid hits and saved memories.
// Simulated crewmates fly too: each heads for a fair share of the memories, then waits at the
// faculty. A human has to dock to finish (or the demo skip).
// ---------------------------------------------------------------------------------------------
const FW = require("../public/game/flightworld.js");
const FLIGHT = { botSpeed: 95, collectR: 52 };

function startFlight(crew) {
  const mems = shuffle(crew.memories);
  const count = Math.max(1, Math.min(10, mems.length));
  const groups = Array.from({ length: count }, () => []);
  mems.forEach((m, i) => groups[i % count].push(m.id));
  const capsules = groups.map((memoryIds, i) => ({ id: `m${i + 1}`, memoryIds, collected: false, by: null, glimpse: glimpseOf(crew, memoryIds) }));
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

// ---------------------------------------------------------------------------------------------
// Colour restore
// ---------------------------------------------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function rgbToLab([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function labToRgb([L, a, b]) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const f = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  [x, y, z] = [f(x) * 0.95047, f(y), f(z) * 1.08883];
  let R = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let G = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let B = x * 0.0557 + y * -0.204 + z * 1.057;
  const g = (v) => 255 * (v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v);
  return [g(R), g(G), g(B)];
}
/** dial.gg-style 0–10: how close two colours look to a person (CIE76 distance). */
function colourScore(targetHex, guessHex) {
  const A = rgbToLab(hexToRgb(targetHex));
  const B = rgbToLab(hexToRgb(guessHex));
  const dE = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  return Math.round(Math.max(0, 10 * (1 - dE / 75)) * 100) / 100;
}
function averageHex(hexes) {
  const labs = hexes.map((h) => rgbToLab(hexToRgb(h)));
  const avg = [0, 1, 2].map((i) => labs.reduce((s, l) => s + l[i], 0) / labs.length);
  return rgbToHex(labToRgb(avg));
}

function startColors(crew) {
  const mems = shuffle(crew.memories);
  const rounds = Math.max(3, Math.min(5, Math.ceil(mems.length / 2)));
  const targets = shuffle(UQ_COLORS).slice(0, rounds);
  const groups = Array.from({ length: rounds }, () => []);
  mems.forEach((m, i) => groups[i % rounds].push(m.id));
  crew.game = {
    type: "colorgame",
    startedAt: now(),
    rounds: targets.map((target, i) => ({ target, memoryIds: groups[i], guesses: {}, crewHex: null, crewScore: null, botAt: {}, next: {} })),
    round: 0,
    stage: "show",
    stageStartedAt: now(),
    notes: {},
    finishedAt: null,
  };
  crews.setPhase(crew, "colorgame");
  planBots(crew);
}

function planBots(crew) {
  const r = crew.game.rounds[crew.game.round];
  if (!r) return;
  crew.members.filter((m) => m.isSimulated).forEach((m) => (r.botAt[m.id] = 3500 + Math.random() * 9000));
}

function colorsView(crew) {
  const g = crew.game;
  const r = g.rounds[g.round];
  const showColour = g.stage === "show" || g.stage === "result" || g.stage === "done";
  const stageMs = { show: COLORS.showMs, guess: COLORS.guessMs, result: COLORS.resultMs }[g.stage] || 0;
  return {
    type: "colorgame",
    serverNow: now(),
    round: g.round,
    rounds: g.rounds.length,
    stage: g.stage,
    stageStartedAt: g.stageStartedAt,
    stageMs,
    members: crew.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar || "nova", isSimulated: !!m.isSimulated })),
    target: r ? { name: r.target.name, art: r.target.art, hint: r.target.hint, emoji: r.target.emoji, hex: showColour ? r.target.hex : null } : null,
    lockedIn: r ? Object.keys(r.guesses) : [],
    nextVotes: r ? Object.keys(r.next || {}) : [],
    results:
      r && (g.stage === "result" || g.stage === "done")
        ? Object.entries(r.guesses)
            .map(([id, guess]) => ({ id, name: nameOf(crew, id), avatar: crews.findMember(crew, id)?.avatar, hex: guess.hex, score: guess.score }))
            .sort((a, b) => b.score - a.score)
        : null,
    crewHex: r?.crewHex || null,
    crewScore: r?.crewScore ?? null,
    // every round so far: how each batch of memories came back
    capsules: g.rounds.map((x, i) => ({
      round: i,
      count: x.memoryIds.length,
      restored: x.crewHex != null,
      hex: x.crewHex,
      art: x.target.art,
      target: x.crewHex != null ? x.target.hex : null,
      score: x.crewScore,
      glimpses: x.crewHex != null ? x.memoryIds.map((id) => glimpseOf(crew, [id])) : [],
    })),
    finishedAt: g.finishedAt,
  };
}

function colorGuess(crew, memberId, hex) {
  const g = crew.game;
  if (crew.phase !== "colorgame" || !g || g.stage !== "guess") return { error: "Not guessing right now." };
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return { error: "Bad colour." };
  const r = g.rounds[g.round];
  r.guesses[memberId] = { hex: hex.toLowerCase(), score: colourScore(r.target.hex, hex), at: now() };
  crews.save();
  return { ok: true };
}

/** The lamp: a quick peek at the real colour, twice per player per game. */
function colorHint(crew, memberId) {
  const g = crew.game;
  if (crew.phase !== "colorgame" || g?.stage !== "guess") return { error: "Not now." };
  g.hints = g.hints || {};
  if ((g.hints[memberId] || 0) >= 2) return { error: "No peeks left." };
  g.hints[memberId] = (g.hints[memberId] || 0) + 1;
  crews.save();
  return { hex: g.rounds[g.round].target.hex, left: 2 - g.hints[memberId] };
}

/** "→" on the results screen: the round moves on once every real crewmate has tapped it. */
function colorNext(crew, memberId) {
  const g = crew.game;
  if (crew.phase !== "colorgame" || g?.stage !== "result") return;
  const r = g.rounds[g.round];
  r.next = r.next || {};
  r.next[memberId] = true;
}

function setStage(crew, stage) {
  crew.game.stage = stage;
  crew.game.stageStartedAt = now();
  crews.save();
}

function closeRound(crew) {
  const g = crew.game;
  const r = g.rounds[g.round];
  const hexes = Object.values(r.guesses).map((x) => x.hex);
  r.crewHex = hexes.length ? averageHex(hexes) : r.target.hex; // nobody guessed: it still comes home
  r.crewScore = hexes.length ? colourScore(r.target.hex, r.crewHex) : 0;
  r.memoryIds.forEach((id) => (g.notes[id] = { how: "colors", round: g.round + 1, target: r.target.name, crewScore: r.crewScore }));
  setStage(crew, "result");
}

/** Four times a second: move the stages along; simulated crewmates lock in their guesses. */
function colorsTick(crew) {
  const g = crew.game;
  const events = [];
  if (g.finishedAt) return events;
  const t = now();
  const el = t - g.stageStartedAt;
  const r = g.rounds[g.round];
  if (g.stage === "show" && el > COLORS.showMs) {
    setStage(crew, "guess");
    events.push({ type: "state" });
  } else if (g.stage === "guess") {
    let changed = false;
    crew.members
      .filter((m) => m.isSimulated && !r.guesses[m.id] && el > (r.botAt[m.id] || 5000))
      .forEach((m) => {
        // a decent but imperfect memory of the colour
        const lab = rgbToLab(hexToRgb(r.target.hex)).map((v, i) => v + (Math.random() - 0.5) * (i === 0 ? 22 : 34));
        colorGuess(crew, m.id, rgbToHex(labToRgb(lab)));
        changed = true;
      });
    const all = crew.members.every((m) => r.guesses[m.id]);
    if (all || el > COLORS.guessMs) {
      closeRound(crew);
      events.push({ type: "state" });
    } else if (changed) events.push({ type: "state" });
  } else if (g.stage === "result" && (el > COLORS.resultMs || (el > 1500 && crew.members.filter((m) => !m.isSimulated).every((m) => r.next && r.next[m.id])))) {
    if (g.round + 1 >= g.rounds.length) {
      g.stage = "done";
      g.finishedAt = t;
      crews.save();
      events.push({ type: "game_complete" });
    } else {
      g.round++;
      planBots(crew);
      setStage(crew, "show");
      events.push({ type: "state" });
    }
  }
  return events;
}

// ---------------------------------------------------------------------------------------------

function start(crew, activity) {
  if (activity === "rescue") startFlight(crew);
  else if (activity === "colors") startColors(crew);
}

function view(crew) {
  if (!crew.game) return null;
  if (crew.game.type === "flight") return flightView(crew);
  return crew.game.type === "rescue" ? rescueView(crew) : colorsView(crew);
}

/** The small bit every phone's app needs (the game itself has its own state stream). */
function summary(crew) {
  const g = crew.game;
  const base = { type: g.type, finishedAt: g.finishedAt };
  if (g.type === "flight") {
    return { ...base, collected: g.capsules.filter((c) => c.collected).length, total: g.capsules.length };
  }
  return base;
}

function tick(crew) {
  if (crew.phase === "rescue" && crew.game?.type === "rescue") return rescueTick(crew);
  if (crew.phase === "colorgame" && crew.game?.type === "colorgame") return colorsTick(crew);
  return [];
}

/** Demo: finish whatever game is running (every remaining memory comes home). */
function finishNow(crew) {
  const g = crew.game;
  if (!g) return;
  if (g.type === "flight") {
    const crewIds = crew.members.filter((m) => !m.isSimulated).map((m) => m.id);
    g.capsules.forEach((c) => {
      c.collected = true;
      c.memoryIds.forEach((id) => (g.notes[id] = g.notes[id] || { how: "flight", savedBy: crewIds }));
    });
    g.finishedAt = now();
  } else if (g.type === "rescue") {
    g.capsules
      .filter((c) => c.status !== "saved")
      .forEach((c) => {
        c.status = "saved";
        c.hp = 0;
        const savedBy = Object.keys(c.helpers).length ? Object.keys(c.helpers) : [c.ownerId];
        c.memoryIds.forEach((id) => (g.notes[id] = { how: "rescue", heavy: c.heavy, savedBy }));
      });
  } else {
    while (g.round < g.rounds.length) {
      const r = g.rounds[g.round];
      if (r.crewHex == null) {
        r.crewHex = r.target.hex;
        r.crewScore = 10;
        r.memoryIds.forEach((id) => (g.notes[id] = { how: "colors", round: g.round + 1, target: r.target.name, crewScore: 10 }));
      }
      g.round++;
    }
    g.round = g.rounds.length - 1;
    g.stage = "done";
  }
  g.finishedAt = now();
  crews.save();
}

module.exports = { summary, start, view, tick, rescueHit, rescueFail, colorGuess, colorNext, colorHint, finishNow, colourScore, flightCollect, flightPos, flightRock, flightDock, flightTick, flightShips };
