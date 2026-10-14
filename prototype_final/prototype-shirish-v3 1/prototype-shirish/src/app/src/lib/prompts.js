// Memory Star prompts — about your DECO crewmates and the semester you spent together.
//
// Edit freely: the components never hard-code prompt text.
//   {name}  where the crewmate picker goes (prompts without it are about the whole group)
//   __      a blank to fill in (a prompt can have more than one)
//   needsPhoto  (optional) the capsule can only be loaded once a photo is attached
//   when    which part of semester the prompt is about. Memories are collected all semester, so
//           every visit mixes all of them (start, mid, end, any) whatever the current week is.
//             "start" weeks 1–4 · "mid" weeks 5–9 · "end" weeks 10–13 · "any" always
export const PROMPT_BANK = [
  // ---- start of semester: forming the group ----
  { id: "s1", when: "start", template: "The first thing I noticed about {name} in week one was __." },
  { id: "s2", when: "start", template: "When we formed our group, {name} was the one who __." },
  { id: "s3", when: "start", template: "{name}'s very first project idea was __, and honestly __." },
  { id: "s4", when: "start", template: "Our first group meeting was at __ and we mostly talked about __." },
  { id: "s5", when: "start", template: "I knew {name} and I would get along when they __." },
  { id: "s6", when: "start", template: "{name} named our group chat \"__\" and it stuck because __." },

  // ---- mid semester: studio, crits, prototyping, testing ----
  { id: "m1", when: "mid", template: "{name} could spend hours on the Miro board just __." },
  { id: "m2", when: "mid", template: "During user testing, {name} __." },
  { id: "m3", when: "mid", template: "In crit, {name} defended our idea by saying \"__\"." },
  { id: "m4", when: "mid", template: "When our prototype broke mid-demo, {name} __." },
  { id: "m5", when: "mid", template: "{name} always turned up to studio with __." },
  { id: "m6", when: "mid", template: "The tutor feedback that hit {name} hardest was \"__\"." },
  { id: "m7", when: "mid", template: "{name}'s sketches always looked like __ until they explained them." },
  { id: "m8", when: "mid", template: "Our group chat at 1am was mostly __." },
  { id: "m9", when: "mid", template: "{name} turned our messiest affinity map into __." },

  // ---- end of semester: deadlines, presentations, wrapping up ----
  { id: "e1", when: "end", template: "The night before the deadline, {name} was __." },
  { id: "e2", when: "end", template: "{name} pulled our final presentation together by __." },
  { id: "e3", when: "end", template: "If {name} won an award this semester it'd be \"Best __\"." },
  { id: "e4", when: "end", template: "Right after we submitted, we all __." },
  { id: "e5", when: "end", template: "The moment I knew our group actually worked was when {name} __." },
  { id: "e6", when: "end", template: "In three years, I bet {name} will be __." },

  // ---- any time ----
  { id: "a1", when: "any", template: "{name}'s go-to phrase when things went wrong was \"__\"." },
  { id: "a2", when: "any", template: "{name}'s Merlo order is __, no exceptions." },
  { id: "a3", when: "any", template: "Nobody could get {name} to stop __." },
  { id: "a4", when: "any", template: "I never told {name} this, but __." },
  { id: "a5", when: "any", template: "{name} taught me how to __." },
  { id: "a6", when: "any", template: "The funniest thing {name} did in class was __." },
  { id: "a7", when: "any", template: "{name}'s \"5 minutes\" always meant __." },
  { id: "a8", when: "any", template: "I'll never forget the look on {name}'s face when __." },
  { id: "a9", when: "any", template: "Our group's unofficial rule was: never let {name} near __." },
  { id: "a11", when: "any", template: "{name} was secretly the best at __." },
  { id: "a12", when: "any", template: "This week, {name} __." },

  // ---- ask your crewmate (needsPhoto: the memory only counts once a photo is uploaded) ----
  { id: "q1", when: "mid", template: "Ask {name}: who was their favourite tutor this semester? They said __ because __. But you think: __." },
  { id: "q2", when: "any", needsPhoto: true, template: "You and {name} have a photo together somewhere. Find it and get them to upload it. It was taken at __. What I remember about that moment: __." },
  { id: "q3", when: "end", template: "Ask {name} what they think you'll be doing in 3 years. They said __. Honestly, you hope __." },
  { id: "q4", when: "any", template: "Ask {name} what song sums up this semester for them. They said __. Yours is __." },
  { id: "q5", when: "mid", needsPhoto: true, template: "Ask {name} for the one group chat message they'd save forever. Get them to screenshot and upload it. Why it's iconic: __." },
  { id: "q6", when: "any", needsPhoto: true, template: "Get {name} to upload the worst photo they have of you. ...your response is __." },
];

const STARS_PER_VISIT = 6;

export function semesterStage(week) {
  if (week <= 4) return "start";
  if (week <= 9) return "mid";
  return "end";
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick this visit's stars: prompts for the current part of semester first, then
 * any-time ones, then the rest — skipping prompts you've already answered where possible,
 * so every visit feels fresh.
 */
/** The "ask your crewmate" prompts: every player has to load one of these. */
export const isCollabPrompt = (promptId) => /^q\d+$/.test(promptId || "");

export function pickPrompts(week, answeredIds = []) {
  // Memories are collected all semester long, so every visit gets a balanced mix: at least one
  // prompt from each part of the semester (start, mid, end) and from the any-time ones, then the
  // spare places go to randomly chosen parts. `week` no longer changes which prompts you see.
  // One of the six is always a collaborate prompt (everyone has to load one).
  const unused = PROMPT_BANK.filter((p) => !answeredIds.includes(p.id));
  const pool = unused.length >= STARS_PER_VISIT ? unused : PROMPT_BANK;
  const collab = shuffle(pool.filter((p) => isCollabPrompt(p.id)))[0] || shuffle(PROMPT_BANK.filter((p) => isCollabPrompt(p.id)))[0];
  const rest = pool.filter((p) => p !== collab && !isCollabPrompt(p.id));
  const groups = ["start", "mid", "end", "any"].map((when) => shuffle(rest.filter((p) => p.when === when)));
  const picked = [];
  const want = STARS_PER_VISIT - 1;
  const order = [...shuffle([0, 1, 2, 3]), ...shuffle([0, 1, 2, 3])]; // two rounds, each part in a random order
  for (const gi of order) {
    if (picked.length >= want) break;
    const next = groups[gi].shift();
    if (next) picked.push(next);
  }
  for (const p of shuffle(groups.flat())) {
    if (picked.length >= want) break;
    picked.push(p);
  }
  return shuffle([collab, ...picked]);
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

/** Short preview before it's filled in — for hover tooltips. */
export function previewTemplate(template) {
  return template.replace("{name}", "someone").replace(/__/g, "...");
}

/** The finished, readable sentence. */
export function renderFilledTemplate(template, { friendName, filledText }) {
  let result = template.replace("{name}", friendName || "someone");
  let i = 0;
  return result.replace(/__/g, () => {
    const value = filledText[i++];
    return value && value.trim() ? value.trim() : "___";
  });
}
