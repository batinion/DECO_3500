// Rescue your memories — standalone server. Rooms, lobby and the flight game; nothing else.
const path = require("path");
const os = require("os");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const rooms = require("./src/rooms");
const games = require("./src/games");
const sharedShip = require("./src/sharedship");

// ---- what makes this the "rescue" build (the colour build differs only here) ---------------------
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const TITLE = "Rescue your memories";
const PLAYING_PHASE = "rescue"; // the phase games.start() puts a room into
// ---------------------------------------------------------------------------------------------------

const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
// Classic and shared-ship rooms use different game screens.
app.get("/play", (req, res) => {
  const shared = rooms.getCrew(req.query.code)?.mode === "shared";
  res.sendFile(path.join(PUBLIC_DIR, shared ? "shared.html" : "game.html"));
});
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

// The flight: 10x/sec, simulated crewmates move and everyone's ships are relayed to the room.
setInterval(() => {
  rooms.allCrews().forEach((crew) => {
    if (crew.phase !== PLAYING_PHASE || crew.game?.type !== "flight" || crew.game.finishedAt) return;
    const events = games.flightTick(crew, 0.1);
    events.forEach((e) => io.to(roomOf(crew)).emit("game_event", e));
    if (events.length) broadcastGame(crew, true);
    io.to(roomOf(crew)).emit("flight_ships", { t: Date.now(), ships: games.flightShips(crew) });
  });
}, 100);

// The shared ship: simulated here ~30x/sec, relayed to every phone ~15x/sec.
let sharedTick = 0;
setInterval(() => {
  sharedTick++;
  rooms.allCrews().forEach((crew) => {
    if (!sharedShip.running(crew)) return;
    const events = sharedShip.step(crew);
    events.forEach((e) => io.to(roomOf(crew)).emit("shared_event", e));
    if (sharedTick % 2 === 0) io.to(roomOf(crew)).emit("shared_ship", sharedShip.shipState(crew));
    const done = events.find((e) => e.type === "game_complete");
    if (done) emitGameEvents(crew, [done]);
  });
}, 33);

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

  socket.on("create_room", ({ name, avatar, mode } = {}, ack) => {
    const reply = (p) => typeof ack === "function" && ack(p);
    if (!String(name || "").trim()) return reply({ error: "Add your name first." });
    const { crew, member } = rooms.createCrew({ name, avatar, mode });
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
    "set_mode",
    asMember(({ crew, payload, reply }) => {
      if (crew.phase !== "lobby") return reply({ error: "The game has already started." });
      const r = rooms.setMode(crew, payload.mode);
      reply(r);
      if (!r.error) broadcastRoom(crew);
    })
  );

  socket.on(
    "add_bots",
    asMember(({ crew, reply }) => {
      if (crew.phase !== "lobby") return reply({ error: "The game has already started." });
      if (crew.mode === "shared") return reply({ error: "Simulated crewmates only fly in the classic game." });
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

  // "Start over" from anywhere in the game: everyone in the room goes back to the lobby together.
  socket.on(
    "start_over",
    asMember(({ crew, reply }) => {
      clearTimeout(gameTimers.get(crew.code));
      gameTimers.delete(crew.code);
      rooms.reset(crew);
      reply({ ok: true });
      io.to(roomOf(crew)).emit("start_over");
      broadcastRoom(crew);
    })
  );

  // ---- game screens (served at /play) ----
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

  // ---- shared ship ----
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
      io.to(roomOf(crew)).emit("game_event", r);
      broadcastGame(crew, true);
    })
  );

  socket.on(
    "flight_pos",
    asMember(({ crew, member, payload }) => games.flightPos(crew, member.id, payload))
  );
  socket.on(
    "flight_rock",
    asMember(({ crew, payload }) => {
      if (games.flightRock(crew, payload.id)) socket.to(roomOf(crew)).emit("flight_rock", { id: payload.id });
    })
  );
  socket.on(
    "flight_collect",
    asMember(({ crew, member, payload }) => {
      const e = games.flightCollect(crew, member.id, payload.capsuleId);
      if (!e) return;
      io.to(roomOf(crew)).emit("game_event", e);
      broadcastGame(crew, true);
    })
  );
  socket.on(
    "flight_dock",
    asMember(({ crew }) => {
      const e = games.flightDock(crew);
      if (e) emitGameEvents(crew, [e]);
    })
  );
  socket.on(
    "flight_finish",
    asMember(({ crew, reply }) => {
      if (crew.phase !== PLAYING_PHASE) return reply({ error: "No flight running." });
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
