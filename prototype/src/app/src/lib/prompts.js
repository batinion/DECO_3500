// Fill-in-the-blank prompt bank for the "Fill the Blanks" star field. Edit this file to
// change the prompts offered each session — the component that renders them doesn't
// hard-code any prompt text. Every prompt here shows up as a star every session (see
// SubmissionScreen, which uses the full bank rather than a random subset) — the
// always-present free-write star is appended separately on top of these.
export const PROMPT_BANK = [
  { id: "p1", template: '{name}\'s go-to phrase when things went __ was __.' },
  { id: "p2", template: "{name} always had questions on __." },
  { id: "p3", template: "{name}'s __ is so __!" },
  { id: "p4", template: "Every time we __, {name} would say __." },
  { id: "p5", template: "{name} always had a __ in their bag, no matter what." },
  { id: "p6", template: '{name}\'s "5 minutes" always meant __.' },
  { id: "p7", template: "Nobody could get {name} to stop __." },
  { id: "p8", template: "I'll never forget the look on {name}'s face when __." },
  { id: "p9", template: "The unofficial group rule was: never let {name} near __." },
  { id: "p10", template: 'If our group had a theme song it\'d be "__" because __.' },
  { id: "p11", template: "I never told {name} this but __." },
];

export function templateHasName(template) {
  return template.includes("{name}");
}

export function templateBlankCount(template) {
  return (template.match(/__/g) || []).length;
}

/**
 * Break a template into inline render tokens: plain text, the friend-name slot, and
 * each blank (in order). e.g. "{name}'s __ is so __." ->
 * [{type:'name'}, {type:'text',value:"'s "}, {type:'blank',index:0}, ...]
 */
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

/** A short, readable preview of a template before it's filled in — for hover tooltips etc. */
export function previewTemplate(template) {
  return template.replace("{name}", "someone").replace(/__/g, "...");
}

/** Render the final human-readable sentence once filled in, for the capsule reveal. */
export function renderFilledTemplate(template, { friendName, filledText }) {
  let result = template.replace("{name}", friendName || "someone");
  let i = 0;
  result = result.replace(/__/g, () => {
    const value = filledText[i++];
    return value && value.trim() ? value.trim() : "___";
  });
  return result;
}
