import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, FhirResource, Patient, Practitioner, Resource } from 'fhir/r4b';
import { PUBLIC_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { ChartDataRequestedFields, GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { configLabRequestsForGetChartData } from '../lab/shared/labs';
import {
  configProceduresRequestsForGetChartData,
  convertSearchResultsToResponse,
  createFindResourceRequest,
  createFindResourceRequestByEncounterSubject,
  createFindResourceRequestById,
  defaultChartDataFieldsSearchParams,
  encounterSubjectScopedSearchUrl,
  parseChartDataBundle,
  SupportedResourceType,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'get-chart-data';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  console.log('Validating input');
  const { encounterId, secrets, requestedFields } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = (await getChartData(oystehr, m2mToken, encounterId, requestedFields)).response;

  return {
    body: JSON.stringify(output),
    statusCode: 200,
  };
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
    const fieldOptions = requestedFields?.[field as keyof ChartDataRequestedFields];

    const defaultSearchParams = defaultChartDataFieldsSearchParams[field];

    if (!requestedFields || fieldOptions) {
      chartDataRequests.push(
        createFindResourceRequest(
          encounterId,
          resourceType,
          { ...defaultSearchParams, ...fieldOptions },
          defaultSearchBy
        )
      );
    }
  }

  chartDataRequests.push(createFindResourceRequestById(encounterId, 'Encounter'));

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

  // TODO: I commented out this code during the chart-data store refactoring,
  // because cptCodes were being requested with just an empty object,
  // without specifying _searchBy and with default search by encounter,
  // and this variant seems to match what is returned in cptCodes by default without requiredParameters.
  // If this code is no longer needed, it can be removed.
  // ---------------------------------------------------------
  // edge case for Procedures just for getting cpt codes..
  // todo: delete this and just use procedures with special tag in frontend (todo: need to pass tag here through search params most likely)
  // if (requestedFields?.cptCodes) {
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
  //   addRequestIfNeeded({ field: 'cptCodes', resourceType: 'Procedure', defaultSearchBy: 'encounter' });
  // }

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

  if (requestedFields?.historyOfPresentIllness) {
    addRequestIfNeeded({ field: 'historyOfPresentIllness', resourceType: 'Condition', defaultSearchBy: 'encounter' });
  }

  if (requestedFields?.mechanismOfInjury) {
    addRequestIfNeeded({ field: 'mechanismOfInjury', resourceType: 'Condition', defaultSearchBy: 'encounter' });
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
      createFindResourceRequestByEncounterSubject(encounterId, 'Observation', 'subject', requestedFields.birthHistory)
    );
  }

  if (requestedFields?.episodeOfCare) {
    chartDataRequests.push(
      createFindResourceRequestByEncounterSubject(
        encounterId,
        'EpisodeOfCare',
        'patient',
        requestedFields.episodeOfCare
      )
    );
  }

  if (requestedFields?.accident) {
    addRequestIfNeeded({ field: 'accident', resourceType: 'Condition', defaultSearchBy: 'encounter' });
  }

  if (requestedFields == null) {
    // AI chat
    chartDataRequests.push(
      createFindResourceRequest(
        encounterId,
        'DocumentReference',
        // {
        //   type: {
        //     type: 'string',
        //     value: '#aiInterviewQuestionnaire',
        //   },
        // },
        {},
        'encounter'
      )
    );
  }

  // Practitioners
  if (requestedFields?.practitioners) {
    chartDataRequests.push({
      method: 'GET',
      url: `/Practitioner?_has:Encounter:participant:_id=${encounterId}`,
    });
  }

  if (requestedFields?.externalLabResults || requestedFields?.inHouseLabResults) {
    const labRequests = configLabRequestsForGetChartData(encounterId);
    chartDataRequests.push(...labRequests);
  }

  if (requestedFields?.radiologyOrders) {
    addRequestIfNeeded({ field: 'radiologyOrders', resourceType: 'ServiceRequest', defaultSearchBy: 'encounter' });
  }

  // procedures can be requested with custom search params (e.g., multiple encounters)
  if (!requestedFields || requestedFields.procedures) {
    const proceduresSearchParams = requestedFields?.procedures;
    // Check if encounterIds are provided in search params for batch request
    const encounterIdsParam = proceduresSearchParams?.encounterIds;
    const encounterIds = encounterIdsParam || encounterId;
    chartDataRequests.push(configProceduresRequestsForGetChartData(encounterIds));
  }

  if (requestedFields?.preferredPharmacies) {
    // This used to be gated on the patient already having contained pharmacy Organizations, which
    // required the patient resource up front. The response's pharmacy list is built entirely from
    // patient.contained and the QuestionnaireResponse only marks which of those is primary, so
    // issuing the search unconditionally produces the same output.
    chartDataRequests.push(
      createFindResourceRequest(encounterId, 'QuestionnaireResponse', { _search_by: 'encounter' })
    );
  }

  // Determine if we need to check whether the patient is new
  const shouldFetchPatientHasPreviousVisits = !requestedFields || 'patientHasPreviousVisits' in requestedFields;

  console.timeLog('check', 'before resources fetch');
  console.log('Starting a transaction to retrieve chart data...');

  // The patient resource is fetched alongside the chart batch rather than ahead of it, and is
  // kept out of the merged bundle below so the set of resources feeding the response is unchanged.
  const patientPromise = oystehr.fhir
    .batch<Patient>({
      requests: [{ method: 'GET', url: encounterSubjectScopedSearchUrl('Patient', null, encounterId) }],
    })
    .then((result) => {
      const nested = result.entry?.[0]?.resource as Bundle<Patient> | undefined;
      return nested?.entry?.map((entry) => entry.resource).find((resource) => resource?.resourceType === 'Patient');
    });

  // Run the chart-data batch, the patient lookup and the patientHasPreviousVisits query in parallel
  const [batchResult, patient, appointmentCountResult] = await Promise.all([
    oystehr.fhir
      .batch<FhirResource>({
        requests: chartDataRequests,
      })
      .catch((error) => {
        console.log('Error fetching chart data...', error, JSON.stringify(error));
        throw new Error(`Unable to retrieve chart data for encounter with ID ${encounterId}`);
      }),
    patientPromise,
    shouldFetchPatientHasPreviousVisits
      ? oystehr.fhir
          .batch<FhirResource>({
            requests: [
              {
                method: 'GET',
                // Same count as `Appointment?patient._id=<patientId>`, reached through the encounter
                // so it needs no prefetched patient id.
                url: `/Appointment?patient:Patient._has:Encounter:subject:_id=${encounterId}&_summary=count`,
              },
            ],
          })
          .then((result) => result.entry?.[0]?.resource as Bundle<FhirResource> | undefined)
          .catch((error) => {
            console.log('Error fetching appointment count for patient...', error);
            return undefined;
          })
      : Promise.resolve(undefined),
  ]);

  const result = batchResult;
  console.log('Retrieved chart data...');

  // Same guarantees the old prefetch enforced, in the same order, now that the resources have
  // arrived: the encounter must exist, and it must have a patient as its subject.
  const encounter = parseChartDataBundle(result).find((resource) => resource.resourceType === 'Encounter');
  if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
  if (patient === undefined) throw new Error(`Encounter  ${encounterId} must be associated with a patient... `);
  console.log(`Got encounter with id ${encounter.id} and patient with id ${patient.id}`);
  // console.debug('result JSON\n\n==============\n\n', JSON.stringify(result));

  console.timeLog('check', 'after fetch, before converting chart data to response');
  const chartDataResult = await convertSearchResultsToResponse(
    result,
    m2mToken,
    patient.id!,
    encounterId,
    requestedFields ? (Object.keys(requestedFields) as (keyof ChartDataRequestedFields)[]) : undefined,
    patient,
    oystehr
  );
  console.timeLog('check', 'after converting to response');

  if (chartDataResult.chartData.aiChat) {
    const practitionerIDs = chartDataResult.chartData.aiChat.documents
      .filter((document) => document.resourceType === 'DocumentReference')
      .map(
        (document) =>
          document.extension
            ?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
            ?.valueReference?.reference?.split('/')[1]
      )
      .filter((practitionerID) => practitionerID != null);
    if (practitionerIDs.length > 0) {
      console.log('Getting Practitioners');
      const practitioners = (
        await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [
            {
              name: '_id',
              value: practitionerIDs.join(','),
            },
          ],
        })
      ).unbundle();
      chartDataResult.chartData.aiChat.providers = practitioners;
    }
  }
  // Set patientHasPreviousVisits based on appointment count
  if (appointmentCountResult !== undefined) {
    const appointmentCount = appointmentCountResult.total ?? 0;
    // More than 1 appointment means the patient has previous visits (current appointment is one of them)
    chartDataResult.chartData.patientHasPreviousVisits = appointmentCount > 1;
  }

  console.timeEnd('check');

  return {
    response: chartDataResult.chartData,
    chartResources: chartDataResult.chartResources,
  };
}
