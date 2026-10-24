const { customAlphabet, nanoid } = require("nanoid");
const { dealColors } = require("./colors");

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const MAX_PARTICIPANTS = 4;
const FAKE_NAMES = ["Sam", "Jordan", "Riley", "Casey"];
const PHASES = ["joining", "launching", "cruising", "arrived", "timejump", "earth", "puzzle", "revealed"];

function freshSession() {
  return {
    code: makeCode(),
    createdAt: Date.now(),
    phase: "joining", // see PHASES — the server owns the scene state, every screen mirrors it
    phaseStartedAt: Date.now(), // server ms; scenes derive animation progress from this
    timeJumpStep: 0, // 0 leaving the moon -> 1 "cooking the space" -> 2 "3 years have passed"
    stepStartedAt: Date.now(),
    participants: [], // { id, name, engineSlot, status, socketId, isSimulated, blanks, drawing, uploadedImages, colors }
    puzzleAnswer: null, // kept for backwards compatibility; no longer used by the "Guess Who" flow
    puzzleCards: [], // [{ cardId, blankedPrompt, revealedPrompt, aboutParticipantId, aboutName }], built once Earth is reached
    puzzleIndex: 0, // which card the crew is currently on
    puzzleRevealed: false, // true once Mission Control has revealed the current card's answer
  };
}

let session = freshSession();

function getSession() {
  return session;
}

function resetSession() {
  session = freshSession();
  return session;
}

function setPhase(phase) {
  session.phase = phase;
  session.phaseStartedAt = Date.now();
  session.timeJumpStep = 0;
  session.stepStartedAt = session.phaseStartedAt;
}

function setTimeJumpStep(step) {
  session.timeJumpStep = step;
  session.stepStartedAt = Date.now();
}

/** True once the session has reached `phase` or any later one. */
function atLeast(phase) {
  return PHASES.indexOf(session.phase) >= PHASES.indexOf(phase);
}

function publicParticipant(p) {
  return {
    id: p.id,
    name: p.name,
    engineSlot: p.engineSlot,
    status: p.status,
    isSimulated: !!p.isSimulated,
  };
}

function publicSession() {
  return {
    code: session.code,
    phase: session.phase,
    participants: session.participants.map(publicParticipant),
    puzzleAnswer: session.puzzleAnswer,
  };
}

function findParticipant(participantId) {
  return session.participants.find((p) => p.id === participantId);
}

function addParticipant(name) {
  if (session.participants.length >= MAX_PARTICIPANTS) {
    return { error: "Session is full (4/4 already joined)." };
  }
  const participant = {
    id: nanoid(),
    name: String(name).trim().slice(0, 40) || "Anonymous",
    engineSlot: session.participants.length + 1,
    status: "answering", // joined = engine lit; becomes "submitted" once their Memory Stars are in
    socketId: null,
    isSimulated: false,
    blanks: [],
    drawing: null,
    uploadedImages: [],
    colors: null,
  };
  session.participants.push(participant);
  return { participant };
}

function attachSocket(participantId, socketId) {
  const p = findParticipant(participantId);
  if (p) p.socketId = socketId;
  return p;
}

function detachSocket(socketId) {
  const p = session.participants.find((p) => p.socketId === socketId);
  if (p) p.socketId = null;
  return p;
}

function recordSubmission(participantId, submission) {
  const p = findParticipant(participantId);
  if (!p) return { error: "Unknown participant." };
  if (session.phase !== "cruising") return { error: "Memory Stars aren't open yet.", participant: p };
  if (p.status === "submitted") return { error: "Already submitted.", participant: p };

  const blanks = Array.isArray(submission?.blanks) ? submission.blanks : [];
  if (blanks.length < 3) return { error: "At least 3 filled-in stars are required." };

  p.blanks = blanks;
  p.drawing = submission?.drawing || null;
  p.uploadedImages = Array.isArray(submission?.uploadedImages) ? submission.uploadedImages : [];
  p.status = "submitted";
  return { participant: p };
}

function allSubmitted() {
  return (
    session.participants.length === MAX_PARTICIPANTS &&
    session.participants.every((p) => p.status === "submitted")
  );
}

function revealColors() {
  const used = [];
  session.participants.forEach((p) => {
    const dealt = dealColors(2, used);
    dealt.forEach((c) => used.push(c.hex));
    p.colors = dealt;
  });
  return session.participants.map((p) => ({
    id: p.id,
    name: p.name,
    engineSlot: p.engineSlot,
    colors: p.colors,
  }));
}

/** Fisher-Yates shuffle, returns a new array (does not mutate the input). */
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * "Guess Who" cards: one per blank that (a) was written using a template with a
 * {name} slot, (b) has a friend actually chosen, and (c) the app could safely
 * render with that name blanked out. Free-text entries and no-name templates are
 * never eligible (see SubmissionScreen.js) — they still appear later in the full
 * capsule reveal, just not as a guessing card. Shuffled across the whole crew so
 * the order doesn't give anything away.
 */
function buildPuzzleCards() {
  const byId = {};
  session.participants.forEach((p) => (byId[p.id] = p.name));

  const cards = [];
  session.participants.forEach((author) => {
    (author.blanks || []).forEach((b, i) => {
      if (!b.blankedPrompt || !b.aboutParticipantId) return;
      cards.push({
        cardId: `${author.id}-${b.promptId || i}`,
        authorParticipantId: author.id,
        authorName: author.name,
        aboutParticipantId: b.aboutParticipantId,
        aboutName: byId[b.aboutParticipantId] || "Someone",
        blankedPrompt: b.blankedPrompt,
        revealedPrompt: b.promptText,
      });
    });
  });
  return shuffled(cards);
}

