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
const games = require("./games");
const sharedShip = require("./sharedship");

process.on("uncaughtException", (e) => console.error("Unhandled error (server kept running):", e));
process.on("unhandledRejection", (e) => console.error("Unhandled rejection (server kept running):", e));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SUBMISSIONS_DIR = path.join(__dirname, "..", "submissions");
// The participant app, exported for the web (`npx expo export --platform web` in /app,
// output copied here by `npm run build-web`). Served at "/" so any phone or laptop on the
// same Wi-Fi just opens http://<this-computer's-ip>:4000 — no app install, no host screen.
const WEB_APP_DIR = path.join(__dirname, "..", "web-app");

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
// The rescue flight (one ship, flown by the whole crew), embedded full-screen in the app once the hatch blows open.
app.get(["/game/rescue", "/game/shared"], (req, res) => res.sendFile(path.join(PUBLIC_DIR, "game", "shared.html")));
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
  app.get(/^\/(?!socket\.io|api|uploads|scene|intro|game|future).*/, (req, res) => res.sendFile(path.join(WEB_APP_DIR, "index.html")));
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
  boardPerMs: 1500, // each crewmate walks up and loads their memories, one at a time
  boardTailMs: 1200, // hatch closes
  launchMs: 12500, // 6 s countdown hold -> liftoff -> clears atmosphere -> space
  cruiseMs: 7000, // reaches outer space, shuts down its engines and floats away until it vanishes
  warpMs: 44500, // "meanwhile on Earth": a line of text, then the future gifs (2032, 2040, 2050)
  homecomingMs: 21500, // rescue flight done: dock -> memories back in the rocket -> rocket reaches Earth
  earthMs: 13000, // "memories coming back" text, rocket drifts in towards Earth... then the cargo hatch blows
};
const boardMs = (crew) => crew.members.length * TIMING.boardPerMs + TIMING.boardTailMs;

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
    serverNow: Date.now(),
    timing: { ...TIMING, boardMs: boardMs(crew) },
    week: crews.currentWeek(crew),
    semesterWeeks: crews.SEMESTER_WEEKS,
    rules: {
      minMemories: crews.MIN_MEMORIES_TO_BE_READY,
      required: ["image", "collab", "prompt"],
      minMembers: crews.MIN_MEMBERS_TO_LAUNCH,
      maxMembers: crews.MAX_MEMBERS,
    },
    members,
    litEngines: members.map((m) => m.engineSlot),
    readyEngines: members.filter((m) => m.ready).map((m) => m.engineSlot),
    engineCount: Math.max(4, members.length),
    memoryTotal: crew.memories.length,
    activity: activityView(crew),
    game: crew.game ? games.summary(crew) : null,
    capsule: crew.phase === "revealed" ? crews.buildCapsule(crew) : null,
  };
}

const room = (code) => `crew:${code}`;
const memberRoom = (id) => `member:${id}`;

function broadcast(crew) {
  io.to(room(crew.code)).emit("scene_state", buildSceneState(crew));
}

/** Game screens get their own, faster-moving state. Hits are batched to ~10 updates/sec. */
const gameTimers = new Map();
function broadcastGame(crew, now = false) {
  const send = () => {
    gameTimers.delete(crew.code);
    const v = games.view(crew);
    if (v) io.to(room(crew.code)).emit("game_state", v);
  };
  if (now) {
    clearTimeout(gameTimers.get(crew.code));
    return send();
  }
  if (!gameTimers.has(crew.code)) gameTimers.set(crew.code, setTimeout(send, 100));
}

function emitGameEvents(crew, events) {
  events.forEach((e) => {
    if (e.type === "state") return broadcastGame(crew, true);
    if (e.type === "game_complete") {
      io.to(room(crew.code)).emit("game_event", e);
      broadcastGame(crew, true);
      // a moment to celebrate, then everyone's capsule opens. The rescue flight plays a ~20s
      // homecoming first (dock, memories back in the rocket, rocket reaches Earth).
      setTimeout(() => {
        if (crew.phase === "rescue") {
          crews.setPhase(crew, "revealed");
          broadcast(crew);
        }
      }, crew.game?.type === "shared" ? 5000 : TIMING.homecomingMs);
      return;
    }
    io.to(room(crew.code)).emit("game_event", e);
    broadcastGame(crew);
  });
}

