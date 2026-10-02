import React from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { colors, spacing, type } from "../lib/theme";

/** Your own memories so far. Only you can see these until the capsule opens. */
export default function MyMemoriesScreen({ memories, serverUrl, onRemove, onBack }) {
  const abs = (u) => (u && u.startsWith("/") ? `${serverUrl}${u}` : u);
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>ONLY YOU CAN SEE THESE UNTIL LAUNCH</Text>
      <Text style={type.title}>My memories</Text>
      <ScrollView style={{ flex: 1, marginTop: spacing.md }} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        {memories.length === 0 && <Text style={type.muted}>Nothing yet. Head to the Memory Stars and drop one in.</Text>}
        {memories.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.week}>WEEK {m.week}</Text>
              <Text style={styles.about}>{m.aboutName ? `about ${m.aboutName}` : "about the group"}</Text>
              <Pressable onPress={() => onRemove(m.id)} hitSlop={8} style={{ marginLeft: "auto" }}>
                <Text style={styles.remove}>Take out</Text>
              </Pressable>
            </View>
            {m.text ? <Text style={styles.text}>{m.text}</Text> : null}
            {(m.photo || m.drawing) && (
              <View style={styles.media}>
                {m.drawing ? <Image source={{ uri: abs(m.drawing) }} style={styles.img} /> : null}
                {m.photo ? <Image source={{ uri: abs(m.photo) }} style={styles.img} /> : null}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <PrimaryButton title="Back to crew" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl, width: "100%", maxWidth: 560, alignSelf: "center" },
  card: { backgroundColor: "rgba(16, 19, 35, 0.9)", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  week: { color: colors.lit, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  about: { color: colors.muted, fontSize: 12 },
  remove: { color: colors.danger, fontSize: 12 },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  media: { flexDirection: "row", gap: spacing.sm },
  img: { width: 96, height: 96, borderRadius: 10, backgroundColor: colors.panel },
});
