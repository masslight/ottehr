import { BatchInputDeleteRequest } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';

import { getAuth0Token as getM2MClientToken, getPatientEncounter } from '../shared';
import { createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { deleteResourceRequest } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const {
      encounterId,
      chiefComplaint,
      ros,
      conditions,
      medications,
      allergies,
      proceduresNote,
      procedures,
      observations,
      secrets,
    } = validateRequestParameters(input);

    console.log('Getting token');
    if (!m2mtoken) {
      console.log('getting m2m token for service calls...');
      m2mtoken = await getM2MClientToken(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }
    console.debug('token (sans signature)', m2mtoken.substring(0, m2mtoken.lastIndexOf('.')));

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

    const deleteRequests: BatchInputDeleteRequest[] = [];

    // 2. delete  Medical Condition associated with chief complaint
    if (chiefComplaint) {
      deleteRequests.push(deleteResourceRequest('Condition', chiefComplaint.resourceId!));
    }
    if (ros) {
      deleteRequests.push(deleteResourceRequest('Condition', ros.resourceId!));
    }

    // 3. delete Medical Conditions
    conditions?.forEach((element) => {
      deleteRequests.push(deleteResourceRequest('Condition', element.resourceId!));
    });

    // 4. delete Current Medications
    medications?.forEach((element) => {
      deleteRequests.push(deleteResourceRequest('MedicationAdministration', element.resourceId!));
    });

    // 5. delete Allergies
    allergies?.forEach((element) => {
      deleteRequests.push(deleteResourceRequest('AllergyIntolerance', element.resourceId!));
    });

    if (proceduresNote) {
      deleteRequests.push(deleteResourceRequest('Procedure', proceduresNote.resourceId!));
    }

    // 6. delete Procedures
    procedures?.forEach((element) => {
      deleteRequests.push(deleteResourceRequest('Procedure', element.resourceId!));
    });

    // 7. delete Observations
    if (observations) {
      deleteRequests.push(deleteResourceRequest('Observation', observations.resourceId!));
      console.log('AAAAAA', deleteRequests);
    }

    console.log('Starting a transaction update of chart data...');
    await fhirClient.transactionRequest({
      requests: deleteRequests,
    });
    console.log('Updated chart data as a transaction');

    return {
      body: JSON.stringify({
        patientId: patient.id,
      }),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error deleting encounter data' }),
      statusCode: 500,
    };
  }
};
