import React from "react";
import { View, Text } from "react-native";
import CrewPanel from "../components/CrewPanel";
import RosterList from "../components/RosterList";
import { spacing, type } from "../lib/theme";

/** Compact crew-progress panel over the live scene — mirrors Mission Control's crew HUD. */
export default function SubmittedWaitingScreen({ participants, selfId }) {
  const submittedCount = (participants || []).filter((p) => p.status === "submitted").length;
  return (
    <CrewPanel>
      <View>
        <Text style={type.heading}>SUBMITTED ✓</Text>
        <Text style={[type.muted, { marginTop: spacing.xs }]}>{submittedCount} of 4 submitted — waiting on the rest of the crew</Text>
        <View style={{ height: spacing.md }} />
        <RosterList participants={participants} selfId={selfId} />
      </View>
    </CrewPanel>
  );
}
