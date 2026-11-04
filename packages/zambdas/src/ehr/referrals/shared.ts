import Oystehr from '@oystehr/sdk';
import {
  Communication,
  DocumentReference,
  Encounter,
  FhirResource,
  Organization,
  Patient,
  Practitioner,
  Reference,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getOutboundDeliveryAttemptStatus,
  getOutboundDeliveryChannel,
  getOutboundDeliveryRecipientSnapshot,
} from 'utils/lib/fhir/outbound-delivery';
import { getFullestAvailableName, getFullName } from 'utils/lib/fhir/patient';
import {
  getReferralDetails,
  getReferralNotesToRecipient,
  getReferralReason,
  getReferralRecipientContactId,
  getReferralSpecialty,
  getReferralStatus,
  getReferralUrgency,
  isReferralServiceRequest,
  REFERRAL_FORM_DOC_REF_DOCTYPE,
} from 'utils/lib/fhir/referral';
import { removePrefix } from 'utils/lib/helpers/helpers';
import {
  isReferralOpen,
  REFERRAL_DEFAULTS,
  REFERRAL_TASK,
  ReferralDTO,
  ReferralRecipient,
  referralTaskTitle,
} from 'utils/lib/types/api/referrals/referrals.types';
import { getTaskInputValue } from 'utils/lib/types/data/tasks/types';
import { mapReferralRecipient, withReferralFax } from '../../shared/referrals/recipient';
import { findReferralTasks, isOpenTask, referralOverdueAt } from '../../shared/referrals/referral-task';
import { createOwnerReference, createTask } from '../../shared/tasks';

/** Ids per `_id` / `based-on` / `related` search, so the query string stays well under URL limits. */
const ID_SEARCH_CHUNK = 50;

/** One paged search per chunk of values for `paramName`, so a long patient history never builds an oversized URL. */
const searchByValues = async <T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  paramName: string,
  values: string[],
  extraParams: { name: string; value: string }[] = []
): Promise<T[]> => {
  const unique = [...new Set(values)];
  const results: T[] = [];
  for (let i = 0; i < unique.length; i += ID_SEARCH_CHUNK) {
    const chunk = unique.slice(i, i + ID_SEARCH_CHUNK);
    results.push(
      ...(await getAllFhirSearchPages<T>(
        { resourceType, params: [{ name: paramName, value: chunk.join(',') }, ...extraParams] },
        oystehr
      ))
    );
  }
  return results;
};

const referenceId = (reference: Reference | undefined, prefix: string): string | undefined =>
  removePrefix(prefix, reference?.reference ?? '') || undefined;

const isReferralTask = (task: Task): boolean =>
  task.groupIdentifier?.system === TASK_CATEGORY_IDENTIFIER && task.groupIdentifier.value === REFERRAL_TASK.category;

const isReferralForm = (docRef: DocumentReference): boolean =>
  !!docRef.type?.coding?.some(
    (coding) =>
      coding.system === REFERRAL_FORM_DOC_REF_DOCTYPE.system && coding.code === REFERRAL_FORM_DOC_REF_DOCTYPE.code
  );

const newestFirst = <T extends { authoredOn?: string; date?: string }>(a: T, b: T): number =>
  (b.authoredOn ?? b.date ?? '').localeCompare(a.authoredOn ?? a.date ?? '');

const oldestFirst = <T extends { authoredOn?: string; date?: string }>(a: T, b: T): number => newestFirst(b, a);

/** The task that represents the referral: an open one when there is one, else the most recent. */
export const pickReferralTask = (tasks: Task[]): Task | undefined => {
  const sorted = [...tasks].sort(newestFirst);
  return sorted.find(isOpenTask) ?? sorted[0];
};

/** Open statuses first, then newest first. */
export const sortReferrals = (referrals: ReferralDTO[]): ReferralDTO[] =>
  [...referrals].sort((a, b) => {
    const openDiff = Number(isReferralOpen(b.status)) - Number(isReferralOpen(a.status));
    return openDiff !== 0 ? openDiff : b.createdAt.localeCompare(a.createdAt);
  });

