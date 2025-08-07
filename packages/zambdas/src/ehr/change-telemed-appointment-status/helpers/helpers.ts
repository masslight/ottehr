import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { Account, Appointment, ChargeItem, DocumentReference, Encounter, EncounterStatusHistory, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences, getPatchBinary, OTTEHR_MODULE, RECEIPT_CODE, TelemedCallStatuses } from 'utils';
import { telemedStatusToEncounter } from '../../../shared/appointment/helpers';
import { sendSmsForPatient } from '../../../shared/communication';
import { createPublishExcuseNotesOps } from '../../../shared/createPublishExcuseNotesOps';
import { PdfInfo } from '../../../shared/pdf/pdf-utils';
import { FullAppointmentResourcePackage } from '../../../shared/pdf/visit-details-pdf/types';
import {
  addPeriodEndOp,
  addStatusHistoryRecordOp,
  changeStatusOp,
  changeStatusRecordPeriodValueOp,
  deleteStatusHistoryRecordOp,
  handleEmptyEncounterStatusHistoryOp,
} from './fhir-res-patch-operations';

export const changeStatusIfPossible = async (
  oystehr: Oystehr,
  resourcesToUpdate: FullAppointmentResourcePackage,
  currentStatus: TelemedCallStatuses,
  newStatus: TelemedCallStatuses,
  practitionerId: string,
  ENVIRONMENT: string
): Promise<void> => {
  const { patient, appointment } = resourcesToUpdate;
  let appointmentPatchOp: Operation[] = [];
  let encounterPatchOp: Operation[] = [];
  let smsToSend: string | undefined = undefined;
  const patchOperationsBinaries: BatchInputRequest<Appointment | DocumentReference | Encounter>[] = [];

  if (currentStatus === 'ready' && newStatus === 'pre-video') {
    encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
    const addPractitionerOp = await getAddPractitionerToEncounterOperation(resourcesToUpdate.encounter, practitionerId);
    if (addPractitionerOp) {
      encounterPatchOp.push(addPractitionerOp);
    }
    smsToSend = 'Thank you for waiting. The clinician will see you within around 5 minutes.';
  } else if (currentStatus === 'pre-video' && newStatus === 'ready') {
    encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
    const removePractitionerOr = getRemovePractitionerFromEncounterOperation(
      resourcesToUpdate.encounter,
      practitionerId
    );
    if (removePractitionerOr) {
      encounterPatchOp.push(removePractitionerOr);
    }
    smsToSend =
      'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
  } else if (currentStatus === 'on-video' && newStatus === 'unsigned') {
    encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
    encounterPatchOp.push(addPeriodEndOp(now()));
    if (appointment.id)
      smsToSend = `Thanks for visiting. Tap https://feedbackURL/220116034976149?VisitID=${appointment.id} to let us know how it went.`;
  } else if (currentStatus === 'unsigned' && newStatus === 'complete') {
    encounterPatchOp = encounterOperationsWrapper(
      newStatus,
      resourcesToUpdate,
      (_newEncounterStatus, statusHistoryLength) => {
        const statusHistory = resourcesToUpdate.encounter.statusHistory || [];
        if (
          statusHistoryLength >= 2 &&
          statusHistory[statusHistoryLength - 1].status === 'finished' &&
          statusHistory[statusHistoryLength - 2].status === 'finished'
        ) {
          return mergeUnsignedStatusesTimesOp(statusHistory);
        } else {
          return [changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', now())];
        }
      }
    );
    appointmentPatchOp.push({ path: '/end', value: now(), op: 'add' });

    const updateNotesOps = createPublishExcuseNotesOps(resourcesToUpdate.documentReferences ?? []);
    if (updateNotesOps.length > 0) {
      patchOperationsBinaries.push(...updateNotesOps);
    }
    appointmentPatchOp = [changeStatusOp('fulfilled')];
  } else if (currentStatus === 'complete' && newStatus === 'unsigned') {
    encounterPatchOp = encounterOperationsWrapper(
      newStatus,
      resourcesToUpdate,
      (newEncounterStatus, statusHistoryLength) => {
        return [
          addStatusHistoryRecordOp(statusHistoryLength, newEncounterStatus, now()),
          changeStatusOp(newEncounterStatus),
        ];
      }
    );
    appointmentPatchOp = [changeStatusOp('arrived')];
  } else {
    console.error(
      `Status change between current status: '${currentStatus}', and desired status: '${newStatus}', is not possible.`
    );
    throw new Error(
      `Status change between current status: '${currentStatus}', and desired status: '${newStatus}', is not possible.`
    );
  }

  if (resourcesToUpdate.appointment.id && appointmentPatchOp.length > 0) {
    patchOperationsBinaries.push(
      getPatchBinary({
        resourceType: 'Appointment',
        resourceId: resourcesToUpdate.appointment.id,
        patchOperations: appointmentPatchOp,
      })
    );
  }
  patchOperationsBinaries.push(
    getPatchBinary({
      resourceType: 'Encounter',
      resourceId: resourcesToUpdate.encounter.id!,
      patchOperations: encounterPatchOp,
    })
  );

  const promises: Promise<any>[] = [];
  promises.push(oystehr.fhir.transaction({ requests: patchOperationsBinaries }));
  if (smsToSend)
    promises.push(
      sendSmsForPatient(smsToSend, oystehr, patient, ENVIRONMENT).catch((error) =>
        console.error('Error trying to send SMS message to patient on appointment change', error, smsToSend)
      )
    );
  await Promise.all(promises);
};

/**
 * handle complete status after appointment already was in complete status, so we
 * wanna summarize all time appointment was in unsigned status. For example:
 * unsigned - 3 min wait
 * complete - 5 min
 * unsigned - 9 min - practitioner decided to change something in and moved it to unsigned again.
 * So we wanna record 3 min initial + 9 min in unsigned to result record, because time in
 * complete status doesn't count
 */
const mergeUnsignedStatusesTimesOp = (statusHistory: EncounterStatusHistory[]): Operation[] => {
  let encounterOperations: Operation[] = [];
  let statusHistoryLength = statusHistory.length;
  const lastRecord = statusHistory[statusHistoryLength - 1];
  const beforeLastRecord = statusHistory[statusHistoryLength - 2];

  if (
    lastRecord.status === 'finished' &&
    beforeLastRecord.status === 'finished' &&
    lastRecord.period.start &&
    beforeLastRecord.period.start &&
    beforeLastRecord.period.end
  ) {
    const firstUnsignedStart = new Date(beforeLastRecord.period.start).getTime();
    const firstUnsignedEnd = new Date(beforeLastRecord.period.end).getTime();
    const secondUnsignedStart = new Date(lastRecord.period.start).getTime();
    const secondUnsignedEnd = new Date().getTime();

    const unsignedTimeSummary =
      Math.abs(firstUnsignedEnd - firstUnsignedStart) + Math.abs(secondUnsignedEnd - secondUnsignedStart);
    const unsignedSummaryStart = new Date(Math.abs(new Date().getTime() - unsignedTimeSummary)).toISOString();
    const unsignedSummaryEnd = now();

    encounterOperations.push(deleteStatusHistoryRecordOp(statusHistoryLength - 1));
    statusHistoryLength--;
    encounterOperations = encounterOperations.concat([
      changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'start', unsignedSummaryStart),
      changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', unsignedSummaryEnd),
    ]);
  }

  return encounterOperations;
};

