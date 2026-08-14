import { AIChatDetails } from 'utils/lib/types/api/chart-data/chart-data.types';

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

// Section-header line prefixed to a transcript's text whenever it travels inside a larger message
// (multi-transcript prime, insert-into-composer). The composer send path relies on this exact
// shape to detect transcript-derived text, so build/contains/extract below must stay in sync.
export function transcriptHeaderLine(label: string): string {
  return `=== ${label} ===`;
}

// Whole-line match for the header shape above; non-greedy so a label containing '===' still
// round-trips (the trailing ' ===' anchor wins).
const TRANSCRIPT_HEADER_RE = /^=== (.+?) ===$/;

// True when any line of `text` is a transcript section header — the signal that the composer text
// embeds a whole-visit transcript and must route as narrative regardless of the length heuristic.
export function containsTranscriptHeader(text: string): boolean {
  return text.split(/\r?\n/).some((line) => TRANSCRIPT_HEADER_RE.test(line.trim()));
}

// Labels of every transcript section header in `text`, in order of appearance. Used after a
// successful composer send to stamp the matching transcript documents as consumed — only exact
// label matches count, so an edited header conservatively stamps nothing.
export function extractTranscriptHeaderLabels(text: string): string[] {
  const labels: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(TRANSCRIPT_HEADER_RE);
    if (m) labels.push(m[1]);
  }
  return labels;
}
