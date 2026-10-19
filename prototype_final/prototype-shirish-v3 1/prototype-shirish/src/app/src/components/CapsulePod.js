import Svg, { Path, Circle } from "react-native-svg";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, View, StyleSheet, Easing } from "react-native";
import { colors } from "../lib/theme";
import { ASK_MATES_LABEL } from "../lib/prompts";

/**
 * One empty memory capsule on the launch pad, waiting to be filled and loaded onto the
 * rocket. (These used to be stars — but stars belong to space, which comes *after* the
 * memories are loaded, so testers found the order confusing.) It floats gently to invite a tap.
 */
/** Camera / microphone drawn in plain white, so they read clearly on the capsule window (emoji can't be recoloured). */
function WhiteIcon({ kind, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      {kind === "mic" ? (
        <>
          <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </>
      ) : (
        <>
          <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <Circle cx={12} cy={13} r={4} />
        </>
      )}
    </Svg>
  );
}

export default function CapsulePod({ visual, collected, label, isFree, isExample, isImage, isVoice, isSelfie, isCollab, askMates, number, onPress, onRemove, onDuplicate, onEdit }) {
  const float = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef(null);
  // Leaving is delayed a moment so the pointer can cross the gap between the capsule and its preview.
  const hoverIn = () => {
    clearTimeout(hideTimer.current);
    setHovered(true);
  };
  const hoverOut = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 250);
  };
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  // react-native-web ends a Pressable's hover as soon as a Pressable inside it is hovered, which closed the
  // preview the moment the pointer reached it. A plain DOM pointerenter/leave on the whole wrapper (capsule
  // and preview together) doesn't have that problem.
  const wrapRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (Platform.OS !== "web" || !el?.addEventListener) return undefined;
    const onEnter = (e) => e.pointerType !== "touch" && hoverIn();
    const onLeave = (e) => e.pointerType !== "touch" && hoverOut();
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  const closePreview = () => {
    clearTimeout(hideTimer.current);
    setHovered(false);
    setPinned(false);
  };
  const [pinned, setPinned] = useState(false); // touch screens have no hover: tapping a loaded capsule pins its preview

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
  const halo = isExample ? 16 : isSelfie ? 6 : 9; // the example capsule gets a bigger, red halo; the selfie a slim golden one
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  // A loaded capsule has nothing to open, so tapping it pins its preview (touch screens have no hover).
  const handlePress = collected && !isExample ? () => setPinned((v) => !v) : onPress;

  const showTip = (hovered || pinned) && !!label;
  const canRemove = !!onRemove && !collected;
  const hasActions = !isExample && (onDuplicate || canRemove || (collected && onEdit));

  return (
    <View ref={wrapRef} style={[styles.wrap, { left: visual.left - w / 2, top: visual.top - h / 2, zIndex: showTip ? 10 : 1 }]}>
      <View style={styles.inner} accessibilityLabel={collected ? "Loaded" : label}>
        <Pressable onPress={handlePress} hitSlop={10} style={styles.inner}>
          <Animated.View style={{ transform: [{ translateY }], opacity: collected ? 0.45 : 1 }}>
            <View style={[styles.glow, { width: w + halo * 2, height: h + halo * 2, borderRadius: (h + halo * 2) / 2, left: -halo, top: -halo, backgroundColor: isExample ? "rgba(255, 59, 59, 0.38)" : isSelfie && !collected ? "rgba(255, 200, 40, 0.35)" : `${visual.hue}33` }]} />
            <View style={[styles.pod, isExample && { shadowColor: "#ff3b3b", shadowOpacity: 0.95, shadowRadius: 18 }, isSelfie && !collected && { shadowColor: "#ffc828", shadowOpacity: 0.8, shadowRadius: 7 }, { width: w, height: h, borderRadius: h / 2, borderColor: collected ? "#ffffff" : visual.hue }]}>
              <View style={[styles.band, { backgroundColor: visual.hue }]} />
              {isExample ? (
                <Text style={styles.exampleText}>example</Text>
              ) : (
                <View style={[styles.window, { width: h * 0.48, height: h * 0.48, borderRadius: h * 0.24 }]}>
                  {!collected && (isVoice || isSelfie) ? (
                    <WhiteIcon kind={isVoice ? "mic" : "camera"} size={h * 0.3} />
                  ) : (
                    <Text style={[styles.windowText, isImage && !collected && styles.windowEmoji, isCollab && !collected && { color: "#fff" }]}>{collected ? "✓" : isImage ? "🖼️" : isFree ? "✎" : isCollab ? "⇄" : "?"}</Text>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
          {!isExample && number ? <Text style={[styles.number, collected && styles.numberLoaded]}>{`Capsule ${number}${collected ? " · loaded" : ""}`}</Text> : null}
        </Pressable>

        {showTip && (
          <View style={styles.tooltipHolder}>
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText} numberOfLines={4}>
                {askMates && !collected ? `${ASK_MATES_LABEL}\n` : ""}{label}
              </Text>
              {hasActions && (
                <View style={styles.tipActions}>
                  {collected && onEdit ? (
                    <Pressable onPress={() => { closePreview(); onEdit(); }} style={({ pressed }) => [styles.tipBtn, pressed && styles.tipBtnPressed]} hitSlop={8} accessibilityLabel="Edit this memory">
                      <Text style={[styles.tipBtnText, { fontSize: 10 }]}>✎</Text>
                    </Pressable>
                  ) : null}
                  {canRemove ? (
                    <Pressable onPress={() => { closePreview(); onRemove(); }} style={({ pressed }) => [styles.tipBtn, styles.tipBtnBlack, pressed && { opacity: 0.7 }]} hitSlop={8} accessibilityLabel="Remove this copy">
                      <Text style={[styles.tipBtnText, { fontSize: 10 }]}>{"✕"}</Text>
                    </Pressable>
                  ) : null}
                  {onDuplicate ? (
                    <Pressable onPress={() => { closePreview(); onDuplicate(); }} style={({ pressed }) => [styles.tipBtn, pressed && styles.tipBtnPressed]} hitSlop={8} accessibilityLabel="Duplicate this capsule">
                      <Text style={[styles.tipBtnText, { fontSize: 10 }]}>⧉</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", alignItems: "center" },
  inner: { alignItems: "center" },
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
  tooltipHolder: { position: "absolute", bottom: "100%", paddingBottom: 10, width: 246, alignItems: "center" },
  tipBtnBlack: { backgroundColor: "#000000" },
  tipActions: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 6 },
  tipBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: "rgba(255,255,255,0.08)" },
  tipBtnPressed: { backgroundColor: "rgba(255,255,255,0.25)" },
  tipBtnText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  tooltip: {
    width: 246,
    backgroundColor: "#05060f", // solid, so the text doesn't blur into the scene behind
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tooltipText: { color: "#ffffff", fontSize: 15, lineHeight: 21, fontWeight: "600", textAlign: "left" },
});