const defaultEncounterOperations = (
  newTelemedStatus: TelemedCallStatuses,
  resourcesToUpdate: FullAppointmentResourcePackage
): Operation[] => {
  return encounterOperationsWrapper(newTelemedStatus, resourcesToUpdate, (newEncounterStatus, statusHistoryLength) => {
    return [
      changeStatusRecordPeriodValueOp(statusHistoryLength - 1, 'end', now()),
      addStatusHistoryRecordOp(statusHistoryLength, newEncounterStatus, now()),
      changeStatusOp(newEncounterStatus),
    ];
  });
};

const encounterOperationsWrapper = (
  newTelemedStatus: TelemedCallStatuses,
  resourcesToUpdate: FullAppointmentResourcePackage,
  callback: (newEncounterStatus: string, statusHistoryLength: number) => Operation[]
): Operation[] => {
  const newEncounterStatus = telemedStatusToEncounter(newTelemedStatus);
  const statusHistoryLength = resourcesToUpdate.encounter.statusHistory?.length || 1;

  return handleEmptyEncounterStatusHistoryOp(resourcesToUpdate).concat(
    callback(newEncounterStatus, statusHistoryLength)
  );
};

const now = (): string => {
  return DateTime.utc().toISO()!;
};

const getAddPractitionerToEncounterOperation = async (
  encounter: Encounter,
  practitionerId: string
): Promise<Operation | undefined> => {
  const existingParticipant = encounter.participant?.find(
    (participant) => participant.individual?.reference === `Practitioner/${practitionerId}`
  );
  if (existingParticipant) return undefined;

  let participants = encounter.participant;

  participants ??= [];

  participants.push({ individual: { reference: `Practitioner/${practitionerId}` } });

  if (!existingParticipant) {
    return {
      op: encounter.participant ? 'replace' : 'add',
      path: '/participant',
      value: participants,
    };
  }
  return undefined;
};

const getRemovePractitionerFromEncounterOperation = (
  encounter: Encounter,
  practitionerId: string
): Operation | undefined => {
  const existingParticipant = encounter.participant?.find(
    (participant) => participant.individual?.reference === `Practitioner/${practitionerId}`
  );
  if (!existingParticipant || !encounter.participant) return undefined;

  const participants = encounter.participant.filter(
    (participant) =>
      participant.individual?.reference && participant.individual.reference !== `Practitioner/${practitionerId}`
  );

  return {
    op: 'replace',
    path: '/participant',
    value: participants,
  };
};

export function makeAppointmentChargeItem(encounter: Encounter, organizationId: string, account?: Account): ChargeItem {
  return {
    resourceType: 'ChargeItem',
    status: 'billable',
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '448337001',
          display: 'Telemedicine consultation with patient',
          userSelected: false,
        },
      ],
    },
    account: [{ reference: `Account/${account?.id}` }],
    subject: {
      type: 'Patient',
      reference: encounter.subject?.reference,
    },
    context: {
      type: 'Encounter',
      reference: `Encounter/${encounter.id}`,
    },
    priceOverride: {
      currency: 'USD',
      value: 100,
    },
    performingOrganization: {
      type: 'Organization',
      reference: `Organization/${organizationId}`,
    },
  };
}

export async function makeReceiptPdfDocumentReference(
  oystehr: Oystehr,
  pdfInfo: PdfInfo,
  patientId: string,
  encounterId: string,
  listResources: List[]
): Promise<DocumentReference> {
  const { docRefs } = await createFilesDocumentReferences({
    files: [
      {
        url: pdfInfo.uploadURL,
        title: pdfInfo.title,
      },
    ],
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: RECEIPT_CODE,
          display: 'Telehealth Payment Receipt',
        },
      ],
    },
    references: {
      subject: {
        reference: `Patient/${patientId}`,
      },
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    meta: {
      tag: [{ code: OTTEHR_MODULE.TM }],
    },
    searchParams: [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'subject', value: `Patient/${patientId}` },
    ],
    listResources,
  });
  return docRefs[0];
}
