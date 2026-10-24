import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, type } from "../lib/theme";

/** Scans the Mission Control join QR code, which encodes JSON: { ip, port, code }. */
export default function QRScanner({ onScanned, onCancel }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View style={styles.center}>
        <Text style={type.muted}>QR scanning isn't available in the web preview — use manual entry below.</Text>
        <Pressable style={styles.linkBtn} onPress={onCancel}>
          <Text style={{ color: colors.accent }}>Back to manual entry</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={type.body}>Camera access is needed to scan the join code.</Text>
        <Pressable style={styles.linkBtn} onPress={requestPermission}>
          <Text style={{ color: colors.accent }}>Grant camera permission</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={onCancel}>
          <Text style={{ color: colors.muted }}>Use manual entry instead</Text>
        </Pressable>
      </View>
    );
  }

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const parsed = JSON.parse(data);
      if (parsed.ip && parsed.port && parsed.code) {
        onScanned(parsed);
        return;
      }
    } catch (e) {
      // fall through to error reset below
    }
    setScanned(false);
  };

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.frame} />
      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Text style={{ color: "#fff" }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  cameraWrap: { height: 320, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  frame: {
    position: "absolute",
    top: "20%",
    left: "20%",
    right: "20%",
    bottom: "20%",
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 12,
  },
  cancelBtn: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  linkBtn: { paddingVertical: 6 },
});
