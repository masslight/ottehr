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

  // Fetch the encounter and patient in parallel
  const [encounterBundle, patientBundle] = await Promise.all([
    oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: '_id', value: encounterId }],
    }),
    oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [{ name: '_id', value: patientId }],
    }),
  ]);

  const encounter = encounterBundle.entry?.[0]?.resource;
  if (!encounter) {
    throw new Error(`Encounter ${encounterId} not found`);
  }

  const alreadySynced = encounter.meta?.tag?.some(
    (tag: { system?: string; code?: string }) =>
      tag.system === FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.system && tag.code === FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.code
  );
  if (alreadySynced) {
    console.log(`Encounter ${encounterId} already synced with eRx, skipping`);
    return { statusCode: 200, body: `Encounter ${encounterId} already synced` };
  }

  const patient = patientBundle.entry?.[0]?.resource;
  if (!patient) {
    throw new Error(`Patient ${patientId} not found`);
  }
  const firstName = getFirstName(patient);
  const lastName = getLastName(patient);
  const birthDate = patient.birthDate;
  const gender = patient.gender;
  const phone = patient.telecom?.find((t) => t.system === 'phone')?.value;
  const address = patient.address?.[0];

  const missingFields: string[] = [];
  if (!firstName || !lastName) missingFields.push('name');
  if (!birthDate) missingFields.push('birthDate');
  if (!gender) missingFields.push('gender');
  if (!phone) missingFields.push('phone');
  if (!address?.line?.[0] || !address?.city || !address?.state || !address?.postalCode) missingFields.push('address');

  if (missingFields.length > 0) {
    console.log(`Patient ${patientId} missing required fields: ${missingFields.join(', ')}, skipping sync`);
    return { statusCode: 200, body: `Patient ${patientId} missing required fields: ${missingFields.join(', ')}` };
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
  console.log(
    `Successfully completed eRx patient sync and medication history fetch for patient ${patientId}, encounter ${encounterId}`
  );

  return {
    statusCode: 200,
    body: `Successfully synced eRx patient for encounter ${encounterId}`,
  };
});
