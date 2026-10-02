const path = require("path");
const fs = require("fs");
const os = require("os");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const QRCode = require("qrcode");
const cors = require("cors");

const crews = require("./crews");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SUBMISSIONS_DIR = path.join(__dirname, "..", "submissions");
// The participant app, exported for the web (`npx expo export --platform web` in /app,
// output copied here by `npm run build-web`). Served at "/" so any phone or laptop on the
// same Wi-Fi just opens http://<this-computer's-ip>:4000 — no app install, no host screen.
const WEB_APP_DIR = path.join(__dirname, "..", "web-app");
const PUZZLE_URL = "https://miro.com/app/board/uXjVJnJSoGU=/";

fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" })); // base64 drawing PNGs go through JSON
// Registered before express.static: public/scene/ is also a directory.
app.get("/scene", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "scene.html")));
// Crew characters: one SVG generator shared by the app (bundled) and the scene/briefing (here).
app.get("/avatars.js", (req, res) => res.type("js").sendFile(path.join(__dirname, "..", "..", "app", "src", "lib", "avatars.js")));
// The 40-second "mission briefing" explainer clip (plays inside the app, or open it directly).
app.get(["/intro", "/intro/"], (req, res) => res.sendFile(path.join(PUBLIC_DIR, "intro", "index.html")));
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use("/uploads", express.static(SUBMISSIONS_DIR));

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}
const LAN_IP = getLanIp();

// ---- HTTP: uploads + invite QR ----------------------------------------------------

function memberDir(code, memberId) {
  const dir = path.join(SUBMISSIONS_DIR, code, memberId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function checkMember(code, memberId) {
  const crew = crews.getCrew(code);
  return crew && crews.findMember(crew, memberId) ? crew : null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { code, participantId } = req.body;
    if (!checkMember(code, participantId)) return cb(new Error("Unknown crew or crewmate"));
    cb(null, memberDir(code, participantId));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.body.questionId || "file"}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// Clients: append text fields (code, participantId, questionId) BEFORE the file field.
app.post("/api/upload", upload.single("file"), (req, res) => {
  const relPath = path.relative(SUBMISSIONS_DIR, req.file.path).split(path.sep).join("/");
  res.json({ fileUrl: `/uploads/${relPath}` });
});

app.post("/api/upload-drawing", (req, res) => {
  const { code, participantId, questionId, dataUrl } = req.body;
  if (!checkMember(code, participantId)) return res.status(400).json({ error: "Unknown crew or crewmate" });
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl || "");
  if (!match) return res.status(400).json({ error: "dataUrl must be a base64 PNG" });
  const filename = `${questionId || "drawing"}-${Date.now()}.png`;
  fs.writeFileSync(path.join(memberDir(code, participantId), filename), Buffer.from(match[1], "base64"));
  res.json({ fileUrl: `/uploads/${code}/${participantId}/${filename}` });
});

const puzzleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { code, participantId } = req.body;
    if (!checkMember(code, participantId)) return cb(new Error("Unknown crew or crewmate"));
    const dir = path.join(SUBMISSIONS_DIR, code, "puzzle-answer");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${req.body.participantId || "answer"}-${Date.now()}${path.extname(file.originalname) || ""}`),
});
const puzzleUpload = multer({ storage: puzzleStorage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/api/upload-puzzle-answer", puzzleUpload.single("file"), (req, res) => {
  const { code, participantId } = req.body;
  const crew = crews.getCrew(code);
  if (!crew) return res.status(404).json({ error: "Unknown crew." });
  const relPath = path.relative(SUBMISSIONS_DIR, req.file.path).split(path.sep).join("/");
  const result = crews.recordPuzzleAnswer(crew, participantId, `/uploads/${relPath}`);
  if (result.error) return res.status(409).json({ error: result.error });
  broadcast(crew);
  res.json({ fileUrl: `/uploads/${relPath}` });
});

// QR for an invite link, so a crewmate can show it on their phone for friends to scan.
app.get("/api/qr", async (req, res) => {
  const text = String(req.query.text || "").slice(0, 500);
  if (!text) return res.status(400).end();
  const png = await QRCode.toBuffer(text, { margin: 1, width: 360, color: { dark: "#05060f", light: "#ffffff" } });
  res.type("png").send(png);
});

app.get("/api/info", (req, res) => res.json({ lanIp: LAN_IP, port: PORT }));

// The participant web app (single-page): everything else falls through to its index.html.
if (fs.existsSync(WEB_APP_DIR)) {
  app.use(express.static(WEB_APP_DIR));
  app.get(/^\/(?!socket\.io|api|uploads|scene|intro).*/, (req, res) => res.sendFile(path.join(WEB_APP_DIR, "index.html")));
} else {
  app.get("/", (req, res) =>
    res
      .type("html")
      .send(
        `<body style="font-family:sans-serif;background:#05060f;color:#eef0ff;padding:40px"><h2>Server is running</h2><p>The web app hasn't been built yet. In <code>/server</code> run <code>npm run build-web</code>, then reload.</p></body>`
      )
  );
}

