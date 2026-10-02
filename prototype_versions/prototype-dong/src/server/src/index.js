const path = require("path");
const fs = require("fs");
const os = require("os");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const QRCode = require("qrcode");
const cors = require("cors");
const { nanoid } = require("nanoid");

const session = require("./session");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SUBMISSIONS_DIR = path.join(__dirname, "..", "submissions");
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

const app = express();
app.use(cors()); // client devices connect from a different origin (LAN IP:port, or expo web's own port)
app.use(express.json({ limit: "15mb" })); // base64 drawing PNGs go through JSON
// Registered before express.static: public/scene/ is also a directory (the scene module's
// assets), and static would otherwise redirect "/scene" to "/scene/" and 404.
app.get("/scene", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "scene.html")));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(SUBMISSIONS_DIR));

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

const LAN_IP = getLanIp();

// ---- HTTP upload endpoints -------------------------------------------------

function participantDir(code, participantId) {
  const dir = path.join(SUBMISSIONS_DIR, code, participantId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { code, participantId } = req.body;
    if (!code || !participantId) return cb(new Error("Missing code/participantId"));
    cb(null, participantDir(code, participantId));
  },
  filename: (req, file, cb) => {
    const { questionId } = req.body;
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${questionId || "file"}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// IMPORTANT for clients: append text fields (code, participantId, questionId) to the
// FormData BEFORE the file field, so multer has them available when picking a destination.
app.post("/api/upload", upload.single("file"), (req, res) => {
  const { code, participantId } = req.body;
  const relPath = path.relative(SUBMISSIONS_DIR, req.file.path).split(path.sep).join("/");
  res.json({ fileUrl: `/uploads/${relPath}` });
});

app.post("/api/upload-drawing", (req, res) => {
  const { code, participantId, questionId, dataUrl } = req.body;
  if (!code || !participantId || !dataUrl) {
    return res.status(400).json({ error: "Missing code/participantId/dataUrl" });
  }
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return res.status(400).json({ error: "dataUrl must be a base64 PNG" });
  const buffer = Buffer.from(match[1], "base64");
  const dir = participantDir(code, participantId);
  const filename = `${questionId || "drawing"}-${Date.now()}.png`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  const relPath = `${code}/${participantId}/${filename}`;
  res.json({ fileUrl: `/uploads/${relPath}` });
});

// The single team-wide puzzle answer file — any one participant's upload counts for the group.
const puzzleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { code } = req.body;
    if (!code) return cb(new Error("Missing code"));
    const dir = path.join(SUBMISSIONS_DIR, code, "puzzle-answer");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const { participantId } = req.body;
    const ext = path.extname(file.originalname) || "";
    cb(null, `${participantId || "answer"}-${Date.now()}${ext}`);
  },
});
const puzzleUpload = multer({ storage: puzzleStorage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post(
  "/api/upload-puzzle-answer",
  (req, res, next) => {
    if (session.getSession().puzzleAnswer) {
      return res.status(409).json({ error: "The puzzle answer has already been uploaded." });
    }
    next();
  },
  puzzleUpload.single("file"),
  (req, res) => {
    const { participantId } = req.body;
    const relPath = path.relative(SUBMISSIONS_DIR, req.file.path).split(path.sep).join("/");
    const result = session.recordPuzzleAnswer(participantId, `/uploads/${relPath}`);
    if (result.error) return res.status(409).json({ error: result.error });

    broadcastScene();
    res.json({ fileUrl: `/uploads/${relPath}` });
  }
);

// ---- Scene state ------------------------------------------------------------
// The server owns the scene. Every screen (Mission Control + each participant's
// background scene + the participant app itself) renders from this one snapshot.

// Server-driven phase lengths. Scenes animate from elapsed time since phaseStartedAt.
const TIMING = {
  launchMs: 8000, // liftoff -> clears atmosphere -> space; then Memory Stars open
  arriveMs: 4500, // rocket reaches the moon; colour reveal appears after this
  revealMs: 4000, // colour reveal hold before the time jump
};

let qrDataUrl = null;
async function refreshQr() {
  const joinPayload = JSON.stringify({ ip: LAN_IP, port: PORT, code: session.getSession().code });
  qrDataUrl = await QRCode.toDataURL(joinPayload, { margin: 1, width: 320 });
}

function buildSceneState() {
  const s = session.getSession();
  const participants = s.participants.map(session.publicParticipant);
  return {
    code: s.code,
    phase: s.phase,
    phaseStartedAt: s.phaseStartedAt,
    timeJumpStep: s.timeJumpStep,
    stepStartedAt: s.stepStartedAt,
    serverNow: Date.now(),
    timing: TIMING,
    participants,
    litEngines: participants.map((p) => p.engineSlot),
    submittedCount: participants.filter((p) => p.status === "submitted").length,
    reveal: session.atLeast("arrived")
      ? s.participants.map((p) => ({ id: p.id, name: p.name, engineSlot: p.engineSlot, colors: p.colors }))
      : null,
    capsule: s.phase === "revealed" ? session.buildCapsuleSummary() : null,
    // "Guess Who": only the current card is sent (not the whole deck), so a peek at
    // the network payload on someone's phone can't spoil cards still to come.
    puzzle:
      s.phase === "puzzle"
        ? {
            index: s.puzzleIndex,
            total: s.puzzleCards.length,
            revealed: s.puzzleRevealed,
            card: s.puzzleCards[s.puzzleIndex] || null,
          }
        : null,
    join: { ip: LAN_IP, port: PORT, code: s.code, qrDataUrl },
  };
}

function broadcastScene() {
  io.emit("scene_state", buildSceneState());
}

// ---- Real-time layer --------------------------------------------------------

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// Phase timers (launch -> cruise, arrival -> time jump, ...). Cleared on reset/skip.
let timers = [];
function later(ms, fn) {
  timers.push(setTimeout(fn, ms));
}
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function startLaunch() {
  session.setPhase("launching");
  io.emit("launch_sequence_start", {});
  broadcastScene();
  later(TIMING.launchMs, () => {
    if (session.getSession().phase !== "launching") return;
    session.setPhase("cruising");
    broadcastScene();
  });
}

function emitMissionColors() {
  session.getSession().participants.forEach((p) => {
    if (p.socketId && p.colors) io.to(p.socketId).emit("mission_colors", { colors: p.colors });
  });
}

function startArrival() {
  session.setPhase("arrived");
  session.revealColors();
  emitMissionColors();
  broadcastScene();
  later(TIMING.arriveMs + TIMING.revealMs, () => {
    if (session.getSession().phase !== "arrived") return;
    // The colour reveal ends as "Cooking the space!" comes up: no separate lead-in step.
    session.setPhase("timejump");
    session.setTimeJumpStep(1);
    broadcastScene();
  });
}

/** A new engine just lit: tell everyone, and launch if that was the 4th. */
function afterJoin(p) {
  io.emit("engine_ignite", { engineSlot: p.engineSlot, participantId: p.id, name: p.name });
  const s = session.getSession();
  if (s.phase === "joining" && s.participants.length === session.MAX_PARTICIPANTS) {
    startLaunch();
  } else {
    broadcastScene();
  }
}

function afterSubmit() {
  if (session.getSession().phase === "cruising" && session.allSubmitted()) {
    startArrival();
  } else {
    broadcastScene();
  }
}

function joinReply(p) {
  return { participantId: p.id, engineSlot: p.engineSlot, name: p.name };
}

io.on("connection", (socket) => {
  // Only Mission Control may drive the scene; scene/participant sockets are view-only.
  const isMc = socket.handshake.query?.role === "mc";
  const controller = (fn) => (...args) => {
    if (isMc) fn(...args);
  };

  // Snapshot on connect/reconnect so a reloaded screen lands on the correct scene state.
  socket.emit("scene_state", buildSceneState());

  socket.on("time_sync", (ack) => typeof ack === "function" && ack(Date.now()));

  socket.on("join_session", ({ code, name, participantId } = {}, ack) => {
    const reply = (payload) => typeof ack === "function" && ack(payload);
    const current = session.getSession();

    if (!code || code.toUpperCase() !== current.code) {
      return reply({ error: "That code doesn't match the current session." });
    }

    // Reconnect flow: same participantId as before. The engine stays lit even while disconnected.
    if (participantId) {
      const existing = session.findParticipant(participantId);
      if (existing) {
        session.attachSocket(participantId, socket.id);
        socket.data.participantId = participantId;
        if (existing.colors) socket.emit("mission_colors", { colors: existing.colors });
        return reply(joinReply(existing));
      }
    }

    if (current.phase !== "joining") {
      return reply({ error: "This crew has already launched." });
    }

    const result = session.addParticipant(name);
    if (result.error) return reply({ error: result.error });

    const participant = result.participant;
    session.attachSocket(participant.id, socket.id);
    socket.data.participantId = participant.id;

    reply(joinReply(participant));
    afterJoin(participant); // joining = ignition
  });

  socket.on("submit_answers", ({ participantId, blanks, drawing, uploadedImages } = {}, ack) => {
    const reply = (payload) => typeof ack === "function" && ack(payload);
    const result = session.recordSubmission(participantId, { blanks, drawing, uploadedImages });
    if (result.error) return reply({ error: result.error });

    const p = result.participant;

    // Persist to disk so real answers survive a server restart.
    const dir = participantDir(session.getSession().code, p.id);
    fs.writeFileSync(
      path.join(dir, "answers.json"),
      JSON.stringify(
        { participant: { id: p.id, name: p.name }, blanks: p.blanks, drawing: p.drawing, uploadedImages: p.uploadedImages },
        null,
        2
      )
    );

    reply({ ok: true });
    afterSubmit();
  });

  // ---- Mission Control controls ----

  // Click-to-advance through the time jump (step 1 -> 2 -> Earth). Step 0 is timed.
  socket.on(
    "advance_scene",
    controller(() => {
      const s = session.getSession();
      if (s.phase !== "timejump" || s.timeJumpStep < 1) return;
      if (s.timeJumpStep === 1) session.setTimeJumpStep(2);
      else session.setPhase("earth");
      broadcastScene();
    })
  );

  socket.on(
    "start_puzzle",
    controller(() => {
      if (session.startPuzzle().error) return;
      broadcastScene();
    })
  );

  // "Guess Who": Mission Control reveals the current card's answer (the crew
  // discusses/guesses out loud first), then advances to the next one.
  socket.on(
    "reveal_puzzle_card",
    controller(() => {
      if (session.revealPuzzleCard().error) return;
      broadcastScene();
    })
  );

  socket.on(
    "next_puzzle_card",
    controller(() => {
      if (session.nextPuzzleCard().error) return;
      broadcastScene();
    })
  );

  // Dev: staggered fake joins (each lights an engine; the 4th triggers the launch).
  socket.on(
    "simulate_joins",
    controller(() => {
      const missing = session.MAX_PARTICIPANTS - session.getSession().participants.length;
      for (let i = 0; i < missing; i++) {
        later(300 + i * 900, () => {
          if (session.getSession().phase !== "joining") return;
          const p = session.addSimulatedParticipant();
          if (p) afterJoin(p);
        });
      }
    })
  );

  // Dev: staggered fake submissions from the simulated crew (real participants write their own).
  socket.on(
    "simulate_submissions",
    controller(() => {
      if (session.getSession().phase !== "cruising") return;
      session.pendingSimulated().forEach((p, i) => {
        later(300 + i * 800, () => {
          if (session.getSession().phase !== "cruising" || p.status === "submitted") return;
          session.submitSimulated(p);
          afterSubmit();
        });
      });
    })
  );

  socket.on(
    "skip_to_reveal",
    controller(() => {
      clearTimers();
      const { added, newlySubmitted } = session.skipToCapsuleReveal();
      [...added, ...newlySubmitted].forEach((p) =>
        io.emit("engine_ignite", { engineSlot: p.engineSlot, participantId: p.id, name: p.name })
      );
      emitMissionColors();
      broadcastScene();
    })
  );

  socket.on(
    "session_reset",
    controller(async () => {
      clearTimers();
      session.resetSession();
      await refreshQr();
      io.emit("session_reset", {});
      broadcastScene();
    })
  );

  socket.on("disconnect", () => {
    session.detachSocket(socket.id);
  });
});

refreshQr().then(() =>
  httpServer.listen(PORT, "0.0.0.0", () => {
    const s = session.getSession();
    console.log("");
    console.log("========================================");
    console.log("  LAUNCH SEQUENCE — Mission Control server");
    console.log("========================================");
    console.log(`  Mission Control page: http://${LAN_IP}:${PORT}`);
    console.log(`  Participant scene:    http://${LAN_IP}:${PORT}/scene?role=participant`);
    console.log(`  LAN IP:  ${LAN_IP}`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  Join code: ${s.code}`);
    console.log("========================================");
    console.log("");
  })
);
