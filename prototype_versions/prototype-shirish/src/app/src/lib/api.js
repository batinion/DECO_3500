// The RN FormData shorthand `{ uri, name, type }` only works through React Native's
// native fetch polyfill — it does nothing on a real browser `fetch` (i.e. `expo start
// --web`), which needs an actual Blob/File. Reading the local URI into a blob first
// works identically on native and web, so every upload goes through this helper.
async function uriToBlob(uri) {
  const res = await fetch(uri);
  return res.blob();
}

/** Upload a photo/slide picked via expo-image-picker. Returns the server's relative fileUrl. */
export async function uploadPhoto(serverUrl, { code, participantId, questionId, asset }) {
  const form = new FormData();
  // Text fields must come before the file field — the server picks a save
  // location from them while parsing the multipart stream.
  form.append("code", code);
  form.append("participantId", participantId);
  form.append("questionId", questionId);

  const filename = asset.fileName || `${questionId}.jpg`;
  const blob = await uriToBlob(asset.uri);
  form.append("file", blob, filename);

  const res = await fetch(`${serverUrl}/api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json();
  return json.fileUrl;
}

/** Upload a freehand drawing exported as a base64 PNG data URL. */
export async function uploadDrawing(serverUrl, { code, participantId, questionId, dataUrl }) {
  const res = await fetch(`${serverUrl}/api/upload-drawing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, participantId, questionId, dataUrl }),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json();
  return json.fileUrl;
}

/**
 * Upload the crew's single shared puzzle-answer file (any type). Only one participant
 * needs to succeed here — the server rejects a second upload once one has landed.
 */
export async function uploadPuzzleAnswer(serverUrl, { code, participantId, asset }) {
  const form = new FormData();
  form.append("code", code);
  form.append("participantId", participantId);

  const filename = asset.name || "answer";
  const blob = await uriToBlob(asset.uri);
  form.append("file", blob, filename);

  const res = await fetch(`${serverUrl}/api/upload-puzzle-answer`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  return json.fileUrl;
}
