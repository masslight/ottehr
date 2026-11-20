import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  DiagnosticReport,
  Encounter,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chunkThings, createSmsModel } from 'utils/lib/fhir/chat';
import { deduplicateUnbundledResources } from 'utils/lib/fhir/deduplicateUnbundledResources';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isIntakePaperworkQuestionnaireResponse } from 'utils/lib/fhir/questionnaires';
import { relatedPersonAndCommunicationMaps } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  GetProviderJournalInputSchema,
  GetProviderJournalResponse,
  JournalKind,
  JournalPatient,
} from 'utils/lib/types/api/provider-journal.types';
import { ALL_EHR_STAFF_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import {
  checkOrCreateM2MClientToken,
  getPractitionerRoles,
  getUserToken,
  requireUserWithRole,
} from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import {
  buildJournal,
  consentSignerLabel,
  JOURNAL_WINDOW_DAYS,
  phonesByBookingAppointment,
  resolveTaskPatientId,
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
  const windowEnd = now.endOf('day').toUTC().toISO()!;

  const visitIncludes = [
    { name: '_include', value: 'Encounter:appointment' },
    { name: '_include', value: 'Encounter:subject' },
    { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
  ];
  const searchVisits = (params: { name: string; value: string }[]): Promise<VisitResource[]> =>
    getAllFhirSearchPages<VisitResource>(
      {
        resourceType: 'Encounter',
        params: [{ name: 'participant', value: `Practitioner/${practitionerId}` }, ...params, ...visitIncludes],
      },
      oystehr
    );
  const visitResources = deduplicateUnbundledResources(
    (
      await Promise.all([
        searchVisits([
          { name: 'appointment.date', value: `ge${windowStart}` },
          { name: 'appointment.date', value: `le${windowEnd}` },
        ]),
        // Unfinished visits of any age: their notes still need signing (Incomplete Encounters report).
        kind === 'provider' ? searchVisits([{ name: 'status', value: 'in-progress' }]) : [],
      ])
    ).flat()
  );
  const encounters = visitResources.filter((r): r is Encounter => r.resourceType === 'Encounter');

  const [ownedTaskResources, visitTaskResources] = await Promise.all([
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
    // Open tasks on any of this person's visits, however old: results and tasks stay until done.
    getAllFhirSearchPages<Task | Encounter | Appointment>(
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
    ),
  ]);

  const tasks = [...ownedTaskResources, ...visitTaskResources].filter((r): r is Task => r.resourceType === 'Task');
  // The visits of those tasks join this journal's visits (buildJournal keeps the ones in this person's role).
  const allEncounters = deduplicateUnbundledResources([
    ...encounters,
    ...visitTaskResources.filter((r): r is Encounter => r.resourceType === 'Encounter'),
  ]);
  const taskEncounters = ownedTaskResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const diagnosticReports = ownedTaskResources.filter(
    (r): r is DiagnosticReport => r.resourceType === 'DiagnosticReport'
  );
  const appointments = [...visitResources, ...ownedTaskResources, ...visitTaskResources].filter(
    (r): r is Appointment => r.resourceType === 'Appointment'
  );

  // Patients of tasks that are not on one of the window's visits.
  const knownPatientIds = new Set(
    visitResources.filter((r): r is Patient => r.resourceType === 'Patient').map((patient) => patient.id!)
  );
  const missingPatientIds = [
    ...new Set(
      tasks
        .map((task) => {
          const encounterId = getIdFromReference(task.encounter?.reference, 'Encounter');
          const encounter = [...taskEncounters, ...allEncounters].find((e) => e.id === encounterId);
          return resolveTaskPatientId(task, encounter, diagnosticReports);
        })
        .filter((patientId): patientId is string => Boolean(patientId) && !knownPatientIds.has(patientId!))
    ),
  ];
  const extraPatientResources = missingPatientIds.length
    ? await getAllFhirSearchPages<Patient | RelatedPerson>(
        {
          resourceType: 'Patient',
          params: [
            { name: '_id', value: missingPatientIds.join(',') },
            { name: '_revinclude', value: 'RelatedPerson:patient' },
          ],
        },
        oystehr
      )
    : [];

  const everything = [...visitResources, ...extraPatientResources];

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
  });
  await labelAccountPhones(oystehr, journal);
  await markUnreadTexts(
    oystehr,
    journal,
    everything.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson')
  );

  return lambdaResponse(200, journal);
});

/** The patients shown on the journal who have an account phone. */
const patientsWithPhones = (journal: GetProviderJournalResponse): JournalPatient[] => {
  const rows = [journal.comingUp, journal.today, journal.todayDone, journal.recent, journal.notTied, journal.past];
  return [
    ...new Map(
      rows.flat().flatMap((row): [string, JournalPatient][] =>
        row.patient?.phones.length ? [[row.patient.patientId, row.patient]] : []
      )
    ).values(),
  ];
};

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

type VisitResource = Encounter | Appointment | Patient | RelatedPerson;

/** Journals exist for Providers (attender) and Clinicians (admitter); the picker's choice is checked here. */
async function getJournalKind(oystehr: Oystehr, practitionerId: string): Promise<JournalKind> {
  const roles = await getPractitionerRoles(oystehr, practitionerId);
  if (roles?.includes(RoleType.Provider)) return 'provider';
  if (roles?.includes(RoleType.Clinician)) return 'clinician';
  throw INVALID_INPUT_ERROR('Journals exist only for users with the Provider or Clinician role');
}
