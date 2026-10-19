import React, { useMemo, useRef, useState } from "react";
import { BlurView } from "expo-blur";
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions } from "react-native";
import CapsulePod from "../components/CapsulePod";
import PrivacyCard from "../components/PrivacyCard";
import PromptSheet from "../components/PromptSheet";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";
import { isCollabPrompt, pickCapsules, previewTemplate, renderFilledTemplate, VOICE_PROMPTS, EXTRA_LABELS } from "../lib/prompts";

const HUES = ["#ff6ec7", "#ffb84c", "#2ec4b6", "#4cc9f0", "#9b5de5", "#3ddc97", "#f4d35e"];
// Submission meter: [from this many submissions, fill, caption]
const METER = [
  [0, 0, "Load capsules"],
  [1, 0.1, "Loading"],
  [3, 0.4, "Ready, but more?"],
  [5, 0.6, "Ready. Amazing"],
  [9, 1, "Ready. Rockstar!"],
];

// The example capsule is pinned to the right side of the field so it is always easy to find.
const examplePoint = (width, height) => ({ left: Math.max(74, width - 74), top: Math.max(52, height * 0.15) });

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
  // a capsule is about 80x40 with its glow; keep its whole body out of the zone
  const hitsZone = (c) => !!zone && c.left > zone.x0 - 54 && c.left < zone.x1 + 54 && c.top > zone.y0 - 32 && c.top < zone.y1 + 32;
  const tooClose = (c) => fixed.some((p) => Math.hypot(p.left - c.left, p.top - c.top) < 80);
  const x0 = 50;
  const y0 = 30;
  const spanW = Math.max(1, width - 100);
  const spanH = Math.max(1, height - 60);
  // Split the whole field into a grid and put one capsule in a random usable cell, so they spread across
  // the entire screen instead of bunching. The grid is made finer until enough cells are clear of the rocket.
  let cells = [];
  for (let n = Math.max(count, 1); n <= count * 6 + 12; n++) {
    const cols = Math.max(1, Math.round(Math.sqrt((n * spanW) / spanH)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cw = spanW / cols;
    const ch = spanH / rows;
    cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mid = { left: x0 + (c + 0.5) * cw, top: y0 + (r + 0.5) * ch };
        if (!hitsZone(mid) && !tooClose(mid)) cells.push({ mid, cw, ch });
      }
    }
    if (cells.length >= count) break;
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[k]] = [cells[k], cells[i]];
  }
  const points = cells.slice(0, count).map(({ mid, cw, ch }) => {
    // a little jitter so it still looks scattered; retry if the jitter lands on the rocket
    for (let a = 0; a < 10; a++) {
      const p = { left: mid.left + (Math.random() - 0.5) * cw * 0.6, top: mid.top + (Math.random() - 0.5) * ch * 0.6 };
      if (!hitsZone(p) && !tooClose(p)) return p;
    }
    return mid;
  });
  // tiny window with no room at all: fall back to the bottom edge
  while (points.length < count) points.push({ left: x0 + Math.random() * spanW, top: Math.max(30, height - 40) });
  return points;
}

/**
 * One visit to the memory capsules (formerly "Memory Stars"). Each star you fill in goes straight into the capsule (no
 * big submit at the end), so you can add one memory on the bus or ten on launch night and
 * leave whenever you like. Prompts change with the week and skip ones you've answered.
 */
