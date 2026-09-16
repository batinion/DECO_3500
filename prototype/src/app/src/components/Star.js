import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View, StyleSheet, Easing } from "react-native";
import { colors } from "../lib/theme";

/**
 * A single tappable star in the field. `visual` carries this star's randomized-once
 * look (size/hue/glow/timing) so the field reads as a scattering of unique stars.
 * `label`, if given, previews the star's prompt on hover (laptop/web) — this works the
 * same whether the star is already collected or not.
 */
export default function Star({ visual, collected, label, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.6)).current;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (collected) {
      scale.stopAnimation();
      glow.stopAnimation();
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(glow, { toValue: 0.25, duration: 300, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.35, duration: visual.twinkleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: visual.twinkleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: visual.twinkleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.6, duration: visual.twinkleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    const timer = setTimeout(() => loop.start(), visual.delayMs);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [collected]);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.wrap, { left: visual.left, top: visual.top }]}
      hitSlop={16}
    >
      <Animated.View
        style={[
          styles.star,
          {
            width: visual.size,
            height: visual.size,
            borderRadius: visual.size / 2,
            backgroundColor: visual.hue,
            transform: [{ scale }],
            opacity: collected ? 0.35 : glow,
            shadowColor: visual.hue,
            borderWidth: collected ? 2 : 0,
            borderColor: "#ffffff",
          },
        ]}
      />

      {hovered && !!label && !collected && (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText} numberOfLines={3}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute" },
  star: {
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    left: "50%",
    transform: [{ translateX: -90 }],
    marginBottom: 10,
    width: 180,
    backgroundColor: "rgba(10, 12, 24, 0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tooltipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
});
