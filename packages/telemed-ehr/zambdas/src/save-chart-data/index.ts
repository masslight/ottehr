import { BatchInputPostRequest, BatchInputPutRequest } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ExamCardsNames, ExamFieldsNames, SNOMEDCodeConceptInterface } from 'ehr-utils';
import { examCardsMap, examFieldsMap } from 'ehr-utils/lib/types/api/chart-data/exam-fields-map';
import { checkOrCreateM2MClientToken, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import {
  filterServiceRequestsFromFhir,
  followUpToPerformerMap,
  getEncounterAndRelatedResources,
  saveOrUpdateResourceRequest,
  validateBundleAndExtractSavedChartData,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { CodeableConcept, DocumentReference, Encounter, FhirResource, Patient } from 'fhir/r4';
// import { createWorkSchoolNotePDF } from '../shared/pdf/pdf';
import {
  createCodingCode,
  makeAllergyResource,
  makeClinicalImpressionResource,
  makeCommunicationResource,
  makeConditionResource,
  makeDiagnosisConditionResource,
  makeDocumentReferenceResource,
  makeExamObservationResource,
  makeMedicationResource,
  makeObservationResource,
  makeProcedureResource,
  makeServiceRequestResource,
  updateEncounterAddendumNote,
  updateEncounterDiagnosis,
  updateEncounterDischargeDisposition,
  updateEncounterPatientInfoConfirmed,
} from '../shared/chart-data/chart-data-helpers';
// import { PdfDocumentReferencePublishedStatuses } from '../shared/pdf/pdfUtils';

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
      newWorkSchoolNote,
      workSchoolNotes,
      patientInfoConfirmed,
      addendumNote,
    } = validateRequestParameters(input);

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);

    // get encounter and resources
    console.log(`Getting encounter ${encounterId}`);
    const allResources = await getEncounterAndRelatedResources(fhirClient, encounterId);
    const encounter = allResources.filter((resource) => resource.resourceType === 'Encounter')[0] as Encounter;
    const patient = allResources.filter((resource) => resource.resourceType === 'Patient')[0] as Patient;
    if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
    console.log(`Got encounter with id ${encounter.id}`);

    // validate that patient from encounter exists
    if (patient?.id === undefined) throw new Error(`Encounter ${encounter.id} must be associated with a patient... `);
    console.log(`Got patient with id ${patient.id}`);

    const saveOrUpdateRequests: (BatchInputPostRequest | BatchInputPutRequest)[] = [];
    let updatedEncounterResource: Encounter = { ...encounter };
    const additionalResourcesForResponse: FhirResource[] = [];

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

    // 9. convert Medical Decision to ClinicalImpression (FHIR) and preserve FHIR resource IDs
    if (medicalDecision) {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeClinicalImpressionResource(encounterId, patient.id, medicalDecision, 'medical-decision'),
        ),
      );
    }

    // 10 convert CPT code to Procedure (FHIR) and preserve FHIR resource IDs
    cptCodes?.forEach((element) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeProcedureResource(encounterId, patient.id!, element, 'cpt-code')),
      );
    });

    // 11 convert provider instructions to Communication (FHIR) and preserve FHIR resource IDs
    instructions?.forEach((element) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeCommunicationResource(encounterId, patient.id!, element, 'patient-instruction'),
        ),
      );
    });

    // 12 convert disposition to Encounter.hospitalization (FHIR) update
    // and ServiceRequest (FHIR) resource creation
    if (disposition) {
      let orderDetail: CodeableConcept[] | undefined = undefined;
      let dispositionFollowUpCode: CodeableConcept = createCodingCode('185389009', 'Follow-up visit (procedure)');
      const dispositionFollowUpMetaTag = 'disposition-follow-up';

      if (disposition.type === 'uc-lab') {
        dispositionFollowUpCode = createCodingCode('15220000', 'Laboratory test (procedure)');
        orderDetail = [];
        if (disposition.labService) {
          orderDetail.push(createCodingCode(disposition.labService, undefined, 'lab-service'));
        }
        if (disposition.virusTest) {
          orderDetail.push(createCodingCode(disposition.virusTest, undefined, 'virus-test'));
        }
      }
      const followUpDaysInMinutes = disposition.followUpIn ? disposition.followUpIn * 1440 : undefined;
      const existedFollowUpId = filterServiceRequestsFromFhir(allResources, dispositionFollowUpMetaTag)[0]?.id;

      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeServiceRequestResource(
            existedFollowUpId,
            encounterId,
            patient.id!,
            dispositionFollowUpMetaTag,
            dispositionFollowUpCode,
            followUpDaysInMinutes,
            orderDetail,
          ),
        ),
      );
      updatedEncounterResource = updateEncounterDischargeDisposition(updatedEncounterResource, disposition);

      // creating sub followUps for disposition
      const subFollowUpCode: CodeableConcept = createCodingCode('185389009', 'Follow-up visit (procedure)');
      const subFollowUpMetaTag = 'sub-follow-up';
      disposition.followUp?.forEach((followUp) => {
        const followUpPerformer = followUpToPerformerMap[followUp.type];
        const lurieCtOrderDetail = createCodingCode('77477000', 'Computed tomography (procedure)');
        const existedSubFollowUpId = filterServiceRequestsFromFhir(
          allResources,
          subFollowUpMetaTag,
          followUpPerformer?.coding?.[0],
        )[0]?.id;

        saveOrUpdateRequests.push(
          saveOrUpdateResourceRequest(
            makeServiceRequestResource(
              existedSubFollowUpId,
              encounterId,
              patient.id!,
              subFollowUpMetaTag,
              subFollowUpCode,
              undefined,
              followUp.type === 'lurie-ct' ? [lurieCtOrderDetail] : undefined,
              followUpPerformer,
              followUp.type === 'other' ? followUp.note : undefined,
            ),
          ),
        );
      });
    }

    // 13 convert diagnosis to Condition (FHIR) resources and mention them in Encounter.diagnosis
    if (diagnosis) {
      for (const element of diagnosis) {
        const condition = await fhirClient.createResource(
          makeDiagnosisConditionResource(encounterId, patient.id!, element, 'diagnosis'),
        );
        additionalResourcesForResponse.push(condition);
        updatedEncounterResource = updateEncounterDiagnosis(updatedEncounterResource, condition.id!, element);
      }
    }

    // convert BooleanValue to Condition (FHIR) resource and mention them in Encounter.extension
    if (patientInfoConfirmed) {
      updatedEncounterResource = updateEncounterPatientInfoConfirmed(updatedEncounterResource, patientInfoConfirmed);
    }

    // convert FreeTextNote to Condition (FHIR) resource and mention them in Encounter.extension
    if (addendumNote) {
      updatedEncounterResource = updateEncounterAddendumNote(updatedEncounterResource, addendumNote);
    }

    // 14 convert work-school note to pdf file, upload it to z3 bucket and create DocumentReference (FHIR) for it
    if (newWorkSchoolNote) {
      // const pdfInfo = await createWorkSchoolNotePDF(newWorkSchoolNote, patient, secrets, m2mtoken);
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeDocumentReferenceResource(patient.id, encounterId, newWorkSchoolNote.type, 'work-school-note'),
        ),
      );
    }
    // updating workSchool note DocumentReference status 'published' | 'unpublished'
    if (workSchoolNotes) {
      const documentReferences = allResources.filter(
        (resource) => resource.resourceType === 'DocumentReference',
      ) as DocumentReference[];
      workSchoolNotes.forEach((element) => {
        const workSchoolDR = documentReferences.find((dr) => dr.id === element.id);
        // if (workSchoolDR) {
        //   workSchoolDR.docStatus = element.published
        //     ? PdfDocumentReferencePublishedStatuses.published
        //     : PdfDocumentReferencePublishedStatuses.unpublished;
        //   saveOrUpdateRequests.push(saveOrUpdateResourceRequest(workSchoolDR));
        // }
      });
    }

    saveOrUpdateRequests.push(saveOrUpdateResourceRequest(updatedEncounterResource));
    console.log('Starting a transaction update of chart data...');
    const transactionBundle = await fhirClient.transactionRequest({
      requests: saveOrUpdateRequests,
    });
    console.log('Updated chart data as a transaction');

    const output = await validateBundleAndExtractSavedChartData(
      transactionBundle,
      patient.id!,
      additionalResourcesForResponse,
    );

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
