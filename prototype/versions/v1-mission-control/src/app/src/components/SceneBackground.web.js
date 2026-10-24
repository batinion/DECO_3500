import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import StarPlaceholder from "./StarPlaceholder";
import { sceneUrl } from "../lib/server";

/**
 * The shared live scene (served by Mission Control at /scene) as a full-bleed,
 * non-interactive background layer. Web: an <iframe>. (Native uses react-native-webview.)
 * A static starfield sits underneath until the scene has loaded.
 */
export default function SceneBackground({ server }) {
  const [loadedUrl, setLoadedUrl] = useState(null);
  const url = server ? sceneUrl(server) : null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <StarPlaceholder />
      {url
        ? React.createElement("iframe", {
            key: url,
            src: url,
            title: "Mission Control scene",
            onLoad: () => setLoadedUrl(url),
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: 0,
              pointerEvents: "none",
              opacity: loadedUrl === url ? 1 : 0,
            },
          })
        : null}
    </View>
  );
}
