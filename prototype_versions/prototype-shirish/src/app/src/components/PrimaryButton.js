import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../lib/theme";

export default function PrimaryButton({ title, onPress, disabled, loading, variant = "primary" }) {
  const isGhost = variant === "ghost";
  const isDark = variant === "dark";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isGhost ? styles.ghost : isDark ? styles.dark : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.accent : isDark ? "#fff" : "#0a0c18"} />
      ) : (
        <Text style={[styles.text, isGhost && { color: colors.accent }, isDark && { color: "#fff" }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.lit },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  dark: { backgroundColor: "#000000" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  text: { color: "#0a0c18", fontWeight: "700", fontSize: 15 },
});