/** Everything about a referral that lives outside its ServiceRequest. */
export interface ReferralDTOContext {
  recipient?: ReferralRecipient;
  referringProviderName?: string;
  appointmentId?: string;
  task?: Task;
  formDocumentReference?: DocumentReference;
  /** Filed responses, oldest first. */
  responseDocumentReferences?: DocumentReference[];
  lastFax?: ReferralDTO['lastFax'];
}

export const toReferralDTO = (serviceRequest: ServiceRequest, context: ReferralDTOContext): ReferralDTO => {
  const details = getReferralDetails(serviceRequest);
  const recipientContactId = getReferralRecipientContactId(serviceRequest);
  const recipient =
    context.recipient ??
    (recipientContactId
      ? { contactId: recipientContactId, name: serviceRequest.performer?.[0]?.display ?? '' }
      : undefined);
  return {
    id: serviceRequest.id ?? '',
    patientId: referenceId(serviceRequest.subject, 'Patient/') ?? '',
    encounterId: referenceId(serviceRequest.encounter, 'Encounter/'),
    appointmentId: context.appointmentId,
    specialty: getReferralSpecialty(serviceRequest),
    recipient,
    reason: getReferralReason(serviceRequest),
    urgency: getReferralUrgency(serviceRequest),
    whatIsAsked: details?.whatIsAsked ?? REFERRAL_DEFAULTS.whatIsAsked,
    whoSchedules: details?.whoSchedules ?? REFERRAL_DEFAULTS.whoSchedules,
    responseRequested: details?.responseRequested ?? REFERRAL_DEFAULTS.responseRequested,
    includeDocuments: details?.includeDocuments ?? [],
    notesToRecipient: getReferralNotesToRecipient(serviceRequest),
    referringProvider: {
      id: referenceId(serviceRequest.requester, 'Practitioner/'),
      name: serviceRequest.requester?.display ?? context.referringProviderName ?? '',
    },
    status: getReferralStatus(serviceRequest),
    createdAt: serviceRequest.authoredOn ?? '',
    sentAt: details?.sentAt,
    givenToPatientAt: details?.givenToPatientAt,
    closedAt: details?.closedAt,
    closeReason: details?.closeReason,
    outcome: details?.outcome,
    taskId: context.task?.id,
    taskStatus: context.task?.status,
    overdueAt: context.task?.restriction?.period?.end,
    formDocumentReferenceId: context.formDocumentReference?.id,
    responseDocumentReferenceIds: (context.responseDocumentReferences ?? [])
      .map((docRef) => docRef.id)
      .filter((id): id is string => !!id),
    lastFax: context.lastFax,
  };
};

/** Recipients by ServiceRequest id. A contact deleted from the directory simply has no entry. */
export const loadRecipientsFor = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<Map<string, ReferralRecipient>> => {
  const contactIds = serviceRequests.map(getReferralRecipientContactId).filter((id): id is string => !!id);
  const organizations = await searchByValues<Organization>(oystehr, 'Organization', '_id', contactIds);
  const byId = new Map(organizations.map((organization) => [organization.id, mapReferralRecipient(organization)]));
  return new Map(
    serviceRequests.flatMap((serviceRequest) => {
      const recipient = byId.get(getReferralRecipientContactId(serviceRequest) ?? '');
      return serviceRequest.id && recipient ? [[serviceRequest.id, withReferralFax(serviceRequest, recipient)]] : [];
    })
  );
};

