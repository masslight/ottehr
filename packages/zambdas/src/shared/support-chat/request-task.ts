import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Communication,
  Encounter,
  Location,
  Patient,
  Practitioner,
  Reference,
  Resource,
  Schedule,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_INPUT_SYSTEM, TASK_LOCATION_SYSTEM, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { getParticipantIdFromAppointment } from 'utils/lib/helpers/helpers';
import { canBeAssignedAsProvider } from 'utils/lib/types/api/get-employees/get-employees.types';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { SUPPORT_CHAT_TOPIC_LABEL, SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { TIMEZONES } from 'utils/lib/types/constants';
import { getTaskInputValue, MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { getTimezone } from 'utils/lib/utils/scheduleUtils';
import { getPractitionerRoles } from '../auth';
import { createOwnerReference, createTask } from '../tasks';
import { mapEncountersToAppointmentIds } from '../visits';
import { PatientRequestCode } from './bot';
import { makeThreadTag, threadTagSearchParam } from './thread';

const MAX_QUOTED_TITLE_LENGTH = 100;
const VISIT_LOOKBACK_YEARS = 3;
const VISITS_PER_PATIENT = 5;
const EXCLUDED_VISIT_STATUSES: Appointment['status'][] = ['entered-in-error'];

export interface Visit {
  appointmentId: string;
  encounterId: string;
  patient: Patient;
  location?: { id: string; name?: string };
  providerId?: string;
  date: string;
  label: string;
}

export async function getVisits(oystehr: Oystehr, patients: Patient[]): Promise<Visit[]> {
  if (!patients.length) return [];

  const resources = await searchVisitResources(oystehr, patients);

  const encounters = mapEncountersToAppointmentIds(resources);

  return resources
    .filter((resource): resource is Appointment => resource.resourceType === 'Appointment')
    .filter(
      (appointment) =>
        !EXCLUDED_VISIT_STATUSES.includes(appointment.status) && appointment.start && encounters[appointment.id!]
    )
    .sort((a, b) => b.start!.localeCompare(a.start!))
    .flatMap((appointment) => {
      const patient = patients.find((p) => p.id === getParticipantIdFromAppointment(appointment, 'Patient'));

      if (!patient) return [];

      const encounter = encounters[appointment.id!];
      const locationId = encounter.location?.[0]?.location?.reference?.replace('Location/', '');
      const location = resources.find((r): r is Location => r.resourceType === 'Location' && r.id === locationId);
      const date = DateTime.fromISO(appointment.start!, { zone: getLocationTimezone(locationId, resources) }).toFormat(
        'MM/dd/yyyy'
      );

      return [
        {
          appointmentId: appointment.id!,
          encounterId: encounter.id!,
          patient,
          location: locationId ? { id: locationId, name: location?.name } : undefined,
          providerId: getAttendingPractitionerId(encounter),
          date,
          label: `${getFullestAvailableName(patient)} ${date}`,
        },
      ];
    });
}

export const findLatestVisitLocation = (visits: Visit[], patientId: string | undefined): Visit['location'] =>
  visits.find((visit) => visit.patient.id === patientId)?.location;

export const getDefaultPatientId = (thread: Communication[], visits: Visit[]): string | undefined =>
  thread.findLast((message) => message.about && message.subject)?.subject?.reference?.replace('Patient/', '') ??
  visits[0]?.patient.id;

async function searchVisitResources(oystehr: Oystehr, patients: Patient[]): Promise<Resource[]> {
  const since = DateTime.now().minus({ years: VISIT_LOOKBACK_YEARS }).toISODate();

  const results = await Promise.allSettled(
    patients.map(async (patient) =>
      (
        await oystehr.fhir.search<Appointment | Encounter>({
          resourceType: 'Appointment',
          params: [
            { name: '_tag', value: [OTTEHR_MODULE.TM, OTTEHR_MODULE.IP].join(',') },
            { name: 'patient', value: `Patient/${patient.id}` },
            { name: 'date', value: `ge${since}` },
            { name: 'status:not', value: EXCLUDED_VISIT_STATUSES.join(',') },
            { name: '_sort', value: '-date' },
            { name: '_count', value: VISITS_PER_PATIENT },
            { name: '_revinclude', value: 'Encounter:appointment' },
          ],
        })
      ).unbundle()
    )
  );

  const visits = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;

    console.error(`Failed to load the visits of Patient/${patients[index].id}`, result.reason);
    return [];
  });

  const locationIds = new Set(
    visits.flatMap((resource) =>
      resource.resourceType === 'Encounter'
        ? (resource.location ?? []).flatMap((item) => item.location?.reference?.replace('Location/', '') ?? [])
        : []
    )
  );

  if (!locationIds.size) return visits;

  const locations = await getAllFhirSearchPages<Location | Schedule>(
    {
      resourceType: 'Location',
      params: [
        { name: '_id', value: [...locationIds].join(',') },
        { name: '_revinclude', value: 'Schedule:actor' },
      ],
    },
    oystehr
  );

  return [...visits, ...locations];
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

export async function getVisitProviderOwner(
  oystehr: Oystehr,
  visit: Visit | undefined
): Promise<Reference | undefined> {
  const providerId = visit?.providerId;

  if (!providerId) return undefined;

  try {
    const [practitioner, roles] = await Promise.all([
      oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: providerId }),
      getPractitionerRoles(oystehr, providerId),
    ]);

    if (roles && !canBeAssignedAsProvider({ roles })) return undefined;

    const name = getFullestAvailableName(practitioner);
    const owner = createOwnerReference(providerId, name ?? '');

    return name ? owner : { ...owner, display: undefined };
  } catch (error) {
    console.warn(`Could not resolve provider ${providerId} of visit ${visit.appointmentId}; leaving unassigned`, error);
    return undefined;
  }
}

