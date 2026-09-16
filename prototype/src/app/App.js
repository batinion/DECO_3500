import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

import { getSocket, emitWithAck } from "./src/lib/socket";
import { saveSessionInfo, loadSessionInfo, clearSessionInfo } from "./src/lib/storage";
import { colors } from "./src/lib/theme";

import JoinScreen from "./src/screens/JoinScreen";
import WaitingRoomScreen from "./src/screens/WaitingRoomScreen";
import SubmissionScreen from "./src/screens/SubmissionScreen";
import SubmittedWaitingScreen from "./src/screens/SubmittedWaitingScreen";
import LaunchScreen from "./src/screens/LaunchScreen";
import YourColorsScreen from "./src/screens/YourColorsScreen";
import PuzzleScreen from "./src/screens/PuzzleScreen";
import CapsuleNoticeScreen from "./src/screens/CapsuleNoticeScreen";

function screenForAck(ack) {
  if (ack.phase === "unlocked") return "capsule-notice";
  if (ack.phase === "puzzle") return "puzzle";
  if (ack.status === "submitted") {
    if (ack.phase === "revealed" && ack.colors) return "colors";
    if (ack.phase === "launching") return "launch";
    return "submitted";
  }
  if (ack.phase === "answering") return "submission";
  return "waiting";
}

export default function App() {
  const [screen, setScreen] = useState("join");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const [serverUrl, setServerUrl] = useState(null);
  const [code, setCode] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [missionColors, setMissionColors] = useState(null);
  const [puzzleUrl, setPuzzleUrl] = useState(null);
  const [puzzleAnswer, setPuzzleAnswer] = useState(null);

  const listenersBoundFor = useRef(null);

  const resetToJoin = useCallback(() => {
    clearSessionInfo();
    setScreen("join");
    setParticipantId(null);
    setMissionColors(null);
    setPuzzleUrl(null);
    setPuzzleAnswer(null);
    setParticipants([]);
  }, []);

  const bindListeners = useCallback(
    (socket) => {
      socket.off("roster_update");
      socket.off("engine_ignite");
      socket.off("launch_sequence_start");
      socket.off("mission_colors");
      socket.off("puzzle_started");
      socket.off("puzzle_answer_submitted");
      socket.off("session_reset");

      socket.on("roster_update", (s) => {
        setParticipants(s.participants || []);
        if (s.phase === "answering") {
          setScreen((prev) => (prev === "waiting" ? "submission" : prev));
        }
      });

      socket.on("launch_sequence_start", () => setScreen("launch"));

      socket.on("mission_colors", ({ colors: mc }) => {
        setMissionColors(mc);
        setScreen("colors");
      });

      socket.on("puzzle_started", ({ puzzleUrl: url }) => {
        setPuzzleUrl(url);
        setScreen("puzzle");
      });

      socket.on("puzzle_answer_submitted", (answer) => {
        setPuzzleAnswer(answer);
        setScreen("capsule-notice");
      });

      socket.on("session_reset", () => resetToJoin());
    },
    [resetToJoin]
  );

  // Attempt to resume a previous session on app start.
  useEffect(() => {
    (async () => {
      const saved = await loadSessionInfo();
      if (!saved?.ip || !saved?.port || !saved?.code || !saved?.participantId) return;
      const url = `http://${saved.ip}:${saved.port}`;
      const socket = getSocket(url);
      bindListeners(socket);
      listenersBoundFor.current = url;
      try {
        const ack = await emitWithAck("join_session", {
          code: saved.code,
          name: saved.name,
          participantId: saved.participantId,
        });
        if (ack.error) {
          await clearSessionInfo();
          return;
        }
        setServerUrl(url);
        setCode(saved.code);
        setParticipantId(ack.participantId);
        setMissionColors(ack.colors || null);
        setPuzzleUrl(ack.puzzleUrl || null);
        setPuzzleAnswer(ack.puzzleAnswer || null);
        setScreen(screenForAck(ack));
      } catch (e) {
        // Server unreachable on resume — fall back to the join screen silently.
      }
    })();
  }, [bindListeners]);

  async function handleJoin({ ip, port, code: joinCode, name }) {
    setError(null);
    setJoining(true);
    const url = `http://${ip}:${port}`;
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
      setServerUrl(url);
      setCode(joinCode);
      setParticipantId(ack.participantId);
      setMissionColors(ack.colors || null);
      setPuzzleUrl(ack.puzzleUrl || null);
      setPuzzleAnswer(ack.puzzleAnswer || null);
      setScreen(screenForAck(ack));
    } catch (e) {
      setError(e.message || "Could not connect. Check the IP, port and code.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSubmit(submission) {
    const ack = await emitWithAck("submit_answers", { participantId, ...submission });
    if (ack.error) throw new Error(ack.error);
    setScreen("submitted");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        {screen === "join" && <JoinScreen onJoin={handleJoin} joining={joining} error={error} />}
        {screen === "waiting" && <WaitingRoomScreen participants={participants} selfId={participantId} />}
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
        {screen === "launch" && <LaunchScreen />}
        {screen === "colors" && <YourColorsScreen colors={missionColors} />}
        {screen === "puzzle" && (
          <PuzzleScreen
            puzzleUrl={puzzleUrl}
            code={code}
            participantId={participantId}
            serverUrl={serverUrl}
            onAnswerUploaded={(fileUrl) => {
              setPuzzleAnswer({ participantId, fileUrl });
              setScreen("capsule-notice");
            }}
          />
        )}
        {screen === "capsule-notice" && <CapsuleNoticeScreen uploaderName={puzzleAnswer?.name} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingTop: StatusBar.currentHeight || 0 },
  container: { flex: 1, backgroundColor: colors.bg },
});
