import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions } from "react-native";
import CapsulePod from "../components/CapsulePod";
import PrivacyCard from "../components/PrivacyCard";
import PromptSheet from "../components/PromptSheet";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";
import { isCollabPrompt, pickPrompts, previewTemplate, renderFilledTemplate, semesterStage } from "../lib/prompts";

const HUES = ["#ff6ec7", "#ffb84c", "#2ec4b6", "#4cc9f0", "#9b5de5", "#3ddc97", "#f4d35e"];
const STAGE_LABEL = { start: "start of semester", mid: "mid-semester", end: "end of semester" };

// The example capsule is pinned to the top-left corner of the field so it is always easy to find.
const EXAMPLE_POINT = { left: 74, top: 52 };

/**
 * Where the rocket, its pad and the crew stand in the scene behind this page, in window pixels.
 * Mirrors the layout maths in server/public/scene/scene.js. Capsules must never sit on top of it.
 */
function rocketZone(W, H) {
  const narrow = W < 640;
  const unit = Math.max(0.5, Math.min(W / 900, H / 700)) * 0.8;
  const groundY = H * (narrow ? 0.36 : 0.86);
  const padX = W * (narrow ? 0.5 : 0.32);
  const top = groundY - 180 * unit - 40; // rocket nose (plus a little air)
  const bottom = groundY + 70; // pad and the engine flames below it
  return narrow ? { x0: 0, x1: W, y0: top, y1: bottom } : { x0: padX - 250, x1: padX + 250, y0: top, y1: bottom };
}

function scatterPoints(count, width, height, fixed = [], zone = null) {
  const points = [...fixed]; // fixed points are only used to keep the others away from them
  const minDist = Math.min(width, height) / (Math.sqrt(count) + 1.5);
  // a capsule is about 80x40 with its glow; keep its whole body out of the zone
  const hitsZone = (c) => !!zone && c.left > zone.x0 - 54 && c.left < zone.x1 + 54 && c.top > zone.y0 - 32 && c.top < zone.y1 + 32;
  const nearest = (c) => points.reduce((m, p) => Math.min(m, Math.hypot(p.left - c.left, p.top - c.top)), Infinity);
  for (let i = 0; i < count; i++) {
    let best = null;
    let bestGap = -1;
    for (let attempt = 0; attempt < 120; attempt++) {
      const candidate = { left: 50 + Math.random() * Math.max(1, width - 100), top: 30 + Math.random() * Math.max(1, height - 60) };
      if (hitsZone(candidate)) continue; // never on the rocket
      const gap = nearest(candidate);
      if (gap > bestGap) {
        best = candidate;
        bestGap = gap; // keep the most spread-out spot found so far
      }
      if (gap >= minDist) break; // far enough from every other capsule
    }
    // no room outside the zone at all (tiny window): fall back to the bottom edge
    points.push(best || { left: 50 + Math.random() * Math.max(1, width - 100), top: Math.max(30, height - 40) });
  }
  return points.slice(fixed.length);
}

/**
 * One visit to the memory capsules (formerly "Memory Stars"). Each star you fill in goes straight into the capsule (no
 * big submit at the end), so you can add one memory on the bus or ten on launch night and
 * leave whenever you like. Prompts change with the week and skip ones you've answered.
 */
