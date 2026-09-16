import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";

export default function CapsuleNoticeScreen({ uploaderName }) {
  return (
    <View style={styles.wrap}>
      <Text style={{ fontSize: 40, marginBottom: spacing.md }}>🌍</Text>
      <Text style={type.title}>THE CAPSULE IS OPEN</Text>
      <Text style={[type.muted, { textAlign: "center", marginTop: spacing.sm }]}>
        {uploaderName ? `${uploaderName}'s answer unlocked it. ` : "Your crew's answer unlocked it. "}
        Look up at Mission Control to see everyone's memories.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.lg },
});
