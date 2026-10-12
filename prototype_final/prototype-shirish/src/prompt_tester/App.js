import { useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, SafeAreaView, Platform,
  KeyboardAvoidingView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { PROMPT_BANK, parseTemplate, renderFilledTemplate } from "./prompts";

const C = {
  bg: "#05060f", card: "#12142b", line: "#2a2e5a", text: "#f2f3ff", dim: "#9aa0d0",
  accent: "#ffb830", accentText: "#1a1200",
};
const STAGES = [
  { key: "all", label: "All prompts" },
  { key: "start", label: "Start" },
  { key: "mid", label: "Mid" },
  { key: "end", label: "End" },
  { key: "any", label: "Any time" },
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Btn({ label, onPress, kind = "primary", disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.btn, kind === "ghost" && s.btnGhost, disabled && { opacity: 0.4 }]}
    >
      <Text style={[s.btnText, kind === "ghost" && { color: C.text }]}>{label}</Text>
    </Pressable>
  );
}

function Setup({ onStart, initial }) {
  const [me, setMe] = useState(initial?.me || "");
  const [draft, setDraft] = useState("");
  const [mates, setMates] = useState(initial?.mates || []);
  const [stage, setStage] = useState(initial?.stage || "all");

  const addMate = () => {
    const n = draft.trim();
    if (n && !mates.some((m) => m.toLowerCase() === n.toLowerCase())) setMates([...mates, n]);
    setDraft("");
  };
  const canStart = me.trim() && mates.length > 0;

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Prompt Tester</Text>
      <Text style={s.dim}>Try the memory prompts. Memories are about your crewmates.</Text>

      <Text style={s.label}>Your name</Text>
      <TextInput style={s.input} value={me} onChangeText={setMe} placeholder="e.g. Ed" placeholderTextColor={C.dim} />

      <Text style={s.label}>Who are you writing memories for? (at least one)</Text>
      <View style={s.row}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addMate}
          blurOnSubmit={false}
          placeholder="Crewmate's name"
          placeholderTextColor={C.dim}
        />
        <Btn label="Add" onPress={addMate} kind="ghost" />
      </View>
      <View style={[s.row, { flexWrap: "wrap", marginTop: 10 }]}>
        {mates.map((m) => (
          <Pressable key={m} style={s.chipOn} onPress={() => setMates(mates.filter((x) => x !== m))}>
            <Text style={s.chipOnText}>{m}  ✕</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Prompts from</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {STAGES.map((st) => (
          <Pressable key={st.key} style={stage === st.key ? s.chipOn : s.chip} onPress={() => setStage(st.key)}>
            <Text style={stage === st.key ? s.chipOnText : s.chipText}>{st.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 24 }} />
      <Btn
        label="Start prompts"
        disabled={!canStart}
        onPress={() => onStart({ me: me.trim(), mates, stage })}
      />
      {!canStart && <Text style={[s.dim, { marginTop: 8 }]}>Enter your name and add at least one crewmate.</Text>}
    </ScrollView>
  );
}

function PromptCard({ prompt, mates, index, total, saved, onSubmit, onSkip, onBack }) {
  const tokens = useMemo(() => parseTemplate(prompt.template), [prompt]);
  const hasName = tokens.some((t) => t.type === "name");
  const blankCount = tokens.filter((t) => t.type === "blank").length;
  const [picked, setPicked] = useState(saved?.picked || (mates.length === 1 ? [mates[0]] : []));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(saved?.values || Array(blankCount).fill(""));

  const choose = (m) => { setPicked([m]); setOpen(false); };
  const setVal = (i, v) => setValues(values.map((x, k) => (k === i ? v : x)));
  const ready = (!hasName || picked.length > 0) && values.every((v) => v.trim());
  const who = picked.join(" & ");

  // Sentence as inline words + inline text inputs (wraps like normal text)
  const pieces = [];
  let space = false; // was there whitespace before the next atom?
  const gap = () => ({ marginLeft: space ? 6 : 0 });
  tokens.forEach((t, i) => {
    if (t.type === "text") {
      t.value.split(/(\s+)/).filter(Boolean).forEach((w, k) => {
        if (!w.trim()) { space = true; return; }
        pieces.push(<Text key={`${i}-${k}`} style={[s.word, gap()]}>{w}</Text>);
        space = false;
      });
    } else if (t.type === "name") {
      pieces.push(
        <Pressable key={i} style={[s.nameDrop, gap()]} onPress={() => setOpen(!open)}>
          <Text style={[s.nameDropText, !who && { opacity: 0.7 }]}>{who || "select name"}</Text>
          <Text style={s.nameDropText}> {open ? "▲" : "▼"}</Text>
        </Pressable>
      );
      space = false;
    } else {
      const v = values[t.index];
      pieces.push(
        <TextInput
          key={i}
          style={[s.blank, gap(), { width: Math.max(150, Math.min(300, v.length * 11 + 50)) }]}
          value={v}
          onChangeText={(x) => setVal(t.index, x)}
          placeholder="type here"
          placeholderTextColor={C.dim}
        />
      );
      space = false;
    }
  });

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.dim}>Prompt {index + 1} of {total} · {prompt.when}</Text>

      <View style={s.card}>
        <View style={s.sentenceRow}>{pieces}</View>
        {hasName && open && (
          <View style={s.menu}>
            {mates.map((m) => (
              <Pressable key={m} style={s.menuItem} onPress={() => choose(m)}>
                <Text style={s.menuCheck}>{picked.includes(m) ? "●" : "○"}</Text>
                <Text style={s.dropdownText}>{m}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: 24 }} />
      <Btn
        label="Add this memory"
        disabled={!ready}
        onPress={() =>
          onSubmit({
            id: prompt.id,
            about: hasName ? picked : [],
            text: renderFilledTemplate(prompt.template, { friendName: who, filledText: values }),
            picked,
            values,
          })
        }
      />
      <View style={{ height: 10 }} />
      <View style={s.row}>
        <View style={{ flex: 1 }}><Btn label="← Back" kind="ghost" onPress={onBack} /></View>
        <View style={{ flex: 1 }}><Btn label="Skip" kind="ghost" onPress={onSkip} /></View>
      </View>
    </ScrollView>
  );
}

function Summary({ me, memories, skipped, onBack, onRestart }) {
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>All done, {me}</Text>
      <Text style={s.dim}>{memories.length} memories added · {skipped} skipped</Text>
      {memories.map((m, i) => (
        <View key={i} style={[s.card, { marginTop: 12 }]}>
          <Text style={s.dim}>about {m.about.length ? m.about.join(" & ") : "the whole crew"} · {m.id}</Text>
          <Text style={[s.sentence, { fontSize: 17 }]}>{m.text}</Text>
        </View>
      ))}
      <View style={{ height: 20 }} />
      <Btn label="Start over" onPress={onRestart} />
      <View style={{ height: 10 }} />
      <Btn label="← Back to prompts" kind="ghost" onPress={onBack} />
    </ScrollView>
  );
}

export default function App() {
  const [session, setSession] = useState(null); // { me, mates, queue }
  const [lastSetup, setLastSetup] = useState(null);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState({}); // pos -> { skipped } | { memory }

  const start = (setup) => {
    const pool = setup.stage === "all" ? PROMPT_BANK : PROMPT_BANK.filter((p) => p.when === setup.stage);
    setLastSetup(setup);
    setSession({ me: setup.me, mates: setup.mates, queue: shuffle(pool) });
    setPos(0);
    setAnswers({});
  };
  const answer = (value) => { setAnswers({ ...answers, [pos]: value }); setPos(pos + 1); };
  const back = () => (pos === 0 ? setSession(null) : setPos(pos - 1));

  let body;
  if (!session) body = <Setup onStart={start} initial={lastSetup} />;
  else if (pos >= session.queue.length) {
    const list = Object.keys(answers).sort((x, y) => x - y).map((k) => answers[k]);
    const memories = list.filter((a) => a.memory).map((a) => a.memory);
    body = (
      <Summary
        me={session.me}
        memories={memories}
        skipped={session.queue.length - memories.length}
        onBack={() => setPos(session.queue.length - 1)}
        onRestart={() => setSession(null)}
      />
    );
  } else
    body = (
      <>
        <View style={s.topbar}>
          <Text style={s.dim}>{session.me} → {session.mates.join(", ")}</Text>
          <Pressable onPress={() => setPos(session.queue.length)}>
            <Text style={[s.dim, { color: C.accent }]}>Finish</Text>
          </Pressable>
        </View>
        <PromptCard
          key={session.queue[pos].id}
          prompt={session.queue[pos]}
          mates={session.mates}
          index={pos}
          total={session.queue.length}
          saved={answers[pos]?.memory}
          onSubmit={(m) => answer({ memory: m })}
          onSkip={() => answer({ skipped: true })}
          onBack={back}
        />
      </>
    );

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.wrap}>{body}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  wrap: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
  pad: { padding: 20, paddingTop: 28 },
  topbar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20 },
  h1: { color: C.text, fontSize: 28, fontWeight: "800", marginBottom: 6 },
  dim: { color: C.dim, fontSize: 14 },
  label: { color: C.text, fontSize: 15, fontWeight: "700", marginTop: 22, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 12,
    color: C.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 14 },
  sentence: { color: C.text, fontSize: 21, lineHeight: 31, fontWeight: "600" },
  hl: { color: C.accent },
  sentenceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6 },
  word: { color: C.text, fontSize: 21, fontWeight: "600", lineHeight: 34 },
  blank: {
    color: C.accent, fontSize: 16, fontWeight: "600", paddingVertical: 4, paddingHorizontal: 6,
    borderBottomWidth: 2, borderBottomColor: C.accent, minWidth: 150,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : null),
  },
  nameDrop: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.accent, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  nameDropText: { color: C.accentText, fontSize: 18, fontWeight: "800" },
  dropdown: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  dropdownText: { color: C.text, fontSize: 16, flexShrink: 1 },
  menu: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 12, marginTop: 6, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  menuCheck: { color: C.accent, fontSize: 18 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 6 },
  chipText: { color: C.text, fontSize: 15 },
  chipOn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 6 },
  chipOnText: { color: C.accentText, fontSize: 15, fontWeight: "700" },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.line },
  btnText: { color: C.accentText, fontSize: 16, fontWeight: "800" },
});
