import React from "react";
import { View, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { colors } from "../lib/theme";

/**
 * Compact floating panel over the live scene: ~320px card in the bottom-right corner on
 * wide screens, a bottom sheet on narrow phones.
 */
export default function CrewPanel({ children }) {
  const { width, height } = useWindowDimensions();
  const sheet = width < 640;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View style={[styles.panel, sheet ? styles.sheet : styles.corner, { maxHeight: height * (sheet ? 0.72 : 0.9) }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: "flex-end", alignItems: "flex-end" },
  panel: {
    backgroundColor: "rgba(16, 19, 35, 0.88)",
    borderColor: colors.border,
    borderWidth: 1,
  },
  corner: { width: 320, margin: 16, borderRadius: 16 },
  sheet: { width: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 0 },
  content: { padding: 16, gap: 10 },
});
