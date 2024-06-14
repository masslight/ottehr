import { BatchInputGetRequest } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, FhirResource } from 'fhir/r4';
import { getPatientEncounter } from '../shared';
import { checkOrCreateM2MClientToken, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import {
  convertSearchResultsToResponse,
  createFindResourceRequest,
  createFindResourceRequestById,
  createFindResourceRequestEncounterField,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { encounterId, secrets } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);

    // 0. get encounter
    console.log(`Getting encounter ${encounterId}`);
    const patientEncounter = await getPatientEncounter(encounterId, fhirClient);
    const encounter = patientEncounter.encounter;
    if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
    console.log(`Got encounter with id ${encounter.id}`);

    // 1. get patient from encounter
    const patient = patientEncounter.patient;
    if (patient === undefined) throw new Error(`Encounter  ${encounter.id} must be associated with a patient... `);
    console.log(`Got patient with id ${patient.id}`);

    const chartDataRequests: BatchInputGetRequest[] = [];
    chartDataRequests.push(createFindResourceRequest(patient.id!, 'AllergyIntolerance', 'patient'));
    chartDataRequests.push(createFindResourceRequest(patient.id!, 'Condition', 'subject'));
    chartDataRequests.push(createFindResourceRequest(patient.id!, 'MedicationStatement', 'subject'));
    chartDataRequests.push(createFindResourceRequest(patient.id!, 'Procedure', 'subject'));
    chartDataRequests.push(createFindResourceRequestEncounterField(encounter.id!, 'Observation'));
    chartDataRequests.push(createFindResourceRequestEncounterField(encounter.id!, 'ClinicalImpression'));
    chartDataRequests.push(createFindResourceRequestEncounterField(encounter.id!, 'Communication'));
    chartDataRequests.push(createFindResourceRequestEncounterField(encounter.id!, 'ServiceRequest'));
    chartDataRequests.push(createFindResourceRequestById(encounter.id!, 'Encounter'));
    chartDataRequests.push(createFindResourceRequestEncounterField(encounter.id!, 'DocumentReference'));

    console.log('Starting a transaction to retrieve chart data...');
    let result: Bundle<FhirResource> | undefined;
    try {
      result = await fhirClient.batchRequest({
        requests: chartDataRequests,
      });
    } catch (error) {
      console.log('Error fetching chart data...', error, JSON.stringify(error));
      throw new Error(`Unable to retrieve chart data for patient with ID ${patient.id}`);
    }
    console.log('Retrieved chart data...');
    console.debug('result JSON\n\n==============\n\n', JSON.stringify(result));

    const output = convertSearchResultsToResponse(result, patient.id!);

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
};
