import Oystehr, {
  BatchInputGetRequest,
  BatchInputPostRequest,
  BatchInputPutRequest,
  BatchInputRequest,
  FhirSearchParams,
} from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import {
  ChartDataResources,
  EXAM_OBSERVATION_META_SYSTEM,
  flattenBundleResources,
  isFollowupEncounter,
  OTTEHR_MODULE,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { createFindResourceRequest } from '../ehr/get-chart-data/helpers';
import {
  chartDataResourceHasMetaTagBySystem,
  getAuth0Token,
  getPatientEncounter,
  makeExamObservationResource,
  saveResourceRequest,
} from '../shared';
import { createExamObservations } from '../subscriptions/appointment/appointment-chart-data-prefilling/helpers';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

async function recoverObservationsForAppointment(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  const appointmentsSearchParams: FhirSearchParams<FhirResource> = {
    resourceType: 'Appointment',
    params: [
      { name: '_tag', value: OTTEHR_MODULE.IP },
      {
        name: '_sort',
        value: 'date',
      },
      { name: '_revinclude', value: 'Encounter:appointment' },
      { name: '_revinclude:iterate', value: 'Observation:encounter' },
    ],
  };

  // The very first offset is 1900
  const FIRST_OFFSET = 1900;
  let total = 1;

  const fixedEncounterIds: string[] = [];
  const failedEncounterIds: string[] = [];

  // Create a new array to avoid mutating the original params
  const params = [
    ...(appointmentsSearchParams.params ?? []),
    { name: '_count', value: `1` },
    { name: '_total', value: 'accurate' },
  ];

  // First, get total count using offset = FIRST_OFFSET
  {
    const initialResponse = await oystehr.fhir.search<FhirResource>({
      resourceType: appointmentsSearchParams.resourceType,
      params: [...params, { name: '_offset', value: `${FIRST_OFFSET}` }],
    });
    total = initialResponse.total || 0;
    console.log('Total is: ', total);
  }

  // If the total is less than FIRST_OFFSET, nothing to do
  if (total <= FIRST_OFFSET) {
    console.log('Total is less than or equal to FIRST_OFFSET, nothing to process.');
  } else {
    const partitionLen = Math.ceil((total - FIRST_OFFSET) / 4);
    // Parallel threads array
    const workers: Promise<void>[] = [];

    // Helper processing logic per "thread"
    const processPartition = async (startIdx: number, endIdx: number): Promise<void> => {
      let currentIndex = startIdx;
      while (currentIndex < endIdx && currentIndex < total) {
        console.log('Current index: ', currentIndex);
        const bundledResponse = await oystehr.fhir.search<FhirResource>({
          resourceType: appointmentsSearchParams.resourceType,
          params: [...params, { name: '_offset', value: `${currentIndex}` }],
        });
        const matchedCount = bundledResponse.entry?.filter((entry) => entry.search?.mode === 'match').length || 0;
        // (Total could in theory change per results, but let's use initial total for partition indices)
        const unbundled = bundledResponse.unbundle();
        const examObservations = unbundled.filter(
          (resource) =>
            resource.resourceType === 'Observation' &&
            chartDataResourceHasMetaTagBySystem(
              resource,
              `${PRIVATE_EXTENSION_BASE_URL}/${EXAM_OBSERVATION_META_SYSTEM}`
            )
        );
        if (examObservations.length < 141) {
          const encounterId = unbundled.find((res) => res.resourceType === 'Encounter' && !isFollowupEncounter(res))
            ?.id;
          const appointmentId = unbundled.find((res) => res.resourceType === 'Appointment')?.id;
          if (!encounterId || !appointmentId) {
            console.log('No encounter or appointment found for index: ' + currentIndex);
            currentIndex += matchedCount > 0 ? matchedCount : 1;
            continue;
          }
          try {
            const fixed = await fixEncounterObservations(encounterId, oystehr);
            if (fixed) {
              fixedEncounterIds.push(encounterId);
              console.log('Fixed encounter: ' + encounterId);
              console.log('Appointment id: ' + appointmentId);
            } else {
              failedEncounterIds.push(encounterId);
              console.log('Failed to fix encounter: ' + encounterId);
              console.log('Appointment id: ' + appointmentId);
            }
          } catch (e) {
            console.log('Error fixing encounter: ' + encounterId);
            console.log('Error: ', e);
            failedEncounterIds.push(encounterId);
          }
        }
        currentIndex += matchedCount > 0 ? matchedCount : 1; // Avoid infinite loops if result is empty
      }
    };

    for (let i = 0; i < 4; i++) {
      const startIdx = FIRST_OFFSET + i * partitionLen;
      // End index is one past the last for this thread
      const endIdx = Math.min(FIRST_OFFSET + (i + 1) * partitionLen, total);
      workers.push(processPartition(startIdx, endIdx));
    }

    // Wait for all threads to finish
    await Promise.all(workers);
  }

  console.log('Fixed encounter ids: ', fixedEncounterIds);
  console.log('Failed encounter ids: ', failedEncounterIds);
}

async function fixEncounterObservations(encounterId: string, oystehr: Oystehr): Promise<boolean> {
  const patientEncounter = await getPatientEncounter(encounterId, oystehr);
  const patient = patientEncounter.patient;
  const encounter = patientEncounter.encounter;
  const chartDataRequests: BatchInputGetRequest[] = [];
  const saveOrUpdateRequests: (
    | BatchInputPostRequest<ChartDataResources>
    | BatchInputPutRequest<ChartDataResources>
    | BatchInputRequest<ChartDataResources>
  )[] = [];
  const obsRequest = createFindResourceRequest(
    patient,
    encounter,
    'Observation',
    { _search_by: 'encounter' },
    'encounter'
  );
  chartDataRequests.push(obsRequest);
  const result = await oystehr.fhir.batch<FhirResource>({
    requests: chartDataRequests,
  });
  const existingObservations = flattenBundleResources<FhirResource>(result);
  // for (const resource of existingObservations) {
  //   if (
  //     resource?.resourceType === 'Observation' &&
  //     chartDataResourceHasMetaTagBySystem(resource, `${PRIVATE_EXTENSION_BASE_URL}/${EXAM_OBSERVATION_META_SYSTEM}`)
  //   ) {
  //     // console.log('Observation found: ', resource.id, resource.code?.text);
  //   }
  // }
  // Exam observations
  const examObservations = createExamObservations(true);
  for (const element of examObservations) {
    const { code, bodySite, label, ...rest } = element;
    if (
      existingObservations.some(
        (o) => o.resourceType === 'Observation' && o.meta?.tag?.some((t) => t.code === element.field)
      )
    ) {
      continue; // Observation already exists
    }
    saveOrUpdateRequests.push(
      saveResourceRequest(
        makeExamObservationResource(encounterId, patient!.id!, rest, code ? { code, bodySite } : undefined, label)
      )
    );
  }
  const saveOrUpdateResult = await oystehr.fhir.batch<FhirResource>({
    requests: saveOrUpdateRequests,
  });
  if (saveOrUpdateResult.entry?.some((e) => e.response?.outcome?.id !== 'ok')) {
    console.log('Failed to save or update observations for encounter: ' + encounterId);
    console.log('SaveOrUpdateResult: ', JSON.stringify(saveOrUpdateResult, null, 2));
    return false;
  }
  return true;
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile((config: any) => recoverObservationsForAppointment(config));
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
