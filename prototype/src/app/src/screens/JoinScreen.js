import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import QRScanner from "../components/QRScanner";
import { colors, spacing, type } from "../lib/theme";

export default function JoinScreen({ onJoin, joining, error }) {
  const [mode, setMode] = useState("manual"); // 'manual' | 'scan'
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4000");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const handleScanned = ({ ip: sIp, port: sPort, code: sCode }) => {
    setIp(String(sIp));
    setPort(String(sPort));
    setCode(String(sCode).toUpperCase());
    setMode("manual");
  };

  const canJoin = ip.trim() && port.trim() && code.trim() && name.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>LAUNCH SEQUENCE</Text>
        <Text style={type.muted}>Join your crew's capsule submission.</Text>

        {mode === "scan" ? (
          <QRScanner onScanned={handleScanned} onCancel={() => setMode("manual")} />
        ) : (
          <View style={styles.form}>
            <PrimaryButton title="Scan QR code" variant="ghost" onPress={() => setMode("scan")} />

            <Text style={type.label}>YOUR NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />

            <Text style={type.label}>JOIN CODE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 8YXM66"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
            />

            <Text style={type.label}>SERVER IP</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 192.168.0.199"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              value={ip}
              onChangeText={setIp}
            />

            <Text style={type.label}>PORT</Text>
            <TextInput
              style={styles.input}
              placeholder="4000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={port}
              onChangeText={setPort}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              title="Join"
              onPress={() => onJoin({ ip: ip.trim(), port: port.trim(), code: code.trim().toUpperCase(), name: name.trim() })}
              disabled={!canJoin}
              loading={joining}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.bg, flexGrow: 1 },
  form: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
