import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";

export default function YourColorsScreen({ colors: mission }) {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>YOUR MISSION KEY</Text>
      <Text style={type.title}>2 COLORS, ASSIGNED</Text>
      <Text style={[type.muted, { textAlign: "center", marginTop: spacing.sm }]}>
        Remember these — they'll matter again later.
      </Text>

      <View style={styles.swatchRow}>
        {(mission || []).map((c) => (
          <View key={c.hex} style={styles.card}>
            <View style={[styles.swatch, { backgroundColor: c.hex }]} />
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.hex}>{c.hex}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  swatchRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xl },
  card: { alignItems: "center", gap: spacing.xs },
  swatch: { width: 96, height: 96, borderRadius: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)" },
  name: { color: colors.text, fontWeight: "700", marginTop: spacing.xs },
  hex: { color: colors.muted, fontSize: 12 },
});
