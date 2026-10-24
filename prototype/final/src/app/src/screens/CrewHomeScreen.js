import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Image, Platform, Share, ScrollView } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import Avatar from "../components/Avatar";
import { colors, spacing, type } from "../lib/theme";
import { inviteLink } from "../lib/server";

// Thin, dark scrollbar for the memory preview list (web only; phones already use slim overlay bars).
function useSlimScrollbar() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById("slim-scroll-style")) return;
    const el = document.createElement("style");
    el.id = "slim-scroll-style";
    // The standard scrollbar-width/color properties would switch the ::-webkit rules off (and have no arrows),
    // so only the webkit ones are used.
    const arrow = (d) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='${d}' fill='white'/%3E%3C/svg%3E")`;
    el.textContent = `
      [data-slim-scroll]::-webkit-scrollbar { width: 8px; }
      [data-slim-scroll]::-webkit-scrollbar-track { background: #0b0c10; border-radius: 4px; }
      [data-slim-scroll]::-webkit-scrollbar-thumb { background: #2a2d37; border-radius: 4px; }
      [data-slim-scroll]::-webkit-scrollbar-thumb:hover { background: #3a3e4c; }
      [data-slim-scroll]::-webkit-scrollbar-button:single-button { display: block; height: 8px; width: 8px; background-color: transparent; background-repeat: no-repeat; background-position: center; background-size: 6px 6px; }
      [data-slim-scroll]::-webkit-scrollbar-button:single-button:vertical:decrement { background-image: ${arrow("M5 2 L9 8 L1 8 Z")}; }
      [data-slim-scroll]::-webkit-scrollbar-button:single-button:vertical:increment { background-image: ${arrow("M1 2 L9 2 L5 8 Z")}; }
    `;
    document.head.appendChild(el);
  }, []);
}

/**
 * The crew's home for the whole semester. Everyone sees the same thing and has the same
 * controls — there's no host.
 */
