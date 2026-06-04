import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Observation, Patient } from 'fhir/r4b';
import {
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG,
  getErxPatientDemographicErrors,
  getPatchOperationForNewMetaTag,
  is18YearsOrYounger,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-erx-patient-sync';

const WEIGHT_LOINC = '29463-7';
const HEIGHT_LOINC = '8302-2';

const isEncounterSynced = (encounter: Encounter): boolean =>
  encounter.meta?.tag?.some(
    (tag) =>
      tag.system === FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.system && tag.code === FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG.code
  ) ?? false;

const tagEncounterAsSynced = async (oystehr: Oystehr, encounterId: string, encounter: Encounter): Promise<void> => {
  let current = encounter;
  let retries = 0;

  while (retries < 5) {
    if (isEncounterSynced(current)) {
      return;
    }

    try {
      await oystehr.fhir.patch(
        {
          resourceType: 'Encounter',
          id: encounterId,
          operations: [getPatchOperationForNewMetaTag(current, FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG)],
        },
        { optimisticLockingVersionId: current.meta?.versionId }
      );
      return;
    } catch (patchError) {
      retries++;
      console.warn(`Tagging encounter ${encounterId} failed (attempt ${retries}), refreshing encounter`, patchError);
      current = await oystehr.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: encounterId,
      });
    }
  }
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { encounterId, patientId, triggerType, secrets } = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);
  console.log('Created M2M token and oystehr client');

  const [patientBundle, encounterBundle] = await Promise.all([
    oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        {
          name: '_id',
          value: patientId,
        },
      ],
    }),
    oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
      ],
    }),
  ]);

  const patient = patientBundle.entry?.[0]?.resource;
  if (!patient) {
    throw new Error(`Patient ${patientId} not found`);
  }

  const encounter = encounterBundle.entry?.[0]?.resource;
  if (!encounter) {
    throw new Error(`Encounter ${encounterId} not found`);
  }

  if (isEncounterSynced(encounter) && triggerType !== 'observation') {
    console.log(`Encounter ${encounterId} already synced with eRx, skipping`);
    return {
      statusCode: 200,
      body: `Encounter ${encounterId} already synced`,
    };
  }

  // In the case of E2E tests, the patient commonly gets deleted while the patient sync endpoint is processing, which causes the patient sync endpoint to blow up
  // I also don't think we'll ever make an E2E test that needs this warmup of patient sync + med history to work. So we'll skip.
  const isE2eTestPatient = patient.meta?.tag?.some(
    (tag) => tag.system && E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM === tag.system
  );
  if (isE2eTestPatient) {
    console.log(`Patient ${patientId} is an e2e test resource, skipping eRx patient sync + med history fetch`);
    return { statusCode: 200, body: `Patient ${patientId} is an e2e test resource, skipping` };
  }

  const demographicErrors = getErxPatientDemographicErrors(patient);
  if (demographicErrors.length > 0) {
    console.log(`Patient ${patientId} missing/invalid fields: ${demographicErrors.join(', ')}, skipping sync`);
    return {
      statusCode: 200,
      body: `Patient ${patientId} missing/invalid fields: ${demographicErrors.join(', ')}`,
    };
  }

  if (is18YearsOrYounger(patient.birthDate!)) {
    const vitalsBundle = await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        {
          name: 'encounter',
          value: `Encounter/${encounterId}`,
        },
        {
          name: 'code',
          value: `${HEIGHT_LOINC},${WEIGHT_LOINC}`,
        },
      ],
    });

    const observations = vitalsBundle.entry?.map((e) => e.resource).filter(Boolean) as Observation[] | undefined;
    const hasHeight = observations?.some((obs) => obs.code?.coding?.some((c) => c.code === HEIGHT_LOINC));
    const hasWeight = observations?.some((obs) => obs.code?.coding?.some((c) => c.code === WEIGHT_LOINC));

    if (!hasHeight || !hasWeight) {
      console.log(
        `Encounter ${encounterId} missing vitals (height: ${hasHeight}, weight: ${hasWeight}), skipping sync`
      );
      return {
        statusCode: 200,
        body: `Encounter ${encounterId} missing required vitals`,
      };
    }
  }

  console.log(`All prerequisites met. Syncing eRx patient for patient ${patientId}, encounter ${encounterId}`);

  // Step 1: Sync the patient with the eRx service
  try {
    await oystehr.erx.syncPatient({
      patientId,
      encounterId,
    });
    console.log(`Successfully synced eRx patient ${patientId}`);
  } catch (syncError: any) {
    console.error(`Failed to sync eRx patient ${patientId}:`, syncError);
    // Intentionally not rethrowing or returning an error here. It's OK if it doesn't succeed because it self heals later on.
  }

  try {
    const history = await oystehr.erx.getMedicationHistory({ patientId });
    console.log(`Fetched medication history for patient ${patientId}: ${history.length} entries`);
  } catch (historyError: any) {
    console.warn(`Failed to pre-fetch medication history for patient ${patientId}:`, historyError.message);
    // Intentionally not rethrowing or returning an error here. It's OK if it doesn't succeed because it self heals later on.
  }

  // Tag the encounter so the visit trigger won't re-sync this visit (the vitals trigger still can)
  await tagEncounterAsSynced(oystehr, encounterId, encounter);
  console.log(`Tagged encounter ${encounterId} with eRx sync tag`);
  console.log(`Successfully completed eRx patient sync and medication history fetch for patient ${patientId}`);

  return {
    statusCode: 200,
    body: `Successfully synced eRx patient ${patientId} for encounter ${encounterId}`,
  };
});
