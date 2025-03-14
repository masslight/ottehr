import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  AllergyIntolerance,
  ClinicalImpression,
  CodeableConcept,
  Communication,
  Condition,
  DocumentReference,
  Encounter,
  EpisodeOfCare,
  FhirResource,
  List,
  MedicationStatement,
  Observation,
  Patient,
  Practitioner,
  Procedure,
  ServiceRequest,
} from 'fhir/r4b';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  createCodingCode,
  DispositionFollowUpType,
  ExamCardsNames,
  ExamFieldsNames,
  getPatchBinary,
  inPersonExamCardsMap,
  InPersonExamCardsNames,
  inPersonExamFieldsMap,
  InPersonExamFieldsNames,
  OTTEHR_MODULE,
  PATIENT_VITALS_META_SYSTEM,
  SCHOOL_WORK_NOTE,
  SNOMEDCodeConceptInterface,
} from 'utils';
import { examCardsMap, examFieldsMap } from 'utils';
import { deleteResourceRequest } from '../delete-chart-data/helpers';
import { saveOrUpdateResourceRequest } from '../shared';
import {
  createDispositionServiceRequest,
  makeAllergyResource,
  makeBirthHistoryObservationResource,
  makeClinicalImpressionResource,
  makeCommunicationResource,
  makeConditionResource,
  makeDiagnosisConditionResource,
  makeExamObservationResource,
  makeHospitalizationResource,
  makeMedicationResource,
  makeNoteResource,
  makeObservationResource,
  makeProcedureResource,
  makeSchoolWorkDR,
  makeServiceRequestResource,
  updateEncounterAddendumNote,
  updateEncounterAddToVisitNote,
  updateEncounterDiagnosis,
  updateEncounterDischargeDisposition,
  updateEncounterPatientInfoConfirmed,
} from '../shared/chart-data/chart-data-helpers';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { PdfDocumentReferencePublishedStatuses } from '../shared/pdf/pdf-utils';
import { createSchoolWorkNotePDF } from '../shared/pdf/school-work-note-pdf';
import { ZambdaInput } from 'zambda-utils';
import {
  filterServiceRequestsFromFhir,
  followUpToPerformerMap,
  getEncounterAndRelatedResources,
  validateBundleAndExtractSavedChartData,
} from './helpers';
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
  | ServiceRequest
  | EpisodeOfCare;

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
      episodeOfCare,
      observations,
      secrets,
      examObservations,
      medicalDecision,
      cptCodes,
      emCode,
      instructions,
      disposition,
      diagnosis,
      newSchoolWorkNote,
      schoolWorkNotes,
      patientInfoConfirmed,
      addendumNote,
      addToVisitNote,
      notes,
      vitalsObservations,
      birthHistory,
      userToken,
    } = validateRequestParameters(input);

    console.time('time');
    console.timeLog('time', 'before creating fhir client and token resources');
    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);

    console.timeLog('time', 'before fetching resources');
    // get encounter and resources
    console.log(`Getting encounter ${encounterId}`);
    // ----- !!!DON'T DELETE!!! this is in #2129 scope -----
    // const [allResources, currentPractitioner, chartDataBeforeUpdate] = await Promise.all([
    //   getEncounterAndRelatedResources(oystehr, encounterId),
    //   getUserPractitioner(oystehr, oystehrCurrentUser),
    //   getChartData(oystehr, encounterId),
    // ]);
    const [allResources, currentPractitioner] = await Promise.all([
      getEncounterAndRelatedResources(oystehr, encounterId),
      getUserPractitioner(oystehr, oystehrCurrentUser),
    ]);

    const encounter = allResources.filter((resource) => resource.resourceType === 'Encounter')[0] as Encounter;
    if (encounter === undefined) throw new Error(`Encounter with ID ${encounterId} must exist... `);
    const patient = allResources.filter((resource) => resource.resourceType === 'Patient')[0] as Patient;
    const listResources = allResources.filter((res) => res.resourceType === 'List') as List[];
    const appointment = allResources.find((res) => res.resourceType === 'Appointment');
    console.log(`Got encounter with id ${encounter.id}`);

    // validate that patient from encounter exists
    if (patient?.id === undefined) throw new Error(`Encounter ${encounter.id} must be associated with a patient... `);
    console.log(`Got patient with id ${patient.id}`);
    console.timeLog('time', 'after fetching resources');

    const saveOrUpdateRequests: (
      | BatchInputPostRequest<ChartData>
      | BatchInputPutRequest<ChartData>
      | BatchInputRequest<ChartData>
    )[] = [];
    const updateEncounterOperations: Operation[] = [];
    const additionalResourcesForResponse: FhirResource[] = [];

    if (chiefComplaint) {
      // convert chief complaint Medical Conditions to Conditions preserve FHIR resource ID, add to encounter
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeConditionResource(encounterId, patient.id, chiefComplaint, 'chief-complaint'))
      );
    }

    if (ros) {
      // convert ROS to Conditions preserve FHIR resource ID, add to encounter
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeConditionResource(encounterId, patient.id, ros, 'ros'))
      );
    }

    // convert Medical Conditions [] to Conditions [] and preserve FHIR resource IDs
    conditions?.forEach((condition) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeConditionResource(encounterId, patient.id!, condition, 'medical-condition'))
      );
    });

    // convert Medications [] to MeicationStatement+Medication [] and preserve FHIR resource IDs
    medications?.forEach((medication) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeMedicationResource(encounterId, patient.id!, currentPractitioner, medication, 'current-medication')
        )
      );
    });

    // convert Allergy [] to AllergyIntolerance [] and preserve FHIR resource IDs
    allergies?.forEach((allergy) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeAllergyResource(encounterId, patient.id!, allergy, 'known-allergy'))
      );
    });

    episodeOfCare?.forEach((hosp) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeHospitalizationResource(patient.id!, hosp, 'hospitalization'))
      );
    });

    procedures?.forEach((procedure) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeProcedureResource(encounterId, patient.id!, procedure, 'surgical-history'))
      );
    });

    if (proceduresNote) {
      // convert Procedure to Procedure (FHIR) and preserve FHIR resource IDs
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeProcedureResource(encounterId, patient.id!, proceduresNote, 'surgical-history-note')
        )
      );
    }

    // convert Observation[] to Observation (FHIR) [] and preserve FHIR resource IDs
    observations?.forEach((element) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeObservationResource(
            encounterId,
            patient.id!,
            currentPractitioner.id!,
            element,
            ADDITIONAL_QUESTIONS_META_SYSTEM
          )
        )
      );
    });

    vitalsObservations?.forEach((element) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeObservationResource(
            encounterId,
            patient.id!,
            currentPractitioner.id!,
            element,
            PATIENT_VITALS_META_SYSTEM
          )
        )
      );
    });

    const isInPersonAppointment = !!appointment?.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

    // convert ExamObservation[] to Observation(FHIR)[] and preserve FHIR resource IDs
    examObservations?.forEach((element) => {
      const mappedSnomedField = isInPersonAppointment
        ? inPersonExamFieldsMap[element.field as InPersonExamFieldsNames]
        : examFieldsMap[element.field as ExamFieldsNames];
      const mappedSnomedCard = isInPersonAppointment
        ? inPersonExamCardsMap[element.field as InPersonExamCardsNames]
        : examCardsMap[element.field as ExamCardsNames];
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
          `Exam observation resource must contain string field: 'note', or boolean: 'value', depends on this resource type is exam-field or exam-card. Resource type determines by 'field' prop.`
        );
      }

      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeExamObservationResource(encounterId, patient.id!, element, snomedCode))
      );
    });

    // 9. convert Medical Decision to ClinicalImpression (FHIR) and preserve FHIR resource IDs
    if (medicalDecision) {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(
          makeClinicalImpressionResource(encounterId, patient.id, medicalDecision, 'medical-decision')
        )
      );
    }

    // 10 convert CPT code to Procedure (FHIR) and preserve FHIR resource IDs
    cptCodes?.forEach((element) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeProcedureResource(encounterId, patient.id!, element, 'cpt-code'))
      );
    });

    if (emCode) {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeProcedureResource(encounterId, patient.id!, emCode, 'em-code'))
      );
    }

    // 11 convert provider instructions to Communication (FHIR) and preserve FHIR resource IDs
    instructions?.forEach((element) => {
      saveOrUpdateRequests.push(
        saveOrUpdateResourceRequest(makeCommunicationResource(encounterId, patient.id!, element, 'patient-instruction'))
      );
    });

    // 12 convert disposition to Encounter.hospitalization (FHIR) update
    // and ServiceRequest (FHIR) resource creation
    if (disposition) {
      saveOrUpdateRequests.push(
        createDispositionServiceRequest({
          disposition,
          encounterId,
          followUpId: filterServiceRequestsFromFhir(allResources, 'disposition-follow-up')[0]?.id,
          patientId: patient.id,
        })
      );

      updateEncounterOperations.push(updateEncounterDischargeDisposition(encounter, disposition));

      // creating sub followUps for disposition
      const subFollowUpCode: CodeableConcept = createCodingCode('185389009', 'Follow-up visit (procedure)');
      const subFollowUpMetaTag = 'sub-follow-up';
      disposition.followUp?.forEach((followUp) => {
        const followUpPerformer = followUpToPerformerMap[followUp.type];
        const lurieCtOrderDetail = createCodingCode('77477000', 'Computed tomography (procedure)');
        const existedSubFollowUpId = filterServiceRequestsFromFhir(
          allResources,
          subFollowUpMetaTag,
          followUpPerformer?.coding?.[0]
        )[0]?.id;

        saveOrUpdateRequests.push(
          saveOrUpdateResourceRequest(
            makeServiceRequestResource({
              resourceId: existedSubFollowUpId,
              encounterId,
              patientId: patient.id!,
              metaName: subFollowUpMetaTag,
              code: subFollowUpCode,
              orderDetail: followUp.type === 'lurie-ct' ? [lurieCtOrderDetail] : undefined,
              performerType: followUpPerformer,
              note: followUp.type === 'other' ? followUp.note : undefined,
            })
          )
        );
      });

      // remove sub follow-ups that are not in the current request
      const existingSubFollowUps = filterServiceRequestsFromFhir(allResources, subFollowUpMetaTag);
      existingSubFollowUps.forEach((subFollowUp) => {
        const subFollowUpType = Object.keys(followUpToPerformerMap).find(
          (key) =>
            followUpToPerformerMap[key as DispositionFollowUpType]?.coding?.[0].code ===
            subFollowUp.performerType?.coding?.[0].code
        );
        if (subFollowUpType && !disposition.followUp?.some((f) => f.type === subFollowUpType)) {
          saveOrUpdateRequests.push(deleteResourceRequest('ServiceRequest', subFollowUp.id!));
        }
      });
    }

    // 13 convert diagnosis to Condition (FHIR) resources and mention them in Encounter.diagnosis
    if (diagnosis) {
      for (const element of diagnosis) {
        const condition = await oystehr.fhir.create(
          makeDiagnosisConditionResource(encounterId, patient.id!, element, 'diagnosis')
        );
        additionalResourcesForResponse.push(condition);
        updateEncounterOperations.push(...updateEncounterDiagnosis(encounter, condition.id!, element));
      }
    }

    // convert BooleanValue to Condition (FHIR) resource and mention them in Encounter.extension
    if (patientInfoConfirmed) {
      updateEncounterOperations.push(...updateEncounterPatientInfoConfirmed(encounter, patientInfoConfirmed));
    }

    // convert BooleanValue to Condition (FHIR) resource and mention them in Encounter.extension
    if (addToVisitNote) {
      updateEncounterOperations.push(...updateEncounterAddToVisitNote(encounter, addToVisitNote));
    }

    // convert FreeTextNote to Condition (FHIR) resource and mention them in Encounter.extension
    if (addendumNote) {
      updateEncounterOperations.push(...updateEncounterAddendumNote(encounter, addendumNote));
    }

    // 14 convert work-school note to pdf file, upload it to z3 bucket and create DocumentReference (FHIR) for it
    if (newSchoolWorkNote) {
      if (appointment?.id === undefined) throw new Error(`No appointment found for encounterId: ${encounterId}`);
      const pdfInfo = await createSchoolWorkNotePDF(newSchoolWorkNote, patient, secrets, m2mtoken);
      additionalResourcesForResponse.push(
        await makeSchoolWorkDR(
          oystehr,
          pdfInfo,
          patient.id,
          appointment?.id,
          encounterId,
          newSchoolWorkNote.type,
          SCHOOL_WORK_NOTE,
          listResources
        )
      );
    }
    // updating schoolWork note DocumentReference status 'published' | 'unpublished'
    if (schoolWorkNotes) {
      const documentReferences = allResources.filter(
        (resource) => resource.resourceType === 'DocumentReference'
      ) as DocumentReference[];
      schoolWorkNotes.forEach((element) => {
        const schoolWorkDR = documentReferences.find((dr) => dr.id === element.id);
        if (schoolWorkDR) {
          schoolWorkDR.docStatus = element.published
            ? PdfDocumentReferencePublishedStatuses.published
            : PdfDocumentReferencePublishedStatuses.unpublished;
          saveOrUpdateRequests.push(saveOrUpdateResourceRequest(schoolWorkDR));
        }
      });
    }

    if (updateEncounterOperations.length > 0) {
      saveOrUpdateRequests.push(
        getPatchBinary({
          resourceId: encounterId,
          resourceType: 'Encounter',
          patchOperations: updateEncounterOperations,
        })
      );
    }

    // convert notes to Communication (FHIR) resources
    notes?.forEach((element) => {
      const note = makeNoteResource(encounterId, patient.id!, element);
      const request = saveOrUpdateResourceRequest(note);
      saveOrUpdateRequests.push(request);
    });

    // convert birth history to Observation (FHIR) resources
    birthHistory?.forEach((element) => {
      const birthHistoryElement = makeBirthHistoryObservationResource(
        encounterId,
        patient.id!,
        element,
        'birth-history'
      );
      const request = saveOrUpdateResourceRequest(birthHistoryElement);
      saveOrUpdateRequests.push(request);
    });

    console.log('Starting a transaction update of chart data...');

    console.timeLog('time', 'before saving resources');
    const transactionBundle = await oystehr.fhir.transaction({
      requests: saveOrUpdateRequests,
    });
    console.timeLog('time', 'after saving resources');

    console.log('Updated chart data as a transaction');

    console.timeLog('time', 'before sorting resources');
    const output = validateBundleAndExtractSavedChartData(
      transactionBundle,
      patient.id!,
      encounterId,
      additionalResourcesForResponse
    );
    console.timeLog('time', 'after sorting resources');

    // ----- !!!DON'T DELETE!!! this is in #2129 scope -----
    // console.timeLog('time', 'before creating auditEvent');
    // const auditEvent = createAuditEvent(chartDataBeforeUpdate.chartResources, output.chartResources);
    // await oystehr.fhir.create(auditEvent);
    // console.timeLog('time', 'after creating auditEvent');

    console.timeEnd('time');
    return {
      body: JSON.stringify(output),
      statusCode: 200,
    };
  } catch (error) {
    console.log(JSON.stringify(error, null, 2));
    return {
      body: JSON.stringify({ message: 'Error saving encounter data...' }),
      statusCode: 500,
    };
  }
};

