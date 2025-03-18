// import { BatchInputRequest, FhirClient } from '@zapehr/sdk';
// import { randomUUID } from 'crypto';
// import { Operation } from 'fast-json-patch';
// import { Account, ChargeItem, DocumentReference, Encounter, EncounterStatusHistory } from 'fhir/r4';
// import { DateTime } from 'luxon';
// import {
//   addOrReplaceOperation,
//   createDocumentReference,
//   getPatchOperationForNewMetaTag,
//   OTTEHR_MODULE,
//   SCHOOL_NOTE_CODE,
//   SCHOOL_WORK_NOTE_TYPE_META_SYSTEM,
//   //   TelemedCallStatuses,
//   WORK_NOTE_CODE,
//  } from 'utils';
// import { getPatchBinary } from '../../../../app/src/helpers/fhir';
// import { telemedStatusToEncounter } from '../../shared/appointment/helpers';
// import { sendSmsForPatient } from '../../shared/communication';
// import { PdfDocumentReferencePublishedStatuses, PdfInfo } from '../../shared/pdf/pdf-utils';
// import {
//   addPeriodEndOp,
//   addStatusHistoryRecordOp,
//   changeStatusOp,
//   changeStatusRecordPeriodValueOp,
//   deleteStatusHistoryRecordOp,
//   handleEmptyEncounterStatusHistoryOp,
// } from './fhir-res-patch-operations';
// import { AppointmentPackage } from './types';

// export const changeStatusIfPossible = async (
//   fhirClient: FhirClient,
//   resourcesToUpdate: AppointmentPackage,
//   currentStatus: TelemedCallStatuses,
//   newStatus: TelemedCallStatuses,
//   practitionerId: string,
//   m2mToken: string,
//   secrets: Secrets | null
// ): Promise<void> => {
//   const { patient, appointment } = resourcesToUpdate;
//   let appointmentPatchOp: Operation[] = [];
//   let encounterPatchOp: Operation[] = [];
//   let smsToSend: string | undefined = undefined;
//   const patchOperationsBinaries: BatchInputRequest[] = [];

//   if (currentStatus === 'ready' && newStatus === 'pre-video') {
//     encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
//     const addPractitionerOp = await getAddPractitionerToEncounterOperation(resourcesToUpdate.encounter, practitionerId);
//     smsToSend =
//       'Thank you for waiting. The clinician will see you within around 5 minutes.';
//   } else if (currentStatus === 'pre-video' && newStatus === 'ready') {
//     encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
//     const removePractitionerOr = getRemovePractitionerFromEncounterOperation(
//       resourcesToUpdate.encounter,
//       practitionerId
//     );
//     if (removePractitionerOr) {
//       encounterPatchOp.push(removePractitionerOr);
//     }
//     smsToSend =
//       'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
//   } else if (currentStatus === 'on-video' && newStatus === 'unsigned') {
//     encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
//     encounterPatchOp.push(addPeriodEndOp(now()));
//     if (appointment.id)
//       smsToSend = `Thanks for visiting. Tap https://feedbackURL/220116034976149?VisitID=${appointment.id} to let us know how it went.`;
//   } else if (currentStatus === 'unsigned' && newStatus === 'complete') {
//     encounterPatchOp = encounterOperationsWrapper(
//       newStatus,
//       resourcesToUpdate,
//       (_newEncounterStatus, statusHistoryLength) => {
//         const statusHistory = resourcesToUpdate.encounter.statusHistory || [];
//         if (
//           statusHistoryLength >= 2 &&
//           statusHistory[statusHistoryLength - 1].status === 'finished' &&
//           statusHistory[statusHistoryLength - 2].status === 'finished'
//         ) {
//           return mergeUnsignedStatusesTimesOp(statusHistory);
//         } else {
//           return [changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', now())];
//         }
//       }
//     );
//     appointmentPatchOp.push({ path: '/end', value: now(), op: 'add' });

//     const updateNotesOps = makeWorkSchoolNotePublished(resourcesToUpdate.documentReferences ?? []);
//     if (updateNotesOps.length > 0) {
//       patchOperationsBinaries.push(...updateNotesOps);
//     }
//     appointmentPatchOp = [changeStatusOp('fulfilled')];
//   } else if (currentStatus === 'cancelled' && newStatus === 'complete') {
//     encounterPatchOp = encounterOperationsWrapper(
//       newStatus,
//       resourcesToUpdate,
//       (newEncounterStatus, statusHistoryLength) => {
//         return [
//           addStatusHistoryRecordOp(statusHistoryLength, newEncounterStatus, now()),
//           changeStatusOp(newEncounterStatus),
//         ];
//       }
//     );
//     appointmentPatchOp = [changeStatusOp('arrived')];
//   } else {
//     console.error(
//       `Status change between current status: '${currentStatus}', and desired status: '${newStatus}', is not possible.`
//     );
//     throw new Error(
//       `Status change between current status: '${currentStatus}', and desired status: '${newStatus}', is not possible.`
//     );
//   }

