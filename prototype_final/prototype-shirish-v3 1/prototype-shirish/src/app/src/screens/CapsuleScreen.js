import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Modal, useWindowDimensions, Platform } from "react-native";
import { colors, spacing, type } from "../lib/theme";
import Avatar from "../components/Avatar";
import GlassCarousel from "../components/GlassCarousel";
import VoicePlayer from "../components/VoicePlayer";
import ReactionBurst from "../components/ReactionBurst";
import { downloadCard } from "../lib/cardImage";

/**
 * The opened capsule as a memory wall: photos and sketches as polaroids, messages as bright
 * notes, laid out like a gallery. Tap any one to open it big, flick through them, and guess
 * who wrote it before the name is shown.
 */
const NOTE_COLORS = ["#ffd166", "#ff9fb2", "#9be7c4", "#a8c7ff", "#d7b8ff", "#ffb38a", "#f6f0a6"];
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export default function CapsuleScreen({ capsule, serverUrl, selfId, onStartOver, remoteBurst, onReactShare }) {
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState("all");
  const [guesses, setGuesses] = useState({}); // memoryId -> guessed member id
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(null); // index into `shown`
  const [burst, setBurst] = useState(null); // { id, emoji, name }
  // a crewmate's reaction shows on this screen too (our own is already shown instantly)
  useEffect(() => {
    if (remoteBurst && remoteBurst.from !== selfId) setBurst(remoteBurst);
  }, [remoteBurst?.id]);
  const abs = (u) => (u && u.startsWith("/") ? `${serverUrl}${u}` : u);
  const members = capsule?.members || [];
  const h = capsule?.highlights || {};

  const shown = useMemo(() => {
    const all = capsule?.memories || [];
    if (filter === "all") return all;
    if (filter === "about-me") return all.filter((m) => m.aboutId === selfId);
    if (filter === "by-me") return all.filter((m) => m.authorId === selfId);
    if (filter === "photos") return all.filter((m) => m.photo || m.drawing);
    return all.filter((m) => m.aboutId === filter);
  }, [capsule, filter, selfId]);

  // masonry: drop each card into the shortest column
  const cols = width >= 980 ? 4 : width >= 700 ? 3 : 2;
  const pageW = Math.min(width, 1100) - spacing.md * 2;
  const colW = (pageW - (cols - 1) * 12) / cols;
  const columns = useMemo(() => {
    const out = Array.from({ length: cols }, () => ({ h: 0, items: [] }));
    shown.forEach((m, i) => {
      const est = m.photo || m.drawing ? colW + 70 : 110 + Math.min(220, (m.text || "").length * 1.4);
      const c = out.reduce((a, b) => (b.h < a.h ? b : a));
      c.items.push({ m, i });
      c.h += est;
    });
    return out;
  }, [shown, cols, colW]);

  const avatarOf = (id) => members.find((m) => m.id === id)?.avatar;
  const nameOf = (id) => (id === selfId ? "you" : members.find((m) => m.id === id)?.name || "someone");
  const candidates = (m) => members.filter((x) => x.id !== m.aboutId && x.id !== selfId);
  const revealed = () => true; // authors are always shown on the panels
  const guessable = (capsule?.memories || []).filter((m) => m.authorId !== selfId && candidates(m).length >= 2);
  const guessed = guessable.filter((m) => guesses[m.id]);
  const right = guessed.filter((m) => guesses[m.id] === m.authorId).length;

  const filters = [
    ["all", "Everything"],
    ["photos", "Photos & sketches"],
    ["about-me", "About me"],
    ["by-me", "By me"],
    ...members.filter((m) => m.id !== selfId).map((m) => [m.id, `About ${m.name}`]),
  ];

  // arrow keys in the viewer (laptops)
  useEffect(() => {
    if (Platform.OS !== "web" || open == null) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") setOpen((o) => Math.min(shown.length - 1, o + 1));
      if (e.key === "ArrowLeft") setOpen((o) => Math.max(0, o - 1));
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shown.length]);

  return (
    <View style={{ flex: 1 }}>
      {/* behind the page, so the glass panels sit in front of the emojis */}
      <ReactionBurst burst={burst} onDone={() => setBurst(null)} />
      {onStartOver && (
        <Pressable onPress={onStartOver} hitSlop={8} style={styles.startOverTop} accessibilityLabel="Start over">
          <Text style={styles.toggle}>↻ Start over</Text>
        </Pressable>
      )}
      <ScrollView contentContainerStyle={[styles.wrap, { width: pageW + spacing.md * 2 }]}>
        <Text style={styles.kicker}>24 YEARS LATER</Text>
        <Text style={styles.title}>the capsule is open</Text>
        {shown.length === 0 && <Text style={[type.muted, { textAlign: "center", marginTop: spacing.lg }]}>Nothing here.</Text>}

        {shown.length > 0 && (
          <View style={{ paddingBottom: spacing.lg }}>
            <GlassCarousel items={shown} width={pageW + spacing.md * 2} abs={abs} revealed={revealed} nameOf={nameOf}
              onReact={(emoji) => {
                setBurst({ id: Date.now(), emoji, name: members.find((x) => x.id === selfId)?.name || "You" });
                onReactShare && onReactShare(emoji);
              }}
              onDownload={(m) => downloadCard(m, nameOf(m.authorId), abs)} />
          </View>
        )}

      </ScrollView>

      <Modal visible={open != null && !!shown[open]} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        {open != null && shown[open] ? (
          <Viewer
            m={shown[open]}
            index={open}
            count={shown.length}
            abs={abs}
            selfId={selfId}
            width={width}
            revealed={revealed(shown[open])}
            guess={guesses[shown[open].id]}
            candidates={candidates(shown[open])}
            avatarOf={avatarOf}
            nameOf={nameOf}
            onGuess={(id) => setGuesses((g) => ({ ...g, [shown[open].id]: id }))}
            onPrev={() => setOpen((o) => Math.max(0, o - 1))}
            onNext={() => setOpen((o) => Math.min(shown.length - 1, o + 1))}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </Modal>
    </View>
  );
}

/** One memory on the wall: a polaroid (photo/sketch) or a bright note (words). */
function Tile({ m, w, abs, selfId, revealed, avatarOf, nameOf, guess, onPress }) {
  const tilt = ((hash(m.id) % 5) - 2) * 0.6;
  const media = m.photo || m.drawing;
  const right = guess && guess === m.authorId;
  const footer = (
    <View style={styles.tileFoot}>
      {m.aboutId ? <Avatar id={avatarOf(m.aboutId)} size={22} expr={m.aboutId === selfId ? "wow" : "default"} /> : <Text style={{ fontSize: 14 }}>👥</Text>}
      <Text style={styles.tileAbout} numberOfLines={1}>
        {m.aboutName ? (m.aboutId === selfId ? "about you" : `about ${m.aboutName}`) : "the group"}
      </Text>
      {revealed ? (
        <View style={styles.byPill}>
          <Avatar id={avatarOf(m.authorId)} size={18} expr={right ? "yay" : "default"} />
          <Text style={styles.byText}>{guess ? (right ? "✓" : "✗") : ""} {nameOf(m.authorId)}</Text>
        </View>
      ) : (
        <View style={[styles.byPill, { backgroundColor: "rgba(0,0,0,0.12)" }]}>
          <Text style={styles.byText}>? who</Text>
        </View>
      )}
    </View>
  );
  if (media) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.polaroid, { transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? 0.97 : 1 }] }]}>
        <Image source={{ uri: abs(m.photo || m.drawing) }} style={{ width: "100%", aspectRatio: 1, backgroundColor: "#ddd" }} resizeMode="cover" />
        <Text style={styles.weekTag}>CAPSULE {m.n}</Text>
        {m.text ? (
          <Text style={styles.polaroidText} numberOfLines={3}>
            {m.text}
          </Text>
        ) : null}
        {footer}
      </Pressable>
    );
  }
  const bg = NOTE_COLORS[hash(m.id) % NOTE_COLORS.length];
  const len = (m.text || "").length;
  const fs = len < 60 ? 19 : len < 120 ? 16 : 14;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.note, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? 0.97 : 1 }] }]}>
      <Text style={styles.noteWeek}>CAPSULE {m.n}{m.audio ? "  🎙️ VOICE NOTE" : ""}</Text>
      <Text style={styles.quote}>“</Text>
      <Text style={[styles.noteText, { fontSize: fs, lineHeight: fs * 1.32 }]} numberOfLines={9}>
        {m.text}
      </Text>
      {footer}
    </Pressable>
  );
}

