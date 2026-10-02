import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import StarPlaceholder from "./StarPlaceholder";
import { sceneUrl } from "../lib/server";
import { colors } from "../lib/theme";

/**
 * The shared live scene (served by Mission Control at /scene) as a full-bleed,
 * non-interactive background layer. Native: react-native-webview (works in Expo Go).
 * A static starfield sits underneath until the scene has loaded.
 */
export default function SceneBackground({ server }) {
  const [loadedUrl, setLoadedUrl] = useState(null);
  const url = server ? sceneUrl(server) : null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <StarPlaceholder />
      {url ? (
        <WebView
          key={url}
          source={{ uri: url }}
          style={[styles.web, { opacity: loadedUrl === url ? 1 : 0 }]}
          onLoadEnd={() => setLoadedUrl(url)}
          onError={() => setLoadedUrl(null)}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled
          originWhitelist={["*"]}
          mixedContentMode="always"
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
});
