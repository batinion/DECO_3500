import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

/** Static starfield shown until the live scene is reachable (no server address yet). */
export default function StarPlaceholder() {
  const dots = useMemo(
    () =>
      Array.from({ length: 70 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 1.4,
        opacity: 0.25 + Math.random() * 0.45,
      })),
    []
  );
  return (
    <View style={styles.wrap}>
      {dots.map((d, i) => (
        <View
          key={i}
          style={{ position: "absolute", left: d.left, top: d.top, width: d.size, height: d.size, borderRadius: d.size, backgroundColor: "#fff", opacity: d.opacity }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
});
