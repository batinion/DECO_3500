// Default question bank. Edit this file to change the questions asked each session.
// `friend_text` questions are templates: one is generated per *other* participant once
// the roster of 4 is known, with {friendName} substituted for their real name.
const BASE_QUESTIONS = [
  {
    id: "q1",
    type: "text",
    prompt: "What's one thing from this course you don't want to forget?",
  },
  {
    id: "q2",
    type: "drawing",
    prompt:
      "Sketch something that reminds you of this course — a doodle, a diagram, whatever comes to mind.",
  },
  {
    id: "q3",
    type: "photo",
    prompt: "Add a photo from the semester that captures how it felt.",
  },
  {
    id: "q4",
    type: "slide",
    prompt:
      "Find the one lecture slide you'll never forget (even if for the wrong reasons) and add a photo or screenshot of it.",
  },
];

// Plain text, not markdown — the client renders prompts as-is with no markdown parser.
const FRIEND_TEMPLATE = (friendName) =>
  `What's something ${friendName} did this semester that you won't forget?`;

/**
 * Build the personalized 6-question list for one participant, once all 4 names are known.
 * @param {{id: string, name: string}} self
 * @param {{id: string, name: string}[]} allParticipants
 */
function buildQuestionsFor(self, allParticipants) {
  const friendQuestions = allParticipants
    .filter((p) => p.id !== self.id)
    .map((friend, i) => ({
      id: `friend_${friend.id}`,
      type: "friend_text",
      prompt: FRIEND_TEMPLATE(friend.name),
      aboutParticipantId: friend.id,
    }));

  return [...BASE_QUESTIONS, ...friendQuestions];
}

module.exports = { BASE_QUESTIONS, buildQuestionsFor };
