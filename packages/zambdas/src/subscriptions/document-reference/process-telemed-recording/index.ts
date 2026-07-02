import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Encounter } from 'fhir/r4b';
import { createOystehrClient, getAttendingPractitionerId, getSecret, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../../shared';
import { transcribeAndCreateResourcesFromZ3Audio } from '../../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'process-telemed-recording';

// Marks the Z3 bucket Oystehr writes telemed audio recordings to, e.g. z3/{projectId}-TelemedRecordings/....
// The triggering LOINC code (56444-3) is shared with lab HL7 result documents, so we additionally require an
// audio attachment from this bucket before processing.
const getTelemedRecordingsBucketSegment = (secrets: Secrets | null): string =>
  `/${getSecret(SecretsKeys.PROJECT_ID, secrets)}-TelemedRecordings/`;

export interface ProcessTelemedRecordingSubscriptionInput {
  documentReference: DocumentReference;
  secrets: Secrets | null;
}

let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { documentReference, secrets } = validateRequestParameters(input);

  // The DocumentReference?type=...|56444-3 subscription also matches lab HL7 result documents, which reuse the
  // same LOINC code. Only telemed recordings carry an audio attachment from the TelemedRecordings bucket; bail
  // on anything else so we don't try to transcribe non-audio documents.
  const telemedRecordingsBucketSegment = getTelemedRecordingsBucketSegment(secrets);
  const attachment = documentReference.content?.find(
    (c) => c.attachment.contentType?.startsWith('audio/') && c.attachment.url?.includes(telemedRecordingsBucketSegment)
  )?.attachment;

  if (!attachment?.url) {
    console.log(
      `DocumentReference/${documentReference.id} is not a telemed audio recording (no audio attachment from TelemedRecordings); skipping.`
    );
    return { statusCode: 200, body: JSON.stringify('Not a telemed recording; skipped') };
  }

  const encounterReference = documentReference.context?.encounter?.[0]?.reference;
  const encounterID = encounterReference?.startsWith('Encounter/') ? encounterReference.split('/')[1] : undefined;
  if (!encounterID) {
    console.log(
      `DocumentReference/${documentReference.id} has no Encounter context reference; cannot create AI resources. Skipping.`
    );
    return { statusCode: 200, body: JSON.stringify('No encounter context; skipped') };
  }

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }
  const oystehr = createOystehrClient(
    oystehrToken,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterID });

  // Attribute the recording to the visit's attending provider. A non-null provider profile also marks the
  // generated resources as source 'audio-recording' (ambient scribe) rather than 'chat' in createResourcesFromAiInterview.
  const attendingPractitionerId = getAttendingPractitionerId(encounter);
  if (!attendingPractitionerId) {
    console.log(
      `Encounter/${encounterID} has no attending practitioner; skipping telemed recording processing for DocumentReference/${documentReference.id}.`
    );
    return { statusCode: 200, body: JSON.stringify('No attending practitioner; skipped') };
  }
  const providerUserProfile = `Practitioner/${attendingPractitionerId}`;

  const createdResources = await transcribeAndCreateResourcesFromZ3Audio(
    oystehr,
    oystehrToken,
    { encounterID, z3URL: attachment.url, providerUserProfile },
    secrets
  );

  return {
    statusCode: 200,
    body: JSON.stringify(`Successfully created ` + createdResources),
  };
});
