import VoicePlayer from "./VoicePlayer";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, Platform } from "react-native";
import { colors } from "../lib/theme";

/**
 * The capsule reveal as a curved wall of tall black-glass panels. The centre panel is sharp,
 * the rest fall away along an arc and blur. They drift right-to-left on their own; the
 * buttons below pause them or step one panel at a time.
 */
const STEP = 0.36; // radians between neighbouring panels on the arc
const DRIFT = 0.09; // panels per second, right-to-left
const HOLD = 0.22; // share of each panel's turn spent holding still at the centre, each side
const VISIBLE = 4;
const REACTIONS = [["😂", "Haha"], ["❤️", "Love"], ["🫡", "Salute"]]; // panels drawn each side of centre

const fmtDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

export default function GlassCarousel({ items, width, abs, revealed, nameOf, onReact, onDownload }) {
  const n = items.length;
  const wrap = n >= 5;
  const cardW = Math.max(240, Math.min(350, width * 0.4));
  const cardH = Math.round(cardW * 1.7);
  const radius = Math.min(width * 0.52, 560);

  const [pos, setPos] = useState(0);
  const [paused, setPaused] = useState(false);
  const live = useRef({ pos: 0, vel: 0, goal: null, paused: false, view: 0, hover: null });
  live.current.paused = paused;

  useEffect(() => {
    live.current.pos = Math.min(live.current.pos, Math.max(0, n - 1));
    let raf;
    let last = Date.now();
    const tick = () => {
      const s = live.current;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (n > 0) {
        if (s.goal != null) {
          // glide to a chosen panel
          const diff = wrap ? shortest(s.goal - s.pos, n) : s.goal - s.pos;
          s.pos += diff * Math.min(1, dt * 7);
          if (Math.abs(diff) < 0.004) { s.pos = s.goal; s.goal = null; }
        } else {
          // the cursor resting on a panel holds the drift still
          const held = s.hover != null;
          const target = !s.paused && wrap && !held ? DRIFT : 0;
          s.vel += (target - s.vel) * Math.min(1, dt * 4);
          s.pos += s.vel * dt;
        }
        if (wrap) s.pos = ((s.pos % n) + n) % n;
        else s.pos = Math.max(0, Math.min(n - 1, s.pos));
        // while drifting, ease each panel to a stop at the centre so it stays in focus
        s.view = s.goal != null ? s.pos : hold(s.pos);
        setPos(s.view);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, wrap]);

  const step = (dir) => {
    const s = live.current;
    s.pos = s.view;
    const base = s.goal != null ? s.goal : Math.round(s.pos);
    const next = base + dir;
    s.goal = wrap ? next : Math.max(0, Math.min(n - 1, next));
    s.vel = 0;
  };

  // The cursor anywhere on a card (text, reactions, download) pauses the drift until it leaves.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onMove = (e) => {
      live.current.hover = e.target?.closest?.("[data-glass-panel]") ? 1 : null;
    };
    const onOut = (e) => {
      if (!e.relatedTarget) live.current.hover = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onOut);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onOut);
    };
  }, []);

  const panels = [];
  items.forEach((m, i) => {
    let d = i - pos;
    if (wrap) d = shortest(d, n);
    if (Math.abs(d) > VISIBLE + 0.5) return;
    const a = d * STEP;
    const x = Math.sin(a) * radius;
    const depth = Math.cos(a); // 1 at the centre, shrinking along the arc
    const scale = 0.62 + 0.38 * depth;
    const focus = Math.max(0, 1 - Math.max(0, Math.abs(d) - 0.1) * 1.1); // 1 = in focus
    const fade = Math.max(0, 1 - Math.max(0, Math.abs(d) - 2.6) / 1.9);
    panels.push(
      <View
        key={m.id}
        pointerEvents="box-none"
        dataSet={{ glassPanel: "1" }}
        style={{
          position: "absolute",
          left: width / 2 - cardW / 2 + x,
          top: 0,
          width: cardW,
          height: cardH,
          zIndex: Math.round(100 - Math.abs(d) * 10),
          opacity: (0.45 + 0.55 * focus) * fade,
          transform: [{ perspective: 1200 }, { rotateY: `${-a}rad` }, { scale }],
          ...(Platform.OS === "web" ? { filter: `blur(${((1 - focus) * 3.2).toFixed(2)}px)` } : null),
        }}
      >
        <Panel m={m} w={cardW} h={cardH} abs={abs} revealed={revealed(m)} nameOf={nameOf} focus={focus} onReact={onReact} onDownload={onDownload} />
      </View>
    );
  });

  return (
    <View>
      <View style={{ height: cardH + 36, width, alignSelf: "center", overflow: "hidden" }}>
        <View style={{ height: cardH, marginTop: 18 }}>{panels}</View>
      </View>
      <View style={styles.controls}>
        <Ctl label="Previous" onPress={() => step(-1)}>‹</Ctl>
        <Ctl label={paused ? "Play" : "Pause"} onPress={() => setPaused((p) => !p)} big>{paused ? "▶" : "❚❚"}</Ctl>
        <Ctl label="Next" onPress={() => step(1)}>›</Ctl>
      </View>
    </View>
  );
}

