import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Modal, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import FriendPicker from "./FriendPicker";
import { spacing } from "../lib/theme";
import { GREEN, DIM, WHITE, BLACK, MONO } from "./TerminalPanel";
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
        <View style={styles.sheet}>
          <Text style={styles.title}>C:\LAUNCH_SEQUENCE&gt; {isFree ? "WRITE_ANYTHING" : "FILL_IN_THE_BLANK"}</Text>

          <View style={styles.body}>
            {isFree ? (
              <TextInput
                style={styles.freeInput}
                multiline
                placeholder="Write anything you want to add…"
                placeholderTextColor={DIM}
                selectionColor={GREEN}
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
                <Text style={styles.hint}>Optionally, about: </Text>
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
              <Pressable style={styles.btn} onPress={onClose}>
                <Text style={styles.btnText}>[ &lt; BACK ]</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleCollect}>
                <Text style={[styles.btnText, { color: WHITE }]}>[ ADD &gt; ]</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.md },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheetWrap: { width: "100%", maxWidth: 480, alignItems: "center", justifyContent: "center" },
  sheet: {
    width: "100%",
    minHeight: 340,
    backgroundColor: BLACK,
    padding: spacing.lg,
    maxHeight: "92%",
    borderWidth: 2,
    borderColor: GREEN,
  },
  title: { fontFamily: MONO, color: WHITE, fontSize: 13, fontWeight: "700" },
  hint: { fontFamily: MONO, color: GREEN, fontSize: 13 },
  btn: { borderWidth: 1, borderColor: GREEN, paddingVertical: 11, alignItems: "center", backgroundColor: BLACK },
  btnPrimary: { backgroundColor: "#04210d" },
  btnText: { fontFamily: MONO, color: GREEN, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
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
  sentenceText: { fontFamily: MONO, color: GREEN, fontSize: 17, fontWeight: "700", lineHeight: 30 },
  blankInput: {
    minWidth: 120,
    minHeight: 40,
    borderBottomWidth: 2,
    borderBottomColor: GREEN,
    backgroundColor: "#04210d",
    color: WHITE,
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  freeInput: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: BLACK,
    color: WHITE,
    fontFamily: MONO,
    borderRadius: 0,
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
