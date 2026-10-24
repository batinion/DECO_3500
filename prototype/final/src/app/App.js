import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, StatusBar, Animated, Pressable, Platform, Alert, useWindowDimensions } from "react-native";
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
import LostScreen from "./src/screens/LostScreen";
import GameFrame from "./src/components/GameFrame";
import SummonLetter from "./src/components/SummonLetter";
import CapsuleScreen from "./src/screens/CapsuleScreen";

/**
 * One line of the tagline, sized so its text is exactly `width` wide. It renders once at a base
 * size, measures itself, then scales the font to fit, so every line ends up the same length.
 */
function FitLine({ text, width, style }) {
  const BASE = 20;
  const [size, setSize] = useState(BASE);
  const done = useRef(null);
  return (
    <Text
      numberOfLines={1}
      style={[style, { fontSize: size, lineHeight: Math.round(size * 1.08), alignSelf: "flex-start" }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (!w || done.current === width) return;
        done.current = width;
        setSize(Math.floor(((BASE * width) / w) * 10) / 10);
      }}
    >
      {text}
    </Text>
  );
}

/**
 * No host, no Mission Control. Every crewmate's screen is a function of their crew's latest
 * `scene_state` plus who they are, and every crewmate has the same controls.
 *   collecting           -> crew home / memory capsules / sketch+photo / my memories (all semester)
 *   boarding             -> the crew loads their memories onto the rocket, one by one
 *   launching, cruising  -> liftoff
 *   timejump             -> just the scene: the time warp (twenty-four years in a tunnel of light)
 *   earth                -> Earth comes into view…
 *   lost                 -> …the cargo hatch blows! Pick: rescue mission / colour restore / skip
 *   rescue               -> the rescue flight, full screen, on everyone's phone (a ship each, or one shared ship)
 *   revealed             -> the opened capsule on everyone's phone
 */
function deriveScreen(joined, scene, selfId) {
  if (!joined) return "join";
  if (!scene || !scene.members?.some((m) => m.id === selfId)) return "loading";
  switch (scene.phase) {
    case "collecting":
      return "collecting";
    case "boarding":
    case "launching":
    case "cruising":
      return "sealed";
    case "timejump":
      return "scene";
    case "earth":
      return "earth";
    case "landing":
      return "scene"; // just the scene: the rocket settles back onto its pad
    case "lost":
      return "lost";
    case "rescue":
      return "game";
    default:
      return "capsule";
  }
}

const INTRO_KEY = "launch-sequence:intro-seen";
const MUTE_KEY = "launch-sequence:muted";

