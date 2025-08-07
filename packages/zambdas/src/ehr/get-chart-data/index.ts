import Oystehr, { BatchInputGetRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Resource } from 'fhir/r4b';
import { ChartDataFields, ChartDataRequestedFields, GetChartDataResponse } from 'utils';
import { checkOrCreateM2MClientToken, getPatientEncounter, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { configLabRequestsForGetChartData } from '../shared/labs';
import {
  configProceduresRequestsForGetChartData,
  convertSearchResultsToResponse,
  createFindResourceRequest,
  createFindResourceRequestById,
  createFindResourceRequestByPatientField,
  defaultChartDataFieldsSearchParams,
  SupportedResourceType,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('get-chart-data', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { encounterId, secrets, requestedFields } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const output = (await getChartData(oystehr, m2mToken, encounterId, requestedFields)).response;

    return {
      body: JSON.stringify(output),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error saving encounter data...' }),
      statusCode: 500,
    };
  }
});

export async function getChartData(
  oystehr: Oystehr,
  m2mToken: string,
  encounterId: string,
  requestedFields?: ChartDataRequestedFields
): Promise<{
  response: GetChartDataResponse;
  chartResources: Resource[];
}> {
  console.time('check');

  console.timeLog('check', 'before fetching patient encounter');
  // 0. get encounter
  console.log(`Getting encounter ${encounterId}`);
  const patientEncounter = await getPatientEncounter(encounterId, oystehr);
  const encounter = patientEncounter.encounter;
  if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
  console.log(`Got encounter with id ${encounter.id}`);
  console.timeLog('check', 'after fetching patient encounter');

  // 1. get patient from encounter
  const patient = patientEncounter.patient;
  if (patient === undefined) throw new Error(`Encounter  ${encounter.id} must be associated with a patient... `);
  console.log(`Got patient with id ${patient.id}`);

  const chartDataRequests: BatchInputGetRequest[] = [];

  function addRequestIfNeeded<K extends keyof GetChartDataResponse>({
    field,
    resourceType,
    defaultSearchBy,
  }: {
    field: K;
    resourceType: SupportedResourceType;
    defaultSearchBy?: 'encounter' | 'patient';
  }): void {
    const fieldOptions = requestedFields?.[field];
    const defaultSearchParams = defaultChartDataFieldsSearchParams[field];

    if (!requestedFields || fieldOptions) {
      chartDataRequests.push(
        createFindResourceRequest(
          patient,
          encounter,
          resourceType,
          { ...fieldOptions, ...defaultSearchParams },
          defaultSearchBy
        )
      );
    }
  }

  chartDataRequests.push(createFindResourceRequestById(encounter.id!, 'Encounter'));

  // allergies are always by-patient and does not have history, so no need to search by encounter
  addRequestIfNeeded({ field: 'allergies', resourceType: 'AllergyIntolerance', defaultSearchBy: 'patient' });

  // search by patient by default
  addRequestIfNeeded({ field: 'conditions', resourceType: 'Condition', defaultSearchBy: 'patient' });

  // search by patient by default
  addRequestIfNeeded({ field: 'medications', resourceType: 'MedicationStatement', defaultSearchBy: 'patient' });

  // search by patient by default
  addRequestIfNeeded({
    field: 'inhouseMedications',
    resourceType: 'MedicationStatement',
    defaultSearchBy: 'patient',
  });

  // search by patient by default
  addRequestIfNeeded({ field: 'surgicalHistory', resourceType: 'Procedure', defaultSearchBy: 'patient' });

  // edge case for Procedures just for getting cpt codes..
  // todo: delete this and just use procedures with special tag in frontend (todo: need to pass tag here through search params most likely)
  if (requestedFields?.cptCodes) {
    /**
     * TODO: Research if we can modify addRequestIfNeeded to include the requested field
     *  in the default query when fields are not defined, instead of adding this condition.
     *
     * Without requestedFields addRequestIfNeeded generates URL like /Procedure?encounter=Encounter/:id,
     * while the code above addRequestIfNeeded({
     *   field: 'procedures',
     *   resourceType: 'Procedure',
     *   defaultSearchBy: 'patient'
     * }) without requestedFields produces URL like /Procedure?subject=Patient/:id.
     * Current solution: To avoid duplicates, run this request only with requestedFields.
     */

    // Comment: theoretically can be solved by using defaultSearchParams added to addRequestIfNeeded logic
    addRequestIfNeeded({ field: 'cptCodes', resourceType: 'Procedure', defaultSearchBy: 'encounter' });
  }

  // search by encounter by default
  addRequestIfNeeded({ field: 'observations', resourceType: 'Observation', defaultSearchBy: 'encounter' });

  // instructions are just per-encounter, so no need to search by patient
  addRequestIfNeeded({ field: 'instructions', resourceType: 'Communication', defaultSearchBy: 'encounter' });

  // for now school work notes are just per-encounter, so no need to search by patient
  addRequestIfNeeded({ field: 'schoolWorkNotes', resourceType: 'DocumentReference', defaultSearchBy: 'encounter' });

  if (requestedFields?.disposition) {
    // disposition is just per-encounter, so no need to search by patient
    addRequestIfNeeded({ field: 'disposition', resourceType: 'ServiceRequest', defaultSearchBy: 'encounter' });
  }

  if (requestedFields?.prescribedMedications) {
    // for now prescribed meds are just per-encounter, so no need to search by patient
    addRequestIfNeeded({
      field: 'prescribedMedications',
      resourceType: 'MedicationRequest',
      defaultSearchBy: 'encounter',
    });
  }

  // notes included only by straight request
  if (requestedFields?.notes) {
    addRequestIfNeeded({ field: 'notes', resourceType: 'Communication', defaultSearchBy: 'patient' });
  }

  if (requestedFields?.chiefComplaint) {
    addRequestIfNeeded({ field: 'chiefComplaint', resourceType: 'Condition', defaultSearchBy: 'encounter' });
  }

  if (requestedFields?.ros) {
    addRequestIfNeeded({ field: 'ros', resourceType: 'Condition', defaultSearchBy: 'encounter' });
  }

  if (requestedFields?.surgicalHistoryNote) {
    addRequestIfNeeded({ field: 'surgicalHistoryNote', resourceType: 'Procedure', defaultSearchBy: 'encounter' });
  }

  if (requestedFields?.medicalDecision) {
    addRequestIfNeeded({ field: 'medicalDecision', resourceType: 'ClinicalImpression', defaultSearchBy: 'encounter' });
  }

  // vitalsObservations included only by straight request
  if (requestedFields?.vitalsObservations) {
    // search by encounter by default
    addRequestIfNeeded({ field: 'vitalsObservations', resourceType: 'Observation', defaultSearchBy: 'encounter' });
  }
  // birthHistory included only by straight request
  if (requestedFields?.birthHistory) {
    chartDataRequests.push(
      createFindResourceRequestByPatientField(patient.id!, 'Observation', 'subject', requestedFields.birthHistory)
    );
  }

  if (requestedFields?.episodeOfCare) {
    chartDataRequests.push(
      createFindResourceRequestByPatientField(patient.id!, 'EpisodeOfCare', 'patient', requestedFields.episodeOfCare)
    );
  }

  if (requestedFields == null) {
    // AI chat
    chartDataRequests.push(
      createFindResourceRequest(
        patient,
        encounter,
        'QuestionnaireResponse',
        {
          questionnaire: {
            type: 'string',
            value: '#aiInterviewQuestionnaire',
          },
        },
        'encounter'
      )
    );
  }

  // Practitioners
  if (requestedFields?.practitioners) {
    encounter?.participant?.forEach((participant) => {
      const [participantType, participantId] = participant.individual?.reference?.split('/') ?? [];
      if (participantType === 'Practitioner' && participantId != null) {
        chartDataRequests.push(createFindResourceRequestById(participantId, 'Practitioner'));
      }
    });
  }

  if ((requestedFields?.externalLabResults || requestedFields?.inHouseLabResults) && encounter.id) {
    const labRequests = configLabRequestsForGetChartData(encounter.id);
    chartDataRequests.push(...labRequests);
  }

  if ((!requestedFields || requestedFields.procedures) && encounter.id) {
    chartDataRequests.push(configProceduresRequestsForGetChartData(encounter.id));
  }

  console.timeLog('check', 'before resources fetch');
  console.log('Starting a transaction to retrieve chart data...');
  let result: Bundle<FhirResource> | undefined;
  try {
    result = await oystehr.fhir.batch<FhirResource>({
      requests: chartDataRequests,
    });
  } catch (error) {
    console.log('Error fetching chart data...', error, JSON.stringify(error));
    throw new Error(`Unable to retrieve chart data for patient with ID ${patient.id}`);
  }
  console.log('Retrieved chart data...');
  // console.debug('result JSON\n\n==============\n\n', JSON.stringify(result));

  console.timeLog('check', 'after fetch, before converting chart data to response');
  const chartDataResult = await convertSearchResultsToResponse(
    result,
    m2mToken,
    patient.id!,
    encounterId,
    requestedFields ? (Object.keys(requestedFields) as (keyof ChartDataFields)[]) : undefined
  );
  console.timeLog('check', 'after converting to response');
  console.timeEnd('check');

  return {
    response: chartDataResult.chartData,
    chartResources: chartDataResult.chartResources,
  };
}