// ---- Scene state -----------------------------------------------------------------------
// Each crew has its own scene. Every screen in that crew (each person's background scene +
// their app) renders from the same snapshot, so everyone sees the same rocket.

const TIMING = {
  launchMs: 8000, // liftoff -> clears atmosphere -> space
  cruiseMs: 5000, // flying to the moon with the sealed memories on board
  arriveMs: 4500, // reaches the moon; colours appear after this
  revealMs: 5000, // colour reveal hold
  cookingMs: 3500, // "Cooking the space!"
  yearsMs: 4000, // "3 years have passed"
};

function activityView(crew) {
  const name = (id) => crews.findMember(crew, id)?.name || "Someone";
  return crew.activity.slice(-30).reverse().map((a) => ({
    id: a.id,
    type: a.type,
    at: a.at,
    week: a.week,
    kind: a.kind || null,
    memberId: a.memberId || null,
    memberName: a.memberId ? name(a.memberId) : null,
    aboutId: a.aboutId || null,
    aboutName: a.aboutId ? name(a.aboutId) : null,
  }));
}

function buildSceneState(crew) {
  if (!crew) {
    return {
      code: null,
      phase: "collecting",
      phaseStartedAt: Date.now(),
      timeJumpStep: 0,
      stepStartedAt: Date.now(),
      serverNow: Date.now(),
      timing: TIMING,
      members: [],
      litEngines: [],
      readyEngines: [],
      engineCount: 4,
      memoryTotal: 0,
    };
  }
  const members = crew.members.map((m) => crews.publicMember(crew, m));
  return {
    code: crew.code,
    crewName: crew.name,
    phase: crew.phase,
    phaseStartedAt: crew.phaseStartedAt,
    timeJumpStep: crew.timeJumpStep,
    stepStartedAt: crew.stepStartedAt,
    serverNow: Date.now(),
    timing: TIMING,
    week: crews.currentWeek(crew),
    semesterWeeks: crews.SEMESTER_WEEKS,
    rules: {
      minMemories: crews.MIN_MEMORIES_TO_BE_READY,
      minMembers: crews.MIN_MEMBERS_TO_LAUNCH,
      maxMembers: crews.MAX_MEMBERS,
    },
    members,
    litEngines: members.map((m) => m.engineSlot),
    readyEngines: members.filter((m) => m.ready).map((m) => m.engineSlot),
    engineCount: Math.max(4, members.length),
    memoryTotal: crew.memories.length,
    activity: activityView(crew),
    reveal: crews.atLeast(crew, "arrived")
      ? crew.members.map((m) => ({ id: m.id, name: m.name, engineSlot: m.engineSlot, colors: m.colors }))
      : null,
    capsule: crew.phase === "revealed" ? crews.buildCapsule(crew) : null,
    puzzleUrl: PUZZLE_URL,
    puzzleAnswer: crew.puzzleAnswer,
  };
}

const room = (code) => `crew:${code}`;
const memberRoom = (id) => `member:${id}`;

function broadcast(crew) {
  io.to(room(crew.code)).emit("scene_state", buildSceneState(crew));
}

/** Your own memories — visible only to you while the capsule is still open. */
function myMemories(crew, memberId) {
  const name = (id) => crews.findMember(crew, id)?.name || null;
  return crew.memories
    .filter((m) => m.authorId === memberId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => ({ id: m.id, kind: m.kind, promptId: m.promptId, text: m.text, week: m.week, createdAt: m.createdAt, aboutName: name(m.aboutId), photo: m.photo, drawing: m.drawing }));
}
function sendMyMemories(crew, memberId) {
  io.to(memberRoom(memberId)).emit("my_memories", myMemories(crew, memberId));
}