//   if (resourcesToUpdate.appointment.id && appointmentPatchOp.length > 0) {
//     patchOperationsBinaries.push(
//       getPatchBinary({
//         resourceType: 'Appointment',
//         resourceId: resourcesToUpdate.appointment.id,
//         patchOperations: appointmentPatchOp,
//       })
//     );
//   }
//   patchOperationsBinaries.push(
//     getPatchBinary({
//       resourceType: 'Encounter',
//       resourceId: resourcesToUpdate.encounter.id!,
//       patchOperations: encounterPatchOp,
//     })
//   );

//   const promises: Promise<any>[] = [];
//   promises.push(fhirClient.transactionRequest({ requests: patchOperationsBinaries }));
//   if (smsToSend)
//     promises.push(
//       sendSmsForPatient(smsToSend, fhirClient, patient, m2mToken, secrets).catch((error) =>
//         console.error('Error trying to send SMS message to patient on appointment change', error, smsToSend)
//       )
//     );
//   await Promise.all(promises);
// };

// /**
//  * handle complete status after appointment already was in complete status, so we
//  * wanna summarize all time appointment was in unsigned status. For example:
//  * unsigned - 3 min wait
//  * complete - 5 min
//  * unsigned - 9 min - practitioner decided to change something in and moved it to unsigned again.
//  * So we wanna record 3 min initial + 9 min in unsigned to result record, because time in
//  * complete status doesn't count
//  */
// const mergeUnsignedStatusesTimesOp = (statusHistory: EncounterStatusHistory[]): Operation[] => {
//   let encounterOperations: Operation[] = [];
//   let statusHistoryLength = statusHistory.length;
//   const lastRecord = statusHistory[statusHistoryLength - 1];
//   const beforeLastRecord = statusHistory[statusHistoryLength - 2];

//   if (
//     lastRecord.status === 'finished' &&
//     beforeLastRecord.status === 'finished' &&
//     lastRecord.period.start &&
//     beforeLastRecord.period.start &&
//     beforeLastRecord.period.end
//   ) {
//     const firstUnsignedStart = new Date(beforeLastRecord.period.start).getTime();
//     const firstUnsignedEnd = new Date(beforeLastRecord.period.end).getTime();
//     const secondUnsignedStart = new Date(lastRecord.period.start).getTime();
//     const secondUnsignedEnd = new Date().getTime();

//     const unisgnedTimeSummary =
//       Math.abs(firstUnsignedEnd - firstUnsignedStart) + Math.abs(secondUnsignedEnd - secondUnsignedStart);
//     const unsignedSummaryStart = new Date(Math.abs(new Date().getTime() - unisgnedTimeSummary)).toISOString();
//     const unsignedSummaryEnd = now();

//     encounterOperations.push(deleteStatusHistoryRecordOp(statusHistoryLength - 1));
//     statusHistoryLength--;
//     encounterOperations = encounterOperations.concat([
//       changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'start', unsignedSummaryStart),
//       changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', unsignedSummaryEnd),
//     ]);
//   }

//   return encounterOperations;
// };

// const defaultEncounterOperations = (
//   newTelemedStatus: TelemedCallStatuses,
//   resourcesToUpdate: AppointmentPackage
// ): Operation[] => {
//   return encounterOperationsWrapper(newTelemedStatus, resourcesToUpdate, (newEncounterStatus, statusHistoryLength) => {
//     return [
//       changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', now()),
//       addStatusHistoryRecordOp(statusHistoryLength, newEncounterStatus, now()),
//       changeStatusOp(newEncounterStatus),
//     ];
//   });
// };

// const encounterOperationsWrapper = (
//   newTelemedStatus: TelemedCallStatuses,
//   resourcesToUpdate: AppointmentPackage,
//   callback: (newEncounterStatus: string, statusHistoryLength: number) => Operation[]
// ): Operation[] => {
//   const newEncounterStatus = telemedStatusToEncounter(newTelemedStatus);
//   const statusHistoryLength = resourcesToUpdate.encounter.statusHistory?.length || 1;

//   return handleEmptyEncounterStatusHistoryOp(resourcesToUpdate).concat(
//     callback(newEncounterStatus, statusHistoryLength)
//   );
// };

// const now = (): string => {
//   return DateTime.utc().toISO()!;
// };

// const getAddPractitionerToEncounterOperation = async (
//   encounter: Encounter,
//   practitionerId: string
// ): Promise<Operation | undefined> => {
//   const existingParticipant = encounter.participant?.find(
//     (participant) => participant.individual?.reference === `Practitioner/${practitionerId}`
//   );
//   if (existingParticipant) return undefined;

//   let participants = encounter.participant;

//   participants ??= [];

//   participants.push({ individual: { reference: `Practitioner/${practitionerId}` } });

//   if (!existingParticipant) {
//     return {
//       op: encounter.participant ? 'replace' : 'add',
//       path: '/participant',
//       value: participants,
//     };
//   }
//   return undefined;
// };

// const getRemovePractitionerFromEncounterOperation = (
//   encounter: Encounter,
//   practitionerId: string
// ): Operation | undefined => {
//   const existingParticipant = encounter.participant?.find(
//     (participant) => participant.individual?.reference === `Practitioner/${practitionerId}`
//   );
//   if (!existingParticipant || !encounter.participant) return undefined;

