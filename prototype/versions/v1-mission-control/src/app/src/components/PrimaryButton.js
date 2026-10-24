import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { GREEN, DIM, WHITE, BLACK, MONO } from "../lib/theme";

/** Terminal-style button: "[ TITLE ]". primary = filled green-dark + white text; ghost/dark = outline. */
export default function PrimaryButton({ title, onPress, disabled, loading, variant = "primary" }) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={GREEN} />
      ) : (
        <Text style={[styles.text, primary && { color: WHITE }, disabled && { color: DIM }]}>[ {String(title).toUpperCase()} ]</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 12, borderWidth: 1, borderColor: GREEN, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#04210d" },
  ghost: { backgroundColor: BLACK },
  disabled: { borderColor: DIM, backgroundColor: "transparent" },
  pressed: { backgroundColor: "#0b4a1c" },
  text: { fontFamily: MONO, color: GREEN, fontWeight: "700", fontSize: 14, letterSpacing: 2 },
});