// ---- Phase machine (runs itself — nobody has to press "next") ----------------------------

const timers = new Map(); // code -> timeout
function schedule(crew) {
  clearTimeout(timers.get(crew.code));
  timers.delete(crew.code);
  const elapsed = Date.now() - crew.phaseStartedAt;
  const stepElapsed = Date.now() - crew.stepStartedAt;
  const after = (ms, fn) => {
    timers.set(
      crew.code,
      setTimeout(() => {
        fn();
        broadcast(crew);
        schedule(crew);
      }, Math.max(0, ms))
    );
  };
  switch (crew.phase) {
    case "launching":
      return after(TIMING.launchMs - elapsed, () => crews.setPhase(crew, "cruising"));
    case "cruising":
      return after(TIMING.cruiseMs - elapsed, () => {
        crews.setPhase(crew, "arrived");
        crews.revealColors(crew);
      });
    case "arrived":
      return after(TIMING.arriveMs + TIMING.revealMs - elapsed, () => {
        crews.setPhase(crew, "timejump");
        crews.setTimeJumpStep(crew, 1);
      });
    case "timejump":
      if (crew.timeJumpStep <= 1) return after(TIMING.cookingMs - stepElapsed, () => crews.setTimeJumpStep(crew, 2));
      return after(TIMING.yearsMs - stepElapsed, () => crews.setPhase(crew, "earth"));
    default:
      return undefined; // collecting / earth / puzzle / revealed wait on the crew
  }
}

function maybeLaunch(crew) {
  if (crew.phase === "collecting" && crews.everyoneReady(crew)) {
    crews.setPhase(crew, "launching");
    schedule(crew);
  }
}

