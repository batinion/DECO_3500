// Memory Star prompts — about your DECO crewmates and the semester you spent together.
//
// Edit freely: the components never hard-code prompt text.
//   {name}      where the crewmate picker goes (prompts without it are about the whole group)
//   __          a blank to fill in (a prompt can have more than one)
//   askMates    (optional) shows a small "Ask your mates" tag. It is a label only, never part of the text.
//   ask         (optional) the instruction shown while writing. It is never saved or shown on reveal cards.
//   template    the sentence that is saved and shown on the reveal cards
//   needsPhoto  (optional) the capsule can only be loaded once a photo is attached
//   facilitatorNote (optional) for the person running the demo; never shown to participants
//
// The id prefixes (s/m/e/a/q) are historical, so saved answers still map. Nothing groups by them.
export const PROMPT_BANK = [
  { id: "s1", template: "The first thing I noticed about {name} in week one was __." },
  { id: "s2", template: "When we formed our group, {name} was the one who __." },
  { id: "s3", template: "{name}’s very first project idea was __, and honestly, __." },
  { id: "s4", template: "Our first group meeting was at __, and we mostly talked about __." },
  { id: "s5", template: "I knew {name} and I would get along when they __." },
  { id: "s6", template: "{name} named our group chat “__”, and it stuck because __." },
  { id: "m2", template: "The most {name} moment during user testing was when they __." },
  { id: "m4", template: "When our prototype broke mid-demo, {name} __." },
  { id: "m5", template: "{name} always turned up to studio with __." },
  { id: "m6", template: "The tutor feedback that hit {name} hardest was “__”." },
  { id: "m7", template: "{name}’s sketches always looked like __ until they explained them." },
  { id: "m8", template: "Our group chat at 1am was mostly __." },
  { id: "m9", template: "{name} turned our messiest affinity map into __." },
  { id: "e1", template: "The night before the deadline, {name} was __." },
  { id: "e2", template: "{name} pulled our final presentation together by __." },
  { id: "e3", askMates: true, template: "If {name} won an award this semester, it’d be “Best __”." },
  { id: "e4", template: "Right after we submitted, we all __." },
  { id: "e5", template: "The moment I knew our group actually worked was when {name} __." },
  { id: "a1", askMates: true, template: "{name}’s go-to phrase when things went wrong was “__”." },
  { id: "a3", template: "Nobody could get {name} to stop __." },
  { id: "a4", template: "I never told {name} this, but __." },
  { id: "a5", template: "{name} taught me how to __." },
  { id: "a6", askMates: true, template: "The funniest thing {name} did in studio was __." },
  { id: "a7", template: "{name}’s “5 minutes” always meant __." },
  { id: "a8", template: "I’ll never forget the look on {name}’s face when __." },
  { id: "a9", template: "Our group’s unofficial rule was: never let {name} near __." },
  { id: "a11", template: "{name} was secretly the best at __." },

  // ---- ask your crewmate: `ask` is the instruction, `template` is what gets saved ----
  {
    id: "q1",
    ask: "Ask {name} who their favourite tutor was this semester.",
    template: "{name}’s favourite tutor was __ because __. Mine was __.",
  },
  {
    id: "q3",
    ask: "Ask {name} what they think you’ll be doing in 3 years.",
    template: "{name} reckons I’ll be __ in 3 years. Honestly, I hope __.",
  },
  {
    id: "q4",
    ask: "Ask {name} what song sums up this semester for them.",
    template: "{name}’s song for this semester is __. Mine is __.",
  },
  {
    id: "q5",
    needsPhoto: true,
    ask: "Ask {name} for the one group chat message they’d save forever, and get them to send you a screenshot.",
    template: "It’s iconic because __.",
    facilitatorNote: "Demo tip: sample screenshots are saved on this device.",
  },
];

// Shown in front of the prompt on screen only. Never saved or shown on reveal cards.
const GROUP_SONG_ID = "q4";
export const ASK_MATES_LABEL = "Ask your mate...";

export const VOICE_PROMPTS = [
  { id: "v1", text: "Record any voice note you like." },
  { id: "v2", text: "Let everyone speak to the mic and record a mini-voice note for the group to listen in 2050." },
];

export const EXTRA_LABELS = {
  selfie: "Take a selfie with your crew.",
  freeWrite: "Write anything about your crew.",
  images: "Add images.",
  example: "See an example memory.",
};

