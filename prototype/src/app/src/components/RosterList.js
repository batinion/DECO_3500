import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, type } from "../lib/theme";

const STATUS_LABEL = {
  waiting: "waiting",
  answering: "answering",
  submitted: "submitted ✓",
};

export default function RosterList({ participants, selfId }) {
  const slots = [1, 2, 3, 4];
  const bySlot = {};
  (participants || []).forEach((p) => (bySlot[p.engineSlot] = p));

  return (
    <View style={styles.wrap}>
      {slots.map((slot) => {
        const p = bySlot[slot];
        return (
          <View key={slot} style={[styles.row, p?.status === "submitted" && styles.rowLit]}>
            <View style={[styles.badge, p && styles.badgeFilled]}>
              <Text style={styles.badgeText}>{slot}</Text>
            </View>
            <Text style={[type.body, !p && { color: colors.muted }]}>
              {p ? p.name : "Waiting to join…"}
              {p && p.id === selfId ? " (you)" : ""}
            </Text>
            {p ? <Text style={styles.status}>{STATUS_LABEL[p.status] || p.status}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowLit: { borderColor: colors.lit },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2a2f4a",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeFilled: { backgroundColor: colors.accent },
  badgeText: { color: "#0a0c18", fontSize: 12, fontWeight: "700" },
  status: { marginLeft: "auto", color: colors.muted, fontSize: 12 },
});
