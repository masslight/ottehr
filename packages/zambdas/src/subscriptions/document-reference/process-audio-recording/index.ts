import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { PUBLIC_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { transcribeAndCreateResourcesFromZ3Audio } from '../../../shared/ai';
import { getAuth0Token } from '../../../shared/getAuth0Token';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'process-audio-recording';

export interface ProcessAudioRecordingSubscriptionInput {
  documentReference: DocumentReference;
  secrets: Secrets | null;
}

let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { documentReference, secrets } = validateRequestParameters(input);

  const z3URL = documentReference.content?.[0]?.attachment?.url;
  if (!z3URL) {
    console.log(`DocumentReference/${documentReference.id} has no audio attachment URL; skipping.`);
    return { statusCode: 200, body: JSON.stringify('No audio attachment; skipped') };
  }

  const encounterReference = documentReference.context?.encounter?.[0]?.reference;
  const encounterID = encounterReference?.startsWith('Encounter/') ? encounterReference.split('/')[1] : undefined;
  if (!encounterID) {
    console.log(
      `DocumentReference/${documentReference.id} has no Encounter context reference; cannot create AI resources. Skipping.`
    );
    return { statusCode: 200, body: JSON.stringify('No encounter context; skipped') };
  }

  const providerUserProfile =
    documentReference.extension?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
      ?.valueReference?.reference ?? null;

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

  const createdResources = await transcribeAndCreateResourcesFromZ3Audio(
    oystehr,
    oystehrToken,
    { encounterID, z3URL, providerUserProfile, existingDocumentReference: documentReference },
    secrets
  );

  return {
    statusCode: 200,
    body: JSON.stringify(`Successfully created ` + createdResources),
  };
});
