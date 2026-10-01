import React from "react";
import { View, Text, ScrollView, Image, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";

/** Final screen: the opened capsule — one card per crew member, same content as Mission Control. */
export default function CapsuleScreen({ capsule, serverUrl, selfId }) {
  const abs = (u) => (u && u.startsWith("/") ? `${serverUrl}${u}` : u);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[type.title, styles.title]}>THE CAPSULE IS OPEN</Text>
      {(capsule || []).map((p) => {
        const media = [p.drawing, ...(p.uploadedImages || [])].filter(Boolean);
        return (
          <View key={p.id} style={[styles.card, p.id === selfId && styles.cardSelf]}>
            <Text style={styles.name}>
              {p.name}
              {p.id === selfId ? " (you)" : ""}
            </Text>
            <View style={styles.swatches}>
              {(p.colors || []).map((c) => (
                <View key={c.hex} style={[styles.swatch, { backgroundColor: c.hex }]} />
              ))}
            </View>
            {(p.entries || []).map((e, i) => (
              <View key={i} style={styles.entry}>
                <Text style={styles.prompt}>{e.prompt}</Text>
                <Text style={styles.value}>{e.value || "— no answer —"}</Text>
              </View>
            ))}
            {media.length ? (
              <View style={styles.media}>
                {media.map((u) => (
                  <Image key={u} source={{ uri: abs(u) }} style={styles.img} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  title: { textAlign: "center", color: colors.lit, marginBottom: spacing.sm },
  card: {
    backgroundColor: "rgba(16, 19, 35, 0.88)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardSelf: { borderColor: colors.accent },
  name: { color: colors.text, fontWeight: "700", fontSize: 17 },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  entry: { gap: 2 },
  prompt: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 14 },
  media: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  img: { width: 110, height: 110, borderRadius: 10, backgroundColor: colors.panel },
});
