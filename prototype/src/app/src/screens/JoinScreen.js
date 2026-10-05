import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import QRScanner from "../components/QRScanner";
import { GREEN, DIM, WHITE, BLACK, MONO } from "../components/TerminalPanel";
import { colors, spacing, type } from "../lib/theme";

/**
 * Compact login form (rendered inside CrewPanel over the live scene). Reports the
 * server address as it's typed/scanned so the parent can bring the scene up before the
 * name is submitted.
 */
export default function JoinScreen({ onJoin, joining, error, initialServer, onServerChange }) {
  const [scanning, setScanning] = useState(false);
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4000");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  // Pre-fill from ?server= / the last-used address once it's resolved.
  useEffect(() => {
    if (!initialServer) return;
    setIp((cur) => cur || String(initialServer.ip));
    setPort((cur) => (cur && cur !== "4000" ? cur : String(initialServer.port)));
  }, [initialServer]);

  useEffect(() => {
    onServerChange?.({ ip: ip.trim(), port: port.trim() });
  }, [ip, port]);

  const handleScanned = ({ ip: sIp, port: sPort, code: sCode }) => {
    setIp(String(sIp));
    setPort(String(sPort));
    setCode(String(sCode).toUpperCase());
    setScanning(false);
  };

  const canJoin = ip.trim() && port.trim() && code.trim() && name.trim();

  const disabled = !canJoin || joining;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>C:\LAUNCH_SEQUENCE&gt; JOIN</Text>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scanner}>
          <QRScanner onScanned={handleScanned} onCancel={() => setScanning(false)} />
        </View>
      </Modal>

      <Pressable onPress={() => setScanning(true)} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
        <Text style={styles.btnText}>[ SCAN QR CODE ]</Text>
      </Pressable>

      <Text style={styles.label}>YOUR NAME</Text>
      <TextInput style={styles.input} placeholder="e.g. Alex" placeholderTextColor={DIM} selectionColor={GREEN} value={name} onChangeText={setName} />

      <Text style={styles.label}>JOIN CODE</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 8YXM66"
        placeholderTextColor={DIM}
        selectionColor={GREEN}
        autoCapitalize="characters"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
      />

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>SERVER IP</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.0.199"
            placeholderTextColor={DIM}
            selectionColor={GREEN}
            autoCapitalize="none"
            value={ip}
            onChangeText={setIp}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>PORT</Text>
          <TextInput
            style={styles.input}
            placeholder="4000"
            placeholderTextColor={DIM}
            selectionColor={GREEN}
            keyboardType="number-pad"
            value={port}
            onChangeText={setPort}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>ERROR: {error}</Text> : null}

      <Pressable
        onPress={() => onJoin({ ip: ip.trim(), port: port.trim(), code: code.trim().toUpperCase(), name: name.trim() })}
        disabled={disabled}
        style={({ pressed }) => [styles.btn, styles.btnPrimary, disabled && styles.btnDisabled, pressed && !disabled && styles.btnPressed]}
      >
        <Text style={[styles.btnText, { color: WHITE }, disabled && { color: DIM }]}>{joining ? "[ JOINING... ]" : "[ JOIN > ]"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xs },
  row: { flexDirection: "row", gap: spacing.sm },
  scanner: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.md },
  title: { fontFamily: MONO, color: WHITE, fontSize: 13, fontWeight: "700" },
  label: { fontFamily: MONO, color: WHITE, fontSize: 11, letterSpacing: 2, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: BLACK,
    color: WHITE,
    fontFamily: MONO,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    marginTop: 3,
    marginBottom: 2,
  },
  btn: { borderWidth: 1, borderColor: GREEN, paddingVertical: 9, alignItems: "center", backgroundColor: BLACK },
  btnPrimary: { backgroundColor: "#04210d", marginTop: spacing.xs },
  btnPressed: { backgroundColor: "#0b4a1c" },
  btnDisabled: { borderColor: DIM, backgroundColor: "transparent" },
  btnText: { fontFamily: MONO, color: GREEN, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  error: { fontFamily: MONO, color: WHITE, fontSize: 12, marginBottom: spacing.xs },
});
