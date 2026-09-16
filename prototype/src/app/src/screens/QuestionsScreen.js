import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Image, ScrollView, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import PrimaryButton from "../components/PrimaryButton";
import DrawingCanvas from "../components/DrawingCanvas";
import { colors, spacing, type } from "../lib/theme";
import { uploadPhoto, uploadDrawing } from "../lib/api";
import { loadAnswerDraft, saveAnswerDraft } from "../lib/storage";

const PHOTO_LABEL = {
  photo: "Add a photo",
  slide: "Add the slide (photo or screenshot)",
};

export default function QuestionsScreen({ questions, code, participantId, serverUrl, onSubmit }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef(null);
  const loadedDraftFor = useRef(null);

  useEffect(() => {
    (async () => {
      const draft = await loadAnswerDraft(code, participantId);
      setAnswers(draft || {});
      loadedDraftFor.current = participantId;
    })();
  }, [code, participantId]);

  useEffect(() => {
    if (loadedDraftFor.current !== participantId) return; // don't clobber draft before it's loaded
    saveAnswerDraft(code, participantId, answers);
  }, [answers, code, participantId]);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const current = answers[question.id] || {};

  function patchAnswer(patch) {
    setAnswers((prev) => ({ ...prev, [question.id]: { ...prev[question.id], ...patch } }));
  }

  async function handleSaveDrawing() {
    if (canvasRef.current?.isEmpty()) {
      Alert.alert("Nothing drawn yet", "Sketch something first, then save.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await canvasRef.current.exportPng();
      const fileUrl = await uploadDrawing(serverUrl, { code, participantId, questionId: question.id, dataUrl });
      patchAnswer({ type: "drawing", fileUrl });
    } catch (e) {
      Alert.alert("Couldn't save sketch", e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleClearDrawing() {
    canvasRef.current?.clear();
    patchAnswer({ type: "drawing", fileUrl: null });
  }

  async function pickImage(fromCamera) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow access to continue.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });

    if (result.canceled || !result.assets?.length) return;

    setBusy(true);
    try {
      const fileUrl = await uploadPhoto(serverUrl, {
        code,
        participantId,
        questionId: question.id,
        asset: result.assets[0],
      });
      patchAnswer({ type: question.type, fileUrl });
    } catch (e) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (isLast) {
      setSubmitting(true);
      const fullAnswers = questions.map((q) => ({
        questionId: q.id,
        type: q.type,
        value: answers[q.id]?.value ?? null,
        fileUrl: answers[q.id]?.fileUrl ?? null,
        aboutParticipantId: q.aboutParticipantId ?? null,
      }));
      try {
        await onSubmit(fullAnswers);
      } finally {
        setSubmitting(false);
      }
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={type.label}>
        QUESTION {index + 1} OF {questions.length}
      </Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.md }}>
        <Text style={styles.prompt}>{question.prompt}</Text>

        {(question.type === "text" || question.type === "friend_text") && (
          <TextInput
            style={styles.textArea}
            multiline
            placeholder="Type your answer…"
            placeholderTextColor={colors.muted}
            value={current.value || ""}
            onChangeText={(v) => patchAnswer({ type: question.type, value: v })}
          />
        )}

        {question.type === "drawing" && (
          <View style={{ gap: spacing.sm }}>
            <DrawingCanvas ref={canvasRef} />
            <View style={styles.row}>
              <PrimaryButton title="Clear" variant="ghost" onPress={handleClearDrawing} />
              <PrimaryButton title={current.fileUrl ? "Saved ✓" : "Save sketch"} onPress={handleSaveDrawing} loading={busy} />
            </View>
          </View>
        )}

        {(question.type === "photo" || question.type === "slide") && (
          <View style={{ gap: spacing.sm }}>
            {current.fileUrl ? (
              <Image source={{ uri: `${serverUrl}${current.fileUrl}` }} style={styles.preview} />
            ) : null}
            <Text style={type.muted}>{PHOTO_LABEL[question.type]}</Text>
            <View style={styles.row}>
              {Platform.OS !== "web" && (
                <PrimaryButton title="Take photo" variant="ghost" onPress={() => pickImage(true)} loading={busy} />
              )}
              <PrimaryButton title="Choose from library" onPress={() => pickImage(false)} loading={busy} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.nav}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Back" variant="ghost" onPress={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={isLast ? "Submit" : "Next"} onPress={handleNext} loading={submitting} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl },
  prompt: { ...type.heading, marginBottom: spacing.md, lineHeight: 26 },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    textAlignVertical: "top",
  },
  preview: { width: "100%", height: 200, borderRadius: 12, backgroundColor: colors.panel },
  row: { flexDirection: "row", gap: spacing.sm },
  nav: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, paddingTop: spacing.sm },
});
