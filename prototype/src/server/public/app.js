const socket = io();

const el = {
  phasePill: document.getElementById("phase-pill"),
  qrImage: document.getElementById("qr-image"),
  joinCode: document.getElementById("join-code"),
  joinIp: document.getElementById("join-ip"),
  joinPort: document.getElementById("join-port"),
  rocket: document.getElementById("rocket"),
  revealOverlay: document.getElementById("reveal-overlay"),
  revealGrid: document.getElementById("reveal-grid"),
  epilogueOverlay: document.getElementById("epilogue-overlay"),
  epilogueEarth: document.getElementById("epilogue-earth"),
  capsuleOverlay: document.getElementById("capsule-overlay"),
  capsuleGrid: document.getElementById("capsule-grid"),
  btnSimulate: document.getElementById("btn-simulate"),
  btnSkipReveal: document.getElementById("btn-skip-reveal"),
  btnReset: document.getElementById("btn-reset"),
};

const EPILOGUE_PHASES = ["phase-wander", "phase-cooking", "phase-years", "phase-earth"];
// How long the color-reveal grid stays up before the epilogue takes over, and how long
// the rocket wanders before "Cooking the space!" appears. From there, "Cooking the
// space!" and "3 years have passed" each wait for a click on Mission Control to advance
// — they no longer auto-advance on a timer.
const REVEAL_HOLD_MS = 4000;
const WANDER_MS = 3000;
let epilogueTimers = [];

function clearEpilogueTimers() {
  epilogueTimers.forEach(clearTimeout);
  epilogueTimers = [];
}

function setEpiloguePhase(phase) {
  el.epilogueOverlay.classList.remove(...EPILOGUE_PHASES);
  el.epilogueOverlay.classList.add(phase);
}

function hideEpilogue() {
  clearEpilogueTimers();
  el.epilogueOverlay.classList.add("hidden");
  el.epilogueOverlay.classList.remove("earth-clickable", "puzzle-waiting");
  setEpiloguePhase("phase-wander");
}

function playEpilogue() {
  clearEpilogueTimers();
  el.epilogueOverlay.classList.remove("hidden");
  el.epilogueOverlay.classList.remove("earth-clickable", "puzzle-waiting");
  setEpiloguePhase("phase-wander");

  // Only the wander -> cooking step is timed; from "Cooking the space!" onward, a
  // click on Mission Control advances to the next beat (see the overlay click handler).
  epilogueTimers.push(setTimeout(() => setEpiloguePhase("phase-cooking"), WANDER_MS));
}

el.epilogueOverlay.addEventListener("click", (e) => {
  if (el.epilogueOverlay.classList.contains("phase-cooking")) {
    setEpiloguePhase("phase-years");
    return;
  }
  if (el.epilogueOverlay.classList.contains("phase-years")) {
    setEpiloguePhase("phase-earth");
    el.epilogueOverlay.classList.add("earth-clickable");
  }
});

el.epilogueEarth.addEventListener("click", (e) => {
  if (!el.epilogueOverlay.classList.contains("earth-clickable")) return;
  e.stopPropagation();
  socket.emit("start_puzzle");
});

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderCapsule(participants) {
  el.capsuleGrid.innerHTML = "";
  (participants || []).forEach((p) => {
    const card = document.createElement("div");
    card.className = "capsule-card";

    const entriesHtml = (p.entries || [])
      .map((entry) => {
        const valueHtml = entry.value
          ? `<div class="capsule-value">${escapeHtml(entry.value)}</div>`
          : `<div class="capsule-value">— no answer —</div>`;
        return `<div class="capsule-entry">
          <div class="capsule-prompt">${escapeHtml(entry.prompt)}</div>
          ${valueHtml}
        </div>`;
      })
      .join("");

    const mediaItems = [
      p.drawing ? `<img src="${p.drawing}" alt="drawing" />` : "",
      ...(p.uploadedImages || []).map((url) => `<img src="${url}" alt="photo" />`),
    ].filter(Boolean);

    const mediaHtml = mediaItems.length
      ? `<div class="capsule-media">${mediaItems.join("")}</div>`
      : `<div class="capsule-media-empty">No photos added</div>`;

    card.innerHTML = `
      <div class="capsule-name">${escapeHtml(p.name)}</div>
      <div class="capsule-colors">
        ${(p.colors || []).map((c) => `<div class="capsule-swatch" style="background:${c.hex}"></div>`).join("")}
      </div>
      ${entriesHtml}
      <div class="capsule-media-section">
        <div class="capsule-media-label">Photos</div>
        ${mediaHtml}
      </div>`;
    el.capsuleGrid.appendChild(card);
  });
}

