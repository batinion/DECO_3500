# Prototype

Every build we made this semester. The one to run is in [`final/`](final/).

| Folder | What it is |
| --- | --- |
| [`final/`](final/) | The build we demonstrated at the Week 12 tradeshow and submit for assessment |
| [`versions/`](versions/) | Earlier builds, kept as evidence of process |
| [`demo-material/`](demo-material/) | Media used at the stall |
| [`progress/`](progress/) | Running record of prototype development |

## Run the final build

You need [Node.js](https://nodejs.org) 18 or newer on one computer, and every device on the
same Wi-Fi network with client isolation off. A phone hotspot works. Some university
networks do not.

```
cd prototype/final/src
./start-all.sh          # macOS and Linux
start-all.bat           # Windows
```

That starts three things:

| Address | What runs there |
| --- | --- |
| `http://localhost:4000` | The full Launch Sequence experience |
| `http://localhost:4001` | Rescue your memories, the shared ship, standalone |
| `http://localhost:4002` | Colour restore, standalone, kept for comparison |

To run only the main experience:

```
cd prototype/final/src/server
npm install             # first time only
npm start
```

The terminal prints two links. Open the **second** one, the LAN address, on every device.
Do not use the localhost link except on the computer running the server.

**No login.** One person taps *Start a crew*. The *Invite* button then shows a code, a link
and a QR for everyone else. Selfies and voice notes need the HTTPS link the terminal also
prints, and the browser will warn about the self-signed certificate.

**Testing on your own:** the crew screen has a control that adds simulated crewmates. Gate
or avoid it when real people are joining, since a full crew blocks a real participant.

## Earlier versions

| Folder | Build | What it contributed |
| --- | --- | --- |
| [`versions/v1-mission-control/`](versions/v1-mission-control/) | v1 | The original build with a shared Mission Control screen and an Expo app per person. Tested in prototype test 1 and rebuilt after it |
| [`versions/v2a-guess-who/`](versions/v2a-guess-who/) | v2a | Dong's reveal as a guessing game, with end-to-end test scripts. Folded into the final reveal |
| [`versions/v2b-no-host-semester/`](versions/v2b-no-host-semester/) | v2b | Shirish's restructure: no host, collection across a semester, course prompts, crew characters, briefing clip. The base of the final build |
| [`versions/prototype-Dev.zip`](versions/prototype-Dev.zip) | | Archived working copy |

What each build tested and what changed because of it is on the
[Prototypes and Evaluation](https://github.com/batinion/DECO_3500/wiki/Prototypes-and-Evaluation)
wiki page.
