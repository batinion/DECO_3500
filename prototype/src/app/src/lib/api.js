/** Upload a photo/slide picked via expo-image-picker. Returns the server's relative fileUrl. */
export async function uploadPhoto(serverUrl, { code, participantId, questionId, asset }) {
  const form = new FormData();
  // Text fields must come before the file field — the server picks a save
  // location from them while parsing the multipart stream.
  form.append("code", code);
  form.append("participantId", participantId);
  form.append("questionId", questionId);

  const filename = asset.fileName || `${questionId}.jpg`;
  const type = asset.mimeType || "image/jpeg";
  form.append("file", {
    uri: asset.uri,
    name: filename,
    type,
  });

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
