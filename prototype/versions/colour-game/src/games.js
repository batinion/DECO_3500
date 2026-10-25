// "Colour restore" — dial.gg-style colour memory game.
// Each round flashes a colour from campus (UQ purple, a jacaranda, a brush turkey's head...);
// everyone recreates it from memory on their own phone. The crew's average guess restores that
// round's memories. Scoring is 0-10, nobody "fails". Simulated crewmates play too.
const crews = require("./rooms");
const { UQ_COLORS } = require("./uqColors");

const COLORS = {
  showMs: 3800,
  guessMs: 25000,
  resultMs: 20000, // or sooner: once every real crewmate taps -> next
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

function start(crew) {
  startColors(crew);
}

function view(crew) {
  return crew.game ? colorsView(crew) : null;
}

function tick(crew) {
  if (crew.phase === "colorgame" && crew.game?.type === "colorgame") return colorsTick(crew);
  return [];
}

/** Demo: finish the game (every round comes home at full score). */
function finishNow(crew) {
  const g = crew.game;
  if (!g || g.type !== "colorgame") return;
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
  g.finishedAt = now();
  crews.save();
}

module.exports = { start, view, tick, finishNow, colorGuess, colorNext, colorHint, colourScore };