const latestFaxAttempt = async (
  oystehr: Oystehr,
  attemptsByReferral: Map<string, Task[]>
): Promise<Map<string, ReferralDTO['lastFax']>> => {
  const latest = new Map(
    [...attemptsByReferral].map(([referralId, attempts]) => [referralId, [...attempts].sort(newestFirst)[0]])
  );
  const communicationIds = [...latest.values()]
    .map((task) => getOutboundDeliveryRecipientSnapshot(task).communicationId)
    .filter((id): id is string => !!id);
  const communications = new Map(
    (await searchByValues<Communication>(oystehr, 'Communication', '_id', communicationIds)).map((communication) => [
      communication.id,
      communication,
    ])
  );
  return new Map(
    [...latest].map(([referralId, task]) => [
      referralId,
      {
        attemptId: task.id ?? '',
        status: getOutboundDeliveryAttemptStatus(
          task,
          communications.get(getOutboundDeliveryRecipientSnapshot(task).communicationId ?? '')
        ),
        sentAt: task.executionPeriod?.start ?? task.authoredOn,
      },
    ])
  );
};

const groupBy = <T>(items: T[], key: (item: T) => string | undefined): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
};

const basedOnReferralId = (task: Task): string | undefined =>
  task.basedOn?.map((ref) => referenceId(ref, 'ServiceRequest/')).find((id) => !!id);

const relatedReferralId = (docRef: DocumentReference): string | undefined =>
  docRef.context?.related?.map((ref) => referenceId(ref, 'ServiceRequest/')).find((id) => !!id);

/** Maps referral ServiceRequests to DTOs, loading what each needs in batches. Sorted open first, newest first. */
export const buildReferralDTOs = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<ReferralDTO[]> => {
  const referrals = serviceRequests.filter(
    (serviceRequest) => serviceRequest.id && isReferralServiceRequest(serviceRequest)
  );
  if (!referrals.length) return [];
  const referralRefs = referrals.map((serviceRequest) => `ServiceRequest/${serviceRequest.id}`);
  const encounterIds = referrals
    .map((serviceRequest) => referenceId(serviceRequest.encounter, 'Encounter/'))
    .filter((id): id is string => !!id);
  const practitionerIdsWithoutDisplay = referrals
    .filter((serviceRequest) => !serviceRequest.requester?.display)
    .map((serviceRequest) => referenceId(serviceRequest.requester, 'Practitioner/'))
    .filter((id): id is string => !!id);

  const [recipients, tasks, docRefs, encounters, practitioners] = await Promise.all([
    loadRecipientsFor(oystehr, referrals),
    // Referral-category tasks and outbound fax attempts both hang off the ServiceRequest; one search, split below.
    searchByValues<Task>(oystehr, 'Task', 'based-on', referralRefs),
    // The form and the filed responses both relate to the ServiceRequest; one search, split by type below.
    searchByValues<DocumentReference>(oystehr, 'DocumentReference', 'related', referralRefs, [
      { name: 'status', value: 'current' },
    ]),
    searchByValues<Encounter>(oystehr, 'Encounter', '_id', encounterIds),
    searchByValues<Practitioner>(oystehr, 'Practitioner', '_id', practitionerIdsWithoutDisplay),
  ]);

  const referralTasks = groupBy(tasks.filter(isReferralTask), basedOnReferralId);
  const faxAttempts = groupBy(
    tasks.filter((task) => getOutboundDeliveryChannel(task) === 'fax'),
    basedOnReferralId
  );
  const lastFaxes = await latestFaxAttempt(oystehr, faxAttempts);
  const formsByReferral = groupBy(docRefs.filter(isReferralForm), relatedReferralId);
  const responsesByReferral = groupBy(
    docRefs.filter((docRef) => !isReferralForm(docRef)),
    relatedReferralId
  );
  const appointmentByEncounter = new Map(
    encounters.map((encounter) => [encounter.id, referenceId(encounter.appointment?.[0], 'Appointment/')])
  );
  const practitionerNames = new Map(
    practitioners.map((practitioner) => [practitioner.id, getFullestAvailableName(practitioner)])
  );

  return sortReferrals(
    referrals.map((serviceRequest) => {
      const id = serviceRequest.id!;
      return toReferralDTO(serviceRequest, {
        recipient: recipients.get(id),
        referringProviderName: practitionerNames.get(referenceId(serviceRequest.requester, 'Practitioner/') ?? ''),
        appointmentId: appointmentByEncounter.get(referenceId(serviceRequest.encounter, 'Encounter/') ?? ''),
        task: pickReferralTask(referralTasks.get(id) ?? []),
        formDocumentReference: [...(formsByReferral.get(id) ?? [])].sort(newestFirst)[0],
        responseDocumentReferences: [...(responsesByReferral.get(id) ?? [])].sort(oldestFirst),
        lastFax: lastFaxes.get(id),
      });
    })
  );
};

