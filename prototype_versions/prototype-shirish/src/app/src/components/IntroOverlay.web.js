import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";

/** The 40-second mission-briefing clip (served by the server at /intro), full screen. Web: an iframe. */
export default function IntroOverlay({ serverUrl, onDone }) {
  useEffect(() => {
    function onMessage(e) {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "intro-done") onDone();
      } catch (err) {
        /* not ours */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onDone]);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: "#05060f" }]}>
      {React.createElement("iframe", {
        src: `${serverUrl}/intro`,
        title: "Mission briefing",
        allow: "autoplay",
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 },
      })}
    </View>
  );
}
