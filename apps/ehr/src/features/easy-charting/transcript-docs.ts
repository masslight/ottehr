import { AIChatDetails } from 'utils';

// A transcript document is a DocumentReference carrying an inline attachment titled 'Transcript'
// with data — the shape both ambient-scribe recordings and the intake chatbot leave on the
// encounter, and the same condition AssistantColumn uses to render transcript chips.
export function transcriptDocumentIds(aiChat: AIChatDetails | undefined): Set<string> {
  const ids = new Set<string>();
  for (const doc of aiChat?.documents ?? []) {
    if (doc.id && doc.content?.some((c) => c.attachment?.title === 'Transcript' && !!c.attachment?.data)) {
      ids.add(doc.id);
    }
  }
  return ids;
}

// True when aiChat contains a transcript document that wasn't in the baseline snapshot.
export function hasNewTranscriptDocument(aiChat: AIChatDetails | undefined, baselineIds: Set<string>): boolean {
  for (const id of transcriptDocumentIds(aiChat)) {
    if (!baselineIds.has(id)) return true;
  }
  return false;
}
