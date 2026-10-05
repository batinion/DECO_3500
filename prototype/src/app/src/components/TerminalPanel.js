import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import { GREEN, DIM, WHITE, BLACK, MONO } from "../lib/theme";
export { GREEN, DIM, WHITE, BLACK, MONO };

// Same phase tags as Mission Control's pill (only the phases this panel is shown for).
const PHASE_LABEL = {
  joining: "WAITING FOR CREW",
  countdown: "LAUNCH COUNTDOWN",
  launching: "LAUNCHING",
  cruising: "CREW WRITING MEMORY STARS",
};

/**
 * DOS-style green + white terminal: phase tag, the four crew slots with their live status
 * (same wording as Mission Control's HUD), step-by-step instructions and, optionally, a
 * progress line with the Next button pinned to the bottom.
 */
export default function TerminalPanel({ participants, selfId, phase, countdown, instructions = [], progress, onNext, nextDisabled, style }) {
  const [cursorOn, setCursorOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setCursorOn((v) => !v), 550);
    return () => clearInterval(t);
  }, []);

  const gathering = phase === "joining" || phase === "countdown" || phase === "launching";
  const bySlot = {};
  (participants || []).forEach((p) => (bySlot[p.engineSlot] = p));

  return (
    <TerminalFrame style={style}>
      <Text style={styles.title}>C:\LAUNCH_SEQUENCE&gt;</Text>
      {PHASE_LABEL[phase] ? <Text style={styles.phase}>[ {PHASE_LABEL[phase]} ]</Text> : null}

      <Text style={styles.heading}>CREW STATUS</Text>
      {[1, 2, 3, 4].map((slot) => {
        const p = bySlot[slot];
        const submitted = p?.status === "submitted";
        const status = !p ? "--" : submitted ? "SUBMITTED ✓" : gathering ? "JOINED" : "WRITING…";
        return (
          <View key={slot} style={styles.row}>
            <Text style={[styles.mono, p ? styles.white : styles.dim]} numberOfLines={1}>
              {slot} {p ? p.name : "Waiting to join…"}
              {p && p.id === selfId ? " *" : ""}
            </Text>
            <Text style={[styles.mono, styles.status, submitted && styles.white]}>{status}</Text>
          </View>
        );
      })}

      {countdown != null ? (
        <>
          <Text style={styles.heading}>ALL ENGINES LIT</Text>
          <Text style={[styles.mono, styles.line]}>
            LIFTOFF IN <Text style={styles.white}>T-MINUS</Text>
          </Text>
          <Text style={styles.bigCount}>{countdown}</Text>
        </>
      ) : instructions.length ? (
        <>
          <Text style={styles.heading}>INSTRUCTIONS</Text>
          {instructions.map((line, i) => (
            <Text key={i} style={[styles.mono, styles.line]}>
              {i + 1}. <Text style={styles.white}>{line}</Text>
            </Text>
          ))}
        </>
      ) : null}

      <View style={styles.spacer} />

      {progress ? <Text style={[styles.mono, styles.progress]}>{progress}</Text> : null}
      {onNext ? (
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          style={({ pressed }) => [styles.next, nextDisabled && styles.nextDisabled, pressed && !nextDisabled && styles.nextPressed]}
        >
          <Text style={[styles.nextText, nextDisabled && { color: DIM }]}>[ NEXT &gt; ]</Text>
        </Pressable>
      ) : (
        <Text style={[styles.mono, styles.white]}>&gt;{cursorOn ? "_" : " "}</Text>
      )}
    </TerminalFrame>
  );
}

// One fixed size + spot (bottom-right) for the terminal on every participant screen.
export const DOCK = { width: 280, height: 340, margin: 16 };

export function TerminalFrame({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    right: DOCK.margin,
    bottom: DOCK.margin,
    width: DOCK.width,
    height: DOCK.height,
    maxWidth: "94%",
    backgroundColor: BLACK,
    borderColor: GREEN,
    borderWidth: 2,
    padding: 12,
    gap: 3,
    overflow: "hidden",
  },
  mono: { fontFamily: MONO, color: GREEN, fontSize: 13 },
  title: { fontFamily: MONO, color: WHITE, fontSize: 13, fontWeight: "700" },
  phase: { fontFamily: MONO, color: GREEN, fontSize: 12, letterSpacing: 1, marginTop: 4 },
  heading: { fontFamily: MONO, color: WHITE, fontSize: 12, letterSpacing: 2, marginTop: 8, borderBottomWidth: 1, borderBottomColor: DIM, paddingBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  status: { fontSize: 11 },
  line: { fontSize: 12, lineHeight: 16 },
  bigCount: { fontFamily: MONO, color: WHITE, fontSize: 64, fontWeight: "700", textAlign: "center", marginTop: 4 },
  white: { color: WHITE },
  dim: { color: DIM },
  spacer: { flex: 1, minHeight: 12 },
  progress: { fontSize: 11, marginBottom: 6 },
  next: { borderColor: GREEN, borderWidth: 1, paddingVertical: 8, alignItems: "center", backgroundColor: "#04210d" },
  nextPressed: { backgroundColor: GREEN },
  nextDisabled: { borderColor: DIM, backgroundColor: "transparent" },
  nextText: { fontFamily: MONO, color: WHITE, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
});
