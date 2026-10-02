// Crew state — replaces the old single global "session" that a Mission Control host drove.
//
// There is no host any more. Anyone can start a crew, and everyone in it has the same
// controls. A crew lives for a whole semester: crewmates drop memories in whenever they
// like (each one dated with the semester week), and the rocket only launches once every
// crewmate has said they're ready. Everything is saved to data/crews.json so a crew
// survives server restarts and people can come back days or weeks later.
const fs = require("fs");
const path = require("path");
const { customAlphabet, nanoid } = require("nanoid");
const { dealColors } = require("./colors");

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const MAX_MEMBERS = 6;
const MIN_MEMBERS_TO_LAUNCH = 2;
const MIN_MEMORIES_TO_BE_READY = 3; // per person, collected across the whole semester
const SEMESTER_WEEKS = 13;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PHASES = ["collecting", "launching", "cruising", "arrived", "timejump", "earth", "puzzle", "revealed"];
const FAKE_NAMES = ["Noah", "Ruben", "Ed", "Priya", "Mei"];
const AVATARS = ["nova", "comet", "orbit", "luna", "pixel", "sprout", "blaze", "moji"];

/** The character someone picked, or a free one if they didn't pick / it's taken. */
function chooseAvatar(crew, wanted) {
  const taken = crew.members.map((m) => m.avatar);
  if (AVATARS.includes(wanted)) return wanted;
  const free = AVATARS.filter((a) => !taken.includes(a));
  const pool = free.length ? free : AVATARS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "crews.json");

/** code -> crew */
const crews = new Map();

// ---- persistence -------------------------------------------------------------

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    (raw.crews || []).forEach((c) => crews.set(c.code, c));
  } catch (e) {
    // first run, or unreadable file: start empty
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ crews: [...crews.values()] }, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  }, 150);
}

load();

// ---- helpers -------------------------------------------------------------------

function getCrew(code) {
  return code ? crews.get(String(code).trim().toUpperCase()) || null : null;
}

function allCrews() {
  return [...crews.values()];
}

function findMember(crew, memberId) {
  return crew?.members.find((m) => m.id === memberId) || null;
}

/** Semester week (1..13). Real time since the crew started, plus any demo fast-forward. */
function currentWeek(crew) {
  const real = Math.floor((Date.now() - crew.createdAt) / WEEK_MS);
  return Math.min(SEMESTER_WEEKS, 1 + real + (crew.weekOffset || 0));
}

function setPhase(crew, phase) {
  crew.phase = phase;
  crew.phaseStartedAt = Date.now();
  crew.timeJumpStep = 0;
  crew.stepStartedAt = crew.phaseStartedAt;
  save();
}

function setTimeJumpStep(crew, step) {
  crew.timeJumpStep = step;
  crew.stepStartedAt = Date.now();
  save();
}

function atLeast(crew, phase) {
  return PHASES.indexOf(crew.phase) >= PHASES.indexOf(phase);
}

function cleanName(name, fallback) {
  return String(name || "").trim().slice(0, 40) || fallback;
}

// ---- crew lifecycle --------------------------------------------------------------

function createCrew({ crewName, memberName, avatar }) {
  let code;
  do code = makeCode();
  while (crews.has(code));
  const now = Date.now();
  const crew = {
    code,
    name: cleanName(crewName, "Our crew"),
    createdAt: now,
    weekOffset: 0,
    phase: "collecting",
    phaseStartedAt: now,
    timeJumpStep: 0,
    stepStartedAt: now,
    members: [],
    memories: [],
    activity: [], // sealed feed: who added a memory, about whom, when — never the content
    puzzleAnswer: null,
  };
  crews.set(code, crew);
  const { member } = addMember(crew, memberName, { avatar });
  return { crew, member };
}

function addMember(crew, name, { simulated = false, avatar = null } = {}) {
  if (crew.phase !== "collecting") return { error: "This crew has already launched." };
  if (crew.members.length >= MAX_MEMBERS) return { error: `This crew is full (${MAX_MEMBERS} max).` };
  const member = {
    id: nanoid(),
    name: cleanName(name, "Anonymous"),
    engineSlot: crew.members.length + 1,
    joinedAt: Date.now(),
    joinedWeek: currentWeek(crew),
    ready: false,
    isSimulated: simulated,
    avatar: chooseAvatar(crew, avatar),
    colors: null,
  };
  crew.members.push(member);
  logActivity(crew, { type: "joined", memberId: member.id });
  save();
  return { member };
}

function logActivity(crew, item) {
  crew.activity.push({ id: nanoid(8), at: Date.now(), week: currentWeek(crew), ...item });
  if (crew.activity.length > 200) crew.activity.splice(0, crew.activity.length - 200);
}

// ---- memories -----------------------------------------------------------------------

function memoryCount(crew, memberId) {
  return crew.memories.filter((m) => m.authorId === memberId).length;
}

