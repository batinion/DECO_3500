import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, TextInput, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import DrawingCanvas from "../components/DrawingCanvas";
import PrimaryButton from "../components/PrimaryButton";
import FriendPicker from "../components/FriendPicker";
import { colors, spacing, type } from "../lib/theme";
import { uploadDrawing, uploadPhoto } from "../lib/api";

/**
 * A sketch and/or photo memory, with a caption and (optionally) who it's of. Goes straight
 * into the capsule as its own memory — no longer a mandatory "page 2" of a form.
 */
export default function DrawUploadPage({ code, participantId, serverUrl, participants, week, onAddMemory, onBack }) {
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState("");
  const [aboutId, setAboutId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  async function handleAddPhoto() {
    setError(null);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return setError("Allow photo access to add a photo.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      setPhoto(await uploadPhoto(serverUrl, { code, participantId, questionId: "photo", asset: result.assets[0] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSending(true);
    try {
      let drawing = null;
      if (canvasRef.current && !canvasRef.current.isEmpty()) {
        const dataUrl = await canvasRef.current.exportPng();
        drawing = await uploadDrawing(serverUrl, { code, participantId, questionId: "drawing", dataUrl });
      }
      if (!drawing && !photo) throw new Error("Sketch something or add a photo first.");
      await onAddMemory({ kind: "media", text: caption.trim(), aboutId, photo, drawing });
      setDone(true);
      setPhoto(null);
      setCaption("");
      setAboutId(null);
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={type.label}>WEEK {week} · SKETCH OR PHOTO</Text>
        <Text style={type.title}>Capture a moment</Text>
        <Text style={[type.muted, { marginTop: spacing.sm }]}>
          A quick doodle of a crewmate, a photo of the whiteboard, the 2am pizza. Add a line so future-you knows what it was.
        </Text>

        {done && <Text style={styles.done}>✓ Dropped in the capsule. Add another, or head back.</Text>}

        <Text style={[type.label, { marginTop: spacing.lg }]}>SKETCH</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <DrawingCanvas key={canvasKey} ref={canvasRef} />
          <PrimaryButton title="Clear sketch" variant="ghost" onPress={() => canvasRef.current?.clear()} />
        </View>

        <Text style={[type.label, { marginTop: spacing.lg }]}>PHOTO</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {photo ? (
            <Pressable onPress={() => setPhoto(null)} style={styles.thumbWrap}>
              <Image source={{ uri: `${serverUrl}${photo}` }} style={styles.thumb} />
              <Text style={styles.removeLabel}>remove</Text>
            </Pressable>
          ) : (
            <PrimaryButton title="Add a photo" variant="ghost" onPress={handleAddPhoto} loading={uploading} />
          )}
        </View>

        <Text style={[type.label, { marginTop: spacing.lg }]}>WHAT'S THIS?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Ed asleep on the beanbag during crunch week"
          placeholderTextColor={colors.muted}
          value={caption}
          onChangeText={setCaption}
          multiline
        />
        {participants.length > 0 && (
          <View style={styles.aboutRow}>
            <Text style={type.muted}>Who's it of? </Text>
            <FriendPicker participants={participants} value={aboutId} onChange={setAboutId} placeholder="the whole group" />
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.nav}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Back" variant="ghost" onPress={onBack} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Drop in capsule" onPress={handleSubmit} loading={sending} disabled={uploading} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl, width: "100%", maxWidth: 560, alignSelf: "center" },
  done: { color: colors.lit, marginTop: spacing.md, fontWeight: "700" },
  thumbWrap: { alignItems: "flex-start" },
  thumb: { width: 120, height: 120, borderRadius: 10, backgroundColor: colors.panel },
  removeLabel: { color: colors.danger, fontSize: 11, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 10,
    padding: 12,
    minHeight: 60,
    marginTop: spacing.sm,
    textAlignVertical: "top",
  },
  aboutRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, zIndex: 10 },
  error: { color: colors.danger, marginTop: spacing.md },
  nav: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.sm },
});
