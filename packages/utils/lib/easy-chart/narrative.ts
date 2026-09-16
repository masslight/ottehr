// The generated narrative as it is STORED beside a transcript, and the two reads the client makes of a
// transcript DocumentReference: the transcript text itself, and the narrative the recording pipeline
// generated from it.
//
// A transcript document is a DocumentReference carrying an inline attachment titled 'Transcript' — the
// shape both the ambient-scribe recording and the intake chatbot leave on the encounter (see
// createDocumentReference in zambdas/src/shared/ai.ts). The narrative rides on the same document as an
// extension, so it is ready when Easy Chart opens and needs no second call.

import { DocumentReference } from 'fhir/r4b';
import { PUBLIC_EXTENSION_BASE_URL } from '../fhir/constants';
import { NarrativeLine } from './api';

export const EASY_CHART_NARRATIVE_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/easy-chart-narrative`;

export const TRANSCRIPT_ATTACHMENT_TITLE = 'Transcript';

/** What the extension's valueString holds. Versioned so a later shape can be told from this one. */
export interface StoredNarrative {
  version: 1;
  generatedAt: string;
  lines: NarrativeLine[];
}

/** The transcript text of a transcript document, decoded; undefined when the document carries none. */
export function transcriptTextOf(doc: DocumentReference): string | undefined {
  const data = doc.content?.find((c) => c.attachment?.title === TRANSCRIPT_ATTACHMENT_TITLE)?.attachment?.data;
  if (!data) return undefined;
  // Exact inverse of the pipeline's btoa(unescape(encodeURIComponent(...))) — plain atob mangles non-ASCII.
  return decodeURIComponent(escape(atob(data)));
}

/** True when the document is a transcript document — the condition the transcript picker lists by. */
export function isTranscriptDocument(doc: DocumentReference): boolean {
  return Boolean(doc.id) && transcriptTextOf(doc) !== undefined;
}

/**
 * The narrative stored on a transcript document, or undefined when there is none or it cannot be read.
 * A malformed payload counts as absent: the stored narrative is a convenience, and the client generates
 * one on demand when it is missing.
 */
export function storedNarrativeOf(doc: DocumentReference): NarrativeLine[] | undefined {
  const raw = doc.extension?.find((e) => e.url === EASY_CHART_NARRATIVE_EXTENSION_URL)?.valueString;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredNarrative>;
    if (parsed.version !== 1 || !Array.isArray(parsed.lines)) return undefined;
    return parsed.lines.filter(
      (line): line is NarrativeLine =>
        typeof line?.text === 'string' && line.text.trim() !== '' && Array.isArray(line.sources)
    );
  } catch {
    return undefined;
  }
}

/** The extension the pipeline stamps on a transcript document once its narrative is generated. */
export function narrativeExtension(lines: NarrativeLine[]): { url: string; valueString: string } {
  const stored: StoredNarrative = { version: 1, generatedAt: new Date().toISOString(), lines };
  return { url: EASY_CHART_NARRATIVE_EXTENSION_URL, valueString: JSON.stringify(stored) };
}