export default function StarFieldPage({ week, participants, answeredIds, totalMine, needs = {}, onAddMemory, onRemoveMemory, onBack, onDone, serverUrl, code, participantId }) {
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

  const [moved, setMoved] = useState({}); // starId -> {left, top} where the user dragged it
  const [dupes, setDupes] = useState([]); // capsules the user duplicated this round
  const dupeCount = useRef(0);
  const visualCache = useRef({});

  const baseStars = useMemo(() => {
    const { prompts, extras } = pickCapsules({ participantId, crewIds: participants.map((x) => x.id), round });
    const picked = prompts.map((p) => ({ id: `${p.id}`, promptId: p.id, kind: "prompt", template: p.template, ask: p.ask || null, askMates: !!p.askMates, needsPhoto: !!p.needsPhoto }));
    const voice = (i) => ({ id: `voice_${round}_${i}`, promptId: "voice", kind: "voice", voicePrompt: VOICE_PROMPTS[i].text });
    return [...picked,
      ...(extras.free ? [{ id: `free_${round}`, promptId: "free_text", kind: "free" }] : []),
      ...(extras.images ? [{ id: `image_${round}`, promptId: "image", kind: "image" }] : []),
      ...(extras.selfie ? [{ id: `selfie_${round}`, promptId: "selfie", kind: "selfie" }] : []),
      ...(extras.voice ? [voice(0)] : []), ...(extras.voice2050 ? [voice(1)] : []), { id: "example", kind: "example" }];
    // new stars on each "shuffle" round; answeredIds intentionally read once per round
  }, [round, participantId, participants.map((x) => x.id).join()]);
  const stars = useMemo(() => [...baseStars, ...dupes], [baseStars, dupes]);

  const positions = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !fieldOrigin) return {}; // wait until we know where the field sits
    const others = baseStars.filter((s) => s.kind !== "example"); // duplicates are placed by hand, not scattered
    const z = rocketZone(winW, winH);
    const zone = { x0: z.x0 - fieldOrigin.x, x1: z.x1 - fieldOrigin.x, y0: z.y0 - fieldOrigin.y, y1: z.y1 - fieldOrigin.y };
    const exPoint = examplePoint(containerSize.width, containerSize.height);
    const points = scatterPoints(others.length, containerSize.width, containerSize.height, [exPoint], zone);
    const map = {};
    others.forEach((s, i) => (map[s.id] = points[i]));
    baseStars.forEach((s) => s.kind === "example" && (map[s.id] = exPoint));
    return map;
  }, [baseStars, containerSize.width, containerSize.height, winW, winH, fieldOrigin]);

  const visuals = useMemo(() => {
    const map = {};
    stars.forEach((s, i) => {
      // cached so adding a duplicate doesn't re-roll everyone else's look
      visualCache.current[s.id] ||= {
        size: 14 + Math.round(Math.random() * 14),
        hue: s.kind === "example" ? "#c3c8e6" : HUES[i % HUES.length],
        twinkleMs: 900 + Math.round(Math.random() * 1200),
        delayMs: Math.round(Math.random() * 2000),
      };
      map[s.id] = visualCache.current[s.id];
    });
    return map;
  }, [stars]);

  // "Capsule 1, 2, 3…" for this load (the example capsule is not numbered)
  const numbers = useMemo(() => {
    const map = {};
    stars.filter((s) => s.kind !== "example").forEach((s, i) => (map[s.id] = i + 1));
    return map;
  }, [stars]);

  const addedCount = Object.keys(added).length;
  const openStar = stars.find((s) => s.id === openStarId) || null;
  const noCrew = participants.length === 0;
  const submitted = Math.max(totalMine || 0, sent.length);
  const [, meterFill, meterText] = [...METER].reverse().find(([from]) => submitted >= from);
  const narrow = winW < 640;

  function duplicate(star) {
    const id = `dup_${++dupeCount.current}_${star.id}`;
    const from = moved[star.id] || positions[star.id] || { left: 80, top: 80 };
    setDupes((d) => [...d, { ...star, id }]);
    visualCache.current[id] = { ...visuals[star.id] }; // same colour and size as the one copied
    const step = (dupeCount.current - 1) % 4; // successive copies fan out instead of stacking
    setMoved((m) => ({
      ...m,
      [id]: { left: Math.min(containerSize.width - 40, from.left + 60 + step * 12), top: Math.min(containerSize.height - 30, from.top + 24 + step * 16) },
    }));
  }

  // a copy can be taken back until it has been submitted
  function removeDupe(id) {
    setDupes((d) => d.filter((x) => x.id !== id));
    setMoved((m) => {
      const { [id]: _gone, ...rest } = m;
      return rest;
    });
  }

  async function handleCollect({ filledText, aboutParticipantId, photo, images, caption, audio }) {
    const star = openStar;
    const prev = added[star.id]; // set when this capsule is being edited
    const friend = participants.find((p) => p.id === aboutParticipantId);
    const ids = [];
    let text;
    let preview;
    if (star.kind === "image") {
      // one memory per image, all with the same caption and crewmate
      text = (caption || "").trim();
      for (const url of images) {
        ids.push(await onAddMemory({ kind: "media", promptId: "image", filledText: [], text, aboutId: aboutParticipantId || null, photo: url }));
      }
      preview = text || `${images.length} image${images.length === 1 ? "" : "s"}`;
    } else if (star.kind === "selfie") {
      text = (caption || "").trim();
      ids.push(await onAddMemory({ kind: "media", promptId: "selfie", filledText: [], text, aboutId: null, photo }));
      preview = text || "📷 Group selfie";
    } else if (star.kind === "voice") {
      text = star.voicePrompt; // the recording is the memory; the prompt gives it a caption
      ids.push(await onAddMemory({ kind: "voice", promptId: "voice", filledText: [], text, aboutId: aboutParticipantId || null, audio }));
      preview = "🎙️ Voice note";
    } else {
      text = star.kind === "free" ? (filledText[0] || "").trim() : renderFilledTemplate(star.template, { friendName: friend?.name, filledText });
      ids.push(
        await onAddMemory({
          kind: star.kind,
          promptId: star.promptId,
          template: star.template || null,
          filledText,
          text,
          aboutId: aboutParticipantId || null,
          photo: photo || null,
        })
      );
      preview = text;
    }
    // edited: the new version is in, so take the old one back out
    if (prev) for (const id of prev.memoryIds) if (id) await onRemoveMemory(id).catch(() => {});
    setAdded((p) => ({ ...p, [star.id]: { memoryIds: ids, preview, values: { filledText, aboutParticipantId, photo: photo || null, images: images || [], caption: caption || "", audio: audio || null } } }));
    setOpenStarId(null);
    const entry = { starId: star.id, text, photo: star.kind === "image" ? images[0] || null : photo || null, aboutName: friend?.name || null };
    setSent((l) => (prev ? l.map((e) => (e.starId === star.id ? entry : e)) : [...l, entry]));
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
          const pos = moved[s.id] || positions[s.id];
          if (!pos) return null;
          return (
            <CapsulePod
              key={s.id}
              visual={{ ...visuals[s.id], left: pos.left, top: pos.top }}
              collected={!!added[s.id]}
              isFree={s.kind === "free"}
              isExample={s.kind === "example"}
              isImage={s.kind === "image"}
              isVoice={s.kind === "voice"}
              isSelfie={s.kind === "selfie"}
              isCollab={s.kind === "prompt" && isCollabPrompt(s.promptId)}
              number={numbers[s.id]}
              label={added[s.id]?.preview || (s.kind === "example" ? EXTRA_LABELS.example : s.kind === "image" ? EXTRA_LABELS.images : s.kind === "voice" ? s.voicePrompt : s.kind === "selfie" ? EXTRA_LABELS.selfie : s.kind === "free" ? EXTRA_LABELS.freeWrite : previewTemplate(s.template, s.ask))}
              askMates={!!s.askMates}
              onRemove={s.id.startsWith("dup_") && !added[s.id] ? () => removeDupe(s.id) : undefined}
              onDuplicate={s.kind === "example" ? undefined : () => duplicate(s)}
              onEdit={added[s.id] ? () => setOpenStarId(s.id) : undefined}
              onPress={() => (s.kind === "example" ? setExampleOpen(true) : !added[s.id] && setOpenStarId(s.id))}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={[styles.bottomRow, narrow && { flexDirection: "column", alignItems: "flex-end" }]}>
          <View style={[styles.meterWrap, !narrow && styles.meterRight]}>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${meterFill * 100}%` }]} />
            </View>
            <Text style={styles.meterText}>{meterText}</Text>
          </View>
        <View style={styles.row}>
          <View style={styles.btn}>
            <PrimaryButton title="Back" variant="ghost" onPress={onBack} />
          </View>
          <View style={styles.btn}>
            <PrimaryButton
              title="New capsules"
              variant="ghost"
              onPress={() => {
                setAdded({});
                setMoved({});
                setDupes([]);
                setRound((r) => r + 1);
              }}
            />
          </View>
          <View style={styles.btn}>
            <PrimaryButton title="Done" onPress={() => (sent.length ? setReview(true) : onDone())} />
          </View>
        </View>
        </View>
      </View>

      {/* The example capsule: shows how a memory reads. Nothing here is saved or loaded. */}
      <Modal visible={exampleOpen} transparent animationType="fade" onRequestClose={() => setExampleOpen(false)}>
        <View style={styles.exRoot}>
          <Pressable style={styles.exBackdrop} onPress={() => setExampleOpen(false)} />
          <BlurView intensity={55} tint="dark" style={styles.exCard}>
            <Text style={type.label}>EXAMPLE · NOT LOADED ONTO THE ROCKET</Text>
            <Text style={styles.exText}>
              <Text style={styles.exName}>Ruben</Text> was secretly the best at <Text style={styles.exBlank}>making everyone laugh in crit</Text>.
            </Text>
            <Text style={styles.exNote}>On a real capsule you pick a crewmate, finish the sentence, then tap “Load”.</Text>
            <View style={{ alignSelf: "center", width: 160 }}>
              <PrimaryButton title="Got it" onPress={() => setExampleOpen(false)} />
            </View>
          </BlurView>
        </View>
      </Modal>

      <PromptSheet
        visible={!!openStar}
        star={openStar}
        initial={openStar && added[openStar.id] ? added[openStar.id].values : null}
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
  exRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.md },
  exBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  exCard: {
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    backgroundColor: "rgba(22, 26, 46, 0.6)",
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    gap: 14,
  },
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
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", flexWrap: "wrap" },
  btn: { width: 140 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  meterWrap: { gap: 6 },
  meterRight: { position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center" }, // pinned to the right edge, level with the buttons
  meterTrack: { width: 210, maxWidth: "100%", height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 2, borderColor: colors.lit, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 6, backgroundColor: colors.lit },
  meterText: { color: colors.text, fontSize: 14, fontWeight: "700" },
});
