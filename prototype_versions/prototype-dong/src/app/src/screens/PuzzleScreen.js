import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";

/**
 * "Guess Who" now plays out entirely on Mission Control (the group discusses and
 * guesses together, looking at the shared screen) — this screen just lets each
 * participant's phone know to look up, rather than duplicating a second, separate
 * game UI on every device. Replaces the old Miro-link-and-upload puzzle.
 */
export default function PuzzleScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>THE CAPSULE REOPENS</Text>
      <Text style={type.title}>LOOK UP AT MISSION CONTROL</Text>
      <Text style={[type.muted, { marginTop: spacing.sm, textAlign: "center" }]}>
        Guess who each memory is about, together — one at a time, out loud.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
});
