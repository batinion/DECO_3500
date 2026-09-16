const { customAlphabet, nanoid } = require("nanoid");
const { buildQuestionsFor } = require("./questions");
const { dealColors } = require("./colors");

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const MAX_PARTICIPANTS = 4;
const FAKE_NAMES = ["Sam (sim)", "Jordan (sim)", "Riley (sim)", "Casey (sim)"];

function freshSession() {
  return {
    code: makeCode(),
    createdAt: Date.now(),
    phase: "waiting", // waiting -> answering -> launching -> revealed
    participants: [], // { id, name, engineSlot, status, socketId, isSimulated, answers, questions, colors }
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
  };
}

function findParticipant(participantId) {
  return session.participants.find((p) => p.id === participantId);
}

function maybeReleaseQuestions() {
  if (session.phase !== "waiting") return;
  if (session.participants.length < MAX_PARTICIPANTS) return;

  session.phase = "answering";
  const roster = session.participants.map((p) => ({ id: p.id, name: p.name }));
  session.participants.forEach((p) => {
    p.questions = buildQuestionsFor(p, roster);
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
    answers: [],
    questions: null,
    colors: null,
  };
  session.participants.push(participant);
  maybeReleaseQuestions();
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

function recordSubmission(participantId, answers) {
  const p = findParticipant(participantId);
  if (!p) return { error: "Unknown participant." };
  if (p.status === "submitted") return { error: "Already submitted.", participant: p };
  p.answers = answers;
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

function simulateRemaining() {
  const added = [];
  let fakeIdx = 0;
  while (session.participants.length < MAX_PARTICIPANTS) {
    const name = FAKE_NAMES[fakeIdx++ % FAKE_NAMES.length];
    const { participant } = addParticipant(name);
    participant.isSimulated = true;
    added.push(participant);
  }
  // Any simulated participant that isn't submitted yet gets canned answers.
  const simulated = session.participants.filter(
    (p) => p.isSimulated && p.status !== "submitted"
  );
  simulated.forEach((p) => {
    const answers = (p.questions || []).map((q) => ({
      questionId: q.id,
      type: q.type,
      value: cannedAnswerFor(q),
    }));
    p.answers = answers;
    p.status = "submitted";
  });
  return { added, simulated };
}

function cannedAnswerFor(question) {
  switch (question.type) {
    case "text":
      return "A simulated memory, generated for testing purposes.";
    case "friend_text":
      return "Made every group meeting funnier than it had any right to be.";
    case "drawing":
    case "photo":
    case "slide":
      return null; // no file for simulated media answers
    default:
      return "";
  }
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
  simulateRemaining,
};
