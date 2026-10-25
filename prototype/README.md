# Prototype

Every build we made this semester. The one to run is in [`final/`](final/).

| Folder | What it is |
| --- | --- |
| [`final/`](final/) | The build we demonstrated at the Week 12 tradeshow and submit for assessment. Code in [`final/src/`](final/src/), walkthrough screenshots in [`final/screenshots/`](final/screenshots/) |
| [`versions/`](versions/) | Earlier builds and the two standalone unlock games, kept as evidence of process |
| [`demo-material/`](demo-material/) | Media used at the stall |
| [`progress/`](progress/) | Running record of prototype development |

## Run the final build

You need [Node.js](https://nodejs.org) on one computer (20 or newer recommended; the server
alone runs on 18), and every device on the same Wi-Fi network with client isolation off. A
phone hotspot works. Some university networks do not.

```
cd prototype/final/src
./start-all.sh          # macOS and Linux
start-all.bat           # Windows
```

This installs dependencies on first run and starts the full Space-Cap experience on port
4000. To do the same by hand:

```
cd prototype/final/src/server
npm install             # first time only
npm start
```

The terminal prints the links. Open the **LAN address** (`http://<ip>:4000`) on every device.
Do not use the localhost link except on the computer running the server.

**No login.** One person taps *Create a new crew*. The *Invite* button then shows a code, a
link and a QR for everyone else.

**Camera and microphone.** Selfies, photos and voice notes need the HTTPS link
(`https://<ip>:4443`). The browser warns once about the self-signed certificate: choose
*Advanced → Proceed*. The server makes that certificate with OpenSSL; if OpenSSL isn't
installed (common on Windows), the HTTPS link isn't printed and camera and mic won't work.

**Testing on your own:** the crew screen has a control that adds simulated crewmates. Gate
or avoid it when real people are joining, since a crew holds at most six people. The rescue
ship takes at most five real players, so a full crew of six should use *skip the activity
and just open the capsule*.

Developer notes (flow, file map, editing prompts, demo tools) are in
[`final/README.md`](final/README.md).

## Earlier versions

| Folder | Build | What it contributed |
| --- | --- | --- |
| [`versions/v1-mission-control/`](versions/v1-mission-control/) | v1 | The original build with a shared Mission Control screen and an Expo app per person. Tested in prototype test 1 and rebuilt after it |
| [`versions/v2a-guess-who/`](versions/v2a-guess-who/) | v2a | Dong's reveal as a guessing game, with end-to-end test scripts. Folded into the final reveal |
| [`versions/v2b-no-host-semester/`](versions/v2b-no-host-semester/) | v2b | Shirish's restructure: no host, collection across a semester, course prompts, crew characters, briefing clip. The base of the final build |
| [`versions/rescue-game/`](versions/rescue-game/) | Test 2 | Standalone rescue flight, in two modes: one ship per player ("Classic") and one shared ship. Compared in prototype test 2; the shared ship went into the final build. Runs on port 4001 |
| [`versions/colour-game/`](versions/colour-game/) | Test 2 | Standalone colour restore game. Compared in prototype test 2 and dropped ([decision 0004](../docs/decisions/0004-shared-ship-unlock.md)). Runs on port 4002 |
| [`versions/prototype-Dev.zip`](versions/prototype-Dev.zip) | | Zipped working copy, archived as it was |

What each build tested and what changed because of it is on the
[Prototypes and Evaluation](https://github.com/batinion/DECO_3500/wiki/Prototypes-and-Evaluation)
wiki page, and in [`user-testing/`](../user-testing/).
