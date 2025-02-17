import { BatchInputDeleteRequest, BatchInputGetRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';

import { Operation } from 'fast-json-patch';

import {
  AllergyIntolerance,
  Bundle,
  ClinicalImpression,
  Communication,
  Condition,
  DocumentReference,
  Encounter,
  FhirResource,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
  ServiceRequest,
} from 'fhir/r4b';
import {
  AllergyDTO,
  CommunicationDTO,
  CPTCodeDTO,
  ExamObservationDTO,
  getPatchBinary,
  MedicalConditionDTO,
  MedicationDTO,
  ObservationDTO,
} from 'utils';
import { createFindResourceRequestByPatientField } from '../get-chart-data/helpers';
import { parseCreatedResourcesBundle } from '../shared';
import {
  chartDataResourceHasMetaTagByCode,
  deleteEncounterAddendumNote,
  deleteEncounterDiagnosis,
  updateEncounterDischargeDisposition,
} from '../shared/chart-data/chart-data-helpers';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { deleteZ3Object } from '../shared/z3Utils';
import { ZambdaInput } from 'zambda-utils';
import { deleteResourceRequest, getEncounterAndRelatedResources } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

type ChartData =
  | AllergyIntolerance
  | ClinicalImpression
  | Communication
  | Condition
  | DocumentReference
  | MedicationStatement
  | Observation
  | Procedure
  | ServiceRequest;

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
      episodeOfCare,
      secrets,
      examObservations,
      medicalDecision,
      cptCodes,
      emCode,
      instructions,
      disposition,
      diagnosis,
      schoolWorkNotes,
      addendumNote,
      notes,
      vitalsObservations,
    } = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);

    const oystehr = createOystehrClient(m2mtoken, secrets);

    // 0. get encounter
    console.log(`Getting encounter ${encounterId}`);
    const allResources = await getEncounterAndRelatedResources(oystehr, encounterId);
    const encounter = allResources.filter((resource) => resource.resourceType === 'Encounter')[0] as Encounter;
    if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
    console.log(`Got encounter with id ${encounter.id}`);

    // 1. get patient from encounter
    const patient = allResources.filter((resource) => resource.resourceType === 'Patient')[0] as Patient;
    if (patient === undefined) throw new Error(`Encounter  ${encounter.id} must be associated with a patient... `);
    console.log(`Got patient with id ${patient.id}`);

    const deleteOrUpdateRequests: (
      | BatchInputDeleteRequest
      | BatchInputPutRequest<ChartData>
      | BatchInputRequest<ChartData>
    )[] = [];
    const updateEncounterOperations: Operation[] = [];

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

    // 5. delete Allergies
    allergies?.forEach((element: AllergyDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('AllergyIntolerance', element.resourceId!));
    });

    if (proceduresNote) {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', proceduresNote.resourceId!));
    }

    // 6. delete Procedures
    procedures?.forEach((element: CPTCodeDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', element.resourceId!));
    });

    // 7. delete Observations
    observations?.forEach((element: ObservationDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Observation', element.resourceId!));
    });

    // 8. delete ExamObservations
    examObservations?.forEach((element: ExamObservationDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Observation', element.resourceId!));
    });

    // 9. delete ClinicalImpression
    if (medicalDecision) {
      deleteOrUpdateRequests.push(deleteResourceRequest('ClinicalImpression', medicalDecision.resourceId!));
    }

    // 10. delete cpt-codes Procedures
    cptCodes?.forEach((cptCode: CPTCodeDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', cptCode.resourceId!));
    });

    if (emCode) {
      deleteOrUpdateRequests.push(deleteResourceRequest('Procedure', emCode.resourceId!));
    }

    // 11. delete Communications
    instructions?.forEach((element: CommunicationDTO) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Communication', element.resourceId!));
    });

    // 12. delete disposition ServiceRequests and encounter properties
    if (disposition) {
      updateEncounterOperations.push(updateEncounterDischargeDisposition(encounter, undefined));
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
      updateEncounterOperations.push(...deleteEncounterDiagnosis(encounter, element.resourceId!));
      deleteOrUpdateRequests.push(deleteResourceRequest('Condition', element.resourceId!));
    });

    if (addendumNote) {
      updateEncounterOperations.push(...deleteEncounterAddendumNote(encounter));
    }

    // 14. delete school-work excuse note DocumentReference resource
    schoolWorkNotes?.forEach((element) => {
      const documentReference = allResources.find((resource) => resource.id === element.id);
      if (documentReference)
        deleteOrUpdateRequests.push(deleteResourceRequest('DocumentReference', documentReference.id!));
    });

    // 15. delete notes
    notes?.forEach((element) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Communication', element.resourceId!));
    });

    // 16. delete vitalsObservations
    vitalsObservations?.forEach((element) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('Observation', element.resourceId!));
    });

    episodeOfCare?.forEach((element) => {
      deleteOrUpdateRequests.push(deleteResourceRequest('EpisodeOfCare', element.resourceId!));
    });

    if (updateEncounterOperations.length > 0) {
      deleteOrUpdateRequests.push(
        getPatchBinary({
          resourceId: encounterId,
          resourceType: 'Encounter',
          patchOperations: updateEncounterOperations,
        })
      );
    }

    const specialRulesDeletions = new Promise((resolve, reject) => {
      // if no resources for special deletion rules were provided - resolve immediately
      if (!medications?.length) {
        resolve(true);
        return;
      }

      const getRequests: BatchInputGetRequest[] = [];
      const specialDeleteOrUpdateRequests: BatchInputRequest<FhirResource>[] = [];
      const request = createFindResourceRequestByPatientField(patient.id, 'MedicationStatement', 'subject');
      request.url += '&_id=';

      // 4. delete Current Medications
      medications?.forEach((element: MedicationDTO, i) => {
        request.url += `${element.resourceId}${i === medications.length - 1 ? '' : ','}`;
      });
      getRequests.push(request);
      oystehr.fhir
        .transaction({
          requests: getRequests,
        })
        .then((results) => {
          const resources = parseCreatedResourcesBundle(parseCreatedResourcesBundle(results as Bundle)[0] as Bundle);
          resources.forEach((res) => {
            if (res.resourceType === 'MedicationStatement') {
              // for medications from current encounter - remove entirely
              if ((<MedicationStatement>res).context?.reference === `Encounter/${encounter.id}`) {
                specialDeleteOrUpdateRequests.push(deleteResourceRequest('MedicationStatement', res.id!));
              } else {
                // otherwise only remove from current medications - mark as not active
                specialDeleteOrUpdateRequests.push(
                  getPatchBinary({
                    resourceId: res.id!,
                    resourceType: 'MedicationStatement',
                    patchOperations: [{ op: 'replace', path: '/status', value: 'completed' }],
                  })
                );
              }
            }
          });

          oystehr.fhir.transaction({ requests: specialDeleteOrUpdateRequests }).then(resolve).catch(reject);
        })
        .catch(reject);
    });

    console.log('Starting a transaction update of chart data...');
    await Promise.all([
      oystehr.fhir.transaction({
        requests: deleteOrUpdateRequests,
      }),
      specialRulesDeletions,
    ]);
    console.log('Updated chart data as a transaction');

    // perform deleting z3 pdf objects after deleting all fhir resources
    if (schoolWorkNotes) {
      for (const schoolWorkNote of schoolWorkNotes) {
        const documentReference = allResources.find((resource) => resource.id === schoolWorkNote.id) as
          | DocumentReference
          | undefined;
        const fileUrl = documentReference?.content?.[0]?.attachment.url;
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
