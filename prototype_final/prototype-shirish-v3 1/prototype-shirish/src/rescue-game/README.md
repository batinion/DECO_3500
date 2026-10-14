# Rescue your memories (standalone)

One of the two activities from the Launch Sequence memory capsule, running on its own:
no crews, no semester, no capsule — just open a room and play.

## Run it

You need [Node.js](https://nodejs.org) (v18+).

```bash
cd rescue-game
npm install      # first time only
npm start        # or double-click start.bat (Windows) / ./start.sh (Mac, Linux)
```

Open `http://localhost:4001`. Phones and laptops on the same Wi-Fi use the
`Phones on same Wi-Fi` link the terminal prints. Use `PORT=1234 npm start` to change the port.

## How it works

- **Two versions**, chosen in the lobby (anyone in the room can switch before starting):
  - **Classic**: everyone flies their own ship in the same space. Simulated crewmates can join.
  - **One ship**: a single ship, flown by the whole room. Five controls (steering, throttle,
    altitude, memory pick-up, gun) are dealt out at random; with fewer than 5 players some
    players get several. Max 5 players, no simulated crewmates. The ship is simulated on the
    server, so everyone sees the same movement; the roster at the top lights up as each
    control is used. To save a memory, fly close and the pick-up player taps their button.
- **Play now** makes a room (with simulated crewmates in Classic) and starts straight away.
- **Create a room** gives a 6-letter code; friends open the same link and **Join**. Anyone can
  add simulated crewmates and press **Start**.
- The game needs something to save, so each player is given a few sample memories.
- When the game ends, the lobby offers **Play again**.

## Files

```
server.js          HTTP + Socket.IO: lobby, rooms, the game loop
src/rooms.js       In-memory rooms, simulated crewmates, sample memories
src/games.js       Classic game rules and the simulated crewmates' play
src/sharedship.js  One-ship version: control roles and the server-side ship simulation
public/index.html  Lobby
public/game.html   Classic game screen (served at /play)
public/shared.html One-ship game screen (served at /play for one-ship rooms)
```

The other activity lives in `../colour-game` (port 4002), so both can run at the same time.
