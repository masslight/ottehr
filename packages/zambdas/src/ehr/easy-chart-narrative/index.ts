// easy-chart-narrative — transcript in, provider-voice narrative out.
//
// The on-demand half of narrative generation. The recording pipeline (shared/ai.ts) pre-generates a
// narrative and stores it on the transcript document; this endpoint exists for the cases that has not
// covered — a pasted transcript, a document written before the pipeline stamped narratives, or a provider
// asking for a fresh one. Same generator, same verification, so the two never disagree.
//
// When the caller names the transcript document the text came from, the result is stamped onto it the
// same way the pipeline does, so a document written before the pipeline stamped narratives costs one
// generation ever. Best-effort: the response is the narrative, and a stamping failure never fails it.
//
// Authorisation is the shared Easy Chart check: a charting role, and read access to the encounter when
// one is named. The transcript itself is never read from FHIR here; the caller sends it.
//
// PHI: never logs the transcript or a line of the narrative. Envelope only.

import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { ChartNarrativeResponse, NarrativeLine } from 'utils/lib/easy-chart/api';
import {
  EASY_CHART_NARRATIVE_EXTENSION_URL,
  narrativeExtension,
  transcriptTextOf,
} from 'utils/lib/easy-chart/narrative';
import { Secrets } from 'utils/lib/secrets';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { generateNarrative } from '../easy-chart-shared/narrative';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-narrative';

// Lifted outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, transcript, encounterId, documentId } = validateRequestParameters(input);

  await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  const response: ChartNarrativeResponse = await generateNarrative(transcript, secrets, ZAMBDA_NAME);
  if (documentId && response.lines.length > 0) {
    await stampNarrativeBestEffort(documentId, encounterId, transcript, response.lines, secrets);
  }
  return { statusCode: 200, body: JSON.stringify(response) };
});

/**
 * Store the narrative on the transcript document it was generated from, under the M2M client.
 *
 * Two refusals, both logged and neither an error. The document must belong to the encounter the caller was
 * authorised for — that is what ties this write to the read check — and its transcript must be the text the
 * narrative was written from, so a narrative of pasted or edited text is never stamped onto a document it
 * does not describe. Written as a patch of `/extension`, not an update, so a concurrent edit to the rest of
 * the resource is not clobbered.
 */
async function stampNarrativeBestEffort(
  documentId: string,
  encounterId: string | undefined,
  transcript: string,
  lines: NarrativeLine[],
  secrets: Secrets | null
): Promise<void> {
  try {
    if (!encounterId) {
      console.log(`[${ZAMBDA_NAME}] not stamping DocumentReference ${documentId}: no encounterId on the request`);
      return;
    }
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    const doc = await oystehr.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: documentId });

    if (!doc.context?.encounter?.some((ref) => ref.reference === `Encounter/${encounterId}`)) {
      console.log(`[${ZAMBDA_NAME}] not stamping DocumentReference ${documentId}: not on Encounter ${encounterId}`);
      return;
    }
    if ((transcriptTextOf(doc) ?? '').trim() !== transcript.trim()) {
      console.log(
        `[${ZAMBDA_NAME}] not stamping DocumentReference ${documentId}: transcript differs from the document's`
      );
      return;
    }

    // Same shape the pipeline writes (updateDocumentReference in shared/ai.ts): any earlier narrative goes,
    // every other extension stays.
    const extension = [
      ...(doc.extension ?? []).filter((e) => e.url !== EASY_CHART_NARRATIVE_EXTENSION_URL),
      narrativeExtension(lines),
    ];
    await oystehr.fhir.patch<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentId,
      operations: [{ op: doc.extension ? 'replace' : 'add', path: '/extension', value: extension }],
    });
    console.log(`[${ZAMBDA_NAME}] stamped narrative on DocumentReference ${documentId}`);
  } catch (error) {
    // The document id and the error envelope only — never the transcript or a line.
    console.error(`[${ZAMBDA_NAME}] could not stamp narrative on DocumentReference ${documentId}`);
    captureException(error);
  }
}
