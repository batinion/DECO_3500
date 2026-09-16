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
  btnSimulate: document.getElementById("btn-simulate"),
  btnReset: document.getElementById("btn-reset"),
};

const PHASE_LABEL = {
  waiting: "WAITING FOR CREW",
  answering: "CREW ANSWERING",
  launching: "LAUNCHING",
  revealed: "MISSION KEYS REVEALED",
};

function applySessionInfo(info) {
  el.qrImage.src = info.qrDataUrl;
  el.joinCode.textContent = info.code;
  el.joinIp.textContent = info.ip;
  el.joinPort.textContent = info.port;
  applyPhase(info.phase);
  applyRoster(info);

  if (info.phase !== "launching" && info.phase !== "revealed") {
    el.rocket.classList.remove("launching");
    el.revealOverlay.classList.add("hidden");
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
      <div class="name">${p.name}</div>
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
});

socket.on("session_reset", (info) => {
  el.revealOverlay.classList.add("hidden");
  el.rocket.classList.remove("launching");
  document.querySelectorAll(".engine").forEach((e) => e.classList.remove("lit"));
  applySessionInfo(info);
});

el.btnSimulate.addEventListener("click", () => socket.emit("simulate_remaining"));
el.btnReset.addEventListener("click", () => socket.emit("session_reset"));
