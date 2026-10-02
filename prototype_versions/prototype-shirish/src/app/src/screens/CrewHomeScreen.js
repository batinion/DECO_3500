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
  const [demoOpen, setDemoOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const members = scene.members || [];
  const me = members.find((m) => m.id === selfId);
  const others = members.filter((m) => m.id !== selfId);
  const rules = scene.rules || { minMemories: 3, minMembers: 2, maxMembers: 6 };
  const readyCount = members.filter((m) => m.ready).length;
  const myCount = me?.memoryCount || 0;
  const canBeReady = myCount >= rules.minMemories;
  const endOfSemester = scene.week >= scene.semesterWeeks;
  const link = inviteLink(server, scene.code);

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

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>YOUR CREW</Text>
          <Text style={styles.crewName} numberOfLines={1}>
            {scene.crewName}
          </Text>
        </View>
        <View style={styles.weekChip}>
          <Text style={styles.weekText}>WEEK {scene.week}</Text>
          <Text style={styles.weekSub}>of {scene.semesterWeeks}</Text>
        </View>
      </View>

      <Pressable style={styles.codeRow} onPress={() => setInviteOpen(true)}>
        <Text style={styles.codeLabel}>Crew code</Text>
        <Text style={styles.code}>{scene.code}</Text>
        <Text style={styles.invite}>Invite ›</Text>
      </Pressable>

      {/* What to do */}
      <View style={styles.howTo}>
        <Text style={styles.howToText}>
          {endOfSemester
            ? "Semester's done! Get the crew together, add any last memories, and everyone taps “ready” to launch."
            : "Whenever something happens with your crew — a crit, a late night, a joke — drop a memory about them here. Nobody can read them until the capsule opens."}
        </Text>
      </View>

      {onWatchIntro ? (
        <Pressable onPress={onWatchIntro}>
          <Text style={styles.watchLink}>▶ How it works (40-sec briefing)</Text>
        </Pressable>
      ) : null}

      {others.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Memories are about your crewmates, so invite them first. Tap “Invite” above.</Text>
        </View>
      )}

      <PrimaryButton title="✦  Add memories" onPress={onAddMemories} />
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
          🔒 {me.aboutCount} {me.aboutCount === 1 ? "memory" : "memories"} about you {me.aboutCount === 1 ? "is" : "are"} waiting in the capsule
        </Text>
      )}

      {/* Crew */}
      <Text style={[type.label, styles.section]}>
        CREW · {members.length}/{rules.maxMembers} · {scene.memoryTotal} MEMORIES ON BOARD
      </Text>
      <View style={{ gap: 6 }}>
        {members.map((m) => (
          <View key={m.id} style={[styles.member, m.ready && styles.memberReady]}>
            <Avatar id={m.avatar} size={38} expr={m.ready ? "yay" : "default"} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>
                {m.name}
                {m.id === selfId ? " (you)" : ""}
              </Text>
              <Text style={styles.memberSub}>
                added {m.memoryCount} · {m.aboutCount} about {m.id === selfId ? "you" : "them"}
              </Text>
            </View>
            <Text style={[styles.memberState, m.ready && { color: colors.lit }]}>{m.ready ? "ready ✓" : "collecting"}</Text>
          </View>
        ))}
      </View>

      {/* Launch */}
      <View style={styles.launchBox}>
        <Text style={styles.launchTitle}>
          Ready for launch: {readyCount} of {members.length}
        </Text>
        <Text style={styles.launchSub}>
          The rocket launches when everyone is ready — usually when you meet up at the end of semester.
          {members.length < rules.minMembers ? ` You need at least ${rules.minMembers} crewmates.` : ""}
        </Text>
        {me?.ready ? (
          <PrimaryButton title="I need more time" variant="ghost" onPress={() => onSetReady(false)} loading={readyBusy} />
        ) : (
          <PrimaryButton
            title={canBeReady ? "I'm ready for launch" : `Add ${rules.minMemories - myCount} more ${rules.minMemories - myCount === 1 ? "memory" : "memories"} to be ready`}
            variant="dark"
            onPress={() => onSetReady(true)}
            disabled={!canBeReady}
            loading={readyBusy}
          />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* Sealed activity feed — who added what about whom, never the content */}
      {(scene.activity || []).length > 0 && (
        <>
          <Text style={[type.label, styles.section]}>CREW ACTIVITY</Text>
          <View style={{ gap: 6 }}>
            {scene.activity.slice(0, 8).map((a) => (
              <View key={a.id} style={styles.feedRow}>
                <Text style={styles.feedWeek}>W{a.week}</Text>
                {a.memberId ? <Avatar id={members.find((m) => m.id === a.memberId)?.avatar} size={22} /> : <View style={{ width: 22 }} />}
                <Text style={styles.feedText}>{activityText(a, selfId)}</Text>
                <Text style={styles.feedTime}>{timeAgo(a.at)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Demo tools: only for testing / showcasing a whole semester in a few minutes */}
      <Pressable onPress={() => setDemoOpen((o) => !o)} style={{ marginTop: spacing.md }}>
        <Text style={styles.demoToggle}>{demoOpen ? "▾" : "▸"} Demo tools (for testing)</Text>
      </Pressable>
      {demoOpen && (
        <View style={styles.demoBox}>
          <PrimaryButton title={`Skip ahead a week (now week ${scene.week})`} variant="ghost" onPress={() => onDemo("demo_fast_forward")} />
          <PrimaryButton title="Add a test crewmate" variant="ghost" onPress={() => onDemo("demo_add_crewmate")} />
          <PrimaryButton title="Test crewmates add a memory" variant="ghost" onPress={() => onDemo("demo_sim_memories")} />
          <PrimaryButton title="Test crewmates get ready" variant="ghost" onPress={() => onDemo("demo_ready_others")} />
        </View>
      )}

      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.inviteCard} onPress={() => {}}>
            <Text style={type.label}>INVITE YOUR CREW</Text>
            <Text style={styles.inviteCode}>{scene.code}</Text>
            {link ? <Image source={{ uri: `${server ? (server.origin || `http://${server.ip}:${server.port}`) : ""}/api/qr?text=${encodeURIComponent(link)}` }} style={styles.qr} /> : null}
            <Text style={styles.inviteHint}>Friends scan this with their phone camera, or open the link below and type their name.</Text>
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
  code: { color: colors.text, fontWeight: "800", letterSpacing: 3, fontSize: 16 },
  invite: { marginLeft: "auto", color: colors.accent, fontWeight: "700" },
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
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: "rgba(255, 184, 76, 0.06)",
  },
  launchTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
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
