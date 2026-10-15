import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";

/**
 * Fills the whole screen with one emoji floating up from the bottom. The first one carries
 * the name of whoever reacted. `burst` is { id, emoji, name }; a new id replays it.
 */
const COUNT = 30;

export default function ReactionBurst({ burst, onDone }) {
  const { width, height } = useWindowDimensions();
  const items = useMemo(
    () =>
      burst
        ? Array.from({ length: COUNT }, (_, i) => ({
            key: i,
            x: i === 0 ? Math.max(12, width * 0.1) : 10 + Math.random() * (width - 70),
            size: i === 0 ? 56 : 28 + Math.random() * 30,
            delay: i === 0 ? 0 : 120 + Math.random() * 1600,
            dur: i === 0 ? 3600 : 2600 + Math.random() * 1800,
            sway: (Math.random() - 0.5) * 60,
          }))
        : [],
    [burst?.id, width]
  );

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => onDone && onDone(), 5600);
    return () => clearTimeout(t);
  }, [burst?.id]);

  if (!burst) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((it) => (
        <Floater key={`${burst.id}-${it.key}`} it={it} emoji={burst.emoji} label={it.key === 0 ? burst.name : null} height={height} />
      ))}
    </View>
  );
}

function Floater({ it, emoji, label, height }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: it.dur, delay: it.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: it.x,
        bottom: -90,
        alignItems: "center",
        opacity: t.interpolate({ inputRange: [0, 0.04, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -(height + 160)] }) },
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, it.sway] }) },
        ],
      }}
    >
      <Text style={{ fontSize: it.size }}>{emoji}</Text>
      {label ? (
        <View style={styles.name}>
          <Text style={styles.nameText}>{label}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  name: { marginTop: 4, backgroundColor: "rgba(8,9,14,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  nameText: { color: "#eef0ff", fontSize: 14, fontWeight: "700" },
});
