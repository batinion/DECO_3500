import React, { useEffect, useMemo, useState, useRef } from "react";
import StarFieldPage from "./StarFieldPage";
import DrawUploadPage from "./DrawUploadPage";
import { PROMPT_BANK, renderFilledTemplate } from "../lib/prompts";
import { saveAnswerDraft, loadAnswerDraft, clearAnswerDraft } from "../lib/storage";

/**
 * Owns the whole "Fill the Blanks" -> "Draw + Upload" -> Submit flow. Keeps its own
 * local state (mirroring the old QuestionsScreen's pattern) and only reports upward
 * once, via onSubmit, with the final Submission payload.
 */
export default function SubmissionScreen({ code, participantId, serverUrl, participants, selfId, onSubmit }) {
  const [ready, setReady] = useState(false);
  const [stars, setStars] = useState([]);
  const [page, setPage] = useState("starfield");
  const [collected, setCollected] = useState({});
  const [drawingFileUrl, setDrawingFileUrl] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const loadedFor = useRef(null);

  const otherParticipants = useMemo(
    () => (participants || []).filter((p) => p.id !== selfId),
    [participants, selfId]
  );

  // Load a persisted draft (same star selection + progress) or pick fresh prompts.
  useEffect(() => {
    (async () => {
      const draft = await loadAnswerDraft(code, participantId);
      if (draft?.stars?.length) {
        setStars(draft.stars);
        setCollected(draft.collected || {});
        setDrawingFileUrl(draft.drawingFileUrl || null);
        setUploadedImages(draft.uploadedImages || []);
        setPage(draft.page || "starfield");
      } else {
        // Every prompt in the bank shows up as a star, every session — no random subset.
        const all = PROMPT_BANK.map((p) => ({ id: p.id, kind: "prompt", template: p.template }));
        setStars([...all, { id: "free_text", kind: "free" }]);
      }
      loadedFor.current = participantId;
      setReady(true);
    })();
  }, [code, participantId]);

  useEffect(() => {
    if (loadedFor.current !== participantId) return; // don't overwrite before the draft loads
    saveAnswerDraft(code, participantId, { stars, collected, drawingFileUrl, uploadedImages, page });
  }, [stars, collected, drawingFileUrl, uploadedImages, page, code, participantId]);

  function handleCollect(starId, data) {
    setCollected((prev) => ({ ...prev, [starId]: data }));
  }

  async function handleFinalSubmit() {
    const blanks = stars
      .filter((s) => collected[s.id])
      .map((s) => {
        const c = collected[s.id];
        if (s.kind === "free") {
          return {
            promptId: "free_text",
            filledText: [c.filledText[0] || ""],
            aboutParticipantId: c.aboutParticipantId || null,
            promptText: c.filledText[0] || "",
          };
        }
        const friend = otherParticipants.find((p) => p.id === c.aboutParticipantId);
        return {
          promptId: s.id,
          filledText: c.filledText,
          aboutParticipantId: c.aboutParticipantId || null,
          promptText: renderFilledTemplate(s.template, { friendName: friend?.name, filledText: c.filledText }),
        };
      });

    setSubmitting(true);
    try {
      await onSubmit({ blanks, drawing: drawingFileUrl, uploadedImages });
      await clearAnswerDraft(code, participantId);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  if (page === "starfield") {
    return (
      <StarFieldPage
        stars={stars}
        participants={otherParticipants}
        collected={collected}
        onCollect={handleCollect}
        onContinue={() => setPage("drawupload")}
      />
    );
  }

  return (
    <DrawUploadPage
      code={code}
      participantId={participantId}
      serverUrl={serverUrl}
      drawingFileUrl={drawingFileUrl}
      onDrawingChange={setDrawingFileUrl}
      uploadedImages={uploadedImages}
      onImagesChange={setUploadedImages}
      onBack={() => setPage("starfield")}
      onSubmit={handleFinalSubmit}
      submitting={submitting}
    />
  );
}
