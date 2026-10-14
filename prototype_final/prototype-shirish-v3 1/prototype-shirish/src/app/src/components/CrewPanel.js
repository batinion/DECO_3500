import React from "react";
import { View, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { colors } from "../lib/theme";

/**
 * Compact floating panel over the live scene: ~320px card in the bottom-right corner on
 * wide screens, a bottom sheet on narrow phones.
 */
export default function CrewPanel({ children, wide, tall }) {
  const { width, height } = useWindowDimensions();
  const sheet = width < 640;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      {/* Every panel is the same (largest) size, from the first screen to the last */}
      <View style={[styles.panel, sheet ? styles.sheet : styles.corner, { height: sheet ? Math.min(height * 0.6, 500) : Math.min(height * 0.92, 500) }]}>
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
  corner: { width: 380, margin: 16, borderRadius: 16 },
  sheet: { width: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 0 },
  // flexGrow + justifyContent centres short content in the fixed-size box; long content just scrolls
  content: { padding: 16, gap: 10, flexGrow: 1, justifyContent: "center" },
});