/** Full-screen view of one memory, with the "who wrote this?" guess. */
function Viewer({ m, index, count, abs, selfId, width, revealed, guess, candidates, avatarOf, nameOf, onGuess, onPrev, onNext, onClose }) {
  const media = m.photo || m.drawing;
  const right = guess && guess === m.authorId;
  const bg = media ? "#f7f3ea" : NOTE_COLORS[hash(m.id) % NOTE_COLORS.length];
  const cardW = Math.min(width - 32, 520);
  return (
    <View style={styles.viewerBg}>
      <View style={styles.viewerTop}>
        <Text style={styles.viewerCount}>
          {index + 1} / {count}
        </Text>
        <Pressable onPress={onClose} style={styles.roundBtn} hitSlop={8} accessibilityLabel="Close">
          <Text style={styles.roundBtnText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 110 }}>
        <View style={[styles.viewerCard, { width: cardW, backgroundColor: bg }]}>
          {m.photo ? <Image source={{ uri: abs(m.photo) }} style={{ width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: "#ddd" }} resizeMode="cover" /> : null}
          {m.drawing ? <Image source={{ uri: abs(m.drawing) }} style={{ width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: "#fff", marginTop: m.photo ? 8 : 0 }} resizeMode="contain" /> : null}
          <Text style={styles.viewerWeek}>CAPSULE {m.n} · {m.aboutName ? (m.aboutId === selfId ? "about you" : `about ${m.aboutName}`) : "about the group"}</Text>
          {m.audio ? <VoicePlayer src={abs(m.audio)} dark /> : null}
          {m.text ? <Text style={[styles.viewerText, media && { fontSize: 18 }]}>{media ? m.text : `“${m.text}”`}</Text> : null}
          {m.rescue ? <Text style={styles.viewerNote}>{rescueLine(m.rescue, selfId)}</Text> : null}
        </View>

        <View style={[styles.guessPanel, { width: cardW }]}>
          {revealed ? (
            <View style={styles.revealRow}>
              <Avatar id={avatarOf(m.authorId)} size={48} expr={right || !guess ? "yay" : "default"} />
              <View style={{ flex: 1 }}>
                <Text style={styles.revealSmall}>{m.authorId === selfId ? "You wrote this" : "Written by"}</Text>
                {m.authorId !== selfId ? <Text style={styles.revealName}>{m.authorName}</Text> : null}
                {guess ? <Text style={[styles.verdict, { color: right ? colors.lit : colors.muted }]}>{right ? "✓ You guessed it!" : `✗ You guessed ${nameOf(guess)}`}</Text> : null}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.guessQ}>Who wrote this?</Text>
              <View style={styles.faces}>
                {candidates.map((x) => (
                  <Pressable key={x.id} onPress={() => onGuess(x.id)} style={({ pressed }) => [styles.face, pressed && { transform: [{ scale: 0.94 }] }]}>
                    <Avatar id={x.avatar} size={44} />
                    <Text style={styles.faceName} numberOfLines={1}>
                      {x.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <View style={styles.viewerNav}>
        <Pressable onPress={onPrev} disabled={index === 0} style={[styles.navBtn, index === 0 && { opacity: 0.3 }]} accessibilityLabel="Previous">
          <Text style={styles.navText}>←</Text>
        </Pressable>
        <Pressable onPress={onNext} disabled={index === count - 1} style={[styles.navBtn, styles.navNext, index === count - 1 && { opacity: 0.3 }]} accessibilityLabel="Next">
          <Text style={[styles.navText, { color: "#0a0c18" }]}>→</Text>
        </Pressable>
      </View>
    </View>
  );
}

function rescueLine(r, selfId) {
  if (r.how === "flight") {
    const names = (r.savedBy || []).map((x) => (x.id === selfId ? "you" : x.name)).filter(Boolean);
    return `🚀 Saved by ${names.join(" + ") || "the crew"} on the flight home`;
  }
  if (r.how === "rescue") {
    const names = (r.savedBy || []).map((x) => (x.id === selfId ? "you" : x.name)).filter(Boolean);
    return `🚀 Rescued by ${names.join(" + ") || "the crew"}`;
  }
  return `🎨 Colour restored in round ${r.round} (${r.target}) · crew scored ${Number(r.crewScore || 0).toFixed(2)}`;
}

function Award({ icon, label, value }) {
  return (
    <View style={styles.award}>
      <Text style={styles.awardIcon}>{icon}</Text>
      <View>
        <Text style={styles.awardValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.awardLabel}>{label}</Text>
      </View>
    </View>
  );
}

const INK = "#1d1430";
const styles = StyleSheet.create({
  wrap: { padding: spacing.md, paddingTop: spacing.xl, gap: spacing.md, alignSelf: "center" },
  kicker: { color: colors.muted, fontSize: 12, letterSpacing: 3, textAlign: "center" },
  title: { color: colors.text, fontSize: 40, fontWeight: "800", letterSpacing: -1.5, textAlign: "center", marginTop: -8 },
  awards: { gap: 8, paddingVertical: 2 },
  award: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(16,19,35,0.9)", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingLeft: 10, paddingRight: 16 },
  awardIcon: { fontSize: 18 },
  awardValue: { color: colors.lit, fontSize: 15, fontWeight: "800" },
  awardLabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
  filters: { gap: 6, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(16,19,35,0.85)" },
  chipOn: { backgroundColor: colors.lit, borderColor: colors.lit },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextOn: { color: "#0a0c18", fontWeight: "700" },
  guessBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  guessText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  toggle: { color: colors.accent, fontSize: 12 },
  startOverTop: { position: "absolute", bottom: spacing.md, right: spacing.md, zIndex: 20, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  startOver: { alignSelf: "center", backgroundColor: colors.lit, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14, marginBottom: spacing.xl },
  startOverText: { color: "#0a0c18", fontSize: 16, fontWeight: "800" },
  masonry: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingBottom: spacing.xl, paddingTop: 4 },

  polaroid: { backgroundColor: "#f7f3ea", padding: 8, paddingBottom: 10, borderRadius: 4, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, gap: 6 },
  weekTag: { position: "absolute", top: 14, left: 14, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  polaroidText: { color: INK, fontSize: 14, lineHeight: 19, fontWeight: "600", paddingHorizontal: 2 },
  note: { borderRadius: 6, padding: 14, gap: 4, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  noteWeek: { color: "rgba(29,20,48,0.55)", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  quote: { color: "rgba(29,20,48,0.35)", fontSize: 40, lineHeight: 34, fontWeight: "800", marginBottom: -10 },
  noteText: { color: INK, fontWeight: "700" },
  tileFoot: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  tileAbout: { color: "rgba(29,20,48,0.7)", fontSize: 11, fontWeight: "700", flex: 1 },
  byPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  byText: { color: INK, fontSize: 11, fontWeight: "800" },

  viewerBg: { flex: 1, backgroundColor: "rgba(5,6,15,0.99)" },
  viewerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, paddingTop: spacing.lg },
  viewerCount: { color: colors.muted, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  roundBtnText: { color: colors.text, fontSize: 18 },
  viewerCard: { borderRadius: 8, padding: 14, gap: 10, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  viewerWeek: { color: "rgba(29,20,48,0.6)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  viewerText: { color: INK, fontSize: 24, lineHeight: 32, fontWeight: "700" },
  viewerNote: { color: "rgba(29,20,48,0.65)", fontSize: 12, fontWeight: "600" },
  guessPanel: { marginTop: spacing.md, backgroundColor: "rgba(22,26,46,0.95)", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  guessQ: { color: colors.lit, fontSize: 18, fontWeight: "800" },
  faces: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  face: { alignItems: "center", width: 72, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.05)" },
  faceName: { color: colors.text, fontSize: 12, marginTop: 2, maxWidth: 66 },
  revealRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  revealSmall: { color: colors.muted, fontSize: 12 },
  revealName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  verdict: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  viewerNav: { position: "absolute", left: 0, right: 0, bottom: spacing.lg, flexDirection: "row", justifyContent: "center", gap: 16 },
  navBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  navNext: { backgroundColor: colors.lit },
  navText: { color: colors.text, fontSize: 26, fontWeight: "700" },
});
