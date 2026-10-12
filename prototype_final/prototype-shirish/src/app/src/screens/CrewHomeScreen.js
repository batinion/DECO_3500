import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Image, Platform, Share } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import Avatar from "../components/Avatar";
import { colors, spacing, type } from "../lib/theme";
import { inviteLink } from "../lib/server";

function timeAgo(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function activityText(a, selfId) {
  const who = a.memberId === selfId ? "You" : a.memberName;
  const about = a.aboutId === selfId ? "you" : a.aboutName;
  switch (a.type) {
    case "joined":
      return `${who} joined the crew — engine lit`;
    case "memory":
      if (a.kind === "media") return `${who} added a sketch or photo${about ? ` of ${about}` : ""}`;
      return about ? `${who} added a memory about ${about}` : `${who} added a memory about the group`;
    case "ready":
      return `${who} ${who === "You" ? "are" : "is"} ready for launch`;
    case "unready":
      return `${who} wants a bit more time`;
    case "week":
      return "A week went by (demo)";
    default:
      return "";
  }
}

/**
 * The crew's home for the whole semester. Everyone sees the same thing and has the same
 * controls — there's no host.
 */
export default function CrewHomeScreen({ scene, selfId, server, onAddMemories, onAddMedia, onMyMemories, onSetReady, onDemo, onWatchIntro, readyBusy, error }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simBusy, setSimBusy] = useState(false);

  const members = scene.members || [];
  const me = members.find((m) => m.id === selfId);
  const others = members.filter((m) => m.id !== selfId);
  const rules = scene.rules || { minMemories: 3, minMembers: 2, maxMembers: 6 };
  const readyCount = members.filter((m) => m.ready).length;
  const myCount = me?.memoryCount || 0;
  const toGo = Math.max(0, rules.minMemories - myCount);
  const canBeReady = toGo === 0;
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

  // One clear "what now" line instead of paragraphs.
  const nextStep = others.length === 0
    ? "Invite your crew — memories are about each other."
    : !canBeReady
      ? `Load ${toGo} more ${toGo === 1 ? "memory" : "memories"} about your crew.`
      : me?.ready
        ? `Waiting for ${members.length - readyCount} more to be ready.`
        : "You're set! Tap ready when the semester's done.";

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.crewName} numberOfLines={1}>
            {scene.crewName}
          </Text>
          <Text style={styles.status}>
            Week {scene.week} · {scene.memoryTotal} {scene.memoryTotal === 1 ? "memory" : "memories"} on board
          </Text>
        </View>
        <Pressable style={styles.codeChip} onPress={() => setInviteOpen(true)}>
          <Text style={styles.code}>{scene.code}</Text>
          <Text style={styles.invite}>Invite</Text>
        </Pressable>
      </View>

      <View style={styles.next}>
        <Text style={styles.nextText}>{nextStep}</Text>
      </View>

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

      <PrimaryButton title="✦  Load a memory" onPress={onAddMemories} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Sketch / photo" variant="ghost" onPress={onAddMedia} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={`My memories (${myCount})`} variant="ghost" onPress={onMyMemories} />
        </View>
      </View>

      {me && me.aboutCount > 0 && (
        <Text style={styles.teaser}>
          🔒 {me.aboutCount} {me.aboutCount === 1 ? "memory" : "memories"} about you {me.aboutCount === 1 ? "is" : "are"} waiting
        </Text>
      )}

      {/* Launch */}
      <View style={styles.launchBox}>
        <View style={styles.readyRow}>
          {members.map((m) => (
            <View key={m.id} style={[styles.readyFace, m.ready && styles.readyFaceOn]}>
              <Avatar id={m.avatar} size={30} expr={m.ready ? "yay" : "default"} />
            </View>
          ))}
          <Text style={styles.launchTitle}>
            {readyCount}/{members.length} ready
          </Text>
        </View>
        {me?.ready ? (
          <PrimaryButton title="I need more time" variant="ghost" onPress={() => onSetReady(false)} loading={readyBusy} />
        ) : (
          <PrimaryButton
            title={canBeReady ? "🚀  I'm ready for launch" : `Ready after ${toGo} more`}
            variant="dark"
            onPress={() => onSetReady(true)}
            disabled={!canBeReady}
            loading={readyBusy}
          />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* Everything else, tucked away */}
      <Pressable onPress={() => setCrewOpen((o) => !o)} style={styles.foldRow}>
        <Text style={styles.fold}>{crewOpen ? "▾" : "▸"} Crew & activity</Text>
      </Pressable>
      {crewOpen && (
        <View style={{ gap: 6 }}>
          {members.map((m) => (
            <View key={m.id} style={[styles.member, m.ready && styles.memberReady]}>
              <Avatar id={m.avatar} size={30} expr={m.ready ? "yay" : "default"} />
              <Text style={[type.body, { flex: 1, fontSize: 14 }]}>
                {m.name}
                {m.id === selfId ? " (you)" : m.isSimulated ? " 🤖" : ""}
              </Text>
              <Text style={styles.memberSub}>added {m.memoryCount}</Text>
            </View>
          ))}
          {(scene.activity || []).slice(0, 6).map((a) => (
            <View key={a.id} style={styles.feedRow}>
              <Text style={styles.feedWeek}>W{a.week}</Text>
              <Text style={styles.feedText}>{activityText(a, selfId)}</Text>
              <Text style={styles.feedTime}>{timeAgo(a.at)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footerRow}>
        {onWatchIntro ? (
          <Pressable onPress={onWatchIntro}>
            <Text style={styles.fold}>▶ How it works</Text>
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
  fold: { color: colors.muted, fontSize: 13 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  crewName: { ...type.heading, fontSize: 20 },
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
  code: { color: colors.text, fontWeight: "800", letterSpacing: 3, fontSize: 15 },
  invite: { color: colors.accent, fontWeight: "700", fontSize: 11 },
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