// ---- referral task ----

/** Sets every open referral-category task of a referral to `status`. */
export const settleReferralTasks = async (
  oystehr: Oystehr,
  referralId: string,
  status: Extract<Task['status'], 'completed' | 'cancelled'>
): Promise<void> => {
  const openTasks = (await findReferralTasks(oystehr, referralId)).filter(isOpenTask);
  await Promise.all(
    openTasks.map((task) =>
      oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [{ op: 'replace', path: '/status', value: status }],
      })
    )
  );
};

/**
 * Keeps the "awaiting response" task in step with a saved referral: created when a response is now
 * requested and none is open, refreshed when one is, cancelled when the request was withdrawn. The overdue
 * clock counts from when the referral went out (`sentAt`, else now) and an edit only moves it when the
 * urgency changed.
 */
export const syncReferralTask = async (args: {
  oystehr: Oystehr;
  serviceRequest: ServiceRequest;
  patient: Patient;
  recipient?: ReferralRecipient;
  owner: Reference;
  location?: { id: string; name?: string };
}): Promise<void> => {
  const { oystehr, serviceRequest, patient, recipient, owner, location } = args;
  const referralId = serviceRequest.id!;
  const details = getReferralDetails(serviceRequest);
  const openTask = (await findReferralTasks(oystehr, referralId)).filter(isOpenTask).sort(newestFirst)[0];

  if (!details?.responseRequested) {
    if (openTask) await settleReferralTasks(oystehr, referralId, 'cancelled');
    return;
  }

  const specialty = getReferralSpecialty(serviceRequest);
  const urgency = getReferralUrgency(serviceRequest);
  const task = createTask({
    category: REFERRAL_TASK.category,
    title: referralTaskTitle(specialty, recipient?.name),
    code: { system: REFERRAL_TASK.system, code: REFERRAL_TASK.code.awaitResponse },
    encounterId: referenceId(serviceRequest.encounter, 'Encounter/'),
    location,
    input: [
      { type: REFERRAL_TASK.input.referralId, valueString: referralId },
      {
        type: REFERRAL_TASK.input.patient,
        valueReference: { reference: `Patient/${patient.id}`, display: getFullName(patient) },
      },
      { type: REFERRAL_TASK.input.specialty, valueString: specialty },
      { type: REFERRAL_TASK.input.recipientName, valueString: recipient?.name },
      { type: REFERRAL_TASK.input.urgency, valueString: urgency },
    ],
    basedOn: [`ServiceRequest/${referralId}`],
  });
  const anchor = details.sentAt ?? DateTime.now().toUTC().toISO() ?? new Date().toISOString();
  const restriction: Task['restriction'] = { period: { end: referralOverdueAt(urgency, anchor) } };

  if (openTask) {
    const urgencyChanged = getTaskInputValue(openTask, REFERRAL_TASK.input.urgency) !== urgency;
    await oystehr.fhir.update<Task>({
      ...openTask,
      description: task.description,
      input: task.input,
      ...(urgencyChanged ? { restriction } : {}),
    });
    return;
  }

  const ownerId = referenceId(owner, 'Practitioner/');
  await oystehr.fhir.create<Task>({
    ...task,
    restriction,
    ...(ownerId ? { owner: createOwnerReference(ownerId, owner.display ?? ''), status: 'in-progress' } : {}),
  });
};
