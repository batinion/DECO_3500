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
const SUBMISSIONS_DIR = path.join(__dirname, "..", "submissions");

fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

const app = express();
app.use(cors()); // client devices connect from a different origin (LAN IP:port, or expo web's own port)
app.use(express.json({ limit: "15mb" })); // base64 drawing PNGs go through JSON
app.use(express.static(path.join(__dirname, "..", "public")));
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

app.get("/api/session-info", async (req, res) => {
  const s = session.publicSession();
  const joinPayload = JSON.stringify({ ip: LAN_IP, port: PORT, code: s.code });
  const qrDataUrl = await QRCode.toDataURL(joinPayload, { margin: 1, width: 320 });
  res.json({ ...s, ip: LAN_IP, port: PORT, qrDataUrl });
});

// ---- Real-time layer --------------------------------------------------------

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

function broadcastRoster() {
  io.emit("roster_update", session.publicSession());
}

async function broadcastSessionInfo() {
  const s = session.publicSession();
  const joinPayload = JSON.stringify({ ip: LAN_IP, port: PORT, code: s.code });
  const qrDataUrl = await QRCode.toDataURL(joinPayload, { margin: 1, width: 320 });
  io.emit("session_reset", { ...s, ip: LAN_IP, port: PORT, qrDataUrl });
}

function sendQuestionsToJoinedSockets() {
  session.getSession().participants.forEach((p) => {
    if (p.socketId && p.questions) {
      io.to(p.socketId).emit("questions_released", { questions: p.questions });
    }
  });
}

async function runLaunchAndReveal() {
  session.beginLaunch();
  broadcastRoster();
  io.emit("launch_sequence_start", {});

  // Give the launch animation a moment to play before the color reveal.
  setTimeout(() => {
    const summary = session.revealColors();
    summary.forEach((p) => {
      if (p && session.findParticipant(p.id)?.socketId) {
        io.to(session.findParticipant(p.id).socketId).emit("mission_colors", {
          colors: p.colors,
        });
      }
    });
    io.emit("mission_colors_summary", { participants: summary });
    broadcastRoster();
  }, 4000);
}

io.on("connection", (socket) => {
  socket.on("join_session", ({ code, name, participantId } = {}, ack) => {
    const reply = (payload) => typeof ack === "function" && ack(payload);
    const current = session.getSession();

    if (!code || code.toUpperCase() !== current.code) {
      return reply({ error: "That code doesn't match the current session." });
    }

    // Reconnect flow: same participantId as before.
    if (participantId) {
      const existing = session.findParticipant(participantId);
      if (existing) {
        session.attachSocket(participantId, socket.id);
        socket.data.participantId = participantId;
        broadcastRoster();
        return reply({
          participantId: existing.id,
          engineSlot: existing.engineSlot,
          name: existing.name,
          phase: current.phase,
          status: existing.status,
          questions: existing.questions || null,
          colors: existing.colors || null,
        });
      }
    }

    const result = session.addParticipant(name);
    if (result.error) return reply({ error: result.error });

    const participant = result.participant;
    session.attachSocket(participant.id, socket.id);
    socket.data.participantId = participant.id;

    broadcastRoster();
    sendQuestionsToJoinedSockets();

    reply({
      participantId: participant.id,
      engineSlot: participant.engineSlot,
      name: participant.name,
      phase: session.getSession().phase,
      status: participant.status,
      questions: participant.questions || null,
      colors: participant.colors || null,
    });
  });

  socket.on("submit_answers", ({ participantId, answers } = {}, ack) => {
    const reply = (payload) => typeof ack === "function" && ack(payload);
    const result = session.recordSubmission(participantId, answers || []);
    if (result.error) return reply({ error: result.error });

    const p = result.participant;

    // Persist to disk so real answers survive a server restart.
    const dir = participantDir(session.getSession().code, p.id);
    fs.writeFileSync(
      path.join(dir, "answers.json"),
      JSON.stringify({ participant: { id: p.id, name: p.name }, answers: p.answers }, null, 2)
    );

    io.emit("engine_ignite", { engineSlot: p.engineSlot, participantId: p.id, name: p.name });
    broadcastRoster();
    reply({ ok: true });

    if (session.allSubmitted()) {
      runLaunchAndReveal();
    }
  });

  socket.on("simulate_remaining", () => {
    session.simulateRemaining();
    broadcastRoster();
    sendQuestionsToJoinedSockets();

    // Ignite engines for every simulated participant that just auto-submitted.
    session
      .getSession()
      .participants.filter((p) => p.isSimulated && p.status === "submitted")
      .forEach((p) => {
        io.emit("engine_ignite", { engineSlot: p.engineSlot, participantId: p.id, name: p.name });
      });

    broadcastRoster();
    if (session.allSubmitted()) {
      runLaunchAndReveal();
    }
  });

  socket.on("session_reset", () => {
    session.resetSession();
    broadcastSessionInfo();
  });

  socket.on("disconnect", () => {
    session.detachSocket(socket.id);
    broadcastRoster();
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  const s = session.getSession();
  console.log("");
  console.log("========================================");
  console.log("  LAUNCH SEQUENCE — Mission Control server");
  console.log("========================================");
  console.log(`  Mission Control page: http://${LAN_IP}:${PORT}`);
  console.log(`  LAN IP:  ${LAN_IP}`);
  console.log(`  Port:    ${PORT}`);
  console.log(`  Join code: ${s.code}`);
  console.log("========================================");
  console.log("");
});