//   const participants = encounter.participant.filter(
//     (participant) =>
//       participant.individual?.reference && participant.individual.reference !== `Practitioner/${practitionerId}`
//   );

//   return {
//     op: 'replace',
//     path: '/participant',
//     value: participants,
//   };
// };

// export async function makeVisitNotePdfDocumentReference(
//   fhirClient: FhirClient,
//   pdfInfo: PdfInfo,
//   patientId: string,
//   appointmentId: string,
//   encounterId: string
// ): Promise<DocumentReference> {
//   return await createDocumentReference({
//     documentReferenceData: {
//       docInfo: [{ contentURL: pdfInfo.uploadURL, title: pdfInfo.title, mimeType: 'application/pdf' }],
//       docStatus: PdfDocumentReferencePublishedStatuses.unpublished,
//       dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
//       type: {
//         coding: [
//           {
//             system: 'http://loinc.org',
//             code: '75498-6',
//             display: 'Telehealth Summary note',
//           },
//         ],
//         text: 'Telemed document',
//       },
//       meta: {
//         tag: [{ code: OTTEHR_MODULE.TM }],
//       },
//       references: {
//         subject: {
//           reference: `Patient/${patientId}`,
//         },
//         context: {
//           related: [
//             {
//               reference: `Appointment/${appointmentId}`,
//             },
//           ],
//           encounter: [{ reference: `Encounter/${encounterId}` }],
//         },
//       },
//     },
//     fhirClient,
//     generateUUID: randomUUID,
//   });
// }

// export function makeAppointmentChargeItem(encounter: Encounter, organizationId: string, account?: Account): ChargeItem {
//   return {
//     resourceType: 'ChargeItem',
//     status: 'billable',
//     code: {
//       coding: [
//         {
//           system: 'http://snomed.info/sct',
//           code: '448337001',
//           display: 'Telemedicine consultation with patient',
//           userSelected: false,
//         },
//       ],
//     },
//     account: [{ reference: `Account/${account?.id}` }],
//     subject: {
//       type: 'Patient',
//       reference: encounter.subject?.reference,
//     },
//     context: {
//       type: 'Encounter',
//       reference: `Encounter/${encounter.id}`,
//     },
//     priceOverride: {
//       currency: 'USD',
//       value: 100,
//     },
//     performingOrganization: {
//       type: 'Organization',
//       reference: `Organization/${organizationId}`,
//     },
//   };
// }

// export function makeReceiptPdfDocumentReference(
//   pdfInfo: PdfInfo,
//   patientId: string,
//   encounterId: string
// ): DocumentReference {
//   return {
//     resourceType: 'DocumentReference',
//     meta: {
//       tag: [{ code: 'OTTEHR-TM' }],
//     },
//     date: DateTime.now().setZone('UTC').toISO() ?? '',
//     status: 'current',
//     type: {
//       coding: [
//         {
//           system: 'http://loinc.org',
//           code: '34105-7',
//           display: 'Telehealth Payment Receipt',
//         },
//       ],
//     },
//     content: [
//       {
//         attachment: { url: pdfInfo.uploadURL, title: pdfInfo.title, contentType: 'application/pdf' },
//       },
//     ],
//     subject: {
//       reference: `Patient/${patientId}`,
//     },
//     context: {
//       encounter: [
//         {
//           reference: `Encounter/${encounterId}`,
//         },
//       ],
//     },
//   };
// }

// function makeWorkSchoolNotePublished(documentReferences: DocumentReference[]): BatchInputRequest[] {
//   const resultBatchRequests: BatchInputRequest[] = [];
//   let workNoteDR: DocumentReference | undefined;
//   let schoolNoteDR: DocumentReference | undefined;
//   documentReferences.forEach((item) => {
//     const workSchoolNoteTag = item.meta?.tag?.find((tag) => tag.system === SCHOOL_WORK_NOTE_TYPE_META_SYSTEM);
//     if (workSchoolNoteTag) {
//       if (workSchoolNoteTag.code === SCHOOL_NOTE_CODE) schoolNoteDR = item;
//       if (workSchoolNoteTag.code === WORK_NOTE_CODE) workNoteDR = item;
//     }
//   });
//   if (workNoteDR && workNoteDR.docStatus !== PdfDocumentReferencePublishedStatuses.published) {
//     resultBatchRequests.push(pdfPublishedPatchOperation(workNoteDR));
//   }
//   if (schoolNoteDR && schoolNoteDR.docStatus !== PdfDocumentReferencePublishedStatuses.published) {
//     resultBatchRequests.push(pdfPublishedPatchOperation(schoolNoteDR));
//   }
//   return resultBatchRequests;
// }

// function pdfPublishedPatchOperation(documentReference: DocumentReference): BatchInputRequest {
//   return getPatchBinary({
//     resourceType: 'DocumentReference',
//     resourceId: documentReference.id!,
//     patchOperations: [
//       addOrReplaceOperation(documentReference.docStatus, '/docStatus', PdfDocumentReferencePublishedStatuses.published),
//     ],
//   });
// }