/** Your own memories — visible only to you while the capsule is still open. */
function myMemories(crew, memberId) {
  const name = (id) => crews.findMember(crew, id)?.name || null;
  return crew.memories
    .filter((m) => m.authorId === memberId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => ({ id: m.id, kind: m.kind, promptId: m.promptId, text: m.text, n: crew.memories.indexOf(m) + 1, week: m.week, createdAt: m.createdAt, aboutName: name(m.aboutId), photo: m.photo, drawing: m.drawing }));
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
    case "boarding":
      return after(boardMs(crew) - elapsed, () => crews.setPhase(crew, "launching"));
    case "launching":
      return after(TIMING.launchMs - elapsed, () => crews.setPhase(crew, "cruising"));
    case "cruising":
      return after(TIMING.cruiseMs - elapsed, () => crews.setPhase(crew, "timejump"));
    case "timejump":
      return after(TIMING.warpMs - elapsed, () => crews.setPhase(crew, "earth"));
    case "earth":
      return after(TIMING.earthMs - elapsed, () => crews.setPhase(crew, "lost"));
    default:
      return undefined; // collecting / lost / games / revealed wait on the crew
  }
}

function maybeLaunch(crew) {
  if (crew.phase === "collecting" && crews.everyoneReady(crew)) {
    crews.revealColors(crew); // each crewmate's colour, used to tint their memories in the reveal
    crews.setPhase(crew, "boarding");
    schedule(crew);
  }
}

// Games run on a shared clock: simulated crewmates play.
let tickCount = 0;
setInterval(() => {
  tickCount++;
  crews.allCrews().forEach((crew) => {
    if (crew.phase === "rescue" && tickCount % 4 === 0) emitGameEvents(crew, games.tick(crew));
  });
}, 250);

