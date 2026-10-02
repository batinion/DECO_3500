import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

import { getSocket, emitWithAck } from "./src/lib/socket";
import { saveSessionInfo, loadSessionInfo, clearSessionInfo, saveLastServer, loadLastServer } from "./src/lib/storage";
import { httpUrl, isUsableServer, serverFromUrlParam } from "./src/lib/server";
import { colors } from "./src/lib/theme";

import SceneBackground from "./src/components/SceneBackground";
import CrewPanel from "./src/components/CrewPanel";
import JoinScreen from "./src/screens/JoinScreen";
import SubmissionScreen from "./src/screens/SubmissionScreen";
import SubmittedWaitingScreen from "./src/screens/SubmittedWaitingScreen";
import YourColorsScreen from "./src/screens/YourColorsScreen";
import PuzzleScreen from "./src/screens/PuzzleScreen";
import CapsuleScreen from "./src/screens/CapsuleScreen";

/**
 * The server owns the scene; the screen is a pure function of its latest `scene_state`
 * snapshot plus who we are. (Mission Control is the only controller.)
 *   joining/launching -> corner panel over the scene ("Engine N lit — waiting on X more")
 *   cruising          -> Memory Stars over the cruising rocket
 *   arrived..earth    -> your mission colours
 *   puzzle / revealed -> puzzle, then "look up at Mission Control"
 */
function deriveScreen(joined, scene, selfId) {
  if (!joined) return "join";
  const me = scene?.participants.find((p) => p.id === selfId);
  if (!me) return "waiting"; // joined, snapshot with us in it not here yet
  switch (scene.phase) {
    case "joining":
    case "launching":
      return "waiting";
    case "cruising":
      return me.status === "submitted" ? "submitted" : "submission";
    case "arrived":
      return "colors";
    case "timejump":
    case "earth":
      return "scene"; // colours are gone once "Cooking the space!" appears; just the scene
    case "puzzle":
      return "puzzle";
    default:
      return "capsule-notice";
  }
}

const PANEL_SCREENS = ["join", "waiting", "submitted", "scene"]; // no scrim over the bare scene (join form, waiting for crew) or the compact panel