/**
 * One memory = one filled-in star (or a free-write, or a sketch/photo with a caption).
 * Memories are added one at a time, any time during the semester, and stay sealed until
 * the capsule opens.
 */
function addMemory(crew, memberId, input = {}) {
  const author = findMember(crew, memberId);
  if (!author) return { error: "You're not in this crew." };
  if (crew.phase !== "collecting") return { error: "The capsule is sealed — the rocket has launched." };

  const kind = ["prompt", "free", "media"].includes(input.kind) ? input.kind : "prompt";
  const filledText = Array.isArray(input.filledText) ? input.filledText.map((t) => String(t || "").slice(0, 500)) : [];
  const text = String(input.text || "").slice(0, 1200).trim();
  const photo = typeof input.photo === "string" ? input.photo : null;
  const drawing = typeof input.drawing === "string" ? input.drawing : null;
  const about = findMember(crew, input.aboutId);

  if (kind === "media" && !photo && !drawing) return { error: "Add a sketch or a photo first." };
  if (kind !== "media" && !text && !filledText.some((t) => t.trim())) return { error: "Write something first." };
  if (about && about.id === author.id) return { error: "Memories are about your crewmates, not yourself." };

  const memory = {
    id: nanoid(10),
    authorId: author.id,
    kind,
    promptId: input.promptId || null,
    template: input.template || null,
    filledText,
    text, // the finished, readable sentence (or free text / caption)
    aboutId: about ? about.id : null,
    photo,
    drawing,
    week: currentWeek(crew),
    createdAt: Date.now(),
  };
  crew.memories.push(memory);
  logActivity(crew, { type: "memory", memberId: author.id, aboutId: memory.aboutId, kind });
  save();
  return { memory };
}

/** A person can take back their own memory while the capsule is still open. */
function removeMemory(crew, memberId, memoryId) {
  if (crew.phase !== "collecting") return { error: "The capsule is sealed." };
  const i = crew.memories.findIndex((m) => m.id === memoryId && m.authorId === memberId);
  if (i < 0) return { error: "Memory not found." };
  crew.memories.splice(i, 1);
  const me = findMember(crew, memberId);
  if (me && memoryCount(crew, memberId) < MIN_MEMORIES_TO_BE_READY) me.ready = false;
  save();
  return { ok: true };
}

// ---- launch readiness (replaces the host's controls) ------------------------------------

function setAvatar(crew, memberId, avatar) {
  const me = findMember(crew, memberId);
  if (!me) return { error: "You're not in this crew." };
  if (!AVATARS.includes(avatar)) return { error: "Unknown character." };
  me.avatar = avatar;
  save();
  return { ok: true };
}

function setReady(crew, memberId, ready) {
  const me = findMember(crew, memberId);
  if (!me) return { error: "You're not in this crew." };
  if (crew.phase !== "collecting") return { error: "Already launched." };
  if (ready && memoryCount(crew, memberId) < MIN_MEMORIES_TO_BE_READY) {
    return { error: `Add at least ${MIN_MEMORIES_TO_BE_READY} memories before you're ready to launch.` };
  }
  if (me.ready !== !!ready) {
    me.ready = !!ready;
    logActivity(crew, { type: ready ? "ready" : "unready", memberId });
    save();
  }
  return { ok: true };
}

function everyoneReady(crew) {
  return crew.members.length >= MIN_MEMBERS_TO_LAUNCH && crew.members.every((m) => m.ready);
}

function revealColors(crew) {
  const used = [];
  crew.members.forEach((m) => {
    const dealt = dealColors(2, used);
    dealt.forEach((c) => used.push(c.hex));
    m.colors = dealt;
  });
  save();
}

function recordPuzzleAnswer(crew, memberId, fileUrl) {
  if (crew.puzzleAnswer) return { error: "The puzzle answer has already been uploaded." };
  const m = findMember(crew, memberId);
  if (!m) return { error: "You're not in this crew." };
  crew.puzzleAnswer = { memberId, name: m.name, fileUrl, uploadedAt: Date.now() };
  setPhase(crew, "revealed");
  return { puzzleAnswer: crew.puzzleAnswer };
}

// ---- public views --------------------------------------------------------------------------

function publicMember(crew, m) {
  return {
    id: m.id,
    name: m.name,
    engineSlot: m.engineSlot,
    ready: m.ready,
    isSimulated: !!m.isSimulated,
    avatar: m.avatar || "nova",
    joinedWeek: m.joinedWeek,
    memoryCount: memoryCount(crew, m.id),
    // How many memories are *about* this person — a sealed teaser, never the content.
    aboutCount: crew.memories.filter((x) => x.aboutId === m.id).length,
  };
}