// ---- seeded shuffle: the same participant always gets the same order -------------------------

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(list, seedStr) {
  const rand = mulberry32(hashSeed(seedStr));
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The "ask your crewmate" prompts: every player has to load one of these. */
export const isCollabPrompt = (promptId) => /^q\d+$/.test(promptId || "");

const CAPSULES_PER_VISIT = 8;

/**
 * One visit's eight capsules for one player.
 *  - Everyone always gets the plain voice note, the free-write and the image upload.
 *  - The selfie and the 2050 voice note each go to ONE player in the crew. The holder moves on every round.
 *  - The "ask your mate" and "ask {name}" prompts are split between players and never repeated: each
 *    one goes to exactly one player (so with a big crew some players get none). q4, the group song,
 *    is always among them, so somebody always has it.
 *  - Only the ordinary prompts may repeat between players, and only once the pool has run dry.
 * When there is more than eight to give, the earlier items win: the three for everyone, the held
 * extras, the ask prompts (q4 first, then "ask your mate" and "ask {name}" taking turns), then ordinary prompts.
 * The deal depends only on who is in the crew and the round, so it is stable on reload.
 */
export function pickCapsules({ participantId = "", crewIds = [], round = 0 } = {}) {
  const ids = [...new Set([...crewIds, participantId])].sort();
  const n = ids.length;
  const me = Math.max(0, ids.indexOf(participantId));
  const crewSeed = ids.join("|");
  const holds = (offset) => (round + offset) % n === me;
  const share = (pool, tag) => seededShuffle(pool, `${crewSeed}|${tag}`).filter((_, k) => (k + round) % n === me);
  const mates = share(PROMPT_BANK.filter((p) => p.askMates), "mates");
  const asks = share(PROMPT_BANK.filter((p) => isCollabPrompt(p.id)), "ask");
  const song = asks.filter((p) => p.id === GROUP_SONG_ID);
  const others = asks.filter((p) => p.id !== GROUP_SONG_ID);
  const turns = [];
  for (let i = 0; i < Math.max(mates.length, others.length); i++) turns.push(...[mates[i], others[i]].filter(Boolean));
  const plainPool = seededShuffle(PROMPT_BANK.filter((p) => !p.askMates && !isCollabPrompt(p.id)), `${crewSeed}|plain`);
  const start = (round * n + me) * CAPSULES_PER_VISIT;
  const plain = plainPool.length ? Array.from({ length: CAPSULES_PER_VISIT }, (_, i) => plainPool[(start + i) % plainPool.length]) : [];

  const wanted = [
    { extra: "voice" },
    { extra: "free" },
    { extra: "images" },
    ...[["selfie", holds(0)], ["voice2050", holds(1)]].filter(([, held]) => held).map(([key]) => ({ extra: key })),
    ...[...song, ...turns].map((prompt) => ({ prompt })),
    ...plain.map((prompt) => ({ prompt })),
  ].slice(0, CAPSULES_PER_VISIT);

  const extras = { selfie: false, voice2050: false, images: false, voice: false, free: false };
  wanted.forEach((w) => w.extra && (extras[w.extra] = true));
  const prompts = wanted.filter((w) => w.prompt).map((w) => w.prompt);
  return { prompts: seededShuffle(prompts, `${participantId}|${round}`), extras };
}

/** The text the writer fills in around: the ask line if there is one, else the template. */
export function nameSource(prompt) {
  return prompt.ask || prompt.template;
}

export function templateHasName(template) {
  return template.includes("{name}");
}

export function templateBlankCount(template) {
  return (template.match(/__/g) || []).length;
}

/** Break a template into inline tokens: text, the crewmate slot, and each blank (in order). */
export function parseTemplate(template) {
  const parts = template.split(/(\{name\}|__)/);
  let blankIndex = 0;
  return parts
    .filter((p) => p !== "")
    .map((p) => {
      if (p === "{name}") return { type: "name" };
      if (p === "__") return { type: "blank", index: blankIndex++ };
      return { type: "text", value: p };
    });
}

/** Short preview before it's filled in — for hover tooltips. Ask prompts show their instruction. */
export function previewTemplate(template, ask) {
  return (ask || template).replace(/\{name\}/g, "someone").replace(/__/g, "...");
}

/** The finished, readable sentence. */
export function renderFilledTemplate(template, { friendName, filledText }) {
  let result = template.replace(/\{name\}/g, friendName || "someone");
  let i = 0;
  return result.replace(/__/g, () => {
    const value = filledText[i++];
    return value && value.trim() ? value.trim() : "___";
  });
}
