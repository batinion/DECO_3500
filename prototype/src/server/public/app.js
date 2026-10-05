// Mission Control chrome: phase pill, crew HUD and dev controls. The scene itself
// (everything animated) is /scene/scene.js, driven by the server's scene_state.
const { socket, onState } = window.LaunchScene;

const PHASE_LABEL = {
  joining: "WAITING FOR CREW",
  countdown: "LAUNCH COUNTDOWN",
  launching: "LAUNCHING",
  cruising: "CREW WRITING MEMORY STARS",
  arrived: "MISSION KEYS ASSIGNED",
  timejump: "",
  earth: "EARTH — CLICK TO REOPEN",
  puzzle: "SOLVE THE PUZZLE",
  revealed: "CAPSULE OPENED",
};

const phasePill = document.getElementById("phase-pill");

// Countdown: "LAUNCH IN 5 … 1", derived from the server clock so every screen agrees.
let countdownTimer = null;
function tickCountdown(st, offset) {
  const left = Math.ceil((st.timing.countdownMs - (Date.now() + offset - st.phaseStartedAt)) / 1000);
  phasePill.textContent = `LAUNCH IN ${Math.min(Math.max(left, 1), Math.ceil(st.timing.countdownMs / 1000))}`;
}

onState((st) => {
  clearInterval(countdownTimer);
  phasePill.textContent = PHASE_LABEL[st.phase] || st.phase;
  if (st.phase === "countdown") {
    const offset = st.serverNow - Date.now();
    tickCountdown(st, offset);
    countdownTimer = setInterval(() => tickCountdown(st, offset), 200);
  }
  phasePill.hidden = !phasePill.textContent;

  // The crew HUD is only for joining + writing; hide it once everyone has submitted.
  document.getElementById("crew-hud").hidden = ["arrived", "timejump", "earth", "puzzle", "revealed"].includes(st.phase);

  const bySlot = {};
  st.participants.forEach((p) => (bySlot[p.engineSlot] = p));
  document.querySelectorAll(".hud-slot").forEach((slotEl) => {
    const p = bySlot[Number(slotEl.dataset.slot)];
    const nameEl = slotEl.querySelector(".slot-name");
    const statusEl = slotEl.querySelector(".slot-status");
    slotEl.classList.remove("filled", "status-answering", "status-submitted");
    if (!p) {
      nameEl.textContent = "Waiting to join…";
      statusEl.textContent = "—";
      return;
    }
    slotEl.classList.add("filled", `status-${p.status}`);
    nameEl.textContent = p.name;
    // Joined = engine lit. Before the Memory Stars open, "joined" is the honest label.
    statusEl.textContent = p.status === "submitted" ? "submitted ✓" : ["joining", "countdown", "launching"].includes(st.phase) ? "joined" : "writing…";
  });
});

document.getElementById("btn-simulate-joins").addEventListener("click", () => socket.emit("simulate_joins"));
document.getElementById("btn-simulate-submissions").addEventListener("click", () => socket.emit("simulate_submissions"));
document.getElementById("btn-skip-reveal").addEventListener("click", () => socket.emit("skip_to_reveal"));
document.getElementById("btn-reset").addEventListener("click", () => socket.emit("session_reset"));
