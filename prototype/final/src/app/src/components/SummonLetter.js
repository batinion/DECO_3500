import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { play } from "../lib/sounds";

/**
 * The end of the time jump. A closed envelope arrives with a bell and drifts about the screen,
 * asking to be touched. Open it and there is a note from 24 years later with a round red rocket
 * button: everyone in the crew has to press it to summon the rocket back. A status pill (top,
 * towards the right) shows who just said they're ready and how many are in.
 */
export default function SummonLetter({ members, summonReady, selfId, crewName, onSummon }) {
  const [opened, setOpened] = useState(false);
  const ready = summonReady || [];
  const iAmReady = ready.includes(selfId);

  useEffect(() => {
    play("bell");
  }, []);

  return (
    <>
      <View style={styles.wrap} pointerEvents="box-none">
        {opened ? (
          <Note crewName={crewName} iAmReady={iAmReady} onSummon={onSummon} />
        ) : (
          <Envelope
            onOpen={() => {
              play("pop");
              setOpened(true);
            }}
          />
        )}
        {opened ? <ReadyList members={members} ready={ready} selfId={selfId} /> : null}
      </View>
    </>
  );
}

/** A closed envelope that floats gently around the screen until it is touched. */
function Envelope({ onOpen }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View
        style={{
          transform: [
            { translateX: t.interpolate({ inputRange: steps, outputRange: [0, 34, 0, -34, 0] }) },
            { translateY: t.interpolate({ inputRange: steps, outputRange: [0, -22, 0, 22, 0] }) },
            { rotate: t.interpolate({ inputRange: steps, outputRange: ["0deg", "5deg", "0deg", "-5deg", "0deg"] }) },
          ],
        }}
      >
        <Pressable onPress={onOpen} accessibilityLabel="Open the email" style={({ pressed }) => [styles.envelope, pressed && { transform: [{ scale: 0.96 }] }]}>
          <View style={styles.envFlap} />
          <View style={styles.envSeal}>
            <Text style={{ fontSize: 22 }}>🚀</Text>
          </View>
        </Pressable>
      </Animated.View>
      <Text style={styles.tap}>You have mail. Touch the envelope to open it</Text>
    </View>
  );
}

