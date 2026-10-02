// Memory Star prompts — about your DECO crewmates and the semester you spent together.
//
// Edit freely: the components never hard-code prompt text.
//   {name}  where the crewmate picker goes (prompts without it are about the whole group)
//   __      a blank to fill in (a prompt can have more than one)
//   when    which part of semester it fits best. Prompts for the current part of semester
//           are shown first, so coming back in week 2 vs week 11 gives you different stars.
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
  { id: "a10", when: "any", template: "If our group had a theme song it'd be \"__\" because __." },
  { id: "a11", when: "any", template: "{name} was secretly the best at __." },
  { id: "a12", when: "any", template: "This week, {name} __." },
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
export function pickPrompts(week, answeredIds = []) {
  const stage = semesterStage(week);
  const unused = PROMPT_BANK.filter((p) => !answeredIds.includes(p.id));
  const pool = unused.length >= STARS_PER_VISIT ? unused : PROMPT_BANK;
  const now = shuffle(pool.filter((p) => p.when === stage));
  const any = shuffle(pool.filter((p) => p.when === "any"));
  const rest = shuffle(pool.filter((p) => p.when !== stage && p.when !== "any"));
  // ~half from this part of semester, then fill with any-time, then the rest
  const picked = [...now.slice(0, 3), ...any.slice(0, 2)];
  for (const p of [...now.slice(3), ...any.slice(2), ...rest]) {
    if (picked.length >= STARS_PER_VISIT) break;
    picked.push(p);
  }
  return shuffle(picked.slice(0, STARS_PER_VISIT));
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
