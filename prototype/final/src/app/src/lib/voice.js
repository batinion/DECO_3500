import { Platform } from "react-native";

// Voice notes are recorded in the browser with MediaRecorder (the web version of the app).
// Phones running the native app don't have a recorder wired up yet, so voiceSupported() is false there.
export function voiceSupported() {
  return Platform.OS === "web" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export const MAX_VOICE_SECONDS = 60;

/** Starts recording. Resolves to { stop() -> Promise<{ uri, ext }>, cancel() }. Rejects if the mic is blocked. */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release();
          const type = rec.mimeType || mime || "audio/webm";
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          resolve({ uri: URL.createObjectURL(new Blob(chunks, { type })), ext });
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      release();
    },
  };
}
