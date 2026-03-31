import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Observation, Patient } from 'fhir/r4b';
import { FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG, getFirstName, getLastName, getPatchOperationForNewMetaTag } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-erx-patient-sync';

const WEIGHT_LOINC = '29463-7';
const HEIGHT_LOINC = '8302-2';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { encounterId, patientId, secrets } = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);
  console.log('Created M2M token and oystehr client');

  // Fetch the encounter to check if already synced
  const encounter = await oystehr.fhir.read<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const alreadySynced = encounter.meta?.tag?.some(
    (tag) =>
      tag.system === FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.system && tag.code === FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.code
  );
  if (alreadySynced) {
    console.log(`Encounter ${encounterId} already synced with eRx, skipping`);
    return { statusCode: 200, body: `Encounter ${encounterId} already synced` };
  }

  // Fetch patient to verify required demographics
  const patient = await oystehr.fhir.read<Patient>({ resourceType: 'Patient', id: patientId });
  const firstName = getFirstName(patient);
  const lastName = getLastName(patient);
  const birthDate = patient.birthDate;

  if (!firstName || !lastName) {
    console.log(`Patient ${patientId} missing name (first: ${firstName}, last: ${lastName}), skipping sync`);
    return { statusCode: 200, body: `Patient ${patientId} missing required name` };
  }

  if (!birthDate) {
    console.log(`Patient ${patientId} missing birthDate, skipping sync`);
    return { statusCode: 200, body: `Patient ${patientId} missing required birthDate` };
  }

  // Check for height and weight observations on this encounter
  const vitalsBundle = await oystehr.fhir.search<Observation>({
    resourceType: 'Observation',
    params: [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'code', value: `${HEIGHT_LOINC},${WEIGHT_LOINC}` },
    ],
  });

  const observations = vitalsBundle.entry?.map((e) => e.resource).filter(Boolean) as Observation[] | undefined;
  const hasHeight = observations?.some((obs) => obs.code?.coding?.some((c) => c.code === HEIGHT_LOINC));
  const hasWeight = observations?.some((obs) => obs.code?.coding?.some((c) => c.code === WEIGHT_LOINC));

  if (!hasHeight || !hasWeight) {
    console.log(`Encounter ${encounterId} missing vitals (height: ${hasHeight}, weight: ${hasWeight}), skipping sync`);
    return { statusCode: 200, body: `Encounter ${encounterId} missing required vitals` };
  }

  console.log(`All prerequisites met. Syncing eRx patient for patient ${patientId}, encounter ${encounterId}`);

  // Step 1: Sync the patient with the eRx service
  await oystehr.erx.syncPatient({ patientId, encounterId });
  console.log(`Successfully synced eRx patient ${patientId}`);

  // Step 2: Fetch medication history to warm the upstream cache.
  try {
    const history = await oystehr.erx.getMedicationHistory({ patientId });
    console.log(`Fetched medication history for patient ${patientId}: ${history.length} entries`);
  } catch (historyError: any) {
    console.warn(`Failed to pre-fetch medication history for patient ${patientId}:`, historyError.message);
  }

  // Tag the encounter so the subscription won't fire again for this encounter
  await oystehr.fhir.patch({
    resourceType: 'Encounter',
    id: encounterId,
    operations: [getPatchOperationForNewMetaTag(encounter, FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG)],
  });
  console.log(`Tagged encounter ${encounterId} with eRx sync tag`);

  return {
    statusCode: 200,
    body: `Successfully synced eRx patient for encounter ${encounterId}`,
  };
});
