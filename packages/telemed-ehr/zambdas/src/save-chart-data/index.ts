import { BatchInputPostRequest, BatchInputPutRequest } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  ExamCardsNames,
  ExamFieldsNames,
  SNOMEDCodeConceptInterface,
  makeAllergyResource,
  makeConditionResource,
  makeExamObservationResource,
  makeMedicationResource,
  makeObservationResource,
  makeProcedureResource,
} from 'ehr-utils';
import { examCardsMap, examFieldsMap } from 'ehr-utils/lib/types/api/chart-data/exam-fields-map';
import { getAuth0Token as getM2MClientToken, getPatientEncounter } from '../shared';
import { createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { saveOrUpdateResourceRequest, validateBundleAndExtractSavedChartData } from './helpers';
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
      examObservations,
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

    // get encounter
    console.log(`Getting encounter ${encounterId}`);
    const { encounter, patient } = await getPatientEncounter(encounterId, fhirClient);
    if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
    console.log(`Got encounter with id ${encounter.id}`);

    // validate that patient from encounter exists
    if (patient?.id === undefined) throw new Error(`Encounter ${encounter.id} must be associated with a patient... `);
    console.log(`Got patient with id ${patient.id}`);

    const saveOrUpdateRequests: (BatchInputPostRequest | BatchInputPutRequest)[] = [];

    if (chiefComplaint) {
      // convert cheif complaint Medical Conditions to Conditions preserve FHIR resource ID, add to encounter
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeConditionResource(encounterId, patient.id, chiefComplaint, 'chief-complaint')),
      );
    }

    if (ros) {
      // convert ROS to Conditions preserve FHIR resource ID, add to encounter
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeConditionResource(encounterId, patient.id, ros, 'ros')),
      );
    }

    // convert Medical Conditions [] to Conditions [] and preserve FHIR resource IDs
    conditions?.forEach((condition) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeConditionResource(encounterId, patient.id!, condition, 'medical-condition')),
      );
    });

    // convert Medications [] to MeicationStatement+Medication [] and preserve FHIR resource IDs
    medications?.forEach((medication) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeMedicationResource(encounterId, patient.id!, medication, 'current-medication')),
      );
    });

    // convert Allergy [] to AllergyIntolerance [] and preserve FHIR resource IDs
    allergies?.forEach((allergy) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeAllergyResource(encounterId, patient.id!, allergy, 'known-allergy')),
      );
    });

    procedures?.forEach((procedure) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeProcedureResource(encounterId, patient.id!, procedure, 'surgical-history')),
      );
    });

    if (proceduresNote) {
      // convert Procedure to Procedure (FHIR) and preserve FHIR resource IDs
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeProcedureResource(encounterId, patient.id!, proceduresNote, 'surgical-history-note'),
        ),
      );
    }

    if (observations) {
      // convert Ovservation to Observation (FHIR) [] and preserve FHIR resource IDs

      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeObservationResource(encounterId, patient.id!, observations, 'additional-question'),
        ),
      );
    }

    // convert ExamObservation[] to Observation(FHIR)[] and preserve FHIR resource IDs
    examObservations?.forEach((element) => {
      const mappedSnomedField = examFieldsMap[element.field as ExamFieldsNames];
      const mappedSnomedCard = examCardsMap[element.field as ExamCardsNames];
      let snomedCode: SNOMEDCodeConceptInterface;

      if (!mappedSnomedField && !mappedSnomedCard)
        throw new Error('Provided "element.field" property is not recognized.');
      if (mappedSnomedField && typeof element.value === 'boolean') {
        element.note = undefined;
        snomedCode = mappedSnomedField;
      } else if (mappedSnomedCard && element.note) {
        element.value = undefined;
        snomedCode = mappedSnomedCard;
      } else {
        throw new Error(
          `Exam observation resource must contain string field: 'note', or boolean: 'value', depends on this resource type is exam-field or exam-card. Resource type determines by 'field' prop.`,
        );
      }

      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeExamObservationResource(encounterId, patient.id!, element, snomedCode)),
      );
    });

    console.log('Starting a transaction update of chart data...');
    const transactionBundle = await fhirClient.transactionRequest({
      requests: saveOrUpdateRequests,
    });
    console.log('Updated chart data as a transaction');

    const output = validateBundleAndExtractSavedChartData(transactionBundle, patient.id!);

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
