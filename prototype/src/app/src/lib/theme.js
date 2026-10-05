import { Platform } from "react-native";

// DOS-terminal look shared by every participant screen: green + white on near-black.
export const GREEN = "#33ff66";
export const DIM = "#1f9c3f";
export const WHITE = "#f2f2f2";
export const BLACK = "#020a04";
export const MONO = Platform.select({ ios: "Courier", android: "monospace", default: "'Courier New', Courier, monospace" });

export const colors = {
  bg: "#05060f", // behind the live scene
  panel: BLACK,
  border: GREEN,
  text: WHITE,
  muted: "#29c455",
  accent: GREEN,
  accent2: WHITE,
  lit: WHITE,
  danger: "#ff6b6b",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const type = {
  title: { fontFamily: MONO, fontSize: 24, fontWeight: "700", color: WHITE, letterSpacing: 2 },
  heading: { fontFamily: MONO, fontSize: 17, fontWeight: "700", color: GREEN },
  body: { fontFamily: MONO, fontSize: 14, color: WHITE },
  muted: { fontFamily: MONO, fontSize: 12, color: colors.muted, lineHeight: 17 },
  label: { fontFamily: MONO, fontSize: 11, color: WHITE, letterSpacing: 2 },
};
