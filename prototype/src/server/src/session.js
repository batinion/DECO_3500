const { customAlphabet, nanoid } = require("nanoid");
const { dealColors } = require("./colors");

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const MAX_PARTICIPANTS = 4;
const FAKE_NAMES = ["Sam", "Jordan", "Riley", "Casey"];

function freshSession() {
  return {
    code: makeCode(),
    createdAt: Date.now(),
    phase: "waiting", // waiting -> answering -> launching -> revealed -> puzzle -> unlocked
    participants: [], // { id, name, engineSlot, status, socketId, isSimulated, blanks, drawing, uploadedImages, colors }
    puzzleAnswer: null, // { participantId, name, fileUrl, uploadedAt } once someone uploads
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

// The fill-in-the-blank prompt bank and selection now live entirely client-side (/app);
// the server no longer needs to know the prompt set, only when to open the answering phase.
function maybeOpenAnswering() {
  if (session.phase !== "waiting") return;
  if (session.participants.length < MAX_PARTICIPANTS) return;

  session.phase = "answering";
  session.participants.forEach((p) => {
    p.status = "answering";
  });
}

function addParticipant(name) {
  if (session.participants.length >= MAX_PARTICIPANTS) {
    return { error: "Session is full (4/4 already joined)." };
  }
  const participant = {
    id: nanoid(),
    name: String(name).trim().slice(0, 40) || "Anonymous",
    engineSlot: session.participants.length + 1,
    status: "waiting",
    socketId: null,
    isSimulated: false,
    blanks: [],
    drawing: null,
    uploadedImages: [],
    colors: null,
  };
  session.participants.push(participant);
  maybeOpenAnswering();
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

function beginLaunch() {
  session.phase = "launching";
}

function revealColors() {
  session.phase = "revealed";
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

function startPuzzle() {
  if (session.phase !== "revealed") return { error: "Puzzle can only start after colors are revealed." };
  session.phase = "puzzle";
  return { session };
}

function recordPuzzleAnswer(participantId, fileUrl) {
  if (session.puzzleAnswer) return { error: "The puzzle answer has already been uploaded." };
  const p = findParticipant(participantId);
  if (!p) return { error: "Unknown participant." };
  session.puzzleAnswer = { participantId, name: p.name, fileUrl, uploadedAt: Date.now() };
  session.phase = "unlocked";
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
    })),
    drawing: p.drawing || null,
    uploadedImages: p.uploadedImages || [],
  }));
}

function simulateRemaining() {
  const added = [];
  let fakeIdx = 0;
  while (session.participants.length < MAX_PARTICIPANTS) {
    const name = FAKE_NAMES[fakeIdx++ % FAKE_NAMES.length];
    const { participant } = addParticipant(name);
    participant.isSimulated = true;
    added.push(participant);
  }
  // Any simulated participant that isn't submitted yet gets canned blanks.
  const simulated = session.participants.filter(
    (p) => p.isSimulated && p.status !== "submitted"
  );
  simulated.forEach((p) => {
    p.blanks = cannedBlanks();
    p.drawing = null;
    p.uploadedImages = [];
    p.status = "submitted";
  });
  return { added, simulated };
}

/**
 * Dev-only: jump straight to the final capsule-reveal cards screen. Fills any empty
 * slots, force-submits every participant who hasn't submitted yet (real participants
 * included) with canned blanks, deals colors, and fakes the puzzle answer — so none of
 * it waits on input from anyone's device, including solving/uploading the puzzle.
 */
function skipToCapsuleReveal() {
  let fakeIdx = 0;
  while (session.participants.length < MAX_PARTICIPANTS) {
    const name = FAKE_NAMES[fakeIdx++ % FAKE_NAMES.length];
    const { participant } = addParticipant(name);
    participant.isSimulated = true;
  }

  const newlySubmitted = session.participants.filter((p) => p.status !== "submitted");
  newlySubmitted.forEach((p) => {
    p.blanks = cannedBlanks();
    p.drawing = null;
    p.uploadedImages = [];
    p.status = "submitted";
  });

  if (!session.participants.every((p) => p.colors)) {
    revealColors();
  }

  if (!session.puzzleAnswer) {
    const first = session.participants[0];
    session.puzzleAnswer = {
      participantId: first?.id || null,
      name: first?.name || "Dev skip",
      fileUrl: null,
      uploadedAt: Date.now(),
    };
  }
  session.phase = "unlocked";

  return { newlySubmitted };
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
  beginLaunch,
  revealColors,
  startPuzzle,
  recordPuzzleAnswer,
  buildCapsuleSummary,
  simulateRemaining,
  skipToCapsuleReveal,
};
