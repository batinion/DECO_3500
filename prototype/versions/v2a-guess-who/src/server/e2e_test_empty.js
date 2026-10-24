// Edge case: everyone only writes free-text entries (no guessable name-blank cards) —
// starting the puzzle should skip straight to "revealed" instead of showing an empty game.
const { io } = require("socket.io-client");
const URL = process.env.TEST_URL || "http://localhost:4100";
const NAMES = ["Alice", "Bob", "Carol", "Dave"];

function connect(role) { return io(URL, { query: { role } }); }
function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(4000).emit(event, payload, (err, ack) => (err ? reject(new Error(`${event} timed out`)) : resolve(ack)));
  });
}
function waitForConnect(socket, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("connect timeout")), ms);
    socket.once("connect", () => { clearTimeout(t); resolve(); });
  });
}
function waitUntil(pred, ms, label) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (pred()) { clearInterval(iv); resolve(); }
      else if (Date.now() - start > ms) { clearInterval(iv); reject(new Error(`Timed out: ${label}`)); }
    }, 50);
  });
}

async function main() {
  const mc = connect("mc");
  let latestState = null;
  mc.on("scene_state", (s) => (latestState = s));
  await waitForConnect(mc);
  await waitUntil(() => latestState !== null, 8000, "initial scene_state");
  const code = latestState.code;

  const participants = [];
  for (const name of NAMES) {
    const sock = connect("participant");
    await waitForConnect(sock);
    const ack = await emitAck(sock, "join_session", { code, name });
    if (ack.error) throw new Error(ack.error);
    participants.push({ sock, name, id: ack.participantId });
  }

  await waitUntil(() => latestState.phase === "cruising", 15000, "cruising");

  // Only free-text entries, no aboutParticipantId/blankedPrompt at all.
  for (const me of participants) {
    const blanks = [1, 2, 3].map((n) => ({
      promptId: "free_text",
      filledText: [`just a plain note #${n}, no friend attached`],
      aboutParticipantId: null,
      promptText: `just a plain note #${n}, no friend attached`,
      blankedPrompt: null,
    }));
    const ack = await emitAck(me.sock, "submit_answers", { participantId: me.id, blanks });
    if (ack.error) throw new Error(`Submit failed: ${ack.error}`);
  }

  await waitUntil(() => latestState.phase === "arrived", 15000, "arrived");
  await waitUntil(() => latestState.phase === "timejump", 10000, "timejump");
  mc.emit("advance_scene");
  await waitUntil(() => latestState.timeJumpStep === 2, 5000, "step 2");
  mc.emit("advance_scene");
  await waitUntil(() => latestState.phase === "earth", 5000, "earth");

  console.log("Starting puzzle with ZERO guessable cards (should skip straight to revealed)...");
  mc.emit("start_puzzle");
  await waitUntil(() => latestState.phase === "revealed", 5000, "revealed (direct skip)");

  if (latestState.puzzle !== null) throw new Error(`Expected puzzle to be null, got ${JSON.stringify(latestState.puzzle)}`);
  if (!latestState.capsule || latestState.capsule.length !== 4) throw new Error("Capsule missing or wrong size");

  console.log("✅ EMPTY-CARDS EDGE CASE PASSED — skipped straight to capsule reveal, no crash.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ EDGE CASE TEST FAILED:", err.message);
  process.exit(1);
});
