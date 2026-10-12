import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import CapsulePod from "../components/CapsulePod";
import PrivacyCard from "../components/PrivacyCard";
import PromptSheet from "../components/PromptSheet";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";
import { pickPrompts, previewTemplate, renderFilledTemplate, semesterStage } from "../lib/prompts";

const HUES = ["#ff6ec7", "#ffb84c", "#2ec4b6", "#4cc9f0", "#9b5de5", "#3ddc97", "#f4d35e"];
const STAGE_LABEL = { start: "start of semester", mid: "mid-semester", end: "end of semester" };

function scatterPoints(count, width, height) {
  const points = [];
  const minDist = Math.min(width, height) / (Math.sqrt(count) + 1.5);
  for (let i = 0; i < count; i++) {
    let best = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = { left: 50 + Math.random() * Math.max(1, width - 100), top: 30 + Math.random() * Math.max(1, height - 60) };
      best = candidate;
      if (!points.some((p) => Math.hypot(p.left - candidate.left, p.top - candidate.top) < minDist)) break;
    }
    points.push(best);
  }
  return points;
}

/**
 * One visit to the memory capsules (formerly "Memory Stars"). Each star you fill in goes straight into the capsule (no
 * big submit at the end), so you can add one memory on the bus or ten on launch night and
 * leave whenever you like. Prompts change with the week and skip ones you've answered.
 */
export default function StarFieldPage({ week, participants, answeredIds, totalMine, onAddMemory, onDone, serverUrl, code, participantId }) {
  const [round, setRound] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [openStarId, setOpenStarId] = useState(null);
  const [added, setAdded] = useState({}); // starId -> true, this visit
  const [sent, setSent] = useState(null); // the memory just loaded, for the privacy card

  const stars = useMemo(() => {
    const picked = pickPrompts(week, answeredIds).map((p) => ({ id: `${p.id}`, promptId: p.id, kind: "prompt", template: p.template }));
    return [...picked, { id: `free_${round}`, promptId: "free_text", kind: "free" }];
    // new stars on each "shuffle" round; answeredIds intentionally read once per round
  }, [round, week]);

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

  const addedCount = Object.keys(added).length;
  const openStar = stars.find((s) => s.id === openStarId) || null;
  const noCrew = participants.length === 0;

  async function handleCollect({ filledText, aboutParticipantId, photo }) {
    const star = openStar;
    const friend = participants.find((p) => p.id === aboutParticipantId);
    const text =
      star.kind === "free" ? (filledText[0] || "").trim() : renderFilledTemplate(star.template, { friendName: friend?.name, filledText });
    await onAddMemory({
      kind: star.kind,
      promptId: star.promptId,
      template: star.template || null,
      filledText,
      text,
      aboutId: aboutParticipantId || null,
      photo: photo || null,
    });
    setAdded((prev) => ({ ...prev, [star.id]: true }));
    setOpenStarId(null);
    setSent({ text, photo: photo || null, aboutName: friend?.name || null });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>
            WEEK {week} · {STAGE_LABEL[semesterStage(week)].toUpperCase()}
          </Text>
          <Text style={type.title}>Memory capsules</Text>
        </View>
      </View>

      {/* The instruction testers asked for: always visible, so nobody forgets who it's about. */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Tap a capsule → finish the sentence about a crewmate → it's loaded on the rocket.</Text>
      </View>
      {noCrew && <Text style={styles.warn}>No crewmates yet: use the ✎ capsule to write about the group, or invite your crew first.</Text>}

      <View style={styles.field} onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {stars.map((s) => {
          const pos = positions[s.id];
          if (!pos) return null;
          return (
            <CapsulePod
              key={s.id}
              visual={{ ...visuals[s.id], left: pos.left, top: pos.top }}
              collected={!!added[s.id]}
              isFree={s.kind === "free"}
              label={s.kind === "free" ? "Write anything about your crew" : previewTemplate(s.template)}
              onPress={() => !added[s.id] && setOpenStarId(s.id)}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={type.muted}>
          {addedCount} loaded this visit · {totalMine} on board from you
        </Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title="New capsules"
              variant="ghost"
              onPress={() => {
                setAdded({});
                setRound((r) => r + 1);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton title={addedCount ? "Done for now" : "Back"} onPress={onDone} />
          </View>
        </View>
      </View>

      <PromptSheet
        visible={!!openStar}
        star={openStar}
        participants={participants}
        onCollect={handleCollect}
        onClose={() => setOpenStarId(null)}
        serverUrl={serverUrl}
        code={code}
        participantId={participantId}
      />
      <PrivacyCard memory={sent} serverUrl={serverUrl} onAnother={() => setSent(null)} onDone={() => { setSent(null); onDone(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
  header: { flexDirection: "row", alignItems: "flex-end" },
  banner: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(16, 19, 35, 0.85)",
    borderWidth: 1,
    borderColor: colors.lit,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bannerTitle: { color: colors.text, fontWeight: "700", fontSize: 13, lineHeight: 18 },
  bannerText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.accent, fontSize: 12, marginTop: spacing.sm },
  field: { flex: 1, marginTop: spacing.md, marginBottom: spacing.md, minHeight: 220 },
  footer: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
});
