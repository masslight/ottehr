// easy-chart-save-transcript — a transcript typed or edited in Autochart, saved to the visit and processed.
//
// Both paths run the text through createResourcesFromAiInterview, the same function a recording's transcript
// reaches once transcribed, so the transcript DocumentReference, the extracted history Observations and the
// stored narrative come out exactly as they would for audio.
//
// NEW (no documentId): a new transcript document is written. The caller is recorded as its provider, which is
// what labels it a recording in the EHR; only the audio attachment is absent.
//
// EDIT (documentId): the document is processed again from the new text — its transcript and narrative are
// replaced, fresh Observations are extracted, and then the Observations extracted from the old text are
// deleted, so the chart's suggestions describe what the transcript now says. The deletion runs last: a failure
// there leaves both sets rather than neither, and saving again clears every set but the newest. Any audio
// attachment and the document's provider stay.
//
// Authorisation is the shared Easy Chart check: a charting role and read access to the encounter. An edited
// document must belong to that encounter and be a transcript document.
//
// PHI: never logs the transcript. Envelope only.

import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Observation } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { SaveTranscriptResponse } from 'utils/lib/easy-chart/api';
import { isTranscriptDocument } from 'utils/lib/easy-chart/narrative';
import { PUBLIC_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { createResourcesFromAiInterview } from '../../shared/ai';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-save-transcript';

// Lifted outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, transcript, encounterId, documentId } = validateRequestParameters(input);

  const { userToken, isServiceClient } = await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let existing: DocumentReference | undefined;
  let staleObservationIds: string[] = [];
  let providerUserProfile: string | null;
  if (documentId) {
    existing = await oystehr.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: documentId });
    if (!existing.context?.encounter?.some((ref) => ref.reference === `Encounter/${encounterId}`)) {
      throw INVALID_INPUT_ERROR('The transcript does not belong to this visit');
    }
    if (!isTranscriptDocument(existing)) {
      throw INVALID_INPUT_ERROR('The document is not a transcript');
    }
    // The document keeps the provider it was recorded (or first saved) under; a chat transcript has none.
    providerUserProfile =
      existing.extension?.find((e) => e.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)?.valueReference?.reference ??
      null;
    staleObservationIds = (
      await oystehr.fhir.search<Observation>({
        resourceType: 'Observation',
        params: [{ name: 'derived-from', value: `DocumentReference/${documentId}` }],
      })
    )
      .unbundle()
      .flatMap((obs) => (obs.id ? [obs.id] : []));
  } else {
    // A service client has no user profile; its transcript is stored as a chat transcript.
    providerUserProfile = isServiceClient ? null : (await userMe(userToken, secrets)).profile;
  }

  const created = await createResourcesFromAiInterview(
    oystehr,
    encounterId,
    transcript,
    null,
    undefined,
    null,
    providerUserProfile,
    existing,
    secrets
  );

  if (staleObservationIds.length > 0) {
    await oystehr.fhir.batch({
      requests: staleObservationIds.map((id) => ({ method: 'DELETE' as const, url: `/Observation/${id}` })),
    });
  }

  // `created` lists the written resources as "Type/id,Type/id"; the transcript document is the one the client needs.
  const savedDocumentId =
    documentId ??
    created
      .split(',')
      .find((ref) => ref.startsWith('DocumentReference/'))
      ?.split('/')[1];
  if (!savedDocumentId) {
    throw new Error(`[${ZAMBDA_NAME}] the pipeline wrote no DocumentReference`);
  }
  console.log(
    `[${ZAMBDA_NAME}] ${documentId ? 'reprocessed' : 'created'} DocumentReference/${savedDocumentId} ` +
      `(${transcript.length} chars; ${staleObservationIds.length} stale observations removed)`
  );

  const response: SaveTranscriptResponse = { documentId: savedDocumentId };
  return { statusCode: 200, body: JSON.stringify(response) };
});
