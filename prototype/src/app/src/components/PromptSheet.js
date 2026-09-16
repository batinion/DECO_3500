import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Modal, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { BlurView } from "expo-blur";
import PrimaryButton from "./PrimaryButton";
import FriendPicker from "./FriendPicker";
import { colors, spacing, type } from "../lib/theme";
import { parseTemplate, templateHasName, templateBlankCount } from "../lib/prompts";

export default function PromptSheet({ visible, star, participants, initialValue, onCollect, onClose }) {
  const isFree = star?.kind === "free";
  const blankCount = isFree ? 1 : star ? templateBlankCount(star.template) : 0;
  const hasName = isFree ? false : star ? templateHasName(star.template) : false;

  const [filledText, setFilledText] = useState(Array(blankCount).fill(""));
  const [aboutParticipantId, setAboutParticipantId] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setFilledText(initialValue?.filledText?.length ? initialValue.filledText : Array(blankCount).fill(""));
    setAboutParticipantId(initialValue?.aboutParticipantId ?? null);
  }, [visible, star?.id]);

  if (!star) return null;

  const tokens = isFree ? [] : parseTemplate(star.template);

  function setBlank(index, value) {
    setFilledText((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleCollect() {
    onCollect({ filledText, aboutParticipantId });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
        <BlurView intensity={55} tint="dark" style={styles.sheet}>
          <Text style={type.label}>{isFree ? "WRITE ANYTHING" : "FILL IN THE BLANK"}</Text>

          <View style={styles.body}>
            {isFree ? (
              <TextInput
                style={styles.freeInput}
                multiline
                placeholder="Write anything you want to add…"
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
                    return (
                      <FriendPicker
                        key={i}
                        participants={participants}
                        value={aboutParticipantId}
                        onChange={setAboutParticipantId}
                      />
                    );
                  }
                  return (
                    <TextInput
                      key={i}
                      style={styles.blankInput}
                      value={filledText[tok.index] || ""}
                      onChangeText={(v) => setBlank(tok.index, v)}
                      multiline
                    />
                  );
                })}
              </View>
            )}

            {isFree && (
              <View style={styles.freeFriendRow}>
                <Text style={type.muted}>Optionally, about: </Text>
                <FriendPicker
                  participants={participants}
                  value={aboutParticipantId}
                  onChange={setAboutParticipantId}
                  placeholder="no one in particular"
                />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Back to stars" variant="dark" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Add" onPress={handleCollect} />
            </View>
          </View>
        </BlurView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.md },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetWrap: { width: "100%", maxWidth: 480, alignItems: "center", justifyContent: "center" },
  sheet: {
    width: "100%",
    minHeight: 380,
    overflow: "hidden",
    backgroundColor: "rgba(22, 26, 46, 0.38)",
    borderRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xl,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  body: {
    flexGrow: 1,
    position: "relative",
    zIndex: 5,
    marginTop: spacing.sm,
  },
  sentence: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: spacing.md,
  },
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
    minHeight: 180,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: colors.text,
    borderRadius: 10,
    padding: 12,
    marginTop: spacing.md,
    textAlignVertical: "top",
  },
  freeFriendRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    position: "relative",
    zIndex: 1,
  },
});
