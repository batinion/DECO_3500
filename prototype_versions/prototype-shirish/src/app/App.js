import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, StatusBar, Animated, Pressable } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

import { getSocket, emitWithAck } from "./src/lib/socket";
import { saveSessionInfo, loadSessionInfo, clearSessionInfo, saveLastServer, loadLastServer } from "./src/lib/storage";
import { httpUrl, isUsableServer, serverFromUrlParam, sameOriginServer, joinCodeFromUrl } from "./src/lib/server";
import { colors, spacing, type } from "./src/lib/theme";
import { initSounds, play, playCountdown, setMuted as setSoundMuted } from "./src/lib/sounds";
import AsyncStorage from "@react-native-async-storage/async-storage";

import SceneBackground from "./src/components/SceneBackground";
import CrewPanel from "./src/components/CrewPanel";
import IntroOverlay from "./src/components/IntroOverlay";
import Avatar from "./src/components/Avatar";
import PrimaryButton from "./src/components/PrimaryButton";
import JoinScreen from "./src/screens/JoinScreen";
import CrewHomeScreen from "./src/screens/CrewHomeScreen";
import StarFieldPage from "./src/screens/StarFieldPage";
import DrawUploadPage from "./src/screens/DrawUploadPage";
import MyMemoriesScreen from "./src/screens/MyMemoriesScreen";
import YourColorsScreen from "./src/screens/YourColorsScreen";
import PuzzleScreen from "./src/screens/PuzzleScreen";
import CapsuleScreen from "./src/screens/CapsuleScreen";

/**
 * No host, no Mission Control. Every crewmate's screen is a function of their crew's latest
 * `scene_state` plus who they are, and every crewmate has the same controls.
 *   collecting        -> crew home / Memory Stars / sketch+photo / my memories (all semester)
 *   launching,cruising-> "capsule sealed" over the launch
 *   arrived           -> your mission colours
 *   timejump          -> just the scene ("3 years have passed")
 *   earth             -> anyone can open the capsule
 *   puzzle / revealed -> puzzle, then the opened capsule on everyone's phone
 */
function deriveScreen(joined, scene, selfId) {
  if (!joined) return "join";
  if (!scene || !scene.members?.some((m) => m.id === selfId)) return "loading";
  switch (scene.phase) {
    case "collecting":
      return "collecting";
    case "launching":
    case "cruising":
      return "sealed";
    case "arrived":
      return "colors";
    case "timejump":
      return "scene";
    case "earth":
      return "earth";
    case "puzzle":
      return "puzzle";
    default:
      return "capsule";
  }
}

const INTRO_KEY = "launch-sequence:intro-seen";
const MUTE_KEY = "launch-sequence:muted";

const PANEL_SCREENS = ["join", "loading", "sealed", "scene", "earth"]; // compact panel over the bare scene

function resolveServer(fromUrl, last) {
  const same = sameOriginServer();
  if (same) return { server: same, needsServer: false };
  if (fromUrl) return { server: fromUrl, needsServer: false };
  if (isUsableServer(last)) return { server: last, needsServer: true };
  // expo start --web on this computer: the server is almost always right here on :4000
  if (typeof window !== "undefined" && window.location?.hostname) return { server: { ip: window.location.hostname, port: "4000" }, needsServer: true };
  return { server: null, needsServer: true };
}

