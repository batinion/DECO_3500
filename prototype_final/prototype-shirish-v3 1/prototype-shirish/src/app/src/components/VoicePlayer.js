import React from "react";
import { Platform, Text, View } from "react-native";
import { colors } from "../lib/theme";

/** Plays a voice note. Web only for now; phones show a note instead. */
export default function VoicePlayer({ src, dark = false }) {
  if (!src) return null;
  if (Platform.OS === "web") {
    return <View style={{ width: "100%", marginVertical: 8 }}>{React.createElement("audio", { src, controls: true, preload: "metadata", style: { width: "100%", height: 38 } })}</View>;
  }
  return <Text style={{ color: dark ? "#222" : colors.muted, fontSize: 12, marginVertical: 8 }}>🎙️ Voice note (play it in the web version)</Text>;
}
