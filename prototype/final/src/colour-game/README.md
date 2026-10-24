# Colour restore (standalone)

One of the two activities from the Launch Sequence memory capsule, running on its own:
no crews, no semester, no capsule — just open a room and play.

## Run it

You need [Node.js](https://nodejs.org) (v18+).

```bash
cd colour-game
npm install      # first time only
npm start        # or double-click start.bat (Windows) / ./start.sh (Mac, Linux)
```

Open `http://localhost:4002`. Phones and laptops on the same Wi-Fi use the
`Phones on same Wi-Fi` link the terminal prints. Use `PORT=1234 npm start` to change the port.

## How it works

- **Play now** makes a room, adds simulated crewmates and starts straight away.
- **Create a room** gives a 6-letter code; friends open the same link and **Join**. Anyone can
  add simulated crewmates and press **Start**.
- The game needs something to save, so each player is given a few sample memories.
- When the game ends, the lobby offers **Play again**.

## Files

```
server.js          HTTP + Socket.IO: lobby, rooms, the game loop
src/rooms.js       In-memory rooms, simulated crewmates, sample memories
src/games.js       Game rules and the simulated crewmates' play
public/index.html  Lobby
public/game.html   The game screen (served at /play)
```

The other activity lives in `../rescue-game` (port 4001), so both can run at the same time.
