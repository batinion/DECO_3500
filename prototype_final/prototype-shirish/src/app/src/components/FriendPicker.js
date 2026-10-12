import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, type } from "../lib/theme";
import Avatar from "./Avatar";

/**
 * Inline "chip" that expands into a small in-flow popover of the other participants.
 * Deliberately not a nested Modal — a Modal-inside-a-Modal doesn't compose reliably
 * on web (it renders detached from the outer sheet's layout).
 */
export default function FriendPicker({ participants, value, onChange, placeholder = "choose someone" }) {
  const [open, setOpen] = useState(false);
  const selected = participants.find((p) => p.id === value);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.chip} onPress={() => setOpen((o) => !o)}>
        {selected ? <Avatar id={selected.avatar} size={22} /> : null}
        <Text style={[styles.chipText, !selected && styles.placeholder]}>
          {selected ? selected.name : placeholder}
        </Text>
      </Pressable>

      {open && (
        <View style={styles.popover}>
          {participants.map((p) => (
            <Pressable
              key={p.id}
              style={styles.option}
              onPress={() => {
                onChange(p.id);
                setOpen(false);
              }}
            >
              <Avatar id={p.avatar} size={28} />
              <Text style={type.body}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", marginHorizontal: 2, zIndex: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: colors.accent, fontWeight: "700" },
  placeholder: { color: colors.muted, fontWeight: "400" },
  popover: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minWidth: 160,
    paddingVertical: 4,
    zIndex: 20,
  },
  option: { paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
});
