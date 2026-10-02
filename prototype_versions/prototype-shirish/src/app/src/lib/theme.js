// Mirrors the Mission Control web page's space theme so the two screens feel like one system.
export const colors = {
  bg: "#05060f",
  panel: "#161a2e",
  border: "#2a2f4a",
  text: "#eef0ff",
  muted: "#8890b5",
  accent: "#4cc9f0",
  accent2: "#ff6ec7",
  lit: "#ffb84c",
  danger: "#e63946",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const type = {
  title: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: 2 },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  label: { fontSize: 11, color: colors.muted, letterSpacing: 1.5 },
};
