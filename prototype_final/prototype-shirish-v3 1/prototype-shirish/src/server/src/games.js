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
  return { week: m.week, capsule: crew.memories.indexOf(m) + 1, about: m.aboutId ? nameOf(crew, m.aboutId) : "the group", count: memoryIds.length };
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
const shared = require("./sharedship");

/** The memory capsules floating along the route (shared by both flight modes). */
function buildCapsules(crew) {
  const mems = shuffle(crew.memories);
  const count = Math.max(1, Math.min(5, mems.length));
  const groups = Array.from({ length: count }, () => []);
  mems.forEach((m, i) => groups[i % count].push(m.id));
  return groups.map((memoryIds, i) => ({ id: `m${i + 1}`, memoryIds, collected: false, by: null, glimpse: glimpseOf(crew, memoryIds) }));
}

/** "One ship": a single ship flown by the whole crew, each person holding one or more of the five controls. */
function startShared(crew) {
  crew.game = shared.create(crew, buildCapsules(crew), Math.floor(Math.random() * 1e9));
  crews.setPhase(crew, "rescue");
}

// ---------------------------------------------------------------------------------------------

/** The rescue mission: one ship flown by the whole crew, each person holding one or more of the five controls. */
function start(crew, activity) {
  if (activity !== "rescue") return { error: "Pick an activity." };
  if (crew.members.filter((m) => !m.isSimulated).length > 5) return { error: "The rescue ship takes 5 players at most." };
  startShared(crew);
  return { ok: true };
}

function view(crew) {
  if (!crew.game) return null;
  return crew.game.type === "shared" ? shared.view(crew) : null; // old saved games (a ship each, colours) are gone
}

/** The small bit every phone's app needs (the game itself has its own state stream). */
function summary(crew) {
  const g = crew.game;
  const base = { type: g.type, finishedAt: g.finishedAt };
  if (g.type === "flight" || g.type === "shared") {
    return { ...base, collected: g.capsules.filter((c) => c.collected).length, total: g.capsules.length };
  }
  return base;
}

function tick(crew) {
  if (crew.phase === "rescue" && crew.game?.type === "rescue") return rescueTick(crew);
  return [];
}

/** Demo: finish whatever game is running (every remaining memory comes home). */
function finishNow(crew) {
  const g = crew.game;
  if (!g || g.type === "setup") return;
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
  } else if (g.type === "shared") {
    return shared.finishNow(crew);
  }
  g.finishedAt = now();
  crews.save();
}

module.exports = { summary, start, view, tick, rescueHit, rescueFail, finishNow };