function startPuzzle() {
  if (session.phase !== "earth") return { error: "Puzzle can only start once the rocket reaches Earth." };
  const cards = buildPuzzleCards();
  session.puzzleCards = cards;
  session.puzzleIndex = 0;
  session.puzzleRevealed = false;
  // Nobody wrote anything guessable (e.g. everyone only used free-write stars) —
  // skip the game rather than show an empty "Guess Who" with nothing to play.
  if (cards.length === 0) {
    setPhase("revealed");
  } else {
    setPhase("puzzle");
  }
  return { session };
}

/** Mission Control reveals the current card's real answer (and discussion moment). */
function revealPuzzleCard() {
  if (session.phase !== "puzzle") return { error: "No Guess Who card is active." };
  session.puzzleRevealed = true;
  return { session };
}

/** Mission Control advances to the next card, or opens the capsule after the last one. */
function nextPuzzleCard() {
  if (session.phase !== "puzzle") return { error: "No Guess Who card is active." };
  if (!session.puzzleRevealed) return { error: "Reveal the current card before moving on." };
  const isLast = session.puzzleIndex + 1 >= session.puzzleCards.length;
  if (isLast) {
    setPhase("revealed");
  } else {
    session.puzzleIndex += 1;
    session.puzzleRevealed = false;
  }
  return { session };
}

/**
 * Legacy from the old Miro-link-and-upload puzzle. No longer reachable from the
 * app (the "Guess Who" flow above replaces it) — kept only so the dormant
 * /api/upload-puzzle-answer route doesn't crash if it's ever hit.
 */
function recordPuzzleAnswer(participantId, fileUrl) {
  if (session.puzzleAnswer) return { error: "The puzzle answer has already been uploaded." };
  const p = findParticipant(participantId);
  if (!p) return { error: "Unknown participant." };
  session.puzzleAnswer = { participantId, name: p.name, fileUrl, uploadedAt: Date.now() };
  setPhase("revealed");
  return { puzzleAnswer: session.puzzleAnswer };
}

/** Every participant's filled-in stars (plus drawing/photos), for the capsule reveal. */
function buildCapsuleSummary() {
  return session.participants.map((p) => ({
    id: p.id,
    name: p.name,
    engineSlot: p.engineSlot,
    colors: p.colors,
    entries: (p.blanks || []).map((b) => ({
      prompt: b.promptText || b.promptId,
      value: Array.isArray(b.filledText) ? b.filledText.join(" / ") : "",
      aboutParticipantId: b.aboutParticipantId ?? null,
      blankedPrompt: b.blankedPrompt ?? null,
    })),
    drawing: p.drawing || null,
    uploadedImages: p.uploadedImages || [],
  }));
}

/** Dev-only: add one fake crew member (lights the next engine). Returns null if the session is full. */
function addSimulatedParticipant() {
  if (session.participants.length >= MAX_PARTICIPANTS) return null;
  const taken = session.participants.map((p) => p.name);
  const name = FAKE_NAMES.find((n) => !taken.includes(n)) || `Crew ${session.participants.length + 1}`;
  const { participant } = addParticipant(name);
  participant.isSimulated = true;
  return participant;
}

function submitSimulated(p) {
  p.blanks = cannedBlanks();
  p.drawing = null;
  p.uploadedImages = [];
  p.status = "submitted";
}

function pendingSimulated() {
  return session.participants.filter((p) => p.isSimulated && p.status !== "submitted");
}

/**
 * Dev-only: jump straight to the final capsule-reveal. Fills any empty slots,
 * force-submits every participant who hasn't submitted yet (real participants
 * included) with canned blanks, deals colors, and fakes the puzzle answer — so none of
 * it waits on input from anyone's device, including solving/uploading the puzzle.
 */
function skipToCapsuleReveal() {
  const added = [];
  while (session.participants.length < MAX_PARTICIPANTS) added.push(addSimulatedParticipant());

  const newlySubmitted = session.participants.filter((p) => p.status !== "submitted");
  newlySubmitted.forEach(submitSimulated);

  if (!session.participants.every((p) => p.colors)) {
    revealColors();
  }

  // Reset puzzle state too — a dev skip bypasses the Guess Who game entirely.
  session.puzzleCards = [];
  session.puzzleIndex = 0;
  session.puzzleRevealed = false;
  setPhase("revealed");

  return { added, newlySubmitted };
}

function cannedBlanks() {
  return [
    {
      promptId: "sim1",
      filledText: ["a simulated memory"],
      aboutParticipantId: null,
      promptText: "A simulated memory, generated for testing purposes.",
    },
    {
      promptId: "sim2",
      filledText: ["funnier than it had any right to be"],
      aboutParticipantId: null,
      promptText: "Made every group meeting funnier than it had any right to be.",
    },
    {
      promptId: "sim3",
      filledText: ["snacks", "the crunch sessions"],
      aboutParticipantId: null,
      promptText: "Always brought snacks to the crunch sessions.",
    },
  ];
}

module.exports = {
  MAX_PARTICIPANTS,
  getSession,
  resetSession,
  publicSession,
  publicParticipant,
  findParticipant,
  addParticipant,
  attachSocket,
  detachSocket,
  recordSubmission,
  allSubmitted,
  revealColors,
  startPuzzle,
  revealPuzzleCard,
  nextPuzzleCard,
  recordPuzzleAnswer,
  buildCapsuleSummary,
  addSimulatedParticipant,
  submitSimulated,
  pendingSimulated,
  skipToCapsuleReveal,
  PHASES,
  setPhase,
  setTimeJumpStep,
  atLeast,
};