/** Full readable capsule, only once it's open: every memory, in the order it was made. */
function buildCapsule(crew) {
  const name = (id) => findMember(crew, id)?.name || null;
  const memories = [...crew.memories]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => ({
      id: m.id,
      kind: m.kind,
      text: m.text,
      week: m.week,
      createdAt: m.createdAt,
      authorId: m.authorId,
      authorName: name(m.authorId),
      aboutId: m.aboutId,
      aboutName: name(m.aboutId),
      photo: m.photo,
      drawing: m.drawing,
    }));

  // A few "awards" so the reveal has something to talk about as a group.
  const aboutCounts = {};
  const weekCounts = {};
  memories.forEach((m) => {
    if (m.aboutId) aboutCounts[m.aboutId] = (aboutCounts[m.aboutId] || 0) + 1;
    weekCounts[m.week] = (weekCounts[m.week] || 0) + 1;
  });
  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || null;
  const mostRemembered = top(aboutCounts);
  const busiestWeek = top(weekCounts);
  const authorCounts = {};
  memories.forEach((m) => (authorCounts[m.authorId] = (authorCounts[m.authorId] || 0) + 1));
  const chiefHistorian = top(authorCounts);

  return {
    memories,
    members: crew.members.map((m) => ({ id: m.id, name: m.name, colors: m.colors, avatar: m.avatar || "nova" })),
    highlights: {
      total: memories.length,
      weeksCovered: Object.keys(weekCounts).length,
      mostRemembered: mostRemembered ? { name: name(mostRemembered[0]), count: mostRemembered[1] } : null,
      busiestWeek: busiestWeek ? { week: Number(busiestWeek[0]), count: busiestWeek[1] } : null,
      chiefHistorian: chiefHistorian ? { name: name(chiefHistorian[0]), count: chiefHistorian[1] } : null,
    },
  };
}

// ---- demo helpers (for testing alone / showing "a semester" in a few minutes) ---------------

function fastForwardWeek(crew) {
  if (crew.phase !== "collecting") return { error: "Already launched." };
  if (currentWeek(crew) >= SEMESTER_WEEKS) return { error: "It's already the end of semester." };
  crew.weekOffset = (crew.weekOffset || 0) + 1;
  logActivity(crew, { type: "week" });
  save();
  return { week: currentWeek(crew) };
}

const CANNED = [
  { template: "{name}'s Merlo order is __, no exceptions.", fill: ["a large oat flat white"] },
  { template: "In crit, {name} defended our idea by saying __.", fill: ["\"users don't read, they scan\""] },
  { template: "The night before the deadline, {name} was __.", fill: ["re-exporting the Figma file for the fourth time"] },
  { template: "{name} could spend hours on the Miro board just __.", fill: ["colour-coding sticky notes"] },
  { template: "During user testing, {name} __.", fill: ["laughed so hard the participant joined in"] },
  { template: "I never told {name} this but __.", fill: ["their sketches made our pitch"] },
];

function addSimulatedMember(crew) {
  const taken = crew.members.map((m) => m.name);
  const name = FAKE_NAMES.find((n) => !taken.includes(n)) || `Crew ${crew.members.length + 1}`;
  return addMember(crew, name, { simulated: true });
}

/** Each simulated crewmate drops one memory about a random real crewmate. */
function simulateMemories(crew) {
  const sims = crew.members.filter((m) => m.isSimulated);
  const added = [];
  sims.forEach((sim) => {
    const others = crew.members.filter((m) => m.id !== sim.id);
    if (!others.length) return;
    const about = others[Math.floor(Math.random() * others.length)];
    const c = CANNED[Math.floor(Math.random() * CANNED.length)];
    let i = 0;
    const text = c.template.replace("{name}", about.name).replace(/__/g, () => c.fill[i++] || "…");
    const r = addMemory(crew, sim.id, { kind: "prompt", template: c.template, filledText: c.fill, text, aboutId: about.id });
    if (r.memory) added.push(r.memory);
  });
  return added;
}

/** Simulated crewmates top up to the minimum and say they're ready. */
function readySimulated(crew) {
  crew.members
    .filter((m) => m.isSimulated)
    .forEach((m) => {
      while (memoryCount(crew, m.id) < MIN_MEMORIES_TO_BE_READY) {
        const before = crew.memories.length;
        simulateMemories(crew);
        if (crew.memories.length === before) break;
      }
      setReady(crew, m.id, true);
    });
}

module.exports = {
  MAX_MEMBERS,
  MIN_MEMBERS_TO_LAUNCH,
  MIN_MEMORIES_TO_BE_READY,
  SEMESTER_WEEKS,
  PHASES,
  getCrew,
  allCrews,
  findMember,
  createCrew,
  addMember,
  addMemory,
  removeMemory,
  memoryCount,
  setReady,
  setAvatar,
  everyoneReady,
  revealColors,
  recordPuzzleAnswer,
  publicMember,
  buildCapsule,
  currentWeek,
  setPhase,
  setTimeJumpStep,
  atLeast,
  fastForwardWeek,
  addSimulatedMember,
  simulateMemories,
  readySimulated,
  save,
};
