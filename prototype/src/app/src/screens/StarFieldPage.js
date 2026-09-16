import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Star from "../components/Star";
import PromptSheet from "../components/PromptSheet";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";
import { previewTemplate } from "../lib/prompts";

const MIN_REQUIRED = 3;
const HUES = ["#ff6ec7", "#ffb84c", "#2ec4b6", "#4cc9f0", "#9b5de5", "#3ddc97", "#f4d35e"];

/** Scatter `count` points with a few retries to keep them from landing on top of each other. */
function scatterPoints(count, width, height) {
  const points = [];
  const minDist = Math.min(width, height) / (Math.sqrt(count) + 1.5);
  for (let i = 0; i < count; i++) {
    let best = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = {
        left: 24 + Math.random() * Math.max(1, width - 48),
        top: 24 + Math.random() * Math.max(1, height - 48),
      };
      const tooClose = points.some(
        (p) => Math.hypot(p.left - candidate.left, p.top - candidate.top) < minDist
      );
      if (!tooClose) {
        best = candidate;
        break;
      }
      best = candidate; // fall back to the last attempt if we can't find a clear spot
    }
    points.push(best);
  }
  return points;
}

export default function StarFieldPage({ stars, participants, collected, onCollect, onContinue }) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [openStarId, setOpenStarId] = useState(null);

  const positions = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return {};
    const points = scatterPoints(stars.length, containerSize.width, containerSize.height);
    const map = {};
    stars.forEach((s, i) => (map[s.id] = points[i]));
    return map;
  }, [stars, containerSize.width, containerSize.height]);

  const visuals = useMemo(() => {
    const map = {};
    stars.forEach((s, i) => {
      map[s.id] = {
        size: 14 + Math.round(Math.random() * 14),
        hue: HUES[i % HUES.length],
        twinkleMs: 900 + Math.round(Math.random() * 1200),
        delayMs: Math.round(Math.random() * 2000),
      };
    });
    return map;
  }, [stars]);

  const collectedCount = Object.keys(collected).length;
  const canContinue = collectedCount >= MIN_REQUIRED;
  const openStar = stars.find((s) => s.id === openStarId) || null;

  return (
    <View style={styles.wrap}>
      <Text style={type.title}>Memory Stars</Text>
      <Text style={type.muted}>Click to add memories</Text>

      <View
        style={styles.field}
        onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {stars.map((s) => {
          const pos = positions[s.id];
          if (!pos) return null;
          return (
            <Star
              key={s.id}
              visual={{ ...visuals[s.id], left: pos.left, top: pos.top }}
              collected={!!collected[s.id]}
              label={s.kind === "free" ? "Write anything you'd like to add" : previewTemplate(s.template)}
              onPress={() => setOpenStarId(s.id)}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={type.muted}>
          {collectedCount} of {stars.length} collected
          {canContinue ? " — you can continue anytime" : ` (need ${MIN_REQUIRED - collectedCount} more)`}
        </Text>
        <PrimaryButton title="Next" onPress={onContinue} disabled={!canContinue} />
      </View>

      <PromptSheet
        visible={!!openStar}
        star={openStar}
        participants={participants}
        initialValue={openStar ? collected[openStar.id] : null}
        onCollect={(data) => {
          onCollect(openStarId, data);
          setOpenStarId(null);
        }}
        onClose={() => setOpenStarId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  field: { flex: 1, marginTop: spacing.md, marginBottom: spacing.md },
  footer: { gap: spacing.sm },
});
