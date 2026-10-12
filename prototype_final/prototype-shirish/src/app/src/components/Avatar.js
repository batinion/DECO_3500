import React, { useMemo } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { avatarSvg } from "../lib/avatars";

/** A crewmate's astronaut. expr: "default" | "wow" | "yay". */
export default function Avatar({ id, size = 40, expr = "default", style }) {
  const xml = useMemo(() => avatarSvg(id || "nova", { expr, size: 100 }), [id, expr]);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
