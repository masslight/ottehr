import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Location, Patient, Resource, Schedule, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_INPUT_SYSTEM, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { getParticipantIdFromAppointment } from 'utils/lib/helpers/helpers';
import { SUPPORT_CHAT_TOPIC_LABEL, SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { TIMEZONES } from 'utils/lib/types/constants';
import { getTaskInputValue, MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { getTimezone } from 'utils/lib/utils/scheduleUtils';
import { createTask } from '../tasks';
import { getFhirResources, mapEncountersToAppointmentIds } from '../visits';
import { PatientRequestCode } from './bot';
import { makeThreadTag, threadTagSearchParam } from './thread';

const MAX_QUOTED_TITLE_LENGTH = 100;

export interface Visit {
  appointmentId: string;
  encounterId: string;
  patient: Patient;
  location?: { id: string; name?: string };
  label: string;
}

export async function getVisits(oystehr: Oystehr, patients: Patient[]): Promise<Visit[]> {
  if (!patients.length) return [];

  const resources = await getFhirResources(
    oystehr,
    patients.map((patient) => `Patient/${patient.id}`)
  );

  const encounters = mapEncountersToAppointmentIds(resources);

  return resources
    .filter((resource): resource is Appointment => resource.resourceType === 'Appointment')
    .filter((appointment) => appointment.status === 'fulfilled' && appointment.start && encounters[appointment.id!])
    .sort((a, b) => b.start!.localeCompare(a.start!))
    .flatMap((appointment) => {
      const patient = patients.find((p) => p.id === getParticipantIdFromAppointment(appointment, 'Patient'));

      if (!patient) return [];

      const encounter = encounters[appointment.id!];
      const locationId = encounter.location?.[0]?.location?.reference?.replace('Location/', '');
      const location = resources.find((r): r is Location => r.resourceType === 'Location' && r.id === locationId);
      const date = DateTime.fromISO(appointment.start!, { zone: getLocationTimezone(locationId, resources) });

      return [
        {
          appointmentId: appointment.id!,
          encounterId: encounter.id!,
          patient,
          location: locationId ? { id: locationId, name: location?.name } : undefined,
          label: `${getFullestAvailableName(patient)} ${date.toFormat('MM/dd/yyyy')}`,
        },
      ];
    });
}

function getLocationTimezone(locationId: string | undefined, resources: Resource[]): string {
  const hasTimezone = (resource: Location | Schedule): boolean =>
    Boolean(resource.extension?.some((extension) => extension.url === TIMEZONE_EXTENSION_URL));

  const isVisitLocation = (resource: Resource): resource is Location | Schedule =>
    (resource.resourceType === 'Location' && resource.id === locationId) ||
    (resource.resourceType === 'Schedule' &&
      Boolean((resource as Schedule).actor?.some((actor) => actor.reference === `Location/${locationId}`)));

  const source = resources.filter(isVisitLocation).find(hasTimezone);

  return source ? getTimezone(source) : TIMEZONES[0];
}

export function buildRequestTitle(code: PatientRequestCode, subject: string, text?: string): string {
  if (code !== PATIENT_REQUEST_TASK.code.followUp) return `${SUPPORT_CHAT_TOPIC_LABEL[code]} for ${subject}`;

  const quoted = (text ?? '').length > MAX_QUOTED_TITLE_LENGTH ? `${text!.slice(0, MAX_QUOTED_TITLE_LENGTH)}…` : text;

  return `“${quoted}” for ${subject}`;
}

export async function findOpenTasks(oystehr: Oystehr, threadId: string): Promise<Task[]> {
  return getAllFhirSearchPages<Task>(
    {
      resourceType: 'Task',
      params: [
        threadTagSearchParam(threadId),
        { name: 'status', value: 'ready,in-progress' },
        { name: '_sort', value: '-authored-on' },
      ],
    },
    oystehr
  );
}

export const hasUnreadTag = (task: Task): boolean =>
  Boolean(
    task.meta?.tag?.some(
      (tag) => tag.system === SUPPORT_CHAT_UNREAD_TAG.system && tag.code === SUPPORT_CHAT_UNREAD_TAG.code
    )
  );

export function buildRequestTask(input: {
  code: PatientRequestCode;
  threadId: string;
  patient: Patient;
  visit?: Visit;
  text?: string;
  details?: string;
}): Task {
  const { code, threadId, patient, visit, text, details } = input;
  const patientName = getFullestAvailableName(patient) ?? '';
  const title = buildRequestTitle(code, visit?.label ?? patientName, text);

  const task = createTask({
    category: PATIENT_REQUEST_TASK.category,
    title,
    code: { system: PATIENT_REQUEST_TASK.system, code },
    encounterId: visit?.encounterId,
    location: visit?.location,
    input: [
      { type: MANUAL_TASK.input.title, valueString: title },
      { type: MANUAL_TASK.input.details, valueString: details },
      { type: MANUAL_TASK.input.patient, valueReference: { reference: `Patient/${patient.id}`, display: patientName } },
      { type: MANUAL_TASK.input.appointmentId, valueString: visit?.appointmentId },
      { type: MANUAL_TASK.input.encounterId, valueString: visit?.encounterId },
    ],
  });

  task.meta!.tag!.push(makeThreadTag(threadId), SUPPORT_CHAT_UNREAD_TAG);

  return task;
}

export function getAttachOperations(task: Task, text: string): Operation[] {
  const operations: Operation[] = [getPatchOperationForNewMetaTag(task, SUPPORT_CHAT_UNREAD_TAG)];
  const isFollowUp = task.code?.coding?.some((coding) => coding.code === PATIENT_REQUEST_TASK.code.followUp);

  if (!isFollowUp && !getTaskInputValue(task, MANUAL_TASK.input.details)) {
    operations.push({
      op: 'add',
      path: '/input/-',
      value: { type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.details }] }, valueString: text },
    });
  }

  return operations;
}

export const getTaskPatientId = (task: Task): string | undefined =>
  task.input
    ?.find((input) => input.type.coding?.some((coding) => coding.code === MANUAL_TASK.input.patient))
    ?.valueReference?.reference?.replace('Patient/', '');

export async function clearTaskUnread(oystehr: Oystehr, taskId: string): Promise<void> {
  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  const index =
    task.meta?.tag?.findIndex(
      (tag) => tag.system === SUPPORT_CHAT_UNREAD_TAG.system && tag.code === SUPPORT_CHAT_UNREAD_TAG.code
    ) ?? -1;

  if (index < 0) return;

  const path = `/meta/tag/${index}`;

  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [
      { op: 'test', path, value: task.meta!.tag![index] },
      { op: 'remove', path },
    ],
  });
}
