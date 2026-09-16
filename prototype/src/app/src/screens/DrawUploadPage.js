import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import DrawingCanvas from "../components/DrawingCanvas";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";
import { uploadDrawing, uploadPhoto } from "../lib/api";

export default function DrawUploadPage({
  code,
  participantId,
  serverUrl,
  drawingFileUrl,
  onDrawingChange,
  uploadedImages,
  onImagesChange,
  onBack,
  onSubmit,
  submitting,
}) {
  const canvasRef = useRef(null);
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);

  async function handleSaveDrawing() {
    if (canvasRef.current?.isEmpty()) {
      Alert.alert("Nothing drawn yet", "Sketch something first, then save.");
      return;
    }
    setSavingDrawing(true);
    try {
      const dataUrl = await canvasRef.current.exportPng();
      const fileUrl = await uploadDrawing(serverUrl, { code, participantId, questionId: "drawing", dataUrl });
      onDrawingChange(fileUrl);
    } catch (e) {
      Alert.alert("Couldn't save sketch", e.message);
    } finally {
      setSavingDrawing(false);
    }
  }

  function handleClearDrawing() {
    canvasRef.current?.clear();
    onDrawingChange(null);
  }

  async function handleAddPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo access to continue.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (result.canceled || !result.assets?.length) return;

    setAddingPhoto(true);
    try {
      const fileUrl = await uploadPhoto(serverUrl, { code, participantId, questionId: "photo", asset: result.assets[0] });
      onImagesChange([...uploadedImages, fileUrl]);
    } catch (e) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setAddingPhoto(false);
    }
  }

  function removeImage(fileUrl) {
    onImagesChange(uploadedImages.filter((u) => u !== fileUrl));
  }

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
        <Text style={type.label}>PAGE 2 OF 2 · OPTIONAL</Text>
        <Text style={type.title}>DRAW + UPLOAD</Text>
        <Text style={[type.muted, { marginTop: spacing.sm }]}>
          Sketch something and add a photo if you'd like — or skip straight to Submit.
        </Text>

        <Text style={[type.label, { marginTop: spacing.xl }]}>SKETCH</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <DrawingCanvas ref={canvasRef} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Clear" variant="ghost" onPress={handleClearDrawing} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={drawingFileUrl ? "Saved ✓" : "Save sketch"} onPress={handleSaveDrawing} loading={savingDrawing} />
            </View>
          </View>
        </View>

        <Text style={[type.label, { marginTop: spacing.xl }]}>PHOTOS</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {uploadedImages.length > 0 && (
            <View style={styles.gallery}>
              {uploadedImages.map((url) => (
                <Pressable key={url} onPress={() => removeImage(url)} style={styles.thumbWrap}>
                  <Image source={{ uri: `${serverUrl}${url}` }} style={styles.thumb} />
                  <Text style={styles.removeLabel}>remove</Text>
                </Pressable>
              ))}
            </View>
          )}
          <PrimaryButton title="Add a photo" variant="ghost" onPress={handleAddPhoto} loading={addingPhoto} />
        </View>
      </ScrollView>

      <View style={styles.nav}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Back to stars" variant="ghost" onPress={onBack} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Submit" onPress={onSubmit} loading={submitting} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  row: { flexDirection: "row", gap: spacing.sm },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumbWrap: { alignItems: "center" },
  thumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: colors.panel },
  removeLabel: { color: colors.danger, fontSize: 11, marginTop: 4 },
  nav: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.sm },
});
