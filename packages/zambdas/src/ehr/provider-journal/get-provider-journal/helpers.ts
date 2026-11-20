import { Appointment, DiagnosticReport, Encounter, Patient, QuestionnaireResponse, RelatedPerson, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAppointmentRoom, getReasonForVisitAndAdditionalDetailsFromAppointment } from 'utils/lib/fhir/appointments';
import {
  PRIVATE_EXTENSION_BASE_URL,
  SERVICE_CATEGORY_SYSTEM,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { getFirstName, getFullestAvailableName, getLastName, getSMSNumberForIndividual } from 'utils/lib/fhir/patient';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { VisitStatusLabel } from 'utils/lib/types/api/appointment.types';
import {
  GetProviderJournalResponse,
  JournalItem,
  JournalItemWhen,
  JournalKind,
  JournalPatient,
  JournalPhone,
  JournalRow,
  JournalVisit,
} from 'utils/lib/types/api/provider-journal.types';
import { SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { IN_HOUSE_LAB_TASK } from 'utils/lib/types/data/in-house/in-house.constants';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { flattenQuestionnaireAnswers } from 'utils/lib/types/data/paperwork/paperwork.types';
import {
  ERX_TASK,
  FAX_TASK,
  getTaskInputValue,
  MANUAL_TASK,
  PATIENT_REQUEST_TASK,
  RADIOLOGY_TASK,
  TaskAlertCode,
} from 'utils/lib/types/data/tasks/types';
import { getInPersonVisitStatus, getVisitStatusHistory } from 'utils/lib/utils/visitUtils';

/** Visits older than this fall off the journal, except unfinished ones; owned tasks stay until done. */
export const JOURNAL_WINDOW_DAYS = 90;
export const PAST_WINDOW_DAYS = 7;

/** The Tasks board hides these codes too (`TASK_CODES_TO_EXCLUDE` in the EHR's useTasks). */
const EXCLUDED_TASK_CODES: string[] = [
  LAB_ORDER_TASK.code.preSubmission,
  LAB_ORDER_TASK.code.reviewCancelledResult,
  IN_HOUSE_LAB_TASK.code.collectSampleTask,
  IN_HOUSE_LAB_TASK.code.inputResultsTask,
];
const OPEN_TASK_STATUSES: Task['status'][] = ['ready', 'in-progress'];
/** The chart (and so the progress note) exists once intake has started. */
const STATUSES_WITHOUT_PROGRESS_NOTE: VisitStatusLabel[] = [
  'pending',
  'arrived',
  'ready',
  'cancelled',
  'no show',
  'unknown',
];

const JOURNAL_RULES: Record<
  JournalKind,
  {
    owns: (encounter: Encounter) => string | undefined;
    /** The row is in Coming Up. */
    ready: VisitStatusLabel;
    /** Provider journals also look ahead at their own patients still in intake. */
    lookahead?: VisitStatusLabel;
    /** The patient is in the room with this person. */
    inProgress: VisitStatusLabel;
    /** The patient counts as seen (Today / Past). */
    seen: VisitStatusLabel[];
  }
> = {
  provider: {
    owns: getAttendingPractitionerId,
    ready: 'ready for provider',
    lookahead: 'intake',
    inProgress: 'provider',
    seen: ['provider', 'discharged', 'awaiting supervisor approval', 'completed'],
  },
  clinician: {
    owns: getAdmitterPractitionerId,
    ready: 'ready',
    inProgress: 'intake',
    seen: ['intake', 'ready for provider', 'provider', 'discharged', 'awaiting supervisor approval', 'completed'],
  },
};

export interface JournalSources {
  kind: JournalKind;
  practitionerId: string;
  /** "Now" in the browser's timezone; "today" is that calendar day. */
  now: DateTime;
  /** Encounters where the practitioner is a participant, with their appointments. */
  encounters: Encounter[];
  appointments: Appointment[];
  patients: Patient[];
  relatedPersons: RelatedPerson[];
  /** Open board tasks owned by the practitioner or linked to one of the encounters. */
  tasks: Task[];
  /** Encounters of owned tasks that are not the practitioner's visits (for the patient and appointment). */
  taskEncounters?: Encounter[];
  /** Results of tasks with no encounter (unsolicited labs), for the patient. */
  diagnosticReports?: DiagnosticReport[];
}

interface Visit {
  appointment: Appointment;
  encounter: Encounter;
  patientId: string;
  journal: JournalVisit;
}

interface PatientBucket {
  patient: JournalPatient;
  visits: Visit[];
  items: JournalItem[];
}

export const isBoardTask = (task: Task): boolean => Boolean(task.meta?.tag?.some((tag) => tag.code === 'task'));

export const isOpenBoardTask = (task: Task): boolean =>
  isBoardTask(task) &&
  OPEN_TASK_STATUSES.includes(task.status) &&
  !task.code?.coding?.some((coding) => coding.code && EXCLUDED_TASK_CODES.includes(coding.code));

const taskOwnerId = (task: Task): string | undefined => getIdFromReference(task.owner?.reference, 'Practitioner');

const taskAssignedAt = (task: Task): string | undefined =>
  task.owner?.extension?.find((extension) => extension.url === TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)?.valueDateTime;

const basedOnId = (task: Task, resourceType: 'ServiceRequest' | 'DiagnosticReport'): string | undefined =>
  task.basedOn?.map((reference) => getIdFromReference(reference.reference, resourceType)).find(Boolean);

/** The Tasks page's alert (useTasks getAlertCode): the "alert" input, when it is a known code. */
const taskAlert = (task: Task): TaskAlertCode | undefined => {
  const code = getTaskInputValue(task, LAB_ORDER_TASK.input.alert);
  return Object.values(TaskAlertCode).includes(code as TaskAlertCode) ? (code as TaskAlertCode) : undefined;
};

const hasTag = (task: Task, tag: { system: string; code: string }): boolean =>
  Boolean(task.meta?.tag?.some((t) => t.system === tag.system && t.code === tag.code));

const toJournalVisit = (appointment: Appointment, encounter: Encounter, status: VisitStatusLabel): JournalVisit => {
  const category = appointment.serviceCategory
    ?.flatMap((codeableConcept) => codeableConcept.coding ?? [])
    .find((coding) => coding.system === SERVICE_CATEGORY_SYSTEM);
  return {
    appointmentId: appointment.id!,
    encounterId: encounter.id!,
    start: appointment.start!,
    isTelemed: isTelemedAppointment(appointment),
    isFollowUp: Boolean(encounter.partOf),
    status,
    serviceCategory: category?.display ?? category?.code,
    reasonForVisit: getReasonForVisitAndAdditionalDetailsFromAppointment(appointment).reasonForVisit,
    hasProgressNote: !STATUSES_WITHOUT_PROGRESS_NOTE.includes(status),
  };
};

const toJournalPatient = (patient: Patient, relatedPersons: RelatedPerson[]): JournalPatient => ({
  patientId: patient.id!,
  name: getFullestAvailableName(patient) ?? '',
  firstName: getFirstName(patient),
  lastName: getLastName(patient),
  phones: relatedPersons
    .filter(
      (rp) =>
        rp.patient?.reference === `Patient/${patient.id}` &&
        getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson'
    )
    .flatMap((rp) => {
      const number = getSMSNumberForIndividual(rp);
      return number && rp.id ? [{ number, recipientResourceUri: `RelatedPerson/${rp.id}` }] : [];
    })
    .filter((phone, index, phones) => phones.findIndex((p) => p.number === phone.number) === index),
});

const bySinceDesc = (a: JournalItem, b: JournalItem): number => b.since.localeCompare(a.since);
/** Flagged (abnormal) items first, as the provider should open them first; then newest first. */
const byAlertThenSinceDesc = (a: JournalItem, b: JournalItem): number =>
  Number(Boolean(b.alert)) - Number(Boolean(a.alert)) || bySinceDesc(a, b);
const byStartDesc = (a: Visit, b: Visit): number => b.journal.start.localeCompare(a.journal.start);

/**
 * One open item per task. The label is the action ("Review CBC"), `when` says what the age counts
 * from, and the ids let the page link to the order, visit or chart.
 */
export function taskToJournalItem(
  task: Task,
  context: { patientId?: string; appointmentId?: string; encounterId?: string; isFollowUpVisit?: boolean }
): JournalItem {
  const category = task.groupIdentifier?.value;
  const owned = Boolean(task.owner);
  const base = {
    id: task.id!,
    taskId: task.id,
    patientId: context.patientId,
    appointmentId: context.appointmentId,
    encounterId: context.encounterId,
    isFollowUpVisit: context.isFollowUpVisit || undefined,
    alert: taskAlert(task),
  };
  const assignedOrCreated = (): { when: JournalItemWhen; since: string } => ({
    when: owned ? 'assigned' : 'created',
    since: (owned ? taskAssignedAt(task) : undefined) ?? task.authoredOn ?? '',
  });

  if (category === LAB_ORDER_TASK.category) {
    const testName = getTaskInputValue(task, LAB_ORDER_TASK.input.testName);
    return {
      ...base,
      kind: 'external-lab',
      label: `Review ${testName ?? 'lab results'}`,
      when: 'resulted',
      since: getTaskInputValue(task, LAB_ORDER_TASK.input.receivedDate) ?? task.authoredOn ?? '',
      orderId: basedOnId(task, 'ServiceRequest'),
      diagnosticReportId: basedOnId(task, 'DiagnosticReport'),
    };
  }
  if (category === RADIOLOGY_TASK.category) {
    const study = getTaskInputValue(task, RADIOLOGY_TASK.input.studyTypeDisplay);
    return {
      ...base,
      kind: 'radiology',
      label: `Review ${study ?? 'radiology results'}`,
      when: 'read',
      since: task.authoredOn ?? '',
      orderId: basedOnId(task, 'ServiceRequest'),
      diagnosticReportId: basedOnId(task, 'DiagnosticReport'),
    };
  }
  if (category === PATIENT_REQUEST_TASK.category) {
    const code = getCoding(task.code, PATIENT_REQUEST_TASK.system)?.code;
    if (code === PATIENT_REQUEST_TASK.code.textMessage) {
      return {
        ...base,
        kind: 'text-message',
        label: 'Reply to text',
        when: 'received',
        since: task.lastModified ?? task.authoredOn ?? '',
        code,
      };
    }
    const unread = hasTag(task, SUPPORT_CHAT_UNREAD_TAG);
    return {
      ...base,
      kind: 'patient-request',
      label: unread ? 'Reply to patient message' : task.description ?? 'Patient request',
      ...(unread
        ? { when: 'received' as const, since: task.lastModified ?? task.authoredOn ?? '' }
        : assignedOrCreated()),
      code,
    };
  }
  if (category === FAX_TASK.category) {
    return {
      ...base,
      kind: 'fax',
      label: task.description ?? 'Review fax',
      when: 'received',
      since: getTaskInputValue(task, FAX_TASK.input.receivedDate) ?? task.authoredOn ?? '',
      code: getCoding(task.code, FAX_TASK.system)?.code,
      folderId: getTaskInputValue(task, FAX_TASK.input.folderId),
    };
  }
  if (category === ERX_TASK.category) {
    return {
      ...base,
      kind: 'erx',
      label: 'Check eRx notifications',
      when: 'first notified',
      since: task.authoredOn ?? '',
    };
  }
  return {
    ...base,
    kind: 'task',
    label: task.description ?? 'Task',
    ...assignedOrCreated(),
    isCallTask: category === MANUAL_TASK.category.patientFollowUp || undefined,
  };
}

/** The patient a task is about, read from the task itself or its linked resources. */
export function resolveTaskPatientId(
  task: Task,
  encounter: Encounter | undefined,
  diagnosticReports: DiagnosticReport[]
): string | undefined {
  const fromInput =
    task.input?.find((input) => input.type?.coding?.some((coding) => coding.code === MANUAL_TASK.input.patient))
      ?.valueReference?.reference ?? getTaskInputValue(task, FAX_TASK.input.patientId);
  const fromInputId = fromInput?.startsWith('Patient/') ? getIdFromReference(fromInput, 'Patient') : fromInput;
  if (fromInputId) return fromInputId;
  if (encounter?.subject?.reference) return getIdFromReference(encounter.subject.reference, 'Patient');
  const reportId = basedOnId(task, 'DiagnosticReport');
  const report = reportId ? diagnosticReports.find((dr) => dr.id === reportId) : undefined;
  return getIdFromReference(report?.subject?.reference, 'Patient');
}

export function buildJournal(sources: JournalSources): GetProviderJournalResponse {
  const { kind, practitionerId, now } = sources;
  const rules = JOURNAL_RULES[kind];
  const appointmentsById = new Map(sources.appointments.map((appointment) => [appointment.id!, appointment]));
  const patientsById = new Map(sources.patients.map((patient) => [patient.id!, patient]));
  const encountersById = new Map(
    [...sources.encounters, ...(sources.taskEncounters ?? [])].map((encounter) => [encounter.id!, encounter])
  );

  // This journal's visits: the practitioner holds the journal's role on the encounter.
  const visits: Visit[] = sources.encounters.flatMap((encounter) => {
    const appointmentId = getIdFromReference(encounter.appointment?.[0]?.reference, 'Appointment');
    const appointment = appointmentId ? appointmentsById.get(appointmentId) : undefined;
    const patientId = getIdFromReference(encounter.subject?.reference, 'Patient');
    if (!appointment?.start || !patientId || rules.owns(encounter) !== practitionerId) return [];
    const status = getInPersonVisitStatus(appointment, encounter);
    return [{ appointment, encounter, patientId, journal: toJournalVisit(appointment, encounter, status) }];
  });
  const visitEncounterIds = new Set(visits.map((visit) => visit.encounter.id!));

  const buckets = new Map<string, PatientBucket>();
  const bucketFor = (patientId: string): PatientBucket | undefined => {
    const existing = buckets.get(patientId);
    if (existing) return existing;
    const patient = patientsById.get(patientId);
    if (!patient) return undefined;
    const bucket = { patient: toJournalPatient(patient, sources.relatedPersons), visits: [], items: [] };
    buckets.set(patientId, bucket);
    return bucket;
  };
  visits.forEach((visit) => bucketFor(visit.patientId)?.visits.push(visit));
  buckets.forEach((bucket) => bucket.visits.sort(byStartDesc));

  const notTied: JournalRow[] = [];

  const isToday = (visit: Visit): boolean =>
    DateTime.fromISO(visit.journal.start).setZone(now.zone).hasSame(now, 'day');

  // Unsigned notes: the Incomplete Encounters report's rule (not completed, cancelled or no show) for
  // visits with a progress note, any age; today's only once discharged (the rest are still in progress).
  if (kind === 'provider') {
    visits
      .filter(
        (visit) =>
          visit.journal.hasProgressNote &&
          visit.journal.status !== 'completed' &&
          (visit.journal.status === 'discharged' || !isToday(visit))
      )
      .forEach((visit) => {
        const attender = visit.encounter.participant?.find(
          (p) => p.type?.some((t) => t.coding?.some((coding) => coding.code === 'ATND'))
        );
        bucketFor(visit.patientId)?.items.push({
          id: `note:${visit.encounter.id}`,
          kind: 'unsigned-note',
          label: 'Review & sign',
          ...(visit.journal.status === 'discharged'
            ? { when: 'discharged' as const, since: attender?.period?.end ?? visit.journal.start }
            : { when: 'seen' as const, since: visit.journal.start }),
          patientId: visit.patientId,
          appointmentId: visit.journal.appointmentId,
          encounterId: visit.journal.encounterId,
          isFollowUpVisit: visit.journal.isFollowUp || undefined,
        });
      });
  }

  // Tasks: owned by this person, or linked to one of this journal's visits.
  const seenTaskIds = new Set<string>();
  sources.tasks.forEach((task) => {
    if (!task.id || seenTaskIds.has(task.id) || !isOpenBoardTask(task)) return;
    seenTaskIds.add(task.id);
    const encounterId = getIdFromReference(task.encounter?.reference, 'Encounter');
    const owned = taskOwnerId(task) === practitionerId;
    if (!owned && !(encounterId && visitEncounterIds.has(encounterId))) return;
    const encounter = encounterId ? encountersById.get(encounterId) : undefined;
    const appointmentId =
      getTaskInputValue(task, MANUAL_TASK.input.appointmentId) ??
      getIdFromReference(encounter?.appointment?.[0]?.reference, 'Appointment');
    const patientId = resolveTaskPatientId(task, encounter, sources.diagnosticReports ?? []);
    const item = taskToJournalItem(task, {
      patientId,
      appointmentId,
      encounterId,
      isFollowUpVisit: Boolean(encounter?.partOf),
    });
    const bucket = patientId ? bucketFor(patientId) : undefined;
    if (bucket && bucket.visits.length) {
      bucket.items.push(item);
    } else {
      notTied.push({ patient: bucket?.patient, visits: [], items: [item] });
    }
  });
  buckets.forEach((bucket) => bucket.items.sort(byAlertThenSinceDesc));

  const pastStart = now.minus({ days: PAST_WINDOW_DAYS }).startOf('day');
  const isPastWeek = (visit: Visit): boolean =>
    !isToday(visit) && DateTime.fromISO(visit.journal.start).setZone(now.zone) >= pastStart;

  const comingUp: JournalRow[] = [];
  const today: JournalRow[] = [];
  const todayDone: JournalRow[] = [];
  const recent: JournalRow[] = [];
  const past: JournalRow[] = [];

  buckets.forEach((bucket) => {
    const rowBase = { patient: bucket.patient, visits: bucket.visits.map((v) => v.journal), items: bucket.items };
    const todays = bucket.visits.filter(isToday);
    const ready = todays.find((v) => v.journal.status === rules.ready);
    const lookahead = rules.lookahead ? todays.find((v) => v.journal.status === rules.lookahead) : undefined;
    const coming = ready ?? lookahead;
    if (coming) {
      const waiting = getVisitStatusHistory(coming.encounter, coming.appointment)
        .filter((entry) => entry.status === rules.ready && !entry.period.end)
        .at(-1);
      comingUp.push({
        ...rowBase,
        visit: coming.journal,
        room: getAppointmentRoom(coming.appointment),
        waitingSince: ready ? waiting?.period.start ?? coming.journal.start : undefined,
        lookahead: !ready || undefined,
      });
      return;
    }
    const seenToday = todays.filter((v) => rules.seen.includes(v.journal.status)).sort(byStartDesc)[0];
    if (seenToday) {
      const row = { ...rowBase, visit: seenToday.journal };
      (bucket.items.length || seenToday.journal.status === rules.inProgress ? today : todayDone).push(row);
      return;
    }
    if (bucket.items.length) {
      // "Seen" counts from the newest visit the patient was seen at; a booking doesn't count.
      const lastSeen = bucket.visits.find((v) => rules.seen.includes(v.journal.status))?.journal.start;
      recent.push({ ...rowBase, lastSeen });
      return;
    }
    const seenPastWeek = bucket.visits
      .filter((v) => isPastWeek(v) && rules.seen.includes(v.journal.status))
      .sort(byStartDesc)[0];
    if (seenPastWeek) past.push({ ...rowBase, visit: seenPastWeek.journal });
  });

  const byVisitStart = (a: JournalRow, b: JournalRow): number =>
    (b.visit?.start ?? '').localeCompare(a.visit?.start ?? '');
  comingUp.sort((a, b) => Number(Boolean(a.lookahead)) - Number(Boolean(b.lookahead)) || -byVisitStart(a, b));
  today.sort(byVisitStart);
  todayDone.sort(byVisitStart);
  recent.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
  past.sort(byVisitStart);
  notTied.sort((a, b) => bySinceDesc(a.items[0], b.items[0]));

  return {
    kind,
    comingUp,
    today,
    todayDone,
    seenTodayCount: today.length + todayDone.length,
    recent,
    notTied,
    past,
  };
}

const phoneDigits = (phone: string | undefined): string | undefined => phone?.replace(/\D/g, '').slice(-10) || undefined;

/**
 * Decision 11-13: an account phone is labelled with the consent signer of the newest visit that phone
 * booked (the visit's created-by tag, "Patient (202) 555-1313" or "QR - Patient …"). Staff bookings name
 * no phone. Returns the phones each appointment labels.
 */
export function phonesByBookingAppointment(
  patients: JournalPatient[],
  appointments: Appointment[]
): Map<string, JournalPhone[]> {
  const newestFirst = [...appointments].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
  const result = new Map<string, JournalPhone[]>();
  patients.forEach((patient) =>
    patient.phones.forEach((phone) => {
      const booking = newestFirst.find(
        (appointment) =>
          appointment.participant?.some((p) => p.actor?.reference === `Patient/${patient.patientId}`) &&
          phoneDigits(
            appointment.meta?.tag
              ?.find((tag) => tag.system === CREATED_BY_SYSTEM)
              ?.display?.match(/^(?:QR - )?Patient (.+)$/)?.[1]
          ) === phoneDigits(phone.number)
      );
      if (booking?.id) result.set(booking.id, [...(result.get(booking.id) ?? []), phone]);
    })
  );
  return result;
}

/** "Mei Chen (Parent)" from the intake consent page; the patient's own number (Self) stays unlabelled. */
export function consentSignerLabel(questionnaireResponse: QuestionnaireResponse): string | undefined {
  const answers = flattenQuestionnaireAnswers(questionnaireResponse.item ?? []);
  const answer = (linkId: string): string | undefined =>
    answers.find((item) => item.linkId === linkId)?.answer?.[0]?.valueString?.trim() || undefined;
  const name = answer('full-name');
  const relationship = answer('consent-form-signer-relationship');
  return name && relationship && relationship !== 'Self' ? `${name} (${relationship})` : undefined;
}
