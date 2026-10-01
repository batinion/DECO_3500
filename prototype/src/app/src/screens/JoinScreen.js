import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Modal } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import QRScanner from "../components/QRScanner";
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

  return (
    <View style={styles.form}>
      <Text style={type.heading}>LAUNCH SEQUENCE</Text>
      <Text style={type.muted}>Join your crew — your engine lights as soon as you're in.</Text>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scanner}>
          <QRScanner onScanned={handleScanned} onCancel={() => setScanning(false)} />
        </View>
      </Modal>

      <PrimaryButton title="Scan QR code" variant="ghost" onPress={() => setScanning(true)} />

      <Text style={type.label}>YOUR NAME</Text>
      <TextInput style={styles.input} placeholder="e.g. Alex" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />

      <Text style={type.label}>JOIN CODE</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 8YXM66"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
      />

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={type.label}>SERVER IP</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.0.199"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            value={ip}
            onChangeText={setIp}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>PORT</Text>
          <TextInput
            style={styles.input}
            placeholder="4000"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            value={port}
            onChangeText={setPort}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        title="Join"
        onPress={() => onJoin({ ip: ip.trim(), port: port.trim(), code: code.trim().toUpperCase(), name: name.trim() })}
        disabled={!canJoin}
        loading={joining}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xs },
  row: { flexDirection: "row", gap: spacing.sm },
  scanner: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  error: { color: colors.danger, marginBottom: spacing.xs },
});
