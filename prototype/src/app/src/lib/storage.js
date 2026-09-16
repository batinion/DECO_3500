import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "launch-sequence:session";
const draftKey = (code, participantId) => `launch-sequence:draft:${code}:${participantId}`;

// { ip, port, code, name, participantId }
export async function saveSessionInfo(info) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(info));
}

export async function loadSessionInfo() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSessionInfo() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function saveAnswerDraft(code, participantId, answers) {
  await AsyncStorage.setItem(draftKey(code, participantId), JSON.stringify(answers));
}

export async function loadAnswerDraft(code, participantId) {
  const raw = await AsyncStorage.getItem(draftKey(code, participantId));
  return raw ? JSON.parse(raw) : {};
}

export async function clearAnswerDraft(code, participantId) {
  await AsyncStorage.removeItem(draftKey(code, participantId));
}