export function canAutoAssign(task: Task, visits: Visit[]): boolean {
  if (task.status !== 'ready' && task.status !== 'in-progress') return false;
  if (!task.owner) return true;

  const linkedVisit = visits.find((visit) => task.encounter?.reference === `Encounter/${visit.encounterId}`);

  return !!linkedVisit?.providerId && task.owner.reference === `Practitioner/${linkedVisit.providerId}`;
}

export function moveRequestTask(task: Task, next: Task, reassign: boolean): Task {
  const changeOwner = reassign && task.owner?.reference !== next.owner?.reference;
  const droppedTagSystems = changeOwner
    ? [TASK_LOCATION_SYSTEM, PROVIDER_NOTIFICATION_TAG_SYSTEM]
    : [TASK_LOCATION_SYSTEM];
  const keptTags = (task.meta?.tag ?? []).filter((tag) => !droppedTagSystems.includes(tag.system ?? ''));

  const addedTags = (next.meta?.tag ?? []).filter(
    (tag) => !keptTags.some((kept) => kept.system === tag.system && kept.code === tag.code)
  );

  return {
    ...task,
    description: next.description,
    encounter: next.encounter,
    location: next.location,
    input: next.input,
    ...(changeOwner ? { owner: next.owner, status: next.status } : {}),
    meta: { ...task.meta, tag: [...keptTags, ...addedTags] },
  };
}

export function buildRequestTask(input: {
  code: PatientRequestCode;
  threadId: string;
  patient: Patient;
  visit?: Visit;
  location?: Visit['location'];
  owner?: Reference;
  text?: string;
  details?: string;
}): Task {
  const { code, threadId, patient, visit, location, owner, text, details } = input;
  const patientName = getFullestAvailableName(patient) ?? '';
  const title = buildRequestTitle(code, visit?.label ?? patientName, text);

  const task = createTask({
    category: PATIENT_REQUEST_TASK.category,
    title,
    code: { system: PATIENT_REQUEST_TASK.system, code },
    encounterId: visit?.encounterId,
    location: visit ? visit.location : location,
    input: [
      { type: MANUAL_TASK.input.title, valueString: title },
      { type: MANUAL_TASK.input.details, valueString: details },
      { type: MANUAL_TASK.input.patient, valueReference: { reference: `Patient/${patient.id}`, display: patientName } },
      { type: MANUAL_TASK.input.appointmentId, valueString: visit?.appointmentId },
      { type: MANUAL_TASK.input.encounterId, valueString: visit?.encounterId },
    ],
  });

  task.meta!.tag!.push(makeThreadTag(threadId), SUPPORT_CHAT_UNREAD_TAG);

  return owner ? { ...task, owner, status: 'in-progress' } : task;
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