export default function App() {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  // Address of Mission Control. Resolved before login so the live scene can load behind
  // the form: ?server= (web) -> last used (AsyncStorage) -> typed/scanned in the form.
  const [initialServer, setInitialServer] = useState(null);
  const [server, setServer] = useState(null);
  const serverTimer = useRef(null);

  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [scene, setScene] = useState(null);

  const listenersBoundFor = useRef(null);

  const resetToJoin = useCallback(() => {
    clearSessionInfo();
    setJoined(false);
    setParticipantId(null);
    setScene(null);
  }, []);

  const bindListeners = useCallback(
    (socket) => {
      socket.off("scene_state");
      socket.off("session_reset");
      socket.on("scene_state", setScene);
      socket.on("session_reset", resetToJoin);
    },
    [resetToJoin]
  );

  // Resolve the scene's server address, then try to resume a previous session.
  useEffect(() => {
    (async () => {
      const fromUrl = serverFromUrlParam();
      const last = await loadLastServer().catch(() => null);
      const start = fromUrl || (isUsableServer(last) ? last : null);
      if (start) {
        setInitialServer(start);
        setServer(start);
      }

      const saved = await loadSessionInfo().catch(() => null);
      if (!saved?.ip || !saved?.port || !saved?.code || !saved?.participantId) return;
      if (fromUrl && (String(fromUrl.ip) !== String(saved.ip) || String(fromUrl.port) !== String(saved.port))) return;
      const url = httpUrl(saved);
      const socket = getSocket(url);
      bindListeners(socket);
      listenersBoundFor.current = url;
      try {
        const ack = await emitWithAck("join_session", { code: saved.code, name: saved.name, participantId: saved.participantId });
        if (ack.error) {
          await clearSessionInfo();
          return;
        }
        setServer({ ip: saved.ip, port: saved.port });
        setCode(saved.code);
        setParticipantId(ack.participantId);
        setJoined(true);
      } catch (e) {
        // Server unreachable on resume — fall back to the join form silently.
      }
    })();
  }, [bindListeners]);

  // The server restarted / started a new session while we were away: our id means nothing now.
  useEffect(() => {
    if (joined && scene && code && scene.code !== code) resetToJoin();
  }, [joined, scene, code, resetToJoin]);

  // As soon as the typed/scanned IP + port look valid (debounced), bring the live scene up.
  const handleServerChange = useCallback((next) => {
    clearTimeout(serverTimer.current);
    if (!isUsableServer(next)) return;
    serverTimer.current = setTimeout(() => {
      setServer((cur) => (cur && cur.ip === next.ip && cur.port === next.port ? cur : next));
    }, 600);
  }, []);

  async function handleJoin({ ip, port, code: joinCode, name }) {
    setError(null);
    setJoining(true);
    const url = httpUrl({ ip, port });
    try {
      const socket = getSocket(url);
      if (listenersBoundFor.current !== url) {
        bindListeners(socket);
        listenersBoundFor.current = url;
      }
      const ack = await emitWithAck("join_session", { code: joinCode, name });
      if (ack.error) {
        setError(ack.error);
        return;
      }
      await saveSessionInfo({ ip, port, code: joinCode, name: ack.name, participantId: ack.participantId });
      saveLastServer({ ip, port }).catch(() => {});
      setServer({ ip, port });
      setCode(joinCode);
      setParticipantId(ack.participantId);
      setJoined(true);
    } catch (e) {
      setError(e.message || "Could not connect. Check the IP, port and code.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSubmit(submission) {
    const ack = await emitWithAck("submit_answers", { participantId, ...submission });
    if (ack.error) throw new Error(ack.error);
    // The screen flips to "submitted" when the next scene_state shows our status.
  }

  const screen = deriveScreen(joined, scene, participantId);
  const participants = scene?.participants || [];
  const myColors = scene?.reveal?.find((p) => p.id === participantId)?.colors || null;
  const submittedCount = scene?.submittedCount ?? 0;
  const serverUrl = server && isUsableServer(server) ? httpUrl(server) : null;
  const panel = PANEL_SCREENS.includes(screen);

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="light" />
      {/* Layer 1: the live Mission Control scene. Layer 2: scrim. Layer 3: all participant UI. */}
      <SceneBackground server={server && isUsableServer(server) ? server : null} />
      {!panel && <View style={styles.scrim} pointerEvents="none" />}

      <SafeAreaView style={styles.safe}>
        {screen === "join" && (
          <CrewPanel>
            <JoinScreen onJoin={handleJoin} joining={joining} error={error} initialServer={initialServer} onServerChange={handleServerChange} />
          </CrewPanel>
        )}
        {/* No panel after sign-in: the scene itself shows your lit engine. The form returns on a new session. */}
        {screen === "submission" && (
          <SubmissionScreen
            code={code}
            participantId={participantId}
            serverUrl={serverUrl}
            participants={participants}
            selfId={participantId}
            onSubmit={handleSubmit}
          />
        )}
        {screen === "submitted" && <SubmittedWaitingScreen participants={participants} selfId={participantId} />}
        {screen === "colors" && <YourColorsScreen colors={myColors} />}
        {screen === "puzzle" && <PuzzleScreen />}
        {screen === "capsule-notice" && <CapsuleScreen capsule={scene?.capsule} serverUrl={serverUrl} selfId={participantId} />}

        {screen === "submission" && (
          <View style={styles.chip} pointerEvents="none">
            <Text style={styles.chipText}>{submittedCount} of 4 submitted</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingTop: StatusBar.currentHeight || 0 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 6, 15, 0.5)" },
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
});
