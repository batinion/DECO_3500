import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Modal, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import PrimaryButton from "./PrimaryButton";
import FriendPicker from "./FriendPicker";
import { colors, spacing, type } from "../lib/theme";
import { parseTemplate, templateHasName, templateBlankCount, ASK_MATES_LABEL, EXTRA_LABELS } from "../lib/prompts";
import { uploadPhoto } from "../lib/api";
import VoicePlayer from "./VoicePlayer";
import { mediaBlockedReason, webCameraSupported, openCameraStream, stopStream, snapshot } from "../lib/camera";
import { voiceSupported, startRecording, MAX_VOICE_SECONDS } from "../lib/voice";

/**
 * One memory capsule, opened. Fill the sentence, pick the crewmate, optionally attach a photo
 * from that moment, and drop it into the capsule.
 */
export default function PromptSheet({ visible, star, participants, onCollect, onClose, serverUrl, code, participantId, initial = null }) {
  const isFree = star?.kind === "free";
  const isImage = star?.kind === "image";
  const isVoice = star?.kind === "voice";
  const isSelfie = star?.kind === "selfie";
  const blankCount = isFree ? 1 : isImage || isVoice || isSelfie ? 0 : star ? templateBlankCount(star.template) : 0;
  // an ask prompt carries the crewmate picker in its instruction line, since its template may not name anyone
  const hasName = isFree || isImage || isVoice || isSelfie ? false : star ? templateHasName(star.ask || star.template) : false;

  const [filledText, setFilledText] = useState([]);
  const [aboutParticipantId, setAboutParticipantId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [images, setImages] = useState([]); // image capsule: the uploaded pictures
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [audio, setAudio] = useState(null); // voice capsule: the uploaded recording (server path)
  const [localUri, setLocalUri] = useState(null); // ...and the same recording on this device, for instant playback
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const recRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    // editing a loaded capsule starts from what was submitted
    setFilledText(initial?.filledText?.length ? [...initial.filledText] : Array(blankCount).fill(""));
    setAboutParticipantId(initial ? initial.aboutParticipantId || null : participants.length === 1 && hasName ? participants[0].id : null);
    setPhoto(initial?.photo || null);
    setImages(initial?.images ? [...initial.images] : []);
    setCaption(initial?.caption || "");
    setAudio(initial?.audio || null);
    setLocalUri(null);
    setSecs(0);
    setError(null);
  }, [visible, star?.id]);

  // closing the sheet mid-recording drops the recording and frees the mic (and the camera)
  useEffect(() => {
    if (visible) return;
    stopStream(streamRef.current);
    streamRef.current = null;
    setCameraOn(false);
    clearInterval(tickRef.current);
    recRef.current?.cancel();
    recRef.current = null;
    setRecording(false);
  }, [visible]);

  if (!star) return null;
  const plain = isFree || isImage || isVoice || isSelfie;
  const tokens = plain ? [] : parseTemplate(star.template);
  const askTokens = plain || !star.ask ? [] : parseTemplate(star.ask);
  const friendName = participants.find((p) => p.id === aboutParticipantId)?.name;

  function setBlank(index, value) {
    setFilledText((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  const filledAll = filledText.length === blankCount && filledText.every((t) => t && t.trim());
  const canAdd = isSelfie ? !!photo && !cameraOn && !uploading : isVoice ? !!audio && !recording && !uploading : isImage ? images.length > 0 && !uploading : filledAll && (!hasName || aboutParticipantId) && (!star?.needsPhoto || !!photo) && !uploading;

  async function uploadSelfie(asset) {
    setUploading(true);
    try {
      setPhoto(await uploadPhoto(serverUrl, { code, participantId, questionId: "group-selfie", asset }));
    } catch (e) {
      setError(e.message || "Couldn't save that picture.");
    } finally {
      setUploading(false);
    }
  }

  async function openCamera() {
    setError(null);
    if (Platform.OS !== "web") {
      // phones: the system camera
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setError("Allow camera access to take the selfie.");
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7, cameraType: ImagePicker.CameraType.front });
        if (result.canceled || !result.assets?.length) return;
        setLocalUri(result.assets[0].uri);
        await uploadSelfie({ uri: result.assets[0].uri, fileName: "selfie.jpg" });
      } catch (e) {
        setError(e.message || "Couldn't open the camera.");
      }
      return;
    }
    if (!webCameraSupported()) return setError(mediaBlockedReason("camera"));
    try {
      streamRef.current = await openCameraStream();
      setPhoto(null);
      setLocalUri(null);
      setCameraOn(true);
    } catch (e) {
      setError("Couldn't open the camera. Allow camera access and try again.");
    }
  }

  async function takePicture() {
    if (!videoRef.current) return;
    try {
      const { uri } = await snapshot(videoRef.current);
      stopStream(streamRef.current);
      streamRef.current = null;
      setCameraOn(false);
      setLocalUri(uri);
      await uploadSelfie({ uri, fileName: "selfie.jpg" });
    } catch (e) {
      setError(e.message || "Couldn't take the picture.");
    }
  }

  function closeCamera() {
    stopStream(streamRef.current);
    streamRef.current = null;
    setCameraOn(false);
  }

  async function beginRecording() {
    setError(null);
    if (!voiceSupported()) return setError(Platform.OS === "web" ? mediaBlockedReason("microphone") : "Voice notes need the web version for now.");
    try {
      recRef.current = await startRecording();
    } catch (e) {
      return setError("Couldn't use the microphone. Allow microphone access and try again.");
    }
    setAudio(null);
    setLocalUri(null);
    setSecs(0);
    setRecording(true);
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSecs(s);
      if (s >= MAX_VOICE_SECONDS) endRecording();
    }, 250);
  }

  async function endRecording() {
    clearInterval(tickRef.current);
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!rec) return;
    try {
      const { uri, ext } = await rec.stop();
      setLocalUri(uri);
      setUploading(true);
      setAudio(await uploadPhoto(serverUrl, { code, participantId, questionId: "voice-note", asset: { uri, fileName: `voice.${ext}` } }));
    } catch (e) {
      setError(e.message || "Couldn't save that recording.");
    } finally {
      setUploading(false);
    }
  }

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
      await onCollect({ filledText, aboutParticipantId, photo, images, caption, audio });
    } catch (e) {
      setError(e.message || "Couldn't add that memory.");
    } finally {
      setSending(false);
    }
  }

  const missing = isSelfie ? (cameraOn ? "Smile, then tap the shutter" : !photo ? "Take the selfie to add it" : null) : isVoice ? (recording ? "Tap stop when you're done" : !audio ? "Record a voice note to add it" : null) : isImage ? (images.length === 0 ? "Add at least one image" : null) : !filledAll ? "Fill in the blank to add it" : hasName && !aboutParticipantId ? "Pick which crewmate it's about" : star?.needsPhoto && !photo ? "Upload the photo to add it" : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap} pointerEvents="box-none">
          <BlurView intensity={55} tint="dark" style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
              <Text style={type.label}>{isSelfie ? "GROUP SELFIE" : isVoice ? "RECORD A VOICE NOTE" : isImage ? "ADD IMAGES FROM A MOMENT" : isFree ? "WRITE ANYTHING ABOUT YOUR CREW" : "FINISH THE SENTENCE ABOUT A CREWMATE"}</Text>

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
                ) : isSelfie ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <Text style={styles.voicePrompt}>{EXTRA_LABELS.selfie}</Text>
                    {cameraOn ? (
                      <>
                        {React.createElement("video", {
                          ref: (el) => {
                            videoRef.current = el;
                            if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
                          },
                          autoPlay: true,
                          playsInline: true,
                          muted: true,
                          style: { width: "100%", borderRadius: 14, backgroundColor: "#000", transform: "scaleX(-1)" },
                        })}
                        <View style={styles.voiceRow}>
                          <View style={{ flex: 1 }}>
                            <PrimaryButton title="📷  Take picture" onPress={takePicture} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <PrimaryButton title="Cancel" variant="dark" onPress={closeCamera} />
                          </View>
                        </View>
                      </>
                    ) : photo ? (
                      <>
                        <Image source={{ uri: localUri || `${serverUrl}${photo}` }} style={styles.selfieImg} resizeMode="cover" />
                        <Pressable onPress={openCamera} disabled={uploading}>
                          <Text style={styles.removePhoto}>{uploading ? "Saving…" : "Retake"}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <PrimaryButton title={uploading ? "Saving…" : "📷  Open camera"} onPress={openCamera} disabled={uploading} />
                    )}
                    <TextInput
                      style={styles.captionInput}
                      placeholder="Add a small caption (optional)"
                      placeholderTextColor={colors.muted}
                      value={caption}
                      onChangeText={setCaption}
                      maxLength={120}
                    />
                  </View>
                ) : isVoice ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <Text style={styles.voicePrompt}>{star.voicePrompt}</Text>
                    <View style={styles.voiceRow}>
                      <Pressable onPress={recording ? endRecording : beginRecording} disabled={uploading} style={[styles.micBtn, recording && styles.micBtnOn]} accessibilityLabel={recording ? "Stop recording" : "Start recording"}>
                        <Text style={styles.micIcon}>{recording ? "■" : "🎙️"}</Text>
                      </Pressable>
                      <Text style={styles.voiceStatus}>
                        {recording ? `Recording… ${secs}s` : uploading ? "Saving…" : audio ? "Recorded. Listen back or record again." : `Tap the mic to record (up to ${MAX_VOICE_SECONDS}s)`}
                      </Text>
                    </View>
                    {audio && !recording ? <VoicePlayer src={localUri || `${serverUrl}${audio}`} /> : null}
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
                  <>
                  {askTokens.length > 0 && (
                    <View style={[styles.sentence, { marginBottom: spacing.sm, zIndex: 30 }]}>
                      {askTokens.map((tok, i) =>
                        tok.type === "name" ? (
                          <FriendPicker key={i} participants={participants} value={aboutParticipantId} onChange={setAboutParticipantId} placeholder="pick a crewmate" />
                        ) : (
                          <Text key={i} style={[styles.sentenceText, styles.askText]}>{tok.value}</Text>
                        )
                      )}
                    </View>
                  )}
                  {star.askMates ? <Text style={[styles.sentenceText, { marginTop: spacing.md }]}>{ASK_MATES_LABEL}</Text> : null}
                  <View style={[styles.sentence, star.askMates && { marginTop: 0 }]}>
                    {tokens.map((tok, i) => {
                      if (tok.type === "text") return <Text key={i} style={styles.sentenceText}>{tok.value}</Text>;
                      if (tok.type === "name") {
                        // in an ask prompt the picker is already above, so the template just repeats the pick
                        if (star.ask) return <Text key={i} style={styles.sentenceText}>{friendName || "…"}</Text>;
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
                  </>
                )}

                {isFree && participants.length > 0 && (
                  <View style={styles.freeFriendRow}>
                    <Text style={type.muted}>About: </Text>
                    <FriendPicker participants={participants} value={aboutParticipantId} onChange={setAboutParticipantId} placeholder="the whole group" />
                  </View>
                )}

                {!isImage && !isVoice && !isSelfie && <View style={styles.photoRow}>
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
                  <PrimaryButton title={initial ? "Save changes" : "Load"} onPress={handleCollect} disabled={!canAdd} loading={sending} />
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.94)" },
  sheetWrap: { width: "100%", maxWidth: 480, alignItems: "center", justifyContent: "center", maxHeight: "94%" },
  sheet: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#05060f",
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  body: { flexGrow: 1, position: "relative", zIndex: 5, marginTop: spacing.sm },
  sentence: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: spacing.md, zIndex: 20 }, // above the photo row, so the crewmate list isn't covered by it
  sentenceText: { ...type.heading, color: "#ffffff", lineHeight: 30 },
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
  selfieImg: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: colors.panel },
  voicePrompt: { ...type.heading, lineHeight: 28 },
  askText: { color: "#d9def5", fontSize: 16 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  micBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  micBtnOn: { backgroundColor: "#d93a4c", borderColor: "#ff8896" },
  micIcon: { fontSize: 24, color: "#fff" },
  voiceStatus: { color: colors.text, fontSize: 14, flex: 1 },
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