const PANEL_SCREENS = ["join", "loading", "sealed", "scene", "earth", "lost"]; // compact panel over the bare scene

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
  const { width: winW } = useWindowDimensions();
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
  const [remoteBurst, setRemoteBurst] = useState(null); // an emoji reaction from a crewmate in the reveal
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
      socket.off("start_over");
      socket.off("capsule_reaction");
      socket.on("capsule_reaction", (r) => setRemoteBurst({ id: Date.now() + Math.random(), emoji: r.emoji, name: r.name, from: r.from }));
      socket.on("start_over", resetToJoin); // someone used Demo tools > Start over
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
    [showToast, resetToJoin]
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
    if (phase === "boarding") {
      // each crewmate's capsule clunks into the hold as they load it, then the hatch locks
      const per = scene.timing?.boardPerMs || 1500;
      const n = scene.members?.length || 0;
      for (let i = 0; i < n; i++) setTimeout(() => play("load"), i * per + per * 0.5);
      setTimeout(() => play("lock"), n * per + 300);
    } else if (phase === "launching") playCountdown();
    else if (phase === "cruising") play("cruise"); // engine rumble fades away slowly in deep space
    else if (phase === "earth") play("radio");
    else if (phase === "landing") play("cruise"); // thrusters rumble, then fade as the rocket touches down
    else if (phase === "lost") play("breach");
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

  // Leaves this crew on this device and goes back to the join screen, so ask first.
  function confirmStartOver() {
    const message = "Start over? You'll leave this crew on this device and go back to the join screen.";
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || window.confirm(message)) resetToJoin();
    } else {
      Alert.alert("Start over?", message, [{ text: "Cancel", style: "cancel" }, { text: "Start over", style: "destructive", onPress: resetToJoin }]);
    }
  }

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
    const ack = await act("add_memory", { memory });
    return ack?.id;
  }

  // Liftoff countdown: 6 … 0 while the rocket holds on the pad, then the number goes as it lifts.
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (scene?.phase !== "launching") {
      setCount(null);
      return undefined;
    }
    const startedAt = Date.now() - (scene.serverNow - scene.phaseStartedAt);
    const tick = () => {
      const ms = Date.now() - startedAt;
      setCount(ms >= 7000 ? null : Math.max(0, Math.ceil((6000 - ms) / 1000)));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [scene?.phase, scene?.phaseStartedAt]);

  // The "Summon the rocket" email arrives once the last future gif has played.
  const [summonOn, setSummonOn] = useState(false);
  useEffect(() => {
    if (scene?.phase !== "timejump") {
      setSummonOn(false);
      return undefined;
    }
    const startedAt = Date.now() - (scene.serverNow - scene.phaseStartedAt);
    const at = scene.timing?.warpMs || 41400;
    const tick = () => setSummonOn(Date.now() - startedAt >= at);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [scene?.phase, scene?.phaseStartedAt]);

  async function setReady(ready, skip = false) {
    setHomeError(null);
    setReadyBusy(true);
    try {
      await act("set_ready", { ready, skip });
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
  const fullScreenCollecting = screen === "collecting" && view !== "home";
  const taglineWidth = Math.round(Math.min(170, winW * 0.46));
  const panel = PANEL_SCREENS.includes(screen) || (screen === "collecting" && view === "home");

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="light" />
      <SceneBackground server={serverUrl ? server : null} code={joined ? code : null} />
      {!panel && <View style={styles.scrim} pointerEvents="none" />}
      {fullScreenCollecting && view === "stars" && <View style={styles.capsuleScrim} pointerEvents="none" />}

      {/* Tagline, top left, on the first stage (join + crew home) while the rocket is on the pad */}
      {(screen === "join" || (screen === "collecting" && view === "home")) && (
        <View style={[styles.tagline, { width: taglineWidth + 12 }]} pointerEvents="none">
          <FitLine key={`a${taglineWidth}`} text="Preserve your" width={taglineWidth} style={styles.taglineBig} />
          <FitLine key={`b${taglineWidth}`} text="Memories" width={taglineWidth} style={styles.taglineBig} />
          <FitLine key={`c${taglineWidth}`} text="Get into the capsule" width={taglineWidth} style={styles.taglineSmall} />
        </View>
      )}

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

        {/* Top right, outside the panel, until the crew has logged in */}
        {screen === "join" && resolved && serverUrl && !showIntro && (
          <Pressable onPress={() => setShowIntro(true)} style={styles.watchDemo} accessibilityLabel="Watch how it works">
            <Text style={styles.watchDemoText}>▶ Watch how it works</Text>
          </Pressable>
        )}

        {screen === "loading" && (
          <CrewPanel>
            <Text style={type.muted}>Connecting to your crew…</Text>
          </CrewPanel>
        )}

        {screen === "collecting" && view === "home" && (
          <CrewPanel wide tall>
            <CrewHomeScreen
              scene={scene}
              selfId={participantId}
              server={server}
              onAddMemories={() => setView("stars")}
              myMemories={myMemories}
              onAddMedia={() => setView("media")}
              onMyMemories={() => setView("mine")}
              onRemoveMemory={(memoryId) => act("remove_memory", { memoryId }).catch((e) => showToast(e.message))}
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
            needs={me?.needs || {}}
            onAddMemory={addMemory}
            onRemoveMemory={(memoryId) => act("remove_memory", { memoryId })}
            onBack={() => setView("home")}
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

        {screen === "sealed" && scene.phase !== "cruising" && ( // the card goes as soon as the rocket reaches space
          <CrewPanel>
            {scene.phase === "boarding" ? (
              <>
                <Text style={type.label}>BOARDING THE ROCKET</Text>
                <Text style={type.heading}>Avatars getting into the rocket 🚀</Text>
                <Text style={type.muted}>One by one, your crew's avatars climb in with their memory capsules. Then the hatch locks.</Text>
              </>
            ) : count !== null && count > 0 ? (
              <>
                <Text style={[type.label, styles.centerText]}>CAPSULE SEALED 🔒 · LIFTOFF IN</Text>
                <Text style={styles.countdownNum}>{count}</Text>
              </>
            ) : (
              <>
                <Text style={[type.label, styles.centerText]}>CAPSULE SEALED 🔒</Text>
                <Text style={[type.heading, styles.centerText]}>Liftoff!</Text>
                <Text style={[type.muted, styles.centerText]}>
                  {scene.memoryTotal} memories from {members.length} crewmates are on board. Next stop: twenty-four years from now.
                </Text>
              </>
            )}
          </CrewPanel>
        )}
        {screen === "scene" && summonOn && (
          <SummonLetter
            members={members}
            summonReady={scene.summonReady}
            selfId={participantId}
            crewName={scene.crewName}
            onSummon={() => act("summon_ready").catch((e) => showToast(e.message))}
          />
        )}
        {screen === "lost" && (
          <CrewPanel wide>
            <LostScreen memoryTotal={scene.memoryTotal} onChoose={(activity) => act("choose_activity", { activity }).catch((e) => showToast(e.message))} />
          </CrewPanel>
        )}
        {screen === "capsule" && <CapsuleScreen capsule={scene?.capsule} serverUrl={serverUrl} selfId={participantId} remoteBurst={remoteBurst} onReactShare={(emoji) => emitWithAck("capsule_react", { code, participantId, emoji }).catch(() => {})} onStartOver={resetToJoin} />}

        {screen === "game" && serverUrl && (
          <GameFrame serverUrl={serverUrl} kind="rescue" code={code} participantId={participantId} />
        )}

        {screen !== "join" && screen !== "game" && !showIntro && (
          <Pressable onPress={toggleMute} style={styles.mute} hitSlop={8} accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"}>
            <Text style={styles.muteText}>{muted ? "🔇" : "🔊"}</Text>
          </Pressable>
        )}

        {screen !== "join" && screen !== "game" && !showIntro && (
          <Pressable onPress={confirmStartOver} style={[styles.mute, styles.back]} hitSlop={8} accessibilityLabel="Start over">
            <Text style={styles.muteText}>↻</Text>
          </Pressable>
        )}

        {fullScreenCollecting && !showIntro && (
          <Pressable onPress={() => setView("home")} style={[styles.mute, styles.backBtn]} hitSlop={8} accessibilityLabel="Back">
            <Text style={styles.muteText}>←</Text>
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
  capsuleScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2, 3, 10, 0.5)" }, // extra dimming so the capsules stand out
  tagline: { position: "absolute", top: 16, left: 16, zIndex: 5 },
  taglineBig: { color: colors.text, fontWeight: "700", letterSpacing: 0, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8 },
  taglineSmall: { color: colors.lit, fontWeight: "600", marginTop: 3, letterSpacing: 0, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
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
  back: { right: 56 },
  backBtn: { right: 100 }, // sits left of the start-over button
  muteText: { fontSize: 16, color: colors.text },
  centerText: { textAlign: "center" },
  countdownNum: { color: colors.lit, fontSize: 96, fontWeight: "800", textAlign: "center", lineHeight: 110 },
  watchDemo: {
    position: "absolute",
    top: (StatusBar.currentHeight || 0) + 12,
    right: 14,
    backgroundColor: "rgba(16, 19, 35, 0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  watchDemoText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
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