function showCapsule(participants) {
  clearEpilogueTimers();
  el.epilogueOverlay.classList.add("hidden");
  renderCapsule(participants);
  el.capsuleOverlay.classList.remove("hidden");
}

function hideCapsule() {
  el.capsuleOverlay.classList.add("hidden");
}

const PHASE_LABEL = {
  waiting: "WAITING FOR CREW",
  answering: "CREW ANSWERING",
  launching: "LAUNCHING",
  revealed: "MISSION KEYS REVEALED",
  puzzle: "SOLVE THE PUZZLE",
  unlocked: "CAPSULE OPENED",
};

function applySessionInfo(info) {
  el.qrImage.src = info.qrDataUrl;
  el.joinCode.textContent = info.code;
  el.joinIp.textContent = info.ip;
  el.joinPort.textContent = info.port;
  applyPhase(info.phase);
  applyRoster(info);

  if (info.phase === "unlocked" && info.capsule) {
    showCapsule(info.capsule);
    return;
  }
  hideCapsule();

  if (info.phase === "puzzle") {
    el.revealOverlay.classList.add("hidden");
    el.epilogueOverlay.classList.remove("hidden");
    setEpiloguePhase("phase-earth");
    el.epilogueOverlay.classList.remove("earth-clickable");
    el.epilogueOverlay.classList.add("puzzle-waiting");
    return;
  }

  if (info.phase !== "launching" && info.phase !== "revealed") {
    el.rocket.classList.remove("launching");
    el.revealOverlay.classList.add("hidden");
    hideEpilogue();
    document.querySelectorAll(".engine").forEach((e) => e.classList.remove("lit"));
  }
}

function applyPhase(phase) {
  el.phasePill.textContent = PHASE_LABEL[phase] || phase;
}

function applyRoster(session) {
  const bySlot = {};
  (session.participants || []).forEach((p) => (bySlot[p.engineSlot] = p));

  document.querySelectorAll(".roster-slot").forEach((slotEl) => {
    const slot = Number(slotEl.dataset.slot);
    const p = bySlot[slot];
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
    statusEl.textContent = p.status;

    const engineEl = document.querySelector(`.engine[data-slot="${slot}"]`);
    if (engineEl) engineEl.classList.toggle("lit", p.status === "submitted");
  });
}

socket.on("connect", async () => {
  const res = await fetch("/api/session-info");
  const info = await res.json();
  applySessionInfo(info);
});

socket.on("roster_update", (session) => {
  applyPhase(session.phase);
  applyRoster(session);
});

socket.on("engine_ignite", ({ engineSlot }) => {
  const engineEl = document.querySelector(`.engine[data-slot="${engineSlot}"]`);
  if (engineEl) engineEl.classList.add("lit");
});

socket.on("launch_sequence_start", () => {
  applyPhase("launching");
  el.rocket.classList.add("launching");
});

socket.on("mission_colors_summary", ({ participants }) => {
  applyPhase("revealed");
  el.revealGrid.innerHTML = "";
  participants.forEach((p) => {
    const card = document.createElement("div");
    card.className = "reveal-card";
    card.innerHTML = `
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="reveal-swatches">
        ${(p.colors || [])
          .map(
            (c) => `<div>
              <div class="reveal-swatch" style="background:${c.hex}"></div>
              <div class="reveal-swatch-label">${c.name}</div>
            </div>`
          )
          .join("")}
      </div>`;
    el.revealGrid.appendChild(card);
  });
  el.revealOverlay.classList.remove("hidden");
  hideEpilogue();

  epilogueTimers.push(
    setTimeout(() => {
      el.revealOverlay.classList.add("hidden");
      playEpilogue();
    }, REVEAL_HOLD_MS)
  );
});

socket.on("puzzle_started", () => {
  applyPhase("puzzle");
  el.epilogueOverlay.classList.remove("earth-clickable");
  el.epilogueOverlay.classList.add("puzzle-waiting");
});

socket.on("capsule_opened", ({ participants }) => {
  applyPhase("unlocked");
  showCapsule(participants);
});

socket.on("session_reset", (info) => {
  el.revealOverlay.classList.add("hidden");
  el.rocket.classList.remove("launching");
  hideEpilogue();
  hideCapsule();
  document.querySelectorAll(".engine").forEach((e) => e.classList.remove("lit"));
  applySessionInfo(info);
});

el.btnSimulate.addEventListener("click", () => socket.emit("simulate_remaining"));
el.btnSkipReveal.addEventListener("click", () => socket.emit("skip_to_reveal"));
el.btnReset.addEventListener("click", () => socket.emit("session_reset"));