// ---- Real-time layer ----------------------------------------------------------------------

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  // Background scenes connect with ?code=XXXXXX and just listen to that crew.
  const sceneCode = socket.handshake.query?.code;
  const sceneCrew = crews.getCrew(sceneCode);
  if (sceneCrew) socket.join(room(sceneCrew.code));
  socket.emit("scene_state", buildSceneState(sceneCrew));

  socket.on("time_sync", (ack) => typeof ack === "function" && ack(Date.now()));

  /** Bind this socket to a crew + member and send them everything they need. */
  function enter(crew, member) {
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.join(room(crew.code));
    socket.join(memberRoom(member.id));
    socket.data.code = crew.code;
    socket.data.memberId = member.id;
    socket.emit("scene_state", buildSceneState(crew));
    sendMyMemories(crew, member.id);
    return { code: crew.code, participantId: member.id, name: member.name, crewName: crew.name };
  }

  /** Every action below needs a known crew + member; replies with { error } otherwise. */
  const asMember = (fn) => (payload = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    const crew = crews.getCrew(payload.code || socket.data.code);
    const member = crew && crews.findMember(crew, payload.participantId || socket.data.memberId);
    if (!member) return reply({ error: "We couldn't find you in that crew. Try joining again." });
    fn({ crew, member, payload, reply });
  };

  socket.on("create_crew", ({ crewName, name, avatar } = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    if (!String(name || "").trim()) return reply({ error: "Add your name first." });
    const { crew, member } = crews.createCrew({ crewName, memberName: name, avatar });
    reply(enter(crew, member));
    broadcast(crew);
  });

  socket.on("join_session", ({ code, name, participantId, avatar } = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    const crew = crews.getCrew(code);
    if (!crew) return reply({ error: "We can't find a crew with that code." });

    // Coming back (days later, a reload, another tab): same id, nothing changes.
    const existing = participantId && crews.findMember(crew, participantId);
    if (existing) return reply(enter(crew, existing));

    if (!String(name || "").trim()) return reply({ error: "Add your name first." });
    // Same name rejoining from a new device — let them back in as themselves.
    const sameName = crew.members.find((m) => !m.isSimulated && m.name.toLowerCase() === String(name).trim().toLowerCase());
    if (sameName) return reply(enter(crew, sameName));

    const result = crews.addMember(crew, name, { avatar });
    if (result.error) return reply({ error: result.error });
    reply(enter(crew, result.member));
    io.to(room(crew.code)).emit("engine_ignite", { engineSlot: result.member.engineSlot, name: result.member.name, memberId: result.member.id, avatar: result.member.avatar });
    broadcast(crew);
  });

  socket.on(
    "set_avatar",
    asMember(({ crew, member, payload, reply }) => {
      const r = crews.setAvatar(crew, member.id, payload.avatar);
      reply(r);
      if (!r.error) broadcast(crew);
    })
  );

  socket.on(
    "add_memory",
    asMember(({ crew, member, payload, reply }) => {
      const result = crews.addMemory(crew, member.id, payload.memory || {});
      if (result.error) return reply({ error: result.error });
      reply({ ok: true, id: result.memory.id });
      io.to(room(crew.code)).emit("memory_added", {
        memberId: member.id,
        memberName: member.name,
        avatar: member.avatar,
        aboutId: result.memory.aboutId,
        aboutName: crews.findMember(crew, result.memory.aboutId)?.name || null,
        kind: result.memory.kind,
      });
      sendMyMemories(crew, member.id);
      broadcast(crew);
    })
  );

  socket.on(
    "remove_memory",
    asMember(({ crew, member, payload, reply }) => {
      const result = crews.removeMemory(crew, member.id, payload.memoryId);
      if (result.error) return reply({ error: result.error });
      reply({ ok: true });
      sendMyMemories(crew, member.id);
      broadcast(crew);
    })
  );

  socket.on(
    "set_ready",
    asMember(({ crew, member, payload, reply }) => {
      const result = crews.setReady(crew, member.id, !!payload.ready);
      if (result.error) return reply({ error: result.error });
      reply({ ok: true });
      maybeLaunch(crew);
      broadcast(crew);
    })
  );

  // Anyone in the crew can open the capsule once the rocket is home.
  socket.on(
    "start_puzzle",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "earth") return reply({ error: "The rocket isn't home yet." });
      crews.setPhase(crew, "puzzle");
      reply({ ok: true });
      broadcast(crew);
    })
  );

  // ---- Demo tools: any crewmate can use these (they're labelled "demo" in the app) ----

  socket.on(
    "demo_fast_forward",
    asMember(({ crew, reply }) => {
      const r = crews.fastForwardWeek(crew);
      reply(r);
      if (!r.error) broadcast(crew);
    })
  );

  socket.on(
    "demo_add_crewmate",
    asMember(({ crew, reply }) => {
      const r = crews.addSimulatedMember(crew);
      if (r.error) return reply(r);
      reply({ ok: true });
      io.to(room(crew.code)).emit("engine_ignite", { engineSlot: r.member.engineSlot, name: r.member.name });
      broadcast(crew);
    })
  );

  socket.on(
    "demo_sim_memories",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "collecting") return reply({ error: "Already launched." });
      const added = crews.simulateMemories(crew);
      reply({ ok: true, added: added.length });
      added.forEach((m) =>
        io.to(room(crew.code)).emit("memory_added", {
          memberId: m.authorId,
          memberName: crews.findMember(crew, m.authorId)?.name,
          avatar: crews.findMember(crew, m.authorId)?.avatar,
          aboutId: m.aboutId,
          aboutName: crews.findMember(crew, m.aboutId)?.name || null,
          kind: m.kind,
        })
      );
      broadcast(crew);
    })
  );

  socket.on(
    "demo_ready_others",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "collecting") return reply({ error: "Already launched." });
      crews.readySimulated(crew);
      reply({ ok: true });
      maybeLaunch(crew);
      broadcast(crew);
    })
  );

  socket.on(
    "demo_skip_puzzle",
    asMember(({ crew, member, reply }) => {
      if (crew.phase !== "puzzle") return reply({ error: "Not at the puzzle yet." });
      crews.recordPuzzleAnswer(crew, member.id, null);
      reply({ ok: true });
      broadcast(crew);
    })
  );
});

// Pick up where any crew left off if the server restarted mid-launch.
crews.allCrews().forEach(schedule);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("==================================================");
  console.log("  LAUNCH SEQUENCE — memory capsule server");
  console.log("==================================================");
  console.log(`  On this computer:      http://localhost:${PORT}`);
  console.log(`  Phones on same Wi-Fi:  http://${LAN_IP}:${PORT}`);
  console.log("  Open that link on every phone/laptop. No host screen needed.");
  console.log("==================================================");
  console.log("");
});
