import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";

export default function LaunchScreen() {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -600,
          duration: 2600,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1200,
          delay: 1400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={type.title}>ALL ENGINES LIT</Text>
      <Text style={type.muted}>Launching your crew's time capsule…</Text>
      <View style={styles.stage}>
        <Animated.View style={[styles.rocket, { transform: [{ translateY }], opacity }]}>
          <View style={styles.body}>
            <View style={styles.window} />
          </View>
          <View style={styles.flames}>
            <View style={styles.flame} />
            <View style={styles.flame} />
            <View style={styles.flame} />
            <View style={styles.flame} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl, alignItems: "center" },
  stage: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center", overflow: "hidden" },
  rocket: { alignItems: "center", marginBottom: 60 },
  body: {
    width: 56,
    height: 120,
    backgroundColor: "#e9ecff",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#444a72",
    alignItems: "center",
    justifyContent: "center",
  },
  window: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, borderWidth: 2, borderColor: "#1c2038" },
  flames: { flexDirection: "row", gap: 6, marginTop: -4 },
  flame: { width: 8, height: 26, backgroundColor: colors.lit, borderRadius: 4 },
});
