import { APIGatewayProxyResult } from 'aws-lambda';
import { FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG, getPatchOperationForNewMetaTag, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-erx-patient-sync';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const { encounter, secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!encounter.id) {
      throw new Error("Encounter FHIR resource doesn't have an id.");
    }

    const patientId = encounter.subject?.reference?.split('/')[1];
    if (!patientId) {
      throw new Error(`Patient reference not found on encounter ${encounter.id}`);
    }

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created M2M token and oystehr client');

    console.log(`Syncing eRx patient for patient ${patientId}, encounter ${encounter.id}`);

    // Step 1: Sync the patient with the eRx service
    await oystehr.erx.syncPatient({ patientId, encounterId: encounter.id });
    console.log(`Successfully synced eRx patient ${patientId}`);

    // Step 2: Fetch medication history to warm the upstream cache.
    // This is a read-only call — the eRx service caches the result so
    // subsequent fetches from the EHR frontend return quickly.
    try {
      const history = await oystehr.erx.getMedicationHistory({ patientId });
      console.log(`Fetched medication history for patient ${patientId}: ${history.length} entries`);
    } catch (historyError: any) {
      // Non-fatal: the sync itself succeeded, so the frontend can still
      // call getMedicationHistory later. Log and continue.
      console.warn(`Failed to pre-fetch medication history for patient ${patientId}:`, historyError.message);
    }

    // Tag the encounter so the subscription won't fire again for this encounter
    await oystehr.fhir.patch({
      resourceType: 'Encounter',
      id: encounter.id,
      operations: [getPatchOperationForNewMetaTag(encounter, FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG)],
    });
    console.log(`Tagged encounter ${encounter.id} with eRx sync tag`);

    return {
      statusCode: 200,
      body: `Successfully synced eRx patient for encounter ${encounter.id}`,
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
