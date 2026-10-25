// In-memory rooms for the standalone activity. A "crew" here is just a room: a few players
// (real or simulated), a pile of sample memories for the game to rescue, and the game state.
// Nothing is saved to disk; rooms disappear after a few idle hours or when the server stops.
const crypto = require("crypto");

const MAX_MEMBERS = 6;
const MAX_SHARED = 5; // one player per control on the shared ship
const MODES = ["classic", "shared"];
const AVATARS = ["nova", "comet", "orbit", "luna", "pixel", "sprout", "blaze", "moji"];
const FAKE_NAMES = ["Noah", "Ruben", "Ed", "Priya", "Mei"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MEMORIES_EACH = 3;
const IDLE_MS = 6 * 60 * 60 * 1000;

/** code -> crew */
const crews = new Map();

const uid = () => crypto.randomBytes(6).toString("hex");
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");
const cleanName = (name, fallback) => String(name || "").trim().slice(0, 40) || fallback;

function getCrew(code) {
  const crew = code ? crews.get(String(code).trim().toUpperCase()) || null : null;
  if (crew) crew.lastActive = Date.now();
  return crew;
}
const allCrews = () => [...crews.values()];
const findMember = (crew, id) => crew?.members.find((m) => m.id === id) || null;

function chooseAvatar(crew, wanted) {
  if (AVATARS.includes(wanted) && !crew.members.some((m) => m.avatar === wanted)) return wanted;
  const free = AVATARS.filter((a) => !crew.members.some((m) => m.avatar === a));
  const pool = free.length ? free : AVATARS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function setPhase(crew, phase) {
  crew.phase = phase;
  crew.phaseStartedAt = Date.now();
}

/** The games call this after every change; rooms are in-memory only, so there's nothing to do. */
function save() {}

const maxFor = (crew) => (crew.mode === "shared" ? MAX_SHARED : MAX_MEMBERS);

function addMember(crew, name, { simulated = false, avatar = null } = {}) {
  const max = maxFor(crew);
  if (crew.members.length >= max) return { error: `This room is full (${max} max).` };
  const member = {
    id: uid(),
    name: cleanName(name, "Anonymous"),
    isSimulated: simulated,
    avatar: chooseAvatar(crew, avatar),
  };
  crew.members.push(member);
  return { member };
}

function createCrew({ name, avatar, mode }) {
  let code;
  do code = makeCode();
  while (crews.has(code));
  const crew = { code, mode: MODES.includes(mode) ? mode : "classic", phase: "lobby", phaseStartedAt: Date.now(), lastActive: Date.now(), members: [], memories: [], game: null };
  crews.set(code, crew);
  const { member } = addMember(crew, name, { avatar });
  return { crew, member };
}

/** Classic (a ship each) or shared (one ship, shared controls). Simulated crewmates only fly classic. */
function setMode(crew, mode) {
  if (!MODES.includes(mode)) return { error: "Unknown game mode." };
  if (mode === "shared") {
    const humans = crew.members.filter((m) => !m.isSimulated);
    if (humans.length > MAX_SHARED) return { error: `The shared ship takes ${MAX_SHARED} players at most.` };
    crew.members = humans;
  }
  crew.mode = mode;
  return { ok: true };
}

/** Add simulated crewmates until the room has `size` players. */
function addBots(crew, size = 3) {
  const added = [];
  while (crew.members.length < Math.min(size, MAX_MEMBERS)) {
    const taken = crew.members.map((m) => m.name);
    const name = FAKE_NAMES.find((n) => !taken.includes(n)) || `Crew ${crew.members.length + 1}`;
    const r = addMember(crew, name, { simulated: true });
    if (r.error) break;
    added.push(r.member);
  }
  return added;
}

// ---- sample memories (the game has something to rescue) ------------------------------------------

const CANNED = [
  { template: "{name} and I got lost looking for __ on the first day.", fill: ["the Hawken building"] },
  { template: "I'll always remember {name} at the Great Court __.", fill: ["feeding chips to a bin chicken"] },
  { template: "{name}'s best idea all semester was __.", fill: ["the rocket"] },
  { template: "{name}'s Merlo order is __, no exceptions.", fill: ["a large oat flat white"] },
  { template: "In crit, {name} defended our idea by saying __.", fill: ["\"users don't read, they scan\""] },
  { template: "The night before the deadline, {name} was __.", fill: ["re-exporting the Figma file for the fourth time"] },
  { template: "{name} could spend hours on the Miro board just __.", fill: ["colour-coding sticky notes"] },
  { template: "During user testing, {name} __.", fill: ["laughed so hard the participant joined in"] },
  { template: "I never told {name} this but __.", fill: ["their sketches made our pitch"] },
];

/** Everyone gets a few sample memories (about their crewmates) so there is something to save. */
function seedMemories(crew) {
  crew.memories = [];
  crew.members.forEach((author) => {
    const others = crew.members.filter((m) => m.id !== author.id);
    const picks = CANNED.slice().sort(() => Math.random() - 0.5).slice(0, MEMORIES_EACH);
    picks.forEach((c, i) => {
      const about = others.length ? others[(i + Math.floor(Math.random() * others.length)) % others.length] : null;
      let n = 0;
      const text = c.template.replace("{name}", about ? about.name : "we").replace(/__/g, () => c.fill[n++] || "…");
      crew.memories.push({
        id: uid(),
        authorId: author.id,
        kind: "prompt",
        text,
        aboutId: about ? about.id : null,
        week: 1 + Math.floor(Math.random() * 13),
        createdAt: Date.now() + crew.memories.length,
      });
    });
  });
}

/** Back to the lobby for another go (players and bots stay). */
function reset(crew) {
  crew.game = null;
  crew.memories = [];
  setPhase(crew, "lobby");
}

function publicView(crew) {
  return {
    code: crew.code,
    phase: crew.phase,
    mode: crew.mode,
    members: crew.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, isSimulated: !!m.isSimulated })),
    max: maxFor(crew),
  };
}

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS;
  crews.forEach((c, code) => c.lastActive < cutoff && crews.delete(code));
}, 10 * 60 * 1000).unref();

module.exports = { MAX_MEMBERS, MAX_SHARED, setMode, getCrew, allCrews, findMember, createCrew, addMember, addBots, seedMemories, reset, setPhase, publicView, save };
