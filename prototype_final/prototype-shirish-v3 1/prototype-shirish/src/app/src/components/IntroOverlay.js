import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

/** The 40-second mission-briefing clip (served by the server at /intro), full screen. */
export default function IntroOverlay({ serverUrl, onDone }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        source={{ uri: `${serverUrl}/intro` }}
        style={{ flex: 1, backgroundColor: "#05060f" }}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        onMessage={(e) => {
          try {
            if (JSON.parse(e.nativeEvent.data).type === "intro-done") onDone();
          } catch (err) {
            /* ignore */
          }
        }}
      />
    </View>
  );
}
