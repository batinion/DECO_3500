import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

/** A rescue activity (served by the server at /game/flight or /game/shared), full screen. Native: WebView. */
export default function GameFrame({ serverUrl, kind, code, participantId }) {
  const uri = `${serverUrl}/game/${kind}?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(participantId)}`;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: "#05060f" }]}>
      <WebView
        key={uri}
        source={{ uri }}
        style={{ flex: 1, backgroundColor: "#05060f" }}
        javaScriptEnabled
        originWhitelist={["*"]}
        mixedContentMode="always"
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}
