import React from "react";
import { View, Text, Modal, Image, StyleSheet, ScrollView } from "react-native";
import PrimaryButton from "./PrimaryButton";
import { colors, spacing, type } from "../lib/theme";

/**
 * Shown when someone taps "Done for now": exactly what they sent this visit, and plainly what happens
 * to it. Testers wanted to know what they'd submitted and where it goes.
 *
 * Prototype note: while testing, the server runs on a laptop and keeps uploads in
 * server/submissions + server/data. The wording describes the hosted version.
 */
export default function PrivacyCard({ memories, serverUrl, onDone }) {
  if (!memories || memories.length === 0) return null;
  const abs = (u) => (u && u.startsWith("/") ? `${serverUrl}${u}` : u);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
            <Text style={styles.kicker}>✓ LOADED ONTO THE ROCKET</Text>
            <Text style={styles.title}>Here's what you sent</Text>

            {memories.map((memory, i) => (
              <View key={i} style={styles.preview}>
                {memory.text ? <Text style={styles.text}>{memory.text}</Text> : null}
                {(memory.photo || memory.drawing) && (
                  <View style={styles.media}>
                    {memory.drawing ? <Image source={{ uri: abs(memory.drawing) }} style={styles.img} /> : null}
                    {memory.photo ? <Image source={{ uri: abs(memory.photo) }} style={styles.img} /> : null}
                  </View>
                )}
                <Text style={styles.about}>About: {memory.aboutName || "the whole group"}</Text>
              </View>
            ))}

            <View style={styles.points}>
              <Point icon="🔒" text="Sealed. Nobody can read it until your crew opens the capsule together." />
              <Point icon="☁️" text="Your words and pictures are uploaded to the Launch Sequence cloud for this prototype test only." />
              <Point icon="🚫" text="They're never shared outside your crew or used for anything else." />
              <Point icon="↩️" text="Changed your mind? Take it out any time in “My memories”, until launch." />
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Done" onPress={onDone} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Point({ icon, text }) {
  return (
    <View style={styles.point}>
      <Text style={styles.pointIcon}>{icon}</Text>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.md },
  card: { width: "100%", maxWidth: 440, maxHeight: "94%", backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.lg, gap: spacing.md },
  kicker: { color: colors.lit, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { ...type.heading, fontSize: 20 },
  preview: { backgroundColor: colors.panel, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: colors.lit, padding: spacing.md, gap: 8 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  about: { color: colors.muted, fontSize: 12 },
  media: { flexDirection: "row", gap: spacing.sm },
  img: { width: 90, height: 90, borderRadius: 10, backgroundColor: colors.bg },
  points: { gap: 8, marginTop: spacing.xs },
  point: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  pointIcon: { fontSize: 15, width: 22, textAlign: "center" },
  pointText: { color: colors.text, fontSize: 13, lineHeight: 18, flex: 1 },
  actions: { flexDirection: "row", gap: spacing.sm },
});
