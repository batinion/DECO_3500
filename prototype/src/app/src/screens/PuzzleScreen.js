import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Alert, Image } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";
import { uploadPuzzleAnswer } from "../lib/api";

export default function PuzzleScreen({ puzzleUrl, code, participantId, serverUrl, missionColors, onAnswerUploaded }) {
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);

  async function doUpload(asset, { isImage }) {
    setBusy(true);
    try {
      const fileUrl = await uploadPuzzleAnswer(serverUrl, { code, participantId, asset });
      if (isImage) setPreviewUri(asset.uri);
      onAnswerUploaded?.(fileUrl);
    } catch (e) {
      Alert.alert("Couldn't upload", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo access to continue.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets[0];
    await doUpload({ uri: picked.uri, name: picked.fileName || "answer.jpg", mimeType: picked.mimeType || "image/jpeg" }, { isImage: true });
  }

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets[0];
    const isImage = (picked.mimeType || "").startsWith("image/");
    await doUpload({ uri: picked.uri, name: picked.name || "answer", mimeType: picked.mimeType }, { isImage });
  }

  return (
    <View style={styles.wrap}>
      <Text style={type.label}>THE CAPSULE REOPENS</Text>
      <Text style={type.title}>SOLVE THE PUZZLE</Text>
      <Text style={[type.muted, { marginTop: spacing.sm }]}>
        Work it out together as a crew, then have just one of you upload the answer below.
      </Text>

      {missionColors?.length ? (
        <View style={styles.colorsRow}>
          <Text style={styles.colorsLabel}>Your mission key</Text>
          <View style={styles.swatchRow}>
            {missionColors.map((c) => (
              <View key={c.hex} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                <Text style={styles.swatchName}>{c.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable style={styles.linkBox} onPress={() => Linking.openURL(puzzleUrl)}>
        <Text style={styles.linkText}>Click here to solve the puzzle</Text>
        <Text style={styles.linkUrl}>{puzzleUrl}</Text>
      </Pressable>

      <View style={{ height: spacing.xl }} />

      <Text style={type.label}>UPLOAD THE ANSWER</Text>
      <Text style={[type.muted, { marginBottom: spacing.sm }]}>
        Only one of you needs to do this — it counts for the whole crew.
      </Text>

      {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : null}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Choose a photo" onPress={handlePickImage} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Choose a file" variant="ghost" onPress={handlePickFile} loading={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  linkBox: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: spacing.md,
  },
  linkText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  linkUrl: { color: colors.muted, fontSize: 12, marginTop: 4 },
  colorsRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: spacing.md,
  },
  colorsLabel: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  swatchRow: { flexDirection: "row", gap: spacing.sm },
  swatchWrap: { alignItems: "center" },
  swatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  swatchName: { color: colors.muted, fontSize: 10, marginTop: 3 },
  preview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: colors.panel, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
});
