import { BatchInputDeleteRequest, BatchInputPutRequest } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';

import { checkOrCreateM2MClientToken, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { deleteResourceRequest, getEncounterAndRelatedResources, updateResourceRequest } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';
import {
  AllergyDTO,
  CommunicationDTO,
  ExamObservationDTO,
  MedicalConditionDTO,
  MedicationDTO,
  ProcedureDTO,
} from 'ehr-utils';
import { DocumentReference, Encounter, Patient } from 'fhir/r4';
import { deleteZ3Object } from '../shared/z3Utils';
import {
  chartDataResourceHasMetaTagByCode,
  deleteEncounterAddendumNote,
  deleteEncounterDiagnosis,
  updateEncounterDischargeDisposition,
} from '../shared/chart-data/chart-data-helpers';

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
      medicalDecision,
      cptCodes,
      instructions,
      disposition,
      diagnosis,
      schoolWorkNotes,
      addendumNote,
    } = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);

    const fhirClient = createFhirClient(m2mtoken, secrets);

    // 0. get encounter
    console.log(`Getting encounter ${encounterId}`);
    const allResources = await getEncounterAndRelatedResources(fhirClient, encounterId);
    const encounter = allResources.filter((resource) => resource.resourceType === 'Encounter')[0] as Encounter;
    if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
    console.log(`Got encounter with id ${encounter.id}`);

    // 1. get patient from encounter
    const patient = allResources.filter((resource) => resource.resourceType === 'Patient')[0] as Patient;
    if (patient === undefined) throw new Error(`Encounter  ${encounter.id} must be associated with a patient... `);
    console.log(`Got patient with id ${patient.id}`);

    const deleteOrUpdateRequests: (BatchInputDeleteRequest | BatchInputPutRequest)[] = [];
    let updatedEncounterResource: Encounter = { ...encounter };

    // 2. delete  Medical Condition associated with chief complaint
    if (chiefComplaint) {
      deleteOrUpdateRequests.push(deleteResourceRequest('Condition', chiefComplaint.resourceId!));
    }
    if (ros) {
      deleteOrUpdateRequests.push(deleteResourceRequest('Condition', ros.resourceId!));
    }

    // 3. delete Medical Conditions
    conditions?.forEach((element: MedicalConditionDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Condition', element.resourceId!));
    });

    // 4. delete Current Medications
    medications?.forEach((element: MedicationDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('MedicationAdministration', element.resourceId!));
    });

    // 5. delete Allergies
    allergies?.forEach((element: AllergyDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('AllergyIntolerance', element.resourceId!));
    });

    if (proceduresNote) {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', proceduresNote.resourceId!));
    }

    // 6. delete Procedures
    procedures?.forEach((element: ProcedureDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', element.resourceId!));
    });

    // 7. delete Observations
    if (observations) {
      deleteOrUpdateRequests.push(deleteResourceRequest('Observation', observations.resourceId!));
    }

    // 8. delete ExamObservations
    examObservations?.forEach((element: ExamObservationDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Observation', element.resourceId!));
    });

    // 9. delete ClinicalImpression
    if (medicalDecision) {
      deleteOrUpdateRequests.push(deleteResourceRequest('ClinicalImpression', medicalDecision.resourceId!));
    }

    // 10. delete cpt-codes Procedures
    cptCodes?.forEach((cptCode: ProcedureDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', cptCode.resourceId!));
    });

    // 11. delete Communications
    instructions?.forEach((element: CommunicationDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Communication', element.resourceId!));
    });

    // 12. delete disposition ServiceRequests and encounter properties
    if (disposition) {
      updatedEncounterResource = updateEncounterDischargeDisposition(updatedEncounterResource, undefined);
      // deletes all ServiceRequest attached to encounter
      allResources.forEach((resource) => {
        if (
          resource.resourceType === 'ServiceRequest' &&
          (chartDataResourceHasMetaTagByCode(resource, 'disposition-follow-up') ||
            chartDataResourceHasMetaTagByCode(resource, 'sub-follow-up'))
        ) {
          deleteOrUpdateRequests.push(deleteResourceRequest('ServiceRequest', resource.id!));
        }
      });
    }

    // 13. delete diagnosis Conditions and Encounter properties
    diagnosis?.forEach((element) => {
      updatedEncounterResource = deleteEncounterDiagnosis(updatedEncounterResource, element.resourceId!);
      deleteOrUpdateRequests.push(deleteResourceRequest('Condition', element.resourceId!));
    });

    if (addendumNote) {
      updatedEncounterResource = deleteEncounterAddendumNote(updatedEncounterResource);
    }

    // 14. delete work-school excuse note DocumentReference resource
    schoolWorkNotes?.forEach((element) => {
      const documentReference = allResources.find((resource) => resource.id === element.id);
      if (documentReference)
        deleteOrUpdateRequests.push(deleteResourceRequest('DocumentReference', documentReference.id!));
    });

    deleteOrUpdateRequests.push(updateResourceRequest(updatedEncounterResource));
    console.log('Starting a transaction update of chart data...');
    await fhirClient.transactionRequest({
      requests: deleteOrUpdateRequests,
    });
    console.log('Updated chart data as a transaction');

    // perform deleting z3 pdf objects after deleting all fhir resources
    if (schoolWorkNotes) {
      for (const schoolWorkNote of schoolWorkNotes) {
        const documentReference = allResources.find(
          (resource) => resource.id === schoolWorkNote.id,
        ) as DocumentReference;
        const fileUrl = documentReference.content[0].attachment.url;
        if (fileUrl) await deleteZ3Object(fileUrl, m2mtoken);
      }
    }

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
