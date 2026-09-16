import React from "react";
import { View, Text, StyleSheet } from "react-native";
import RosterList from "../components/RosterList";
import { colors, spacing, type } from "../lib/theme";

export default function SubmittedWaitingScreen({ participants, selfId }) {
  const submittedCount = (participants || []).filter((p) => p.status === "submitted").length;
  const total = 4;
  return (
    <View style={styles.wrap}>
      <Text style={type.title}>SUBMITTED ✓</Text>
      <Text style={type.muted}>
        {submittedCount} of {total} crew members have submitted. Your engine is lit — hang tight for the rest of the crew.
      </Text>
      <View style={{ height: spacing.lg }} />
      <RosterList participants={participants} selfId={selfId} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
});