// ----- !!!DON'T DELETE!!! this is in #2129 scope -----
// function createAuditEvent(chartResourcesBeforeUpdate: Resource[], chartResourcesAfterUpdate: Resource[]): AuditEvent {
//   // todo finish up this function to create proper AuditEvent and maybe discuss AE format with guys later
//   const resourcesEntities: AuditEventEntity[] = [];
//
//   // todo add previous resources and new one into entries
//   chartResourcesBeforeUpdate.forEach((res) => {
//     const resReference = createReference(res);
//     if (resReference.reference && res.meta?.versionId) {
//       createAuditEventEntity(createReference(res), 'entityName', res.meta.versionId);
//     }
//   });
//   return {
//     resourceType: 'AuditEvent',
//     type: {
//       code: '110101',
//       system: 'http://dicom.nema.org/resources/ontology/DCM',
//       display: 'Audit Log Used\t',
//     },
//     agent: [
//       {
//         who: {
//           reference: 'Practitioner/96587574-637b-4346-91d9-27abc655365f',
//         },
//         requestor: true,
//       },
//     ],
//     recorded: DateTime.now().toISO() ?? '',
//     source: {
//       observer: {
//         reference: 'Organization/165bb2f4-a972-4d29-b092-dac9d0bc43cf',
//       },
//     },
//     entity: resourcesEntities,
//   };
// }
//
// function createAuditEventEntity(
//   resourceReference: Reference,
//   name: string,
//   previousVersionId: string,
//   newVersionId?: string
// ): AuditEventEntity {
//   const entity = {
//     what: resourceReference,
//     name,
//     detail: [
//       {
//         type: 'previousVersionId',
//         valueString: previousVersionId,
//       },
//       // do we wanna keep this request json?? because idk how to create such thing in save-chart-data
//       {
//         type: 'requestJson',
//         valueString: '{"name": [{"given": ["Jonathan"], "family": "Doe"}]}',
//       },
//     ],
//   };
//   if (newVersionId) {
//     entity.detail.push({
//       type: 'newVersionId',
//       valueString: newVersionId,
//     });
//   }
//   return entity;
// }

async function getUserPractitioner(oystehr: Oystehr, oystehrCurrentUser: Oystehr): Promise<Practitioner> {
  try {
    const getUserResponse = await oystehrCurrentUser.user.me();
    const userProfile = getUserResponse.profile;
    const userProfileString = userProfile.split('/');

    const practitionerId = userProfileString[1];
    return await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitionerId,
    });
  } catch (error) {
    throw new Error(`Failed to get Practitioner: ${JSON.stringify(error)}`);
  }
}
