import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { GREEN, DIM, WHITE, BLACK, MONO } from "./TerminalPanel";

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
              <Text style={styles.optionText}>{p.name}</Text>
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
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: "#04210d",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: MONO, color: WHITE, fontWeight: "700" },
  placeholder: { color: DIM, fontWeight: "400" },
  popover: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    backgroundColor: BLACK,
    borderWidth: 1,
    borderColor: GREEN,
    minWidth: 140,
    paddingVertical: 4,
    zIndex: 20,
  },
  option: { paddingVertical: 10, paddingHorizontal: 12 },
  optionText: { fontFamily: MONO, color: WHITE, fontSize: 14 },
});