export default function StarFieldPage({ week, participants, answeredIds, totalMine, needs = {}, onAddMemory, onDone, serverUrl, code, participantId }) {
  const [round, setRound] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [openStarId, setOpenStarId] = useState(null);
  const [added, setAdded] = useState({}); // starId -> true, this visit
  const [sent, setSent] = useState([]); // memories loaded this visit, listed on the privacy card at "Done for now"
  const [review, setReview] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false); // the always-there "example" capsule
  const { width: winW, height: winH } = useWindowDimensions();
  const fieldRef = useRef(null);
  const [fieldOrigin, setFieldOrigin] = useState(null); // where the capsule field starts in the window

  const stars = useMemo(() => {
    const picked = pickPrompts(week, answeredIds).map((p) => ({ id: `${p.id}`, promptId: p.id, kind: "prompt", template: p.template, needsPhoto: !!p.needsPhoto }));
    return [...picked, { id: `free_${round}`, promptId: "free_text", kind: "free" }, ...[0, 1].map((i) => ({ id: `image_${round}_${i}`, promptId: "image", kind: "image" })), { id: "example", kind: "example" }];
    // new stars on each "shuffle" round; answeredIds intentionally read once per round
  }, [round, week]);

  const positions = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !fieldOrigin) return {}; // wait until we know where the field sits
    const others = stars.filter((s) => s.kind !== "example");
    const z = rocketZone(winW, winH);
    const zone = { x0: z.x0 - fieldOrigin.x, x1: z.x1 - fieldOrigin.x, y0: z.y0 - fieldOrigin.y, y1: z.y1 - fieldOrigin.y };
    const points = scatterPoints(others.length, containerSize.width, containerSize.height, [EXAMPLE_POINT], zone);
    const map = {};
    others.forEach((s, i) => (map[s.id] = points[i]));
    stars.forEach((s) => s.kind === "example" && (map[s.id] = EXAMPLE_POINT));
    return map;
  }, [stars, containerSize.width, containerSize.height, winW, winH, fieldOrigin]);

  const visuals = useMemo(() => {
    const map = {};
    stars.forEach((s, i) => {
      map[s.id] = {
        size: 14 + Math.round(Math.random() * 14),
        hue: s.kind === "example" ? "#c3c8e6" : HUES[i % HUES.length],
        twinkleMs: 900 + Math.round(Math.random() * 1200),
        delayMs: Math.round(Math.random() * 2000),
      };
    });
    return map;
  }, [stars]);

  // "Capsule 1, 2, 3…" for this load (the example capsule is not numbered)
  const numbers = useMemo(() => {
    const map = {};
    stars.filter((s) => s.kind !== "example").forEach((s, i) => (map[s.id] = i + 1));
    return map;
  }, [stars]);

  const minMet = !!(needs.image && needs.collab && needs.prompt); // the least a crewmate must load
  const addedCount = Object.keys(added).length;
  const openStar = stars.find((s) => s.id === openStarId) || null;
  const noCrew = participants.length === 0;

  async function handleCollect({ filledText, aboutParticipantId, photo, images, caption }) {
    const star = openStar;
    const friend = participants.find((p) => p.id === aboutParticipantId);
    if (star.kind === "image") {
      // one memory per image, all with the same caption and crewmate
      for (const url of images) {
        await onAddMemory({ kind: "media", promptId: "image", filledText: [], text: (caption || "").trim(), aboutId: aboutParticipantId || null, photo: url });
      }
      setAdded((prev) => ({ ...prev, [star.id]: true }));
      setOpenStarId(null);
      setSent((l) => [...l, { text: (caption || "").trim(), photo: images[0] || null, aboutName: friend?.name || null }]);
      return;
    }
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
    setSent((l) => [...l, { text, photo: photo || null, aboutName: friend?.name || null }]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>Memory capsules</Text>
        </View>
      </View>

      {/* The instruction testers asked for: always visible, so nobody forgets who it's about. */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Select and load memories into capsules.</Text>
      </View>
      {noCrew && <Text style={styles.warn}>No crewmates yet: use the ✎ capsule to write about the group, or invite your crew first.</Text>}

      <View
        ref={fieldRef}
        style={styles.field}
        onLayout={(e) => {
          setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
          if (fieldRef.current?.measureInWindow) fieldRef.current.measureInWindow((x, y) => setFieldOrigin({ x, y }));
          else setFieldOrigin({ x: 0, y: 0 });
        }}
      >
        {stars.map((s) => {
          const pos = positions[s.id];
          if (!pos) return null;
          return (
            <CapsulePod
              key={s.id}
              visual={{ ...visuals[s.id], left: pos.left, top: pos.top }}
              collected={!!added[s.id]}
              isFree={s.kind === "free"}
              isExample={s.kind === "example"}
              isImage={s.kind === "image"}
              isCollab={s.kind === "prompt" && isCollabPrompt(s.promptId)}
              number={numbers[s.id]}
              label={s.kind === "example" ? "See how a memory is written" : s.kind === "image" ? "Add images" : s.kind === "free" ? "Write anything about your crew" : previewTemplate(s.template)}
              onPress={() => (s.kind === "example" ? setExampleOpen(true) : !added[s.id] && setOpenStarId(s.id))}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        {/* Everyone loads one of each of these before they can be ready for launch */}
        <View style={styles.needRow}>
          <Text style={styles.needLabel}>Load at least:</Text>
          {[["image", "Image 🖼️"], ["collab", "Collaborate ⇄"], ["prompt", "Prompt ?"]].map(([key, label]) => (
            <Text key={key} style={[styles.needItem, needs[key] && styles.needDone]}>
              {needs[key] ? "✓" : "○"} {label}
            </Text>
          ))}
        </View>
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
            <PrimaryButton title="Done" disabled={!minMet} onPress={() => (sent.length ? setReview(true) : onDone())} />
          </View>
        </View>
      </View>

      {/* The example capsule: shows how a memory reads. Nothing here is saved or loaded. */}
      <Modal visible={exampleOpen} transparent animationType="fade" onRequestClose={() => setExampleOpen(false)}>
        <Pressable style={styles.exBackdrop} onPress={() => setExampleOpen(false)}>
          <Pressable style={styles.exCard} onPress={() => {}}>
            <Text style={type.label}>EXAMPLE · NOT LOADED ONTO THE ROCKET</Text>
            <Text style={styles.exText}>
              <Text style={styles.exName}>Ruben</Text> was secretly the best at <Text style={styles.exBlank}>making everyone laugh in crit</Text>.
            </Text>
            <Text style={styles.exNote}>On a real capsule you pick a crewmate, finish the sentence, then tap “Load onto rocket”.</Text>
            <PrimaryButton title="Got it" onPress={() => setExampleOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>

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
      <PrivacyCard memories={review ? sent : null} serverUrl={serverUrl} onDone={() => { setReview(false); setSent([]); onDone(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  exBackdrop: { flex: 1, backgroundColor: "rgba(5, 6, 15, 0.7)", justifyContent: "center", padding: spacing.lg },
  exCard: { backgroundColor: "rgba(16, 19, 35, 0.97)", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.lg, gap: 14 },
  exText: { color: colors.text, fontSize: 20, fontWeight: "700", lineHeight: 30 },
  exName: { color: colors.accent, backgroundColor: "rgba(76, 201, 240, 0.14)" },
  exBlank: { textDecorationLine: "underline", textDecorationColor: colors.accent },
  exNote: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  wrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
  header: { flexDirection: "row", alignItems: "flex-end" },
  banner: {
    marginTop: spacing.xs,
    gap: 4,
  },
  bannerTitle: { color: colors.text, fontWeight: "700", fontSize: 13, lineHeight: 18 },
  bannerText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.accent, fontSize: 12, marginTop: spacing.sm },
  field: { flex: 1, marginTop: spacing.md, marginBottom: spacing.md, minHeight: 220 },
  footer: { gap: spacing.sm },
  needRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  needLabel: { color: colors.muted, fontSize: 12 },
  needItem: { color: colors.text, fontSize: 12, fontWeight: "700" },
  needDone: { color: "#7ee0a1" },
  row: { flexDirection: "row", gap: spacing.sm },
});