export default function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [server, setServer] = useState(null);
  const [needsServer, setNeedsServer] = useState(false);
  const [resolved, setResolved] = useState(false);
  const serverTimer = useRef(null);

  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [scene, setScene] = useState(null);
  const [myMemories, setMyMemories] = useState([]);
  const [view, setView] = useState("home"); // inside "collecting": home | stars | media | mine
  const [readyBusy, setReadyBusy] = useState(false);
  const [homeError, setHomeError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const selfName = useRef(null);
  const [showIntro, setShowIntro] = useState(false);
  const [muted, setMuted] = useState(false);
  const prevPhase = useRef(null);
  const prevReady = useRef(null);

  const resetToJoin = useCallback(() => {
    clearSessionInfo();
    setJoined(false);
    setParticipantId(null);
    setCode(null);
    setScene(null);
    setMyMemories([]);
  }, []);

  const showToast = useCallback(
    (text, avatar = null) => {
      setToast({ text, avatar });
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    },
    [toastOpacity]
  );

  const bindListeners = useCallback(
    (socket) => {
      socket.off("scene_state");
      socket.off("my_memories");
      socket.off("memory_added");
      socket.off("engine_ignite");
      socket.on("scene_state", (s) => s.code && setScene(s));
      socket.on("engine_ignite", () => play("ignite"));
      socket.on("my_memories", setMyMemories);
      // Live, Kahoot-style feedback: you see the moment someone adds a memory (never what it says).
      socket.on("memory_added", ({ memberName, aboutName, avatar }) => {
        play("chime");
        if (memberName === selfName.current) return;
        setTimeout(() => play("toast"), 250);
        const about = aboutName === selfName.current ? "you 👀" : aboutName;
        showToast(about ? `${memberName} dropped a memory about ${about}` : `${memberName} dropped a memory`, avatar);
      });
    },
    [showToast]
  );

  /** Connect, bind, and rejoin on every reconnect (wifi drops, laptop sleeps…). */
  const connect = useCallback(
    (srv) => {
      const socket = getSocket(httpUrl(srv));
      bindListeners(socket);
      socket.off("connect");
      socket.on("connect", async () => {
        const saved = await loadSessionInfo().catch(() => null);
        if (saved?.participantId && saved?.code) {
          socket.emit("join_session", { code: saved.code, participantId: saved.participantId }, () => {});
        }
      });
      return socket;
    },
    [bindListeners]
  );

  // Work out the server, then pick up a saved crew (people come back days or weeks later).
  useEffect(() => {
    (async () => {
      const last = await loadLastServer().catch(() => null);
      const r = resolveServer(serverFromUrlParam(), last);
      setServer(r.server);
      setNeedsServer(r.needsServer);
      setResolved(true);
      if (r.server) initSounds(httpUrl(r.server));
      const m = (await AsyncStorage.getItem(MUTE_KEY).catch(() => null)) === "1";
      setMuted(m);
      setSoundMuted(m);

      const saved = await loadSessionInfo().catch(() => null);
      const srv = r.server || saved?.server;
      // First time here: play the 40-second mission briefing before anything else.
      const seen = await AsyncStorage.getItem(INTRO_KEY).catch(() => null);
      if (!seen && !saved?.participantId && srv) setShowIntro(true);
      if (!saved?.participantId || !saved?.code || !srv) return;
      connect(srv);
      try {
        const ack = await emitWithAck("join_session", { code: saved.code, participantId: saved.participantId });
        if (ack.error) return clearSessionInfo();
        selfName.current = ack.name;
        setServer(srv);
        setCode(ack.code);
        setParticipantId(ack.participantId);
        setJoined(true);
      } catch (e) {
        // Server unreachable right now — show the join form.
      }
    })();
  }, [connect]);

  // The crew was removed on the server (e.g. data wiped): our id means nothing now.
  useEffect(() => {
    if (joined && scene && code && scene.code !== code) resetToJoin();
  }, [joined, scene, code, resetToJoin]);

  // Back to the crew home whenever a new phase starts.
  useEffect(() => {
    if (scene?.phase !== "collecting") setView("home");
  }, [scene?.phase]);

  // Sounds for the big shared moments, in sync on every phone.
  useEffect(() => {
    const phase = scene?.phase;
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (!phase || !prev || prev === phase) return; // not on first load / reconnect
    if (phase === "launching") playCountdown();
    else if (phase === "arrived") play("ready");
    else if (phase === "timejump") play("whoosh");
    else if (phase === "earth") play("radio");
    else if (phase === "puzzle") play("beep");
    else if (phase === "revealed") play("fanfare");
  }, [scene?.phase]);

  // Someone just said they're ready for launch.
  useEffect(() => {
    const n = (scene?.readyEngines || []).length;
    if (prevReady.current !== null && n > prevReady.current && scene?.phase === "collecting") play("ready");
    prevReady.current = scene ? n : null;
  }, [scene?.readyEngines?.length]);

  useEffect(() => {
    if (server && isUsableServer(server)) initSounds(httpUrl(server));
  }, [server]);

  const closeIntro = useCallback(() => {
    setShowIntro(false);
    AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
  }, []);

  function toggleMute() {
    const m = !muted;
    setMuted(m);
    setSoundMuted(m);
    AsyncStorage.setItem(MUTE_KEY, m ? "1" : "0").catch(() => {});
  }

  const handleServerChange = useCallback((next) => {
    clearTimeout(serverTimer.current);
    if (!isUsableServer(next)) return;
    serverTimer.current = setTimeout(() => setServer((cur) => (cur && cur.ip === next.ip && cur.port === next.port ? cur : next)), 600);
  }, []);

  async function enterCrew(evt, payload, typedServer) {
    setError(null);
    setBusy(true);
    const srv = server?.origin ? server : typedServer || server;
    try {
      if (!srv || !isUsableServer(srv)) throw new Error("Add the server address first.");
      connect(srv);
      const ack = await emitWithAck(evt, payload);
      if (ack.error) return setError(ack.error);
      selfName.current = ack.name;
      await saveSessionInfo({ server: srv, code: ack.code, name: ack.name, participantId: ack.participantId });
      if (!srv.origin) saveLastServer(srv).catch(() => {});
      setServer(srv);
      setCode(ack.code);
      setParticipantId(ack.participantId);
      setJoined(true);
      setView("home");
    } catch (e) {
      setError(e.message || "Couldn't reach the server. Check you're on the same Wi-Fi.");
    } finally {
      setBusy(false);
    }
  }

  async function act(evt, payload = {}) {
    const ack = await emitWithAck(evt, { code, participantId, ...payload });
    if (ack?.error) throw new Error(ack.error);
    return ack;
  }

  async function addMemory(memory) {
    await act("add_memory", { memory });
  }

  async function setReady(ready) {
    setHomeError(null);
    setReadyBusy(true);
    try {
      await act("set_ready", { ready });
    } catch (e) {
      setHomeError(e.message);
    } finally {
      setReadyBusy(false);
    }
  }

  async function demo(evt) {
    setHomeError(null);
    try {
      await act(evt);
    } catch (e) {
      setHomeError(e.message);
    }
  }

  const screen = deriveScreen(joined, scene, participantId);
  const serverUrl = server && isUsableServer(server) ? httpUrl(server) : null;
  const members = scene?.members || [];
  const others = members.filter((m) => m.id !== participantId);
  const me = members.find((m) => m.id === participantId);
  const myColors = scene?.reveal?.find((p) => p.id === participantId)?.colors || null;
  const fullScreenCollecting = screen === "collecting" && view !== "home";
  const panel = PANEL_SCREENS.includes(screen) || (screen === "collecting" && view === "home");

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="light" />
      <SceneBackground server={serverUrl ? server : null} code={joined ? code : null} />
      {!panel && <View style={styles.scrim} pointerEvents="none" />}

      <SafeAreaView style={styles.safe}>
        {screen === "join" && resolved && (
          <CrewPanel wide>
            <JoinScreen
              onCreate={({ name, crewName, server: s, avatar }) => enterCrew("create_crew", { name, crewName, avatar }, s)}
              onJoin={({ name, code: c, server: s, avatar }) => enterCrew("join_session", { name, code: c, avatar }, s)}
              busy={busy}
              error={error}
              initialCode={joinCodeFromUrl()}
              needsServer={needsServer}
              initialServer={server}
              onServerChange={handleServerChange}
              onWatchIntro={serverUrl ? () => setShowIntro(true) : null}
            />
          </CrewPanel>
        )}

        {screen === "loading" && (
          <CrewPanel>
            <Text style={type.muted}>Connecting to your crew…</Text>
          </CrewPanel>
        )}

        {screen === "collecting" && view === "home" && (
          <CrewPanel wide>
            <CrewHomeScreen
              scene={scene}
              selfId={participantId}
              server={server}
              onAddMemories={() => setView("stars")}
              onAddMedia={() => setView("media")}
              onMyMemories={() => setView("mine")}
              onSetReady={setReady}
              onDemo={demo}
              onWatchIntro={() => setShowIntro(true)}
              readyBusy={readyBusy}
              error={homeError}
            />
          </CrewPanel>
        )}
        {fullScreenCollecting && view === "stars" && (
          <StarFieldPage
            week={scene.week}
            participants={others}
            answeredIds={myMemories.map((m) => m.promptId).filter(Boolean)}
            totalMine={me?.memoryCount || 0}
            onAddMemory={addMemory}
            onDone={() => setView("home")}
            serverUrl={serverUrl}
            code={code}
            participantId={participantId}
          />
        )}
        {fullScreenCollecting && view === "media" && (
          <DrawUploadPage
            code={code}
            participantId={participantId}
            serverUrl={serverUrl}
            participants={others}
            week={scene.week}
            onAddMemory={addMemory}
            onBack={() => setView("home")}
          />
        )}
        {fullScreenCollecting && view === "mine" && (
          <MyMemoriesScreen
            memories={myMemories}
            serverUrl={serverUrl}
            onRemove={(memoryId) => act("remove_memory", { memoryId }).catch((e) => showToast(e.message))}
            onBack={() => setView("home")}
          />
        )}

        {screen === "sealed" && (
          <CrewPanel>
            <Text style={type.heading}>Capsule sealed 🔒</Text>
            <Text style={type.muted}>
              {scene.memoryTotal} memories from {members.length} crewmates are on board. Liftoff — next stop, the moon.
            </Text>
          </CrewPanel>
        )}
        {screen === "colors" && <YourColorsScreen colors={myColors} />}
        {screen === "earth" && (
          <CrewPanel>
            <Text style={type.label}>THREE YEARS LATER</Text>
            <Text style={type.heading}>Your rocket is home 🌍</Text>
            <Text style={[type.muted, { marginBottom: spacing.sm }]}>
              Get your crew together (in person or on a call). Anyone can open the capsule — it opens for everyone at once.
            </Text>
            <PrimaryButton title="Open the capsule" onPress={() => act("start_puzzle").catch((e) => showToast(e.message))} />
          </CrewPanel>
        )}
        {screen === "puzzle" && (
          <PuzzleScreen
            puzzleUrl={scene?.puzzleUrl}
            code={code}
            participantId={participantId}
            serverUrl={serverUrl}
            missionColors={myColors}
            onAnswerUploaded={() => {}}
            onSkip={() => act("demo_skip_puzzle").catch((e) => showToast(e.message))}
          />
        )}
        {screen === "capsule" && <CapsuleScreen capsule={scene?.capsule} serverUrl={serverUrl} selfId={participantId} />}

        {screen !== "join" && !showIntro && (
          <Pressable onPress={toggleMute} style={styles.mute} hitSlop={8} accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"}>
            <Text style={styles.muteText}>{muted ? "🔇" : "🔊"}</Text>
          </Pressable>
        )}

        {toast && (
          <Animated.View
            style={[
              styles.toast,
              { opacity: toastOpacity, transform: [{ translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] },
            ]}
            pointerEvents="none"
          >
            <View style={styles.toastPill}>
              {toast.avatar ? <Avatar id={toast.avatar} size={34} expr="yay" /> : <Text style={{ fontSize: 16 }}>✦</Text>}
              <Text style={styles.toastText} numberOfLines={2}>
                {toast.text}
              </Text>
              <Text style={styles.toastStar}>✦</Text>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
      {showIntro && serverUrl && <IntroOverlay serverUrl={serverUrl} onDone={closeIntro} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingTop: StatusBar.currentHeight || 0 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 6, 15, 0.55)" },
  chip: {
    position: "absolute",
    top: (StatusBar.currentHeight || 0) + 10,
    right: 14,
    backgroundColor: "rgba(16, 19, 35, 0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { color: colors.accent, fontSize: 12, letterSpacing: 1 },
  mute: {
    position: "absolute",
    top: (StatusBar.currentHeight || 0) + 10,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 19, 35, 0.8)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  muteText: { fontSize: 16 },
  toast: {
    position: "absolute",
    top: (StatusBar.currentHeight || 0) + 54,
    alignSelf: "center",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toastPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 420,
    backgroundColor: "rgba(16, 19, 35, 0.96)",
    borderColor: colors.lit,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 5,
  },
  toastText: { color: colors.text, fontSize: 13, flexShrink: 1 },
  toastStar: { color: colors.lit, fontSize: 14 },
});