// The one-ship version: simulated here ~30x/sec, relayed to every phone ~15x/sec.
let sharedTick = 0;
setInterval(() => {
  sharedTick++;
  crews.allCrews().forEach((crew) => {
    if (crew.phase !== "rescue" || !sharedShip.running(crew)) return;
    const events = sharedShip.step(crew);
    events.forEach((e) => io.to(room(crew.code)).emit("shared_event", e));
    if (sharedTick % 2 === 0) io.to(room(crew.code)).emit("shared_ship", sharedShip.shipState(crew));
    const done = events.find((e) => e.type === "game_complete");
    if (done) emitGameEvents(crew, [done]);
  });
}, 33);

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
      const result = crews.setReady(crew, member.id, !!payload.ready, !!payload.skip);
      if (result.error) return reply({ error: result.error });
      reply({ ok: true });
      maybeLaunch(crew);
      broadcast(crew);
    })
  );

  // After the hatch blows: anyone picks how the crew gets the memories back, for everyone.
  socket.on(
    "choose_activity",
    asMember(({ crew, member, payload, reply }) => {
      if (crew.phase !== "lost") return reply({ error: "Not right now." });
      const a = payload.activity;
      if (a === "skip") crews.setPhase(crew, "revealed");
      else if (a === "rescue") {
        const r = games.start(crew, a, member.id);
        if (r.error) return reply(r);
      }
      else return reply({ error: "Pick an activity." });
      reply({ ok: true });
      broadcast(crew);
      broadcastGame(crew, true);
    })
  );

  // ---- Game screens (served at /game/*, embedded in the app) ----
  socket.on(
    "game_join",
    asMember(({ crew, member, reply }) => {
      socket.join(room(crew.code));
      socket.join(memberRoom(member.id));
      socket.data.code = crew.code;
      socket.data.memberId = member.id;
      reply({ ok: true, me: { id: member.id, name: member.name, avatar: member.avatar } });
      const v = games.view(crew);
      if (v) socket.emit("game_state", v);
    })
  );

  socket.on(
    "rescue_hit",
    asMember(({ crew, member, payload }) => {
      const e = games.rescueHit(crew, member.id, payload.capsuleId, payload.n);
      emitGameEvents(crew, e ? [e] : []);
      broadcastGame(crew);
    })
  );

  socket.on(
    "rescue_fail",
    asMember(({ crew, member, payload }) => {
      const e = games.rescueFail(crew, member.id, payload.capsuleId, payload.reason);
      if (e) emitGameEvents(crew, [e]);
      broadcastGame(crew, true);
    })
  );

  // One ship, shared controls. Everyone has to take their seat before the flight starts.
  socket.on(
    "shared_seat",
    asMember(({ crew, member }) => {
      sharedShip.seat(crew, member.id);
      broadcastGame(crew, true);
    })
  );
  socket.on(
    "shared_input",
    asMember(({ crew, member, payload }) => sharedShip.input(crew, member.id, payload.role, payload.value))
  );
  socket.on(
    "shared_pickup",
    asMember(({ crew, member }) => {
      const r = sharedShip.pickup(crew, member.id);
      if (!r) return;
      if (r.miss) return socket.emit("shared_event", { type: "say", text: "Nothing in reach. Fly closer to a memory!", dur: 1.6 });
      io.to(room(crew.code)).emit("game_event", r);
      broadcastGame(crew, true);
    })
  );

  // Skip button: bring every memory home and open the capsule for the whole crew straight away.
  socket.on(
    "game_skip",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "rescue" || !crew.game) return reply({ error: "No game running." });
      games.finishNow(crew);
      crews.setPhase(crew, "revealed");
      reply({ ok: true });
      broadcast(crew);
    })
  );

  socket.on(
    "flight_finish", // the "skip the flight" demo button
    asMember(({ crew, reply }) => {
      if (crew.phase !== "rescue" || !["flight", "shared"].includes(crew.game?.type)) return reply({ error: "No flight running." });
      games.finishNow(crew);
      reply({ ok: true });
      emitGameEvents(crew, [{ type: "game_complete" }]);
    })
  );

  // Rescue: after the last capsule is saved (from a hit), wrap up straight away.
  // (The 1-second tick also catches it.)

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

  // Practice mode: two simulated crewmates join, write their memories and get ready. They
  // also play the rescue games, so one tester can run the whole experience.
  socket.on(
    "demo_simulate_crew",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "collecting") return reply({ error: "Already launched." });
      const { added, memories } = crews.simulateCrew(crew, 3);
      reply({ ok: true, added: added.length });
      added.forEach((m) => io.to(room(crew.code)).emit("engine_ignite", { engineSlot: m.engineSlot, name: m.name, memberId: m.id, avatar: m.avatar }));
      broadcast(crew);
      // their memories trickle in, so it feels like a crew rather than a data dump
      memories.forEach((m, i) =>
        setTimeout(() => {
          io.to(room(crew.code)).emit("memory_added", {
            memberId: m.authorId,
            memberName: crews.findMember(crew, m.authorId)?.name,
            avatar: crews.findMember(crew, m.authorId)?.avatar,
            aboutId: m.aboutId,
            aboutName: crews.findMember(crew, m.aboutId)?.name || null,
            kind: m.kind,
          });
        }, 900 + i * 700)
      );
    })
  );

  socket.on(
    "demo_finish_game",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "rescue" || !crew.game || crew.game.type === "setup") return reply({ error: "No game running." });
      games.finishNow(crew);
      reply({ ok: true });
      emitGameEvents(crew, [{ type: "game_complete" }]);
    })
  );

  // Back to the very beginning for everyone: tell every screen in the crew, then drop the crew.
  socket.on(
    "demo_start_over",
    asMember(({ crew, reply }) => {
      clearTimeout(timers.get(crew.code));
      timers.delete(crew.code);
      io.to(room(crew.code)).emit("start_over");
      crews.removeCrew(crew);
      reply({ ok: true });
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

});

// Crews saved mid-way through a game that no longer exists (a ship each, colour restore) go back to the breach choice.
crews.allCrews().forEach((crew) => {
  const stale = (crew.phase === "rescue" || crew.phase === "colorgame") && crew.game?.type !== "shared";
  if (stale) {
    crew.game = null;
    crews.setPhase(crew, "lost");
  }
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
