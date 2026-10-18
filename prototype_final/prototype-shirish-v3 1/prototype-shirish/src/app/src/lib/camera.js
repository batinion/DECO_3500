import { Platform } from "react-native";

// Live group selfie. In the browser the camera opens with getUserMedia (laptop webcam or phone camera);
// the native app uses the system camera through expo-image-picker instead (see PromptSheet).
export function webCameraSupported() {
  return Platform.OS === "web" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Why the browser won't give us the camera/mic, in words a person can act on. */
export function mediaBlockedReason(what) {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return `Your browser blocks the ${what} on this address (${window.location.origin}). Open the https:// version instead (port 4443), or http://localhost:4000 on this computer.`;
  }
  return `This browser can't use the ${what} here.`;
}

export function openCameraStream() {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Grabs the current frame of a playing <video> as a JPEG. Resolves to { uri } (an object URL). */
export function snapshot(video) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 960;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve({ uri: URL.createObjectURL(blob) }) : reject(new Error("Couldn't take the picture."))), "image/jpeg", 0.85)
  );
}
