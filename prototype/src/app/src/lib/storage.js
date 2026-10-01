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

// Last Mission Control address used — lets the live scene load behind the login panel
// on the next launch, before the user has joined anything.
const SERVER_KEY = "launch-sequence:last-server";

export async function saveLastServer(server) {
  await AsyncStorage.setItem(SERVER_KEY, JSON.stringify(server));
}

export async function loadLastServer() {
  const raw = await AsyncStorage.getItem(SERVER_KEY);
  return raw ? JSON.parse(raw) : null;
}
