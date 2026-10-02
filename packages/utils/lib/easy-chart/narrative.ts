// Reads a transcript DocumentReference (an inline attachment titled 'Transcript') and the generated narrative
// stored on it as an extension, so the narrative is ready when Easy Chart opens without a second call.

import { DocumentReference } from 'fhir/r4b';
import { z } from 'zod';
import { PUBLIC_EXTENSION_BASE_URL } from '../fhir/constants';
import { NarrativeLine } from './api';

export const EASY_CHART_NARRATIVE_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/easy-chart-narrative`;

export const TRANSCRIPT_ATTACHMENT_TITLE = 'Transcript';

/** What the extension's valueString holds. Versioned so a later shape can be told from this one. */
interface StoredNarrative {
  version: 1;
  generatedAt: string;
  lines: NarrativeLine[];
}

const StoredNarrativeSchema = z.object({ version: z.literal(1), lines: z.array(z.unknown()) });

const StoredLineSchema = z.object({
  text: z.string().refine((text) => text.trim() !== ''),
  sources: z.array(z.string()),
  approximateSource: z.string().optional(),
}) satisfies z.ZodType<NarrativeLine>;

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
 * The stored narrative, or undefined when absent or malformed; the client then generates one on demand.
 * A malformed line is dropped rather than discarding the whole narrative.
 */
export function storedNarrativeOf(doc: DocumentReference): NarrativeLine[] | undefined {
  const raw = doc.extension?.find((e) => e.url === EASY_CHART_NARRATIVE_EXTENSION_URL)?.valueString;
  if (!raw) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const stored = StoredNarrativeSchema.safeParse(json);
  if (!stored.success) return undefined;
  return stored.data.lines.flatMap((line) => {
    const parsed = StoredLineSchema.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The extension the pipeline stamps on a transcript document once its narrative is generated. */
export function narrativeExtension(lines: NarrativeLine[]): { url: string; valueString: string } {
  const stored: StoredNarrative = { version: 1, generatedAt: new Date().toISOString(), lines };
  return { url: EASY_CHART_NARRATIVE_EXTENSION_URL, valueString: JSON.stringify(stored) };
}
