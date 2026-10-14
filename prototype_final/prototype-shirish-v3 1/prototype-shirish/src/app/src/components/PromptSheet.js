import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Modal, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import PrimaryButton from "./PrimaryButton";
import FriendPicker from "./FriendPicker";
import { colors, spacing, type } from "../lib/theme";
import { parseTemplate, templateHasName, templateBlankCount } from "../lib/prompts";
import { uploadPhoto } from "../lib/api";

/**
 * One memory capsule, opened. Fill the sentence, pick the crewmate, optionally attach a photo
 * from that moment, and drop it into the capsule.
 */
export default function PromptSheet({ visible, star, participants, onCollect, onClose, serverUrl, code, participantId }) {
  const isFree = star?.kind === "free";
  const isImage = star?.kind === "image";
  const blankCount = isFree ? 1 : isImage ? 0 : star ? templateBlankCount(star.template) : 0;
  const hasName = isFree || isImage ? false : star ? templateHasName(star.template) : false;

  const [filledText, setFilledText] = useState([]);
  const [aboutParticipantId, setAboutParticipantId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [images, setImages] = useState([]); // image capsule: the uploaded pictures
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setFilledText(Array(blankCount).fill(""));
    setAboutParticipantId(participants.length === 1 && hasName ? participants[0].id : null);
    setPhoto(null);
    setImages([]);
    setCaption("");
    setError(null);
  }, [visible, star?.id]);

  if (!star) return null;
  const tokens = isFree || isImage ? [] : parseTemplate(star.template);

  function setBlank(index, value) {
    setFilledText((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  const filledAll = filledText.length === blankCount && filledText.every((t) => t && t.trim());
  const canAdd = isImage ? images.length > 0 && !uploading : filledAll && (!hasName || aboutParticipantId) && (!star?.needsPhoto || !!photo) && !uploading;

  async function addImages() {
    setError(null);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return setError("Allow photo access to add images.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6 });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      const urls = [];
      for (const asset of result.assets) urls.push(await uploadPhoto(serverUrl, { code, participantId, questionId: "memory-image", asset }));
      setImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch (e) {
      setError(e.message || "Couldn't add those images.");
    } finally {
      setUploading(false);
    }
  }

  async function addPhoto() {
    setError(null);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return setError("Allow photo access to attach a photo.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      const fileUrl = await uploadPhoto(serverUrl, { code, participantId, questionId: "memory-photo", asset: result.assets[0] });
      setPhoto(fileUrl);
    } catch (e) {
      setError(e.message || "Couldn't attach that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCollect() {
    setSending(true);
    setError(null);
    try {
      await onCollect({ filledText, aboutParticipantId, photo, images, caption });
    } catch (e) {
      setError(e.message || "Couldn't add that memory.");
    } finally {
      setSending(false);
    }
  }

  const missing = isImage ? (images.length === 0 ? "Add at least one image" : null) : !filledAll ? "Fill in the blank to add it" : hasName && !aboutParticipantId ? "Pick which crewmate it's about" : star?.needsPhoto && !photo ? "Upload the photo to add it" : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap} pointerEvents="box-none">
          <BlurView intensity={55} tint="dark" style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
              <Text style={type.label}>{isImage ? "ADD IMAGES FROM A MOMENT" : isFree ? "WRITE ANYTHING ABOUT YOUR CREW" : "FINISH THE SENTENCE ABOUT A CREWMATE"}</Text>

              <View style={styles.body}>
                {isImage ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <View style={styles.imageGrid}>
                      {images.map((u) => (
                        <View key={u} style={styles.imageCell}>
                          <Image source={{ uri: `${serverUrl}${u}` }} style={styles.imageThumb} />
                          <Pressable onPress={() => setImages((prev) => prev.filter((x) => x !== u))} style={styles.imageX} hitSlop={6}>
                            <Text style={styles.imageXText}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                      {images.length < 6 && (
                        <Pressable onPress={addImages} style={styles.imageAdd} disabled={uploading}>
                          <Text style={styles.imageAddIcon}>🖼️</Text>
                          <Text style={styles.photoBtnText}>{uploading ? "Adding…" : "Add images"}</Text>
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      style={styles.captionInput}
                      placeholder="What's in them? (optional)"
                      placeholderTextColor={colors.muted}
                      value={caption}
                      onChangeText={setCaption}
                    />
                    {participants.length > 0 && (
                      <View style={[styles.freeFriendRow, { marginTop: 0 }]}>
                        <Text style={type.muted}>About: </Text>
                        <FriendPicker participants={participants} value={aboutParticipantId} onChange={setAboutParticipantId} placeholder="the whole group" />
                      </View>
                    )}
                  </View>
                ) : isFree ? (
                  <TextInput
                    style={styles.freeInput}
                    multiline
                    placeholder="A moment, an inside joke, something you want them to read in twenty-four years…"
                    placeholderTextColor={colors.muted}
                    value={filledText[0] || ""}
                    onChangeText={(v) => setBlank(0, v)}
                    autoFocus
                  />
                ) : (
                  <View style={styles.sentence}>
                    {tokens.map((tok, i) => {
                      if (tok.type === "text") return <Text key={i} style={styles.sentenceText}>{tok.value}</Text>;
                      if (tok.type === "name") {
                        return <FriendPicker key={i} participants={participants} value={aboutParticipantId} onChange={setAboutParticipantId} placeholder="pick a crewmate" />;
                      }
                      return (
                        <TextInput
                          key={i}
                          style={styles.blankInput}
                          value={filledText[tok.index] || ""}
                          onChangeText={(v) => setBlank(tok.index, v)}
                          placeholder="…"
                          placeholderTextColor={colors.muted}
                          multiline
                        />
                      );
                    })}
                  </View>
                )}

                {isFree && participants.length > 0 && (
                  <View style={styles.freeFriendRow}>
                    <Text style={type.muted}>About: </Text>
                    <FriendPicker participants={participants} value={aboutParticipantId} onChange={setAboutParticipantId} placeholder="the whole group" />
                  </View>
                )}

                {!isImage && <View style={styles.photoRow}>
                  {photo ? (
                    <>
                      <Image source={{ uri: `${serverUrl}${photo}` }} style={styles.thumb} />
                      <Pressable onPress={() => setPhoto(null)}>
                        <Text style={styles.removePhoto}>Remove photo</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable onPress={addPhoto} style={styles.photoBtn} disabled={uploading}>
                      <Text style={styles.photoBtnText}>{uploading ? "Attaching…" : star?.needsPhoto ? "📷  Upload the photo (needed for this one)" : "📷  Attach a photo from that moment (optional)"}</Text>
                    </Pressable>
                  )}
                </View>}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : missing ? <Text style={styles.hint}>{missing}</Text> : null}

              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Back" variant="dark" onPress={onClose} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Load onto rocket" onPress={handleCollect} disabled={!canAdd} loading={sending} />
                </View>
              </View>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.md },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetWrap: { width: "100%", maxWidth: 480, alignItems: "center", justifyContent: "center", maxHeight: "94%" },
  sheet: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "rgba(22, 26, 46, 0.6)",
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  body: { flexGrow: 1, position: "relative", zIndex: 5, marginTop: spacing.sm },
  sentence: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: spacing.md },
  sentenceText: { ...type.heading, lineHeight: 30 },
  blankInput: {
    minWidth: 120,
    minHeight: 40,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  freeInput: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: colors.text,
    borderRadius: 10,
    padding: 12,
    marginTop: spacing.md,
    textAlignVertical: "top",
  },
  freeFriendRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, zIndex: 10 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageCell: { width: 76, height: 76 },
  imageThumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.panel },
  imageX: { position: "absolute", right: -6, top: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  imageXText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  imageAdd: { width: 76, height: 76, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.accent, alignItems: "center", justifyContent: "center", gap: 2 },
  imageAddIcon: { fontSize: 22 },
  captionInput: { borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.2)", backgroundColor: "rgba(255, 255, 255, 0.08)", color: colors.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg, zIndex: 1 },
  photoBtn: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  photoBtnText: { color: colors.muted, fontSize: 13 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.panel },
  removePhoto: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, zIndex: 1 },
});
