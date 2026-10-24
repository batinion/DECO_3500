import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, spacing, type } from "../lib/theme";

/**
 * The cargo hatch blew open on the way home and the memories are scattered. Anyone in the
 * crew picks how to bring them back, and it starts for everyone. It's a choice, not a
 * forced game: there's also a quiet way to just open the capsule.
 */
export default function LostScreen({ memoryTotal, onChoose }) {
  const [busy, setBusy] = useState(null);
  async function choose(a) {
    if (busy) return;
    setBusy(a);
    try {
      await onChoose(a);
    } finally {
      setBusy(null);
    }
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.alarm}>🚨 CARGO HATCH BREACH</Text>
      <Text style={styles.title}>Your memories are lost in space!</Text>
      <Text style={styles.sub}>
        The hatch blew open on the way home. {memoryTotal} {memoryTotal === 1 ? "memory is" : "memories are"} drifting out there. Operate your avatars to collect the memories:
      </Text>

      <Option
        icon="🚀"
        title="Rescue mission"
        sub="Fly one ship together. Steering, throttle, altitude, memory pick-up and the gun are shared out between the crew, so talk to each other! Save the capsules past black holes and asteroids, then dock."
        busy={busy === "rescue"}
        onPress={() => choose("rescue")}
      />

      <Pressable onPress={() => choose("skip")} style={styles.skip} hitSlop={8}>
        <Text style={styles.skipText}>{busy === "skip" ? "Opening…" : "Skip the activity and just open the capsule"}</Text>
      </Pressable>
      <Text style={styles.note}>Whoever picks first starts it for the whole crew.</Text>
    </View>
  );
}

function Option({ icon, title, sub, busy, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.optTitle}>{busy ? "Starting…" : title}</Text>
        <Text style={styles.optSub}>{sub}</Text>
      </View>
      <Text style={styles.go}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  alarm: { color: "#ff6b78", fontWeight: "900", letterSpacing: 2, fontSize: 12 },
  title: { ...type.heading, fontSize: 22 },
  sub: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.xs },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: colors.lit,
    backgroundColor: "rgba(255, 184, 76, 0.08)",
    borderRadius: 14,
    padding: 14,
  },
  icon: { fontSize: 30 },
  optTitle: { color: colors.text, fontWeight: "800", fontSize: 17 },
  optSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  go: { color: colors.lit, fontSize: 28, fontWeight: "300" },
  skip: { alignSelf: "center", paddingVertical: 8 },
  skipText: { color: colors.accent, fontSize: 13 },
  note: { color: colors.muted, fontSize: 11, textAlign: "center" },
});