function hold(p) {
  const base = Math.floor(p);
  const f = p - base;
  const t = Math.min(1, Math.max(0, (f - HOLD) / (1 - 2 * HOLD)));
  return base + t * t * (3 - 2 * t);
}

function shortest(d, n) {
  return ((((d + n / 2) % n) + n) % n) - n / 2;
}

function Ctl({ children, label, onPress, big }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [styles.ctl, big && styles.ctlBig, pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] }]}>
      <Text style={[styles.ctlText, big && { fontSize: 16 }]}>{children}</Text>
    </Pressable>
  );
}

function Panel({ m, w, h, abs, revealed, nameOf, focus, onReact, onDownload }) {
  const media = m.photo || m.drawing;
  const len = (m.text || "").length;
  const fs = len < 60 ? 22 : len < 140 ? 18 : 15;
  return (
    <View style={[styles.panel, { width: w, height: h }]}>
      <Text style={styles.date}>{fmtDate(m.createdAt)}</Text>
      <Text style={styles.remember}>Remember...?</Text>
      <View style={styles.body}>
        {media ? (
          <>
            <Image source={{ uri: abs(m.photo || m.drawing) }} style={{ width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: "#111" }} resizeMode={m.photo ? "cover" : "contain"} />
            {m.text ? <Text style={styles.caption} numberOfLines={3}>“{m.text}”</Text> : null}
          </>
        ) : m.text ? (
          <Text style={[styles.quote, { fontSize: fs, lineHeight: fs * 1.4 }]} numberOfLines={10}>
            “{m.text}”
          </Text>
        ) : null}
        {m.audio ? (
          <View style={styles.voice} onStartShouldSetResponder={() => true}>
            <Text style={styles.voiceTag}>🎙️ VOICE NOTE</Text>
            <VoicePlayer src={abs(m.audio)} />
          </View>
        ) : null}
      </View>
      <View style={styles.foot}>
        <View style={styles.byWrap} onStartShouldSetResponder={() => true}>
          <Text style={styles.by} numberOfLines={1}>
            {`by ${nameOf(m.authorId)}`}
          </Text>
        </View>
        <View style={styles.actions}>
          {REACTIONS.map(([emoji, label]) => (
            <Pressable key={label} onPress={() => onReact(emoji, label)} hitSlop={4} accessibilityLabel={label} style={({ pressed }) => [styles.act, pressed && { transform: [{ scale: 0.88 }] }]}>
              <Text style={styles.actEmoji}>{emoji}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => onDownload(m)} hitSlop={4} accessibilityLabel="Download card" style={({ pressed }) => [styles.act, pressed && { transform: [{ scale: 0.88 }] }]}>
            <Text style={styles.actDl}>⤓</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 62,
    paddingBottom: 18,
    backgroundColor: "rgba(8,9,14,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    ...(Platform.OS === "web" ? { backdropFilter: "blur(14px)", } : null),
  },
  date: { position: "absolute", top: 12, right: 14, color: "rgba(238,240,255,0.55)", fontSize: 10, letterSpacing: 0.5 },
  voice: { width: "100%", padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  voiceTag: { color: "#ffd166", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  body: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  quote: { color: colors.text, textAlign: "center", fontWeight: "600" },
  caption: { color: "rgba(238,240,255,0.85)", fontSize: 14, lineHeight: 19, textAlign: "center", fontWeight: "500" },
  remember: { position: "absolute", top: 32, left: 16, color: "rgba(238,240,255,0.8)", fontSize: 15, fontWeight: "600" },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  byWrap: { flex: 1, ...(Platform.OS === "web" ? { cursor: "default" } : null) },
  by: { color: "rgba(238,240,255,0.6)", fontSize: 12, letterSpacing: 0.4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 3 },
  act: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  actEmoji: { fontSize: 14 },
  actDl: { color: "rgba(238,240,255,0.85)", fontSize: 16, fontWeight: "700", lineHeight: 18 },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 22 },
  ctl: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  ctlBig: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.16)" },
  ctlText: { color: colors.text, fontSize: 26, lineHeight: 28, fontWeight: "700" },
});