export default function CrewHomeScreen({ scene, selfId, server, onAddMemories, onAddMedia, onMyMemories, onSetReady, onDemo, onWatchIntro, onRemoveMemory, readyBusy, error, myMemories = [] }) {
  useSlimScrollbar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simBusy, setSimBusy] = useState(false);

  const members = scene.members || [];
  const me = members.find((m) => m.id === selfId);
  const others = members.filter((m) => m.id !== selfId);
  const rules = scene.rules || { minMemories: 3, minMembers: 2, maxMembers: 6 };
  const readyCount = members.filter((m) => m.ready).length;
  const myCount = me?.memoryCount || 0;
  const needs = me?.needs || {};
  const canBeReady = myCount >= rules.minMemories;
  const link = inviteLink(server, scene.code);
  const hasSims = members.some((m) => m.isSimulated);

  async function copyLink() {
    try {
      if (Platform.OS === "web" && navigator?.clipboard) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        await Share.share({ message: `Join our Launch Sequence crew: ${link} (code ${scene.code})` });
      }
    } catch (e) {
      /* ignore */
    }
  }

  async function simulate() {
    setSimBusy(true);
    await onDemo("demo_simulate_crew");
    setSimBusy(false);
  }

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.crewName} numberOfLines={1}>
            {scene.crewName}
          </Text>
        </View>
        <Pressable style={styles.codeChip} onPress={() => setInviteOpen(true)}>
          <Text style={styles.code}>{scene.code}</Text>
          <Text style={styles.invite}>Invite</Text>
        </Pressable>
      </View>

      <PrimaryButton title="✦  Load a memory" onPress={onAddMemories} />

      {/* A small preview of what you've loaded so far; scrolls when it gets long */}
      <View style={styles.preview}>
        {myMemories.length === 0 ? (
          <Text style={styles.previewEmpty}>Memories you load will show up here.</Text>
        ) : (
          <ScrollView style={styles.previewScroll} dataSet={{ slimScroll: "1" }} nestedScrollEnabled showsVerticalScrollIndicator>
            {myMemories.map((m) => (
              <View key={m.id} style={styles.previewRow}>
                <Text style={[styles.previewText, onRemoveMemory && { paddingRight: 28 }]} numberOfLines={2}>
                  {m.audio ? "🎙️  Voice note" : m.text || (m.photo ? "🖼️  Image" : m.drawing ? "✎  Sketch" : "")}
                </Text>
                {onRemoveMemory ? (
                  <Pressable onPress={() => onRemoveMemory(m.id)} style={styles.previewX} hitSlop={8} accessibilityLabel="Remove this memory">
                    <Text style={styles.previewXText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Where the crew is at: a small avatar and one short line each */}
      <ScrollView style={styles.crewStatus} contentContainerStyle={styles.crewGrid} nestedScrollEnabled showsVerticalScrollIndicator>
        {[...members]
          .sort((a, b) => Number(!!b.ready) - Number(!!a.ready)) // the ones who've submitted come first
          .map((m) => (
            <View key={m.id} style={styles.statusRow}>
              <Avatar id={m.avatar} size={22} expr={m.ready ? "yay" : "default"} />
              <Text style={styles.statusText}>
                {m.name} - <Text style={m.ready ? styles.statusReady : styles.statusWriting}>{m.ready ? "ready" : "writing"}</Text>
              </Text>
            </View>
          ))}
      </ScrollView>

      {/* Practice mode: one tester can run the whole thing */}
      {!hasSims && others.length === 0 && (
        <Pressable style={styles.sim} onPress={simulate} disabled={simBusy}>
          <Text style={styles.simIcon}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.simTitle}>{simBusy ? "Adding crewmates…" : "Testing alone? Add 2 simulated crewmates"}</Text>
            <Text style={styles.simSub}>They write memories, get ready and play the rescue games with you.</Text>
          </View>
        </Pressable>
      )}

      {/* Launch: the ready button only appears once you've loaded enough memories */}
      {(canBeReady || me?.ready) && (
        <View style={styles.launchBox}>
          {me?.ready ? (
            <PrimaryButton title="I need more time" variant="ghost" onPress={() => onSetReady(false)} loading={readyBusy} />
          ) : (
            <PrimaryButton title="🚀  I'm ready for launch" variant="dark" onPress={() => onSetReady(true)} loading={readyBusy} />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
      {error && !(canBeReady || me?.ready) ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footerRow}>
        {onWatchIntro ? (
          <Pressable onPress={onWatchIntro}>
            <Text style={styles.fold}>▸ How it works</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setDemoOpen((o) => !o)}>
          <Text style={styles.fold}>{demoOpen ? "▾" : "▸"} Demo tools</Text>
        </Pressable>
      </View>
      {demoOpen && (
        <View style={styles.demoBox}>
          <PrimaryButton title={`Skip ahead a week (now week ${scene.week})`} variant="ghost" onPress={() => onDemo("demo_fast_forward")} />
          <PrimaryButton title="Add a simulated crewmate" variant="ghost" onPress={() => onDemo("demo_add_crewmate")} />
          <PrimaryButton title="Simulated crewmates add a memory" variant="ghost" onPress={() => onDemo("demo_sim_memories")} />
          <PrimaryButton title="Simulated crewmates get ready" variant="ghost" onPress={() => onDemo("demo_ready_others")} />
          <PrimaryButton title="Start over (back to the beginning for everyone)" variant="ghost" onPress={() => onDemo("demo_start_over")} />
          {!me?.ready && !canBeReady && (
            <PrimaryButton title="Skip memory submission and get ready" variant="ghost" onPress={() => onSetReady(true, true)} loading={readyBusy} />
          )}
        </View>
      )}

      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.inviteCard} onPress={() => {}}>
            <Text style={type.label}>INVITE YOUR CREW</Text>
            <Text style={styles.inviteCode}>{scene.code}</Text>
            {link ? <Image source={{ uri: `${server ? (server.origin || `http://${server.ip}:${server.port}`) : ""}/api/qr?text=${encodeURIComponent(link)}` }} style={styles.qr} /> : null}
            <Text style={styles.inviteHint}>Scan with a phone camera, or tap "Join a crew" and type the code.</Text>
            <Text style={styles.inviteLink} selectable>
              {link}
            </Text>
            <PrimaryButton title={copied ? "Copied ✓" : Platform.OS === "web" ? "Copy invite link" : "Share invite link"} onPress={copyLink} />
            <PrimaryButton title="Close" variant="ghost" onPress={() => setInviteOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  status: { color: colors.muted, fontSize: 12, marginTop: 2 },
  codeChip: { alignItems: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  next: { backgroundColor: "rgba(255, 184, 76, 0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  nextText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sim: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderStyle: "dashed", borderColor: colors.accent, borderRadius: 12, padding: 10, backgroundColor: "rgba(76, 201, 240, 0.08)" },
  simIcon: { fontSize: 24 },
  simTitle: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  simSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  readyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  readyFace: { borderRadius: 18, borderWidth: 2, borderColor: "transparent", padding: 1 },
  readyFaceOn: { borderColor: colors.lit },
  foldRow: { marginTop: spacing.xs },
  preview: { height: 170, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, paddingHorizontal: 10, overflow: "hidden" },
  previewScroll: { flex: 1 },
  previewEmpty: { color: colors.muted, fontSize: 13, paddingVertical: 12 },
  previewRow: { height: 42, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  previewX: { position: "absolute", top: 4, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  previewXText: { color: colors.text, fontSize: 9, fontWeight: "800" },
  previewText: { color: colors.text, fontSize: 13, lineHeight: 17 },
  previewSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  crewStatus: { maxHeight: 58, flexGrow: 0 },
  crewGrid: { flexDirection: "row", flexWrap: "wrap" },
  statusRow: { width: "50%", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3, paddingRight: 6 },
  statusText: { color: colors.text, fontSize: 13, flexShrink: 1 },
  statusReady: { color: colors.lit, fontWeight: "700" },
  statusWriting: { color: colors.muted },
  fold: { color: colors.muted, fontSize: 13 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  crewName: { ...type.heading, fontSize: 28, color: "#FFFFFF" },
  weekChip: { alignItems: "center", borderWidth: 1, borderColor: colors.lit, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  weekText: { color: colors.lit, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  weekSub: { color: colors.muted, fontSize: 10 },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeLabel: { color: colors.muted, fontSize: 12 },
  code: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 3, fontSize: 20 },
  invite: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  howTo: { borderLeftWidth: 3, borderLeftColor: colors.lit, paddingLeft: 10, paddingVertical: 2 },
  howToText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  watchLink: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  notice: { backgroundColor: "rgba(76, 201, 240, 0.12)", borderRadius: 10, padding: 10 },
  noticeText: { color: colors.accent, fontSize: 13 },
  row: { flexDirection: "row", gap: spacing.sm },
  teaser: { color: colors.lit, fontSize: 13, textAlign: "center", marginTop: 2 },
  section: { marginTop: spacing.md },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  memberReady: { borderColor: colors.lit },
  engineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  engineDotReady: { backgroundColor: colors.lit },
  engineNum: { color: "#0a0c18", fontSize: 12, fontWeight: "800" },
  memberSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  memberState: { color: colors.muted, fontSize: 12 },
  launchBox: {
    marginTop: spacing.xs,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: "rgba(255, 184, 76, 0.06)",
  },
  launchTitle: { color: colors.text, fontWeight: "700", fontSize: 14, marginLeft: "auto" },
  launchSub: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  error: { color: colors.danger, fontSize: 13 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedWeek: { color: colors.lit, fontSize: 11, fontWeight: "700", width: 28 },
  feedText: { color: colors.text, fontSize: 13, flex: 1 },
  feedTime: { color: colors.muted, fontSize: 11 },
  demoToggle: { color: colors.muted, fontSize: 12 },
  demoBox: { gap: 6 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.md },
  inviteCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "stretch",
  },
  inviteCode: { color: colors.text, fontSize: 32, fontWeight: "800", letterSpacing: 6, textAlign: "center" },
  qr: { width: 200, height: 200, alignSelf: "center", borderRadius: 12, backgroundColor: "#fff" },
  inviteHint: { color: colors.muted, fontSize: 12, textAlign: "center" },
  inviteLink: { color: colors.accent, fontSize: 12, textAlign: "center" },
});
