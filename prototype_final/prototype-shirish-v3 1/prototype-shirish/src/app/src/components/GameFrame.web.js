import React from "react";
import { View, StyleSheet } from "react-native";

/** A rescue activity (served by the server at /game/flight or /game/shared), full screen. Web: an iframe. */
export default function GameFrame({ serverUrl, kind, code, participantId }) {
  const src = `${serverUrl}/game/${kind}?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(participantId)}`;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: "#05060f" }]}>
      {React.createElement("iframe", {
        key: src,
        src,
        title: "Rescue mission",
        allow: "autoplay",
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 },
      })}
    </View>
  );
}