/** Who has pressed the button, one line per crewmate, in the order they got ready (the rest follow). */
function ReadyList({ members, ready, selfId }) {
  const ordered = [...members].sort((a, b) => {
    const ia = ready.indexOf(a.id), ib = ready.indexOf(b.id);
    if (ia < 0 && ib < 0) return 0;
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });
  return (
    <View style={styles.list}>
      {ordered.map((m) => {
        const on = ready.includes(m.id);
        const who = m.id === selfId ? "You are" : `${m.name} is`;
        return (
          <View key={m.id} style={[styles.row, on && styles.rowOn]}>
            <Text style={[styles.rowIcon, on && { color: "#7dffb0" }]}>{on ? "✓" : "…"}</Text>
            <Text style={[styles.rowText, !on && { opacity: 0.6 }, !on && m.id === selfId && { fontStyle: "italic", color: "#9aa0b8" }]}>{on ? `${who} ready` : m.id === selfId ? "Summon and be ready" : `${who} not ready yet`}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Today's date, but in 2050. */
function dateIn2050() {
  const d = new Date();
  d.setFullYear(2050);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Note({ crewName, iAmReady, onSummon }) {
  const [down, setDown] = useState(false);
  return (
    <View style={styles.mail}>
      <View style={styles.mailBar}>
        <Text style={styles.mailBarText}>✉️  New email</Text>
        <Text style={styles.mailDate}>{dateIn2050()}</Text>
      </View>
      <View style={styles.mailBody}>
        <Text style={styles.meta}>
          To: <Text style={styles.metaVal}>{crewName || "the crew"}</Text>
        </Text>
        <View style={styles.rule} />
        <Text style={styles.text}>24 years since DECO3500.</Text>
        <Text style={styles.text2}>Time to get back with {crewName || "the crew"}</Text>

        <View style={styles.btnArea}>
          <Pressable onPress={onSummon} onPressIn={() => setDown(true)} onPressOut={() => setDown(false)} disabled={iAmReady} accessibilityLabel="Summon the rocket back to earth" style={styles.btnHit}>
            <View style={[styles.btnBase, iAmReady && styles.btnBaseDone]} />
            <View style={[styles.btnTop, iAmReady && styles.btnTopDone, (down || iAmReady) && { top: 9 }]}>
              <View style={styles.gloss} />
              <Text style={styles.btnIcon}>{iAmReady ? "✓" : "🚀"}</Text>
            </View>
          </Pressable>
          <Text style={styles.btnLabel}>{iAmReady ? "You're ready. Waiting for the crew…" : "Summon the rocket\nback to earth."}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    position: "absolute",
    top: 12,
    right: 104,
    zIndex: 30,
    backgroundColor: "rgba(8, 9, 20, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  statusCount: { color: colors.lit, fontWeight: "800" },
  wrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", padding: 16 },

  envelope: { width: 240, height: 160, borderRadius: 10, backgroundColor: "#f3ead2", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  envFlap: { position: "absolute", top: 0, left: 0, width: 0, height: 0, borderLeftWidth: 120, borderRightWidth: 120, borderTopWidth: 92, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#e2d5b0" },
  envSeal: { position: "absolute", left: 100, top: 66, width: 40, height: 40, borderRadius: 20, backgroundColor: "#e0213a", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#ff7a8a" },
  tap: { color: "#fff", fontSize: 14, fontWeight: "800", marginTop: 30, textAlign: "center", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 8 },

  mail: { width: "100%", maxWidth: 400, borderRadius: 14, overflow: "hidden", backgroundColor: "#fbfaf6", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
  mailBar: { backgroundColor: "#2b2f55", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mailDate: { color: "#c9ccf0", fontSize: 12, fontWeight: "700" },
  mailBarText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  mailBody: { padding: 18, gap: 6 },
  meta: { color: "#6b6f8d", fontSize: 13 },
  metaVal: { color: "#1d1430", fontWeight: "800" },
  rule: { height: 1, backgroundColor: "rgba(29,20,48,0.15)", marginVertical: 8 },
  text: { color: "#1d1430", fontSize: 22, lineHeight: 30, fontWeight: "800" },
  text2: { color: "#1d1430", fontSize: 17, lineHeight: 24, fontWeight: "700" },
  list: { marginTop: 14, gap: 5, alignSelf: "center", width: "100%", maxWidth: 400 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(8, 9, 20, 0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  rowOn: { borderColor: "rgba(125,255,176,0.6)" },
  rowIcon: { color: "#fff", fontSize: 14, fontWeight: "900", width: 16, textAlign: "center" },
  rowText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  btnArea: { alignItems: "center", marginTop: 14, marginBottom: 4 },
  btnHit: { width: 132, height: 142 },
  btnBase: { position: "absolute", left: 0, top: 12, width: 132, height: 126, borderRadius: 66, backgroundColor: "#8c0f22", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
  btnBaseDone: { backgroundColor: "#5f647c" },
  btnTop: { position: "absolute", left: 0, top: 0, width: 132, height: 126, borderRadius: 63, backgroundColor: "#e0213a", borderWidth: 4, borderColor: "#ff6b7e", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  btnTopDone: { backgroundColor: "#8a8fa8", borderColor: "#b4b8cc" },
  gloss: { position: "absolute", top: 8, left: 22, width: 66, height: 30, borderRadius: 33, backgroundColor: "rgba(255,255,255,0.28)" },
  btnIcon: { fontSize: 54, color: "#fff", fontWeight: "900" },
  btnLabel: { color: "#1d1430", fontSize: 16, fontWeight: "800", marginTop: 10, textAlign: "center" },
});
