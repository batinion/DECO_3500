// Scripted end-to-end run: 4 participants join, each submits real "Guess Who"
// -eligible blanks, Mission Control drives the whole flow through to the capsule.
// Exits non-zero (and logs clearly) on any error or unexpected scene_state shape.
const { io } = require("socket.io-client");

const URL = process.env.TEST_URL || "http://localhost:4100";
const NAMES = ["Alice", "Bob", "Carol", "Dave"];

function connect(role) {
  return io(URL, { query: { role } });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(4000).emit(event, payload, (err, ack) => {
      if (err) return reject(new Error(`${event} timed out`));
      resolve(ack);
    });
  });
}

function waitForConnect(socket, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timed out waiting for connect")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

// Polls a predicate against a live value (e.g. the latest scene_state) rather than
// racing a one-off event listener against packets that may already be in flight.
function waitUntil(predicate, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (predicate()) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error(`Timed out waiting for ${label}`));
      }
    }, 50);
  });
}

async function main() {
  console.log("Connecting Mission Control...");
  const mc = connect("mc");
  // Attach the persistent listener BEFORE awaiting connect — the server emits its
  // first scene_state immediately on connection, so a listener added any later
  // (even "right after" an awaited connect resolves) can race and miss that packet.
  let latestState = null;
  mc.on("scene_state", (s) => (latestState = s));
  await waitForConnect(mc);
  await waitUntil(() => latestState !== null, 8000, "initial scene_state");
  const code = latestState.code;
  console.log("Session code:", code);

  console.log("Joining 4 participants...");
  const participants = [];
  for (const name of NAMES) {
    const sock = connect("participant");
    await waitForConnect(sock);
    const ack = await emitAck(sock, "join_session", { code, name });
    if (ack.error) throw new Error(`Join failed for ${name}: ${ack.error}`);
    participants.push({ sock, name, id: ack.participantId });
    console.log(`  ${name} joined as engine ${ack.engineSlot}`);
  }

  console.log("Waiting for launch -> cruising...");
  await waitUntil(() => latestState.phase === "cruising", 15000, "cruising");
  console.log("  phase: cruising");

  console.log("Submitting answers (each about a different crew-mate, all guessable)...");
  for (let i = 0; i < participants.length; i++) {
    const me = participants[i];
    const aboutP = participants[(i + 1) % participants.length]; // about "the next" person
    const blanks = [
      {
        promptId: "p6",
        filledText: ["he was definitely still coming"],
        aboutParticipantId: aboutP.id,
        promptText: `${aboutP.name}'s "5 minutes" always meant he was definitely still coming.`,
        blankedPrompt: '___\'s "5 minutes" always meant he was definitely still coming.',
      },
      {
        promptId: "p9",
        filledText: ["spare phone charger"],
        aboutParticipantId: aboutP.id,
        promptText: `${aboutP.name} always had a spare phone charger in their bag, no matter what.`,
        blankedPrompt: "___ always had a spare phone charger in their bag, no matter what.",
      },
      {
        promptId: "p7",
        filledText: ["bugs"],
        aboutParticipantId: aboutP.id,
        promptText: `Nobody could get ${aboutP.name} to stop bugs.`,
        blankedPrompt: "Nobody could get ___ to stop bugs.",
      },
    ];
    const ack = await emitAck(me.sock, "submit_answers", { participantId: me.id, blanks });
    if (ack.error) throw new Error(`Submit failed for ${me.name}: ${ack.error}`);
    console.log(`  ${me.name} submitted (about ${aboutP.name})`);
  }

  console.log("Waiting for arrival (colors assigned)...");
  await waitUntil(() => latestState.phase === "arrived", 15000, "arrived");
  console.log("  phase: arrived, colors:", JSON.stringify(latestState.reveal?.map((p) => p.name)));

  console.log("Waiting for timejump...");
  await waitUntil(() => latestState.phase === "timejump", 10000, "timejump");
  console.log("  phase: timejump, step", latestState.timeJumpStep);

  console.log("Advancing through timejump steps...");
  mc.emit("advance_scene");
  await waitUntil(() => latestState.timeJumpStep === 2, 5000, "timejump step 2");
  mc.emit("advance_scene");
  await waitUntil(() => latestState.phase === "earth", 5000, "earth");
  console.log("  phase: earth");

  console.log("Starting puzzle (Guess Who)...");
  mc.emit("start_puzzle");
  await waitUntil(() => latestState.phase === "puzzle" || latestState.phase === "revealed", 5000, "puzzle or skip-to-revealed");
  console.log("  phase:", latestState.phase, "- total cards:", latestState.puzzle?.total);

  if (latestState.phase === "puzzle" && latestState.puzzle.total !== 12) {
    throw new Error(`Expected 12 guessable cards (4 people x 3 blanks), got ${latestState.puzzle?.total}`);
  }

  console.log("Playing through every Guess Who card...");
  let cardCount = 0;
  while (latestState.phase === "puzzle") {
    const before = latestState.puzzle;
    if (!before.card || !before.card.blankedPrompt || !before.card.aboutName) {
      throw new Error(`Card ${before.index} missing expected fields: ${JSON.stringify(before.card)}`);
    }
    console.log(`  Card ${before.index + 1}/${before.total}: "${before.card.blankedPrompt}"`);

    mc.emit("reveal_puzzle_card");
    await waitUntil(() => latestState.puzzle && latestState.puzzle.revealed === true, 5000, "card reveal");
    console.log(`    revealed -> about ${latestState.puzzle.card.aboutName}`);
    cardCount++;

    mc.emit("next_puzzle_card");
    await waitUntil(
      () =>
        latestState.phase === "revealed" ||
        (latestState.puzzle && latestState.puzzle.index === before.index + 1 && latestState.puzzle.revealed === false),
      5000,
      "next card or capsule reveal"
    );
  }

  console.log(`Played ${cardCount} cards. Final phase: ${latestState.phase}`);
  if (latestState.phase !== "revealed") throw new Error("Expected to land on 'revealed' after the last card");
  if (!latestState.capsule || latestState.capsule.length !== 4) {
    throw new Error(`Expected a 4-person capsule, got ${JSON.stringify(latestState.capsule?.length)}`);
  }
  console.log("Capsule entries per person:", latestState.capsule.map((p) => `${p.name}: ${p.entries.length}`));

  console.log("\n✅ FULL FLOW PASSED — join -> cruise -> submit -> arrive -> timejump -> earth -> Guess Who x12 -> capsule");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  process.exit(1);
});
