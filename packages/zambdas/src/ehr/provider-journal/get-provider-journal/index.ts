import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  DiagnosticReport,
  Encounter,
  Location,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chunkThings, createSmsModel } from 'utils/lib/fhir/chat';
import { deduplicateUnbundledResources } from 'utils/lib/fhir/deduplicateUnbundledResources';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { relatedPersonAndCommunicationMaps } from 'utils/lib/fhir/patient';
import { isIntakePaperworkQuestionnaireResponse } from 'utils/lib/fhir/questionnaires';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  GetProviderJournalInputSchema,
  GetProviderJournalResponse,
  JournalKind,
  JournalPatient,
  JournalRow,
  JournalVisit,
} from 'utils/lib/types/api/provider-journal.types';
import { SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { ALL_EHR_STAFF_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import {
  checkOrCreateM2MClientToken,
  getPractitionerRoles,
  getUserToken,
  requireUserWithRole,
} from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { getThreadIdFromTask, isUnreadFor, searchUnread } from '../../../shared/support-chat/thread';
import { getTaskLocation } from '../../../shared/tasks';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import {
  buildJournal,
  consentSignerLabel,
  JOURNAL_WINDOW_DAYS,
  markTextUnread,
  pastWeekStart,
  phonesByBookingAppointment,
  quickTextLocation,
  resolveTaskPatientId,
  visitLocationIds,
} from './helpers';

const ZAMBDA_NAME = 'get-provider-journal';
const IDS_PER_SEARCH = 50;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { practitionerId, timezone, secrets } = validateWithSchema(GetProviderJournalInputSchema, input);
  // Anyone who can open charts can open a journal; what they can do on it keeps each action's own rules.
  await requireUserWithRole(getUserToken(input), secrets, ALL_EHR_STAFF_ROLES);

  const now = DateTime.now().setZone(timezone);
  if (!now.isValid) throw INVALID_INPUT_ERROR(`"timezone" is invalid: ${now.invalidExplanation ?? ''}`);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const kind = await getJournalKind(oystehr, practitionerId);

  const windowStart = now.minus({ days: JOURNAL_WINDOW_DAYS }).startOf('day').toUTC().toISO()!;
  const pastStart = pastWeekStart(now).toUTC().toISO()!;
  const windowEnd = now.endOf('day').toUTC().toISO()!;

  const visitIncludes = [
    { name: '_include', value: 'Encounter:appointment' },
    { name: '_include', value: 'Encounter:subject' },
    { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
  ];
  const searchVisits = (
    params: { name: string; value: string }[],
    includes = visitIncludes
  ): Promise<VisitResource[]> =>
    getAllFhirSearchPages<VisitResource>(
      {
        resourceType: 'Encounter',
        params: [{ name: 'participant', value: `Practitioner/${practitionerId}` }, ...params, ...includes],
      },
      oystehr
    );

  const [weekVisitResources, inProgressVisitResources, [ownedTaskResources, visitTaskResources]] = await Promise.all([
    // Today and the past week: Coming Up, Today and Past show these visits.
    searchVisits([
      { name: 'appointment.date', value: `ge${pastStart}` },
      { name: 'appointment.date', value: `le${windowEnd}` },
    ]),
    // Unfinished visits of any age: their notes still need signing (Incomplete Encounters report).
    kind === 'provider' ? searchVisits([{ name: 'status', value: 'in-progress' }]) : [],
    searchTasks(oystehr, practitionerId, kind),
  ]);

  const tasks = [...ownedTaskResources, ...visitTaskResources].filter((r): r is Task => r.resourceType === 'Task');
  const taskEncounters = ownedTaskResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const diagnosticReports = ownedTaskResources.filter(
    (r): r is DiagnosticReport => r.resourceType === 'DiagnosticReport'
  );
  const taskEncounterPool = [
    ...taskEncounters,
    ...visitTaskResources.filter((r): r is Encounter => r.resourceType === 'Encounter'),
  ];
  const taskPatientIds = [
    ...new Set(
      tasks
        .map((task) => {
          const encounterId = getIdFromReference(task.encounter?.reference, 'Encounter');
          const encounter = taskEncounterPool.find((e) => e.id === encounterId);
          return resolveTaskPatientId(task, encounter, diagnosticReports);
        })
        .filter((patientId): patientId is string => Boolean(patientId))
    ),
  ];
  // Patients of tasks that are not on one of the past week's or unfinished visits.
  const knownPatientIds = new Set(
    [...weekVisitResources, ...inProgressVisitResources]
      .filter((r): r is Patient => r.resourceType === 'Patient')
      .map((patient) => patient.id!)
  );
  const missingPatientIds = taskPatientIds.filter((patientId) => !knownPatientIds.has(patientId));

  const todoPatientIds = [
    ...new Set([
      ...taskPatientIds,
      ...inProgressVisitResources
        .filter((r): r is Patient => r.resourceType === 'Patient')
        .map((patient) => patient.id!),
    ]),
  ].filter(isValidUUID);

  const [olderVisitResources, extraPatientResources] = await Promise.all([
    // Older visits matter only on rows with a to-do: they keep the row in Recent and give its "Seen" and chart links.
    // To-dos are tasks and notes to sign, and every note to sign is on an unfinished visit above.
    Promise.all(
      chunkThings(todoPatientIds, IDS_PER_SEARCH).map((chunk) =>
        searchVisits(
          [
            { name: 'subject', value: chunk.map((id) => `Patient/${id}`).join(',') },
            { name: 'appointment.date', value: `ge${windowStart}` },
            { name: 'appointment.date', value: `lt${pastStart}` },
          ],
          [{ name: '_include', value: 'Encounter:appointment' }]
        )
      )
    ),
    missingPatientIds.length
      ? getAllFhirSearchPages<Patient | RelatedPerson>(
          {
            resourceType: 'Patient',
            params: [
              { name: '_id', value: missingPatientIds.join(',') },
              { name: '_revinclude', value: 'RelatedPerson:patient' },
            ],
          },
          oystehr
        )
      : [],
  ]);

  const visitResources = deduplicateUnbundledResources([
    ...weekVisitResources,
    ...inProgressVisitResources,
    ...olderVisitResources.flat(),
  ]);
  const encounters = visitResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  // The visits of those tasks join this journal's visits (buildJournal keeps the ones in this person's role).
  const allEncounters = deduplicateUnbundledResources([
    ...encounters,
    ...visitTaskResources.filter((r): r is Encounter => r.resourceType === 'Encounter'),
  ]);
  const appointments = [...visitResources, ...ownedTaskResources, ...visitTaskResources].filter(
    (r): r is Appointment => r.resourceType === 'Appointment'
  );

  const everything = [...visitResources, ...extraPatientResources];
  const unreadMessageSentAt = await getUnreadMessageSentAt(oystehr, tasks);

  const journal = buildJournal({
    kind,
    practitionerId,
    now,
    encounters: allEncounters,
    appointments,
    patients: everything.filter((r): r is Patient => r.resourceType === 'Patient'),
    relatedPersons: everything.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson'),
    tasks,
    taskEncounters,
    diagnosticReports,
    unreadMessageSentAt,
  });
  await addVisitLocations(oystehr, journal, [...allEncounters, ...taskEncounters], tasks);
  await labelAccountPhones(oystehr, journal);
  await markUnreadTexts(
    oystehr,
    journal,
    everything.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson')
  );

  return lambdaResponse(200, journal);
});

/** Unread portal requests: the newest unread patient message in each request's Support Chat thread. */
async function getUnreadMessageSentAt(oystehr: Oystehr, tasks: Task[]): Promise<Map<string, string>> {
  const sentAt = new Map<string, string>();
  await Promise.all(
    tasks.map(async (task) => {
      const threadId = getThreadIdFromTask(task);
      if (!task.id || !threadId || !task.meta?.tag?.some((t) => t.system === SUPPORT_CHAT_UNREAD_TAG.system)) return;
      const newest = (await searchUnread(oystehr, threadId))
        .filter((message) => isUnreadFor(message, 'staff') && message.sent)
        .map((message) => message.sent!)
        .sort()
        .at(-1);
      if (newest) sentAt.set(task.id, newest);
    })
  );
  return sentAt;
}

const journalRows = (journal: GetProviderJournalResponse): JournalRow[] =>
  [journal.comingUp, journal.today, journal.todayDone, journal.recent, journal.notTied, journal.past].flat();

/**
 * Each shown visit's Location, and on a row with no visit the Location of its newest to-do that has one (the chat's
 * quick texts fill the office phone, location name and review link).
 */
async function addVisitLocations(
  oystehr: Oystehr,
  journal: GetProviderJournalResponse,
  encounters: Encounter[],
  tasks: Task[]
): Promise<void> {
  const visits = [
    ...new Set(
      journalRows(journal).flatMap((row): JournalVisit[] => (row.visit ? [row.visit, ...row.visits] : row.visits))
    ),
  ];
  const locationIds = visitLocationIds(visits, encounters);
  const rowLocationIds = new Map(
    journalRows(journal).flatMap((row): [JournalRow, string][] => {
      if (!row.patient || row.visit || row.visits.length) return [];
      const locationId = [...row.items]
        .sort((a, b) => b.since.localeCompare(a.since))
        .map((item) => tasks.find((t) => item.taskId && t.id === item.taskId))
        .map((task) => task && getTaskLocation(task)?.id)
        .find(Boolean);
      return locationId ? [[row, locationId]] : [];
    })
  );
  // Task location tags are staff-written: FHIR refuses the whole search over one non-UUID id.
  const ids = [...new Set([...locationIds.values(), ...rowLocationIds.values()])].filter(isValidUUID);
  if (!ids.length) return;
  const locations = (
    await Promise.all(
      chunkThings(ids, IDS_PER_SEARCH).map((chunk) =>
        getAllFhirSearchPages<Location>(
          { resourceType: 'Location', params: [{ name: '_id', value: chunk.join(',') }] },
          oystehr
        )
      )
    )
  ).flat();
  locationIds.forEach((locationId, visit) => {
    const location = locations.find((l) => l.id === locationId);
    if (location) visit.location = quickTextLocation(location);
  });
  rowLocationIds.forEach((locationId, row) => {
    const location = locations.find((l) => l.id === locationId);
    if (location) row.location = quickTextLocation(location);
  });
}

/** The patients shown on the journal who have an account phone. */
const patientsWithPhones = (journal: GetProviderJournalResponse): JournalPatient[] => [
  ...new Map(
    journalRows(journal).flatMap((row): [string, JournalPatient][] =>
      row.patient?.phones.length ? [[row.patient.patientId, row.patient]] : []
    )
  ).values(),
];

/** The tracking board's unread-text state for each shown patient, so opening the chat marks texts read. */
async function markUnreadTexts(
  oystehr: Oystehr,
  journal: GetProviderJournalResponse,
  relatedPersons: RelatedPerson[]
): Promise<void> {
  const patients = patientsWithPhones(journal);
  const phoneOwners = new Set(patients.flatMap((patient) => patient.phones.map((p) => p.recipientResourceUri)));
  const accountPhones = relatedPersons.filter((rp) => phoneOwners.has(`RelatedPerson/${rp.id}`));
  if (!accountPhones.length) return;
  const maps = await relatedPersonAndCommunicationMaps(oystehr, accountPhones);
  patients.forEach((patient) => {
    if (createSmsModel(patient.patientId, maps)?.hasUnreadMessages) patient.hasUnreadTexts = true;
  });
  journalRows(journal).forEach((row) => row.patient?.hasUnreadTexts && row.items.forEach(markTextUnread));
}

/** Labels the shown patients' account phones with the consent signer of the newest visit each phone booked. */
async function labelAccountPhones(oystehr: Oystehr, journal: GetProviderJournalResponse): Promise<void> {
  const patients = patientsWithPhones(journal);
  const searchInChunks = async <T extends Appointment | Encounter | QuestionnaireResponse>(
    resourceType: 'Appointment' | 'Encounter',
    name: string,
    references: string[],
    extra: { name: string; value: string }[] = []
  ): Promise<T[]> =>
    (
      await Promise.all(
        chunkThings(references, IDS_PER_SEARCH).map((chunk) =>
          getAllFhirSearchPages<T>({ resourceType, params: [{ name, value: chunk.join(',') }, ...extra] }, oystehr)
        )
      )
    ).flat();

  const appointments = await searchInChunks<Appointment>(
    'Appointment',
    'actor',
    patients.map((patient) => `Patient/${patient.patientId}`)
  );
  const bookings = phonesByBookingAppointment(patients, appointments);
  const visits = await searchInChunks<Encounter | QuestionnaireResponse>(
    'Encounter',
    'appointment',
    [...bookings.keys()].map((id) => `Appointment/${id}`),
    [{ name: '_revinclude', value: 'QuestionnaireResponse:encounter' }]
  );
  visits.forEach((encounter) => {
    if (encounter.resourceType !== 'Encounter') return;
    const intake = visits.find(
      (r): r is QuestionnaireResponse =>
        r.resourceType === 'QuestionnaireResponse' &&
        r.encounter?.reference === `Encounter/${encounter.id}` &&
        isIntakePaperworkQuestionnaireResponse(r)
    );
    const signer = intake ? consentSignerLabel(intake) : undefined;
    const appointmentId = getIdFromReference(encounter.appointment?.[0]?.reference, 'Appointment');
    if (signer && appointmentId) bookings.get(appointmentId)?.forEach((phone) => (phone.signer = signer));
  });
}

/** Open board tasks owned by this person, and on a provider journal those on any of their visits. */
const searchTasks = (
  oystehr: Oystehr,
  practitionerId: string,
  kind: JournalKind
): Promise<[(Task | Encounter | Appointment | Patient | DiagnosticReport)[], (Task | Encounter | Appointment)[]]> =>
  Promise.all([
    getAllFhirSearchPages<Task | Encounter | Appointment | Patient | DiagnosticReport>(
      {
        resourceType: 'Task',
        params: [
          { name: 'owner', value: `Practitioner/${practitionerId}` },
          { name: 'status', value: 'ready,in-progress' },
          { name: '_tag', value: 'task' },
          { name: '_include', value: 'Task:encounter' },
          { name: '_include:iterate', value: 'Encounter:appointment' },
          { name: '_include', value: 'Task:based-on' },
        ],
      },
      oystehr
    ),
    // Open tasks on any of this provider's visits, however old: results and tasks stay until done.
    kind === 'provider'
      ? getAllFhirSearchPages<Task | Encounter | Appointment>(
          {
            resourceType: 'Task',
            params: [
              { name: 'encounter.participant', value: `Practitioner/${practitionerId}` },
              { name: 'status', value: 'ready,in-progress' },
              { name: '_tag', value: 'task' },
              { name: '_include', value: 'Task:encounter' },
              { name: '_include:iterate', value: 'Encounter:appointment' },
            ],
          },
          oystehr
        )
      : ([] as (Task | Encounter | Appointment)[]),
  ]);

type VisitResource = Encounter | Appointment | Patient | RelatedPerson;

/** Journals exist for Providers (attender) and Clinicians (admitter); the picker's choice is checked here. */
async function getJournalKind(oystehr: Oystehr, practitionerId: string): Promise<JournalKind> {
  const roles = await getPractitionerRoles(oystehr, practitionerId);
  if (roles?.includes(RoleType.Provider)) return 'provider';
  if (roles?.includes(RoleType.Clinician)) return 'clinician';
  throw INVALID_INPUT_ERROR('Journals exist only for users with the Provider or Clinician role');
}
