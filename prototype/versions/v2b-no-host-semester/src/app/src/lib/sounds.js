import { Platform } from "react-native";

// Spacecraft sounds in the app. The synth lives on the server (/sfx.js) so the intro clip
// and the app share exactly the same sounds. Web only for now; on native this is a no-op.
let loading = null;
let pendingMuted = false;

function sfx() {
  return typeof window !== "undefined" ? window.LaunchSFX : null;
}

/** Load /sfx.js from the server once, and unlock audio on the first tap anywhere. */
export function initSounds(serverUrl) {
  if (Platform.OS !== "web" || typeof document === "undefined" || !serverUrl) return;
  if (sfx() || loading) return;
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = `${serverUrl}/sfx.js`;
    s.onload = () => {
      sfx()?.setMuted(pendingMuted);
      resolve();
    };
    s.onerror = () => {
      loading = null;
      resolve();
    };
    document.head.appendChild(s);
  });
  const unlock = () => sfx()?.unlock();
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock);
}

export function play(name, opts) {
  sfx()?.play(name, opts);
}

/** 3, 2, 1 … liftoff — timed to the rocket's 1.5 s hold on the pad before it lifts. */
export function playCountdown() {
  play("countdown");
  setTimeout(() => play("countdown"), 500);
  setTimeout(() => play("countdown"), 1000);
  setTimeout(() => {
    play("countdown", { final: true });
    play("liftoff");
  }, 1500);
}

export function setMuted(m) {
  pendingMuted = !!m;
  sfx()?.setMuted(!!m);
}
