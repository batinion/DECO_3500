import React from "react";
import TerminalPanel from "../components/TerminalPanel";

/** Crew-progress terminal over the live scene — mirrors Mission Control's crew HUD. */
export default function SubmittedWaitingScreen({ participants, selfId }) {
  const submittedCount = (participants || []).filter((p) => p.status === "submitted").length;
  return (
    <TerminalPanel
      participants={participants}
      selfId={selfId}
      phase="cruising"
      instructions={["Your Memory Stars are in. SUBMITTED ✓", "Waiting on the rest of the crew."]}
      progress={`${submittedCount} OF 4 SUBMITTED`}
    />
  );
}
