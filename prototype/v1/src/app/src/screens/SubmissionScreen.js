import React, { useEffect, useMemo, useState, useRef } from "react";
import StarFieldPage from "./StarFieldPage";
import DrawUploadPage from "./DrawUploadPage";
import { PROMPT_BANK, renderFilledTemplate } from "../lib/prompts";
import { saveAnswerDraft, loadAnswerDraft, clearAnswerDraft } from "../lib/storage";

// Five "write anything" stars (the original plus four more); StarFieldPage scatters every star randomly.
const FREE_STAR_COUNT = 5;
const freeStars = () =>
  Array.from({ length: FREE_STAR_COUNT }, (_, i) => ({ id: i === 0 ? "free_text" : `free_text_${i + 1}`, kind: "free" }));

/**
 * Owns the whole "Fill the Blanks" -> "Draw + Upload" -> Submit flow. Keeps its own
 * local state (mirroring the old QuestionsScreen's pattern) and only reports upward
 * once, via onSubmit, with the final Submission payload.
 */
export default function SubmissionScreen({ code, participantId, serverUrl, participants, selfId, phase, onSubmit }) {
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
      // A storage failure must never leave the Memory Stars screen blank.
      const draft = await loadAnswerDraft(code, participantId).catch(() => null);
      if (draft?.stars?.length) {
        // Older drafts predate the extra write-anything stars: top them up.
        const have = new Set(draft.stars.map((s) => s.id));
        setStars([...draft.stars, ...freeStars().filter((s) => !have.has(s.id))]);
        setCollected(draft.collected || {});
        setDrawingFileUrl(draft.drawingFileUrl || null);
        setUploadedImages(draft.uploadedImages || []);
        setPage(draft.page || "starfield");
      } else {
        // Every prompt in the bank shows up as a star, every session — no random subset.
        const all = PROMPT_BANK.map((p) => ({ id: p.id, kind: "prompt", template: p.template }));
        setStars([...all, ...freeStars()]);
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
        allParticipants={participants}
        selfId={selfId}
        phase={phase}
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
