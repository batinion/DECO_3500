import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";
import Avatar from "../components/Avatar";

/**
 * The opened capsule, on everyone's own screen: the semester replayed week by week, with a
 * few "awards" up top to get the crew talking. Filter to memories about you, by you, or
 * about any one crewmate.
 */
export default function CapsuleScreen({ capsule, serverUrl, selfId }) {
  const [filter, setFilter] = useState("all");
  const abs = (u) => (u && u.startsWith("/") ? `${serverUrl}${u}` : u);
  const members = capsule?.members || [];
  const h = capsule?.highlights || {};

  const shown = useMemo(() => {
    const all = capsule?.memories || [];
    if (filter === "all") return all;
    if (filter === "about-me") return all.filter((m) => m.aboutId === selfId);
    if (filter === "by-me") return all.filter((m) => m.authorId === selfId);
    return all.filter((m) => m.aboutId === filter);
  }, [capsule, filter, selfId]);

  const byWeek = useMemo(() => {
    const groups = [];
    shown.forEach((m) => {
      const last = groups[groups.length - 1];
      if (last && last.week === m.week) last.items.push(m);
      else groups.push({ week: m.week, items: [m] });
    });
    return groups;
  }, [shown]);

  const avatarOf = (id) => members.find((m) => m.id === id)?.avatar;
  const colorOf = (id) => members.find((m) => m.id === id)?.colors?.[0]?.hex || colors.accent;
  const filters = [
    ["all", "Everything"],
    ["about-me", "About me"],
    ["by-me", "By me"],
    ...members.filter((m) => m.id !== selfId).map((m) => [m.id, `About ${m.name}`]),
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[type.label, { textAlign: "center" }]}>THREE YEARS LATER</Text>
      <Text style={[type.title, styles.title]}>THE CAPSULE IS OPEN</Text>

      <View style={styles.awards}>
        <Award label="Memories" value={String(h.total || 0)} sub={`across ${h.weeksCovered || 0} weeks`} />
        {h.mostRemembered && <Award label="Most remembered" value={h.mostRemembered.name} sub={`in ${h.mostRemembered.count} memories`} />}
        {h.chiefHistorian && <Award label="Crew historian" value={h.chiefHistorian.name} sub={`wrote ${h.chiefHistorian.count}`} />}
        {h.busiestWeek && <Award label="Busiest week" value={`Week ${h.busiestWeek.week}`} sub={`${h.busiestWeek.count} memories`} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={[styles.chip, filter === key && styles.chipOn]}>
            <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {byWeek.length === 0 && <Text style={[type.muted, { textAlign: "center" }]}>Nothing here.</Text>}
      {byWeek.map((g) => (
        <View key={`${g.week}-${g.items[0].id}`} style={styles.weekGroup}>
          <Text style={styles.weekLabel}>WEEK {g.week}</Text>
          {g.items.map((m) => (
            <View key={m.id} style={[styles.card, { borderLeftColor: colorOf(m.authorId) }]}>
              {m.text ? <Text style={styles.text}>{m.text}</Text> : null}
              {(m.photo || m.drawing) && (
                <View style={styles.media}>
                  {m.drawing ? <Image source={{ uri: abs(m.drawing) }} style={styles.img} /> : null}
                  {m.photo ? <Image source={{ uri: abs(m.photo) }} style={styles.img} /> : null}
                </View>
              )}
              <View style={styles.bylineRow}>
                <Avatar id={avatarOf(m.authorId)} size={26} />
                <Text style={styles.byline}>
                  {m.authorId === selfId ? "you" : m.authorName}
                  {m.aboutName ? ` → ${m.aboutId === selfId ? "you" : m.aboutName}` : " → the group"}
                </Text>
                {m.aboutId ? <Avatar id={avatarOf(m.aboutId)} size={26} expr={m.aboutId === selfId ? "wow" : "default"} /> : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function Award({ label, value, sub }) {
  return (
    <View style={styles.award}>
      <Text style={styles.awardLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.awardValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.awardSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md, width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { textAlign: "center", color: colors.lit },
  awards: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  award: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "rgba(16, 19, 35, 0.9)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  awardLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1.2 },
  awardValue: { color: colors.lit, fontSize: 20, fontWeight: "800", marginTop: 2 },
  awardSub: { color: colors.muted, fontSize: 12 },
  filters: { gap: 6, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(16,19,35,0.85)" },
  chipOn: { backgroundColor: colors.lit, borderColor: colors.lit },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextOn: { color: "#0a0c18", fontWeight: "700" },
  weekGroup: { gap: spacing.sm },
  weekLabel: { color: colors.lit, fontSize: 12, fontWeight: "800", letterSpacing: 2, marginTop: spacing.sm },
  card: {
    backgroundColor: "rgba(16, 19, 35, 0.9)",
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: spacing.md,
    gap: 8,
  },
  text: { color: colors.text, fontSize: 16, lineHeight: 23 },
  media: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  img: { width: 140, height: 140, borderRadius: 10, backgroundColor: colors.panel },
  byline: { color: colors.muted, fontSize: 12 },
  bylineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
