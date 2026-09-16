import React from "react";
import { View, Text, StyleSheet } from "react-native";
import RosterList from "../components/RosterList";
import { colors, spacing, type } from "../lib/theme";

export default function WaitingRoomScreen({ participants, selfId }) {
  const count = (participants || []).length;
  return (
    <View style={styles.wrap}>
      <Text style={type.title}>WAITING ROOM</Text>
      <Text style={type.muted}>
        {count} of 4 crew members have joined. Questions unlock once everyone's in.
      </Text>
      <View style={{ height: spacing.lg }} />
      <RosterList participants={participants} selfId={selfId} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
});
