// Colour restore — standalone server. Rooms, lobby and the colour game; nothing else.
const path = require("path");
const os = require("os");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const rooms = require("./src/rooms");
const games = require("./src/games");

// ---- what makes this the "colour" build (the rescue build differs only here) ---------------------
const PORT = process.env.PORT ? Number(process.env.PORT) : 4002;
const TITLE = "Colour restore";
const PLAYING_PHASE = "colorgame"; // the phase games.start() puts a room into
// ---------------------------------------------------------------------------------------------------

const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
app.get("/play", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "game.html")));
app.get("/api/info", (req, res) => res.json({ title: TITLE, lanIp: LAN_IP, port: PORT }));
app.use(express.static(PUBLIC_DIR));

function getLanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list) if (iface.family === "IPv4" && !iface.internal) return iface.address;
  }
  return "127.0.0.1";
}
const LAN_IP = getLanIp();

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const roomOf = (crew) => `room:${crew.code}`;

function broadcastRoom(crew) {
  io.to(roomOf(crew)).emit("room_state", rooms.publicView(crew));
}

/** Game screens get their own, faster-moving state; bursts are batched to ~10 updates/sec. */
const gameTimers = new Map();
function broadcastGame(crew, now = false) {
  const send = () => {
    gameTimers.delete(crew.code);
    const v = games.view(crew);
    if (v) io.to(roomOf(crew)).emit("game_state", v);
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
    io.to(roomOf(crew)).emit("game_event", e);
    if (e.type === "game_complete") {
      broadcastGame(crew, true);
      rooms.setPhase(crew, "done");
      broadcastRoom(crew);
    } else broadcastGame(crew);
  });
}

// Colour rounds move on by themselves on a shared clock; simulated crewmates lock in guesses.
setInterval(() => {
  rooms.allCrews().forEach((crew) => {
    if (crew.phase === PLAYING_PHASE) emitGameEvents(crew, games.tick(crew));
  });
}, 250);

io.on("connection", (socket) => {
  socket.on("time_sync", (ack) => typeof ack === "function" && ack(Date.now()));

  function enter(crew, member) {
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.join(roomOf(crew));
    socket.data.code = crew.code;
    socket.data.memberId = member.id;
    socket.emit("room_state", rooms.publicView(crew));
    return { code: crew.code, participantId: member.id, name: member.name, avatar: member.avatar };
  }

  /** Every action below needs a known room + player; replies with { error } otherwise. */
  const asMember = (fn) => (payload = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    const crew = rooms.getCrew(payload.code || socket.data.code);
    const member = crew && rooms.findMember(crew, payload.participantId || socket.data.memberId);
    if (!member) return reply({ error: "We couldn't find you in that room. Head back to the lobby." });
    fn({ crew, member, payload, reply });
  };

  socket.on("create_room", ({ name, avatar } = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    if (!String(name || "").trim()) return reply({ error: "Add your name first." });
    const { crew, member } = rooms.createCrew({ name, avatar });
    reply(enter(crew, member));
  });

  socket.on("join_room", ({ code, name, avatar, participantId } = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    const crew = rooms.getCrew(code);
    if (!crew) return reply({ error: "We can't find a room with that code." });
    // Coming back (a reload, the lobby after a game): same id, nothing changes.
    const existing = participantId && rooms.findMember(crew, participantId);
    if (existing) return reply(enter(crew, existing));
    if (!String(name || "").trim()) return reply({ error: "Add your name first." });
    const sameName = crew.members.find((m) => !m.isSimulated && m.name.toLowerCase() === String(name).trim().toLowerCase());
    if (sameName) return reply(enter(crew, sameName));
    if (crew.phase !== "lobby") return reply({ error: "That game has already started. Ask for a new room." });
    const r = rooms.addMember(crew, name, { avatar });
    if (r.error) return reply({ error: r.error });
    reply(enter(crew, r.member));
    broadcastRoom(crew);
  });

  socket.on(
    "add_bots",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "lobby") return reply({ error: "The game has already started." });
      rooms.addBots(crew, 3);
      reply({ ok: true });
      broadcastRoom(crew);
    })
  );

  socket.on(
    "start_game",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "lobby") return reply({ error: "Already started." });
      rooms.seedMemories(crew);
      games.start(crew);
      reply({ ok: true });
      broadcastRoom(crew);
      broadcastGame(crew, true);
    })
  );

  socket.on(
    "play_again",
    asMember(({ crew, reply }) => {
      if (crew.phase === "lobby") return reply({ ok: true });
      rooms.reset(crew);
      reply({ ok: true });
      broadcastRoom(crew);
    })
  );

  // ---- game screen (served at /play) ----
  socket.on(
    "game_join",
    asMember(({ crew, member, reply }) => {
      socket.join(roomOf(crew));
      socket.data.code = crew.code;
      socket.data.memberId = member.id;
      const v = games.view(crew);
      if (!v) return reply({ error: "No game running." });
      reply({ ok: true, me: { id: member.id, name: member.name, avatar: member.avatar } });
      socket.emit("game_state", v);
    })
  );

  socket.on(
    "color_guess",
    asMember(({ crew, member, payload, reply }) => {
      const r = games.colorGuess(crew, member.id, payload.hex);
      reply(r);
      if (!r.error) emitGameEvents(crew, games.tick(crew).concat([{ type: "state" }]));
    })
  );
  socket.on(
    "color_hint",
    asMember(({ crew, member, reply }) => reply(games.colorHint(crew, member.id)))
  );
  socket.on(
    "color_next",
    asMember(({ crew, member }) => {
      games.colorNext(crew, member.id);
      emitGameEvents(crew, games.tick(crew).concat([{ type: "state" }]));
    })
  );
  socket.on(
    "demo_finish_game",
    asMember(({ crew, reply }) => {
      if (crew.phase !== PLAYING_PHASE) return reply({ error: "No game running." });
      games.finishNow(crew);
      reply({ ok: true });
      emitGameEvents(crew, [{ type: "game_complete" }]);
    })
  );
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("==================================================");
  console.log(`  ${TITLE.toUpperCase()}`);
  console.log("==================================================");
  console.log(`  On this computer:      http://localhost:${PORT}`);
  console.log(`  Phones on same Wi-Fi:  http://${LAN_IP}:${PORT}`);
  console.log("==================================================");
  console.log("");
});
