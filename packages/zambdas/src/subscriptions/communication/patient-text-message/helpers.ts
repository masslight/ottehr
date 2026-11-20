import { Operation } from 'fast-json-patch';
import { Communication, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ZAP_SMS_MEDIUM_CODE } from 'utils/lib/fhir/chat';
import { getMessageFromComm } from 'utils/lib/fhir/chat';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { Visit } from '../../../shared/support-chat/request-task';
import { createTask } from '../../../shared/tasks';

/** A text the patient (or their account holder) sent us: SMS medium, sender is an account RelatedPerson. */
export const isInboundPatientSms = (communication: Communication): boolean =>
  Boolean(
    communication.medium?.some((medium) => medium.coding?.some((coding) => coding.code === ZAP_SMS_MEDIUM_CODE)) &&
      communication.sender?.reference?.startsWith('RelatedPerson/')
  );

/** Texts from a patient who is on today's tracking board (any location, any status) need no task. */
export const hasVisitToday = (visits: Visit[], now: DateTime): boolean =>
  visits.some((visit) =>
    DateTime.fromISO(visit.start, { zone: visit.timezone }).hasSame(now.setZone(visit.timezone), 'day')
  );

export const isTaskForCommunication = (task: Task, communicationId: string): boolean =>
  Boolean(task.basedOn?.some((reference) => reference.reference === `Communication/${communicationId}`));

/**
 * The Tasks-list row for a text: the message is the details; the title names the patient like the
 * portal's requests do. Linked to the patient's newest visit (an upcoming booking counts) so the
 * visit's provider sees it on their journal and the clinic sees it in its Tasks list.
 */
export function buildTextMessageTask(input: { patient: Patient; visit?: Visit; communication: Communication }): Task {
  const { patient, visit, communication } = input;
  const patientName = getFullestAvailableName(patient) ?? '';
  const title = `Text message from ${visit?.label ?? patientName}`;
  const task = createTask({
    category: PATIENT_REQUEST_TASK.category,
    title,
    code: { system: PATIENT_REQUEST_TASK.system, code: PATIENT_REQUEST_TASK.code.textMessage },
    encounterId: visit?.encounterId,
    location: visit?.location,
    basedOn: [`Communication/${communication.id}`],
    input: [
      { type: MANUAL_TASK.input.title, valueString: title },
      { type: MANUAL_TASK.input.details, valueString: getMessageFromComm(communication) },
      { type: MANUAL_TASK.input.patient, valueReference: { reference: `Patient/${patient.id}`, display: patientName } },
      { type: MANUAL_TASK.input.appointmentId, valueString: visit?.appointmentId },
      { type: MANUAL_TASK.input.encounterId, valueString: visit?.encounterId },
    ],
  });
  // FHIR inv-1 requires lastModified >= authoredOn, and a received text was sent before now.
  const authoredOn = DateTime.fromISO(task.authoredOn!);
  const sent = communication.sent ? DateTime.fromISO(communication.sent) : authoredOn;
  task.lastModified = DateTime.max(sent, authoredOn).toISO()!;
  return task;
}

/** Adds a new text to the patient's open text task: the message joins the details, and the task's age restarts. */
export function getAttachTextOperations(task: Task, communication: Communication): Operation[] {
  const text = getMessageFromComm(communication);
  const detailsIndex = task.input?.findIndex(
    (input) => input.type?.coding?.some((coding) => coding.code === MANUAL_TASK.input.details)
  );
  const operations: Operation[] = [
    task.basedOn
      ? { op: 'add', path: '/basedOn/-', value: { reference: `Communication/${communication.id}` } }
      : { op: 'add', path: '/basedOn', value: [{ reference: `Communication/${communication.id}` }] },
    {
      op: task.lastModified ? 'replace' : 'add',
      path: '/lastModified',
      value: communication.sent ?? DateTime.now().toISO(),
    },
  ];
  if (detailsIndex != null && detailsIndex >= 0) {
    const existing = task.input![detailsIndex].valueString;
    operations.push({
      op: 'replace',
      path: `/input/${detailsIndex}/valueString`,
      value: existing ? `${existing}\n${text}` : text,
    });
  } else {
    const details = {
      type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.details }] },
      valueString: text,
    };
    operations.push(
      task.input ? { op: 'add', path: '/input/-', value: details } : { op: 'add', path: '/input', value: [details] }
    );
  }
  return operations;
}

export const getTextTaskPatientId = (task: Task): string | undefined =>
  getIdFromReference(
    task.input?.find((input) => input.type?.coding?.some((coding) => coding.code === MANUAL_TASK.input.patient))
      ?.valueReference?.reference,
    'Patient'
  );
