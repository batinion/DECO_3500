import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import Avatar from "../components/Avatar";
import { CHARACTERS } from "../lib/avatars";
import { colors, spacing, type } from "../lib/theme";

/**
 * Two short steps instead of one long form (testers typed their name into the code box):
 *   1. Who are you?  — pick an astronaut, type your name.
 *   2. Your crew     — two clearly separate choices: join with a code, or create a new crew.
 * There's no host: whoever creates the crew just gets a code to share.
 */
export default function JoinScreen({ onCreate, onJoin, busy, error, initialCode, needsServer, initialServer, onServerChange, onWatchIntro }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState(initialCode ? "join" : null); // "join" | "create"
  const [name, setName] = useState("");
  const [crewName, setCrewName] = useState("");
  const [code, setCode] = useState(initialCode || "");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4000");
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
  const server = needsServer ? { ip: ip.trim(), port: port.trim() } : null;
  const codeOk = code.trim().length >= 4;

  if (step === 1) {
    return (
      <View style={styles.form}>
        <Text style={type.label}>LAUNCH SEQUENCE · STEP 1 OF 2</Text>
        <Text style={styles.title}>Who's on board?</Text>
        <Text style={styles.lead}>A memory capsule your crew fills all semester and opens together.</Text>

        <View style={styles.avatars}>
          {CHARACTERS.map((c) => {
            const on = c.id === avatar;
            return (
              <Pressable key={c.id} onPress={() => setAvatar(c.id)} style={[styles.avatarBtn, on && { borderColor: c.suit, backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <Avatar id={c.id} size={44} expr={on ? "yay" : "default"} />
              </Pressable>
            );
          })}
        </View>

        <Text style={type.label}>YOUR NAME</Text>
        <TextInput
          style={styles.input}
          placeholder="What your crew calls you"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={() => name.trim() && setStep(2)}
        />

        <PrimaryButton title="Next" onPress={() => setStep(2)} disabled={!name.trim()} />

        {onWatchIntro ? (
          <Pressable onPress={onWatchIntro} style={styles.watch}>
            <Text style={styles.link}>▶ Watch how it works (with sound)</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Pressable onPress={() => setStep(1)} style={styles.meRow}>
        <Avatar id={avatar} size={36} expr="yay" />
        <Text style={styles.meName}>{name.trim()}</Text>
        <Text style={styles.edit}>change</Text>
      </Pressable>

      <Text style={type.label}>STEP 2 OF 2</Text>
      <Text style={styles.title}>Your crew</Text>

      {/* Two separate, unmistakable choices */}
      <Choice
        on={mode === "join"}
        icon="🔑"
        title="Join a crew"
        sub="Someone gave you a 6-letter code"
        onPress={() => setMode("join")}
      />
      {mode === "join" && (
        <View style={styles.expand}>
          <Text style={type.label}>CREW CODE</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ABC123"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            autoFocus={!initialCode}
          />
          <PrimaryButton
            title="Join crew"
            onPress={() => onJoin({ name: name.trim(), code: code.trim().toUpperCase(), server, avatar })}
            disabled={!codeOk || !serverOk}
            loading={busy}
          />
        </View>
      )}

      <Choice
        on={mode === "create"}
        icon="🚀"
        title="Create a new crew"
        sub="Start the capsule and invite your group"
        onPress={() => setMode("create")}
      />
      {mode === "create" && (
        <View style={styles.expand}>
          <Text style={type.label}>CREW NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Studio group 4"
            placeholderTextColor={colors.muted}
            value={crewName}
            onChangeText={setCrewName}
            autoFocus
          />
          <Text style={styles.hint}>You'll get a code to share once it's made.</Text>
          <PrimaryButton title="Create crew" onPress={() => onCreate({ name: name.trim(), crewName: crewName.trim(), server, avatar })} disabled={!serverOk} loading={busy} />
        </View>
      )}

      {needsServer && (
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 2 }]} placeholder="Server IP" placeholderTextColor={colors.muted} autoCapitalize="none" value={ip} onChangeText={setIp} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="4000" placeholderTextColor={colors.muted} keyboardType="number-pad" value={port} onChangeText={setPort} />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Choice({ on, icon, title, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <Text style={styles.choiceIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSub}>{sub}</Text>
      </View>
      <Text style={[styles.radio, on && styles.radioOn]}>{on ? "●" : "○"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  title: { ...type.heading, fontSize: 22 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  codeInput: { letterSpacing: 6, fontWeight: "800", fontSize: 22, textAlign: "center" },
  avatars: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.xs },
  avatarBtn: { width: "23%", flexGrow: 1, alignItems: "center", paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  watch: { alignSelf: "center", paddingVertical: 6 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  meRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.xs },
  meName: { color: colors.text, fontWeight: "700", fontSize: 15 },
  edit: { color: colors.accent, fontSize: 12, marginLeft: "auto" },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
  },
  choiceOn: { borderColor: colors.lit, backgroundColor: "rgba(255, 184, 76, 0.08)" },
  choiceIcon: { fontSize: 26 },
  choiceTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  choiceSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  radio: { color: colors.muted, fontSize: 18 },
  radioOn: { color: colors.lit },
  expand: { gap: spacing.sm, paddingHorizontal: 4, paddingBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: spacing.sm },
  error: { color: colors.danger },
});
