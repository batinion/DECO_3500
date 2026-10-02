import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import Avatar from "../components/Avatar";
import { CHARACTERS } from "../lib/avatars";
import { colors, spacing, type } from "../lib/theme";

const STEPS = [
  ["1", "Start a crew with your DECO group, or join with their code."],
  ["2", "All semester, drop in memories about each other — whenever something happens."],
  ["3", "They stay sealed. When everyone's ready, the rocket launches."],
  ["4", "Years later, it comes home and you open it together."],
];

/**
 * Start-or-join form, shown over the live scene. There's no host: whoever starts the crew
 * just gets a code to share, and everyone has the same controls from then on.
 */
export default function JoinScreen({ onCreate, onJoin, busy, error, initialCode, needsServer, initialServer, onServerChange, onWatchIntro }) {
  const [mode, setMode] = useState(initialCode ? "join" : "create");
  const [name, setName] = useState("");
  const [crewName, setCrewName] = useState("");
  const [code, setCode] = useState(initialCode || "");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4000");
  const [showServer, setShowServer] = useState(false);
  const [avatar, setAvatar] = useState(() => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id);

  useEffect(() => {
    if (!initialServer || initialServer.origin) return;
    setIp((cur) => cur || String(initialServer.ip));
    setPort(String(initialServer.port));
  }, [initialServer]);

  useEffect(() => {
    if (needsServer) onServerChange?.({ ip: ip.trim(), port: port.trim() });
  }, [ip, port, needsServer]);

  const serverOk = !needsServer || (ip.trim() && port.trim());
  const canGo = name.trim() && serverOk && (mode === "create" || code.trim().length >= 4);

  function submit() {
    const server = needsServer ? { ip: ip.trim(), port: port.trim() } : null;
    if (mode === "create") onCreate({ name: name.trim(), crewName: crewName.trim(), server, avatar });
    else onJoin({ name: name.trim(), code: code.trim().toUpperCase(), server, avatar });
  }

  return (
    <View style={styles.form}>
      <Text style={type.label}>LAUNCH SEQUENCE</Text>
      <Text style={styles.title}>A time capsule for your crew</Text>

      {onWatchIntro ? (
        <Pressable onPress={onWatchIntro} style={styles.watch}>
          <Text style={styles.watchIcon}>▶</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.watchTitle}>Watch the mission briefing</Text>
            <Text style={styles.watchSub}>40 seconds · sound on 🔊</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.steps}>
        {STEPS.map(([n, text]) => (
          <View key={n} style={styles.step}>
            <Text style={styles.stepNum}>{n}</Text>
            <Text style={styles.stepText}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tabs}>
        {[
          ["create", "Start a crew"],
          ["join", "Join a crew"],
        ].map(([key, label]) => (
          <Pressable key={key} onPress={() => setMode(key)} style={[styles.tab, mode === key && styles.tabOn]}>
            <Text style={[styles.tabText, mode === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={type.label}>YOUR NAME</Text>
      <TextInput
        style={styles.input}
        placeholder="The name your crew knows you by"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
      />

      <Text style={type.label}>PICK YOUR ASTRONAUT</Text>
      <View style={styles.avatars}>
        {CHARACTERS.map((c) => {
          const on = c.id === avatar;
          return (
            <Pressable key={c.id} onPress={() => setAvatar(c.id)} style={[styles.avatarBtn, on && { borderColor: c.suit, backgroundColor: "rgba(255,255,255,0.08)" }]}>
              <Avatar id={c.id} size={44} expr={on ? "yay" : "default"} />
              <Text style={[styles.avatarName, on && { color: colors.text }]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "create" ? (
        <>
          <Text style={type.label}>CREW NAME (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. DECO studio group 4"
            placeholderTextColor={colors.muted}
            value={crewName}
            onChangeText={setCrewName}
          />
        </>
      ) : (
        <>
          <Text style={type.label}>CREW CODE</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="e.g. 8YXM66"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
          />
          <Text style={styles.hint}>Coming back? Use the same name and you'll pick up where you left off.</Text>
        </>
      )}

      {needsServer && (
        <View>
          <Pressable onPress={() => setShowServer((s) => !s)}>
            <Text style={styles.link}>{showServer ? "▾" : "▸"} Server address {ip ? `· ${ip}:${port}` : "(needed on this device)"}</Text>
          </Pressable>
          {(showServer || !ip) && (
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="192.168.0.10"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                value={ip}
                onChangeText={setIp}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="4000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={port}
                onChangeText={setPort}
              />
            </View>
          )}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={mode === "create" ? "Start our crew" : "Join the crew"} onPress={submit} disabled={!canGo} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xs },
  title: { ...type.heading, fontSize: 20, marginBottom: spacing.xs },
  steps: { gap: 6, marginBottom: spacing.sm },
  watch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 184, 76, 0.12)",
    borderWidth: 1,
    borderColor: colors.lit,
    borderRadius: 12,
    padding: 10,
    marginBottom: spacing.sm,
  },
  watchIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lit, color: "#0a0c18", textAlign: "center", lineHeight: 34, fontSize: 14, overflow: "hidden" },
  watchTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  watchSub: { color: colors.muted, fontSize: 12 },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255, 184, 76, 0.18)",
    color: colors.lit,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 20,
    overflow: "hidden",
  },
  stepText: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  tabs: { flexDirection: "row", backgroundColor: colors.panel, borderRadius: 12, padding: 4, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabOn: { backgroundColor: colors.lit },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  tabTextOn: { color: "#0a0c18" },
  row: { flexDirection: "row", gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  avatars: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: spacing.sm },
  avatarBtn: { width: "23%", flexGrow: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  avatarName: { color: colors.muted, fontSize: 11, marginTop: 2 },
  codeInput: { letterSpacing: 4, fontWeight: "700", fontSize: 18 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: spacing.xs },
  link: { color: colors.accent, fontSize: 13, paddingVertical: 6 },
  error: { color: colors.danger, marginBottom: spacing.xs },
});
