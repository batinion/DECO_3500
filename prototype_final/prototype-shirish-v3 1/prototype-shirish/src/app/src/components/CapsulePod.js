import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View, StyleSheet, Easing } from "react-native";
import { colors } from "../lib/theme";

/**
 * One empty memory capsule on the launch pad, waiting to be filled and loaded onto the
 * rocket. (These used to be stars — but stars belong to space, which comes *after* the
 * memories are loaded, so testers found the order confusing.) It floats gently to invite a tap.
 */
export default function CapsulePod({ visual, collected, label, isFree, isExample, isImage, isCollab, number, onPress }) {
  const float = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (collected) {
      float.stopAnimation();
      Animated.timing(float, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: visual.twinkleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: visual.twinkleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => loop.start(), visual.delayMs);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [collected]);

  const w = Math.max(isExample ? 76 : 0, Math.round(52 + visual.size)); // the example is the same size as the others
  const h = Math.round(w * 0.5);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.wrap, { left: visual.left - w / 2, top: visual.top - h / 2 }]}
      hitSlop={10}
      accessibilityLabel={collected ? "Loaded" : label}
    >
      <Animated.View style={{ transform: [{ translateY }], opacity: collected ? 0.45 : 1 }}>
        <View style={[styles.glow, { width: w + 18, height: h + 18, borderRadius: (h + 18) / 2, left: -9, top: -9, backgroundColor: `${visual.hue}33` }]} />
        <View style={[styles.pod, { width: w, height: h, borderRadius: h / 2, borderColor: collected ? "#ffffff" : visual.hue }]}>
          <View style={[styles.band, { backgroundColor: visual.hue }]} />
          {isExample ? (
            <Text style={styles.exampleText}>example</Text>
          ) : (
            <View style={[styles.window, { width: h * 0.48, height: h * 0.48, borderRadius: h * 0.24 }]}>
              <Text style={[styles.windowText, isImage && !collected && styles.windowEmoji, isCollab && !collected && { color: "#fff" }]}>{collected ? "✓" : isImage ? "🖼️" : isFree ? "✎" : isCollab ? "⇄" : "?"}</Text>
            </View>
          )}
        </View>
      </Animated.View>
      {!isExample && number ? <Text style={[styles.number, collected && styles.numberLoaded]}>{`Capsule ${number}${collected ? " · loaded" : ""}`}</Text> : null}

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
  wrap: { position: "absolute", alignItems: "center" },
  glow: { position: "absolute" },
  pod: {
    backgroundColor: "#e9ecff",
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffb84c",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  band: { position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", opacity: 0.85 },
  window: { backgroundColor: "#1d2452", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#444a72", marginRight: "18%" },
  exampleText: { color: "#1d2452", fontWeight: "800", fontSize: 10, letterSpacing: 0.2, marginRight: "24%" },
  windowEmoji: { fontSize: 11 },
  windowText: { color: "#fff3c4", fontWeight: "900", fontSize: 12 },
  number: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 4, letterSpacing: 0.5 },
  numberLoaded: { color: colors.lit },
  loaded: { color: colors.lit, fontSize: 10, fontWeight: "700", marginTop: 4, letterSpacing: 1 },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 12,
    width: 190,
    backgroundColor: "rgba(10, 12, 24, 0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tooltipText: { color: colors.text, fontSize: 12, lineHeight: 16, textAlign: "center" },
});
