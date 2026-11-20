import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DiagnosticReport, Encounter, Patient, RelatedPerson, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chunkThings } from 'utils/lib/fhir/chat';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { GetProviderJournalInputSchema, JournalKind } from 'utils/lib/types/api/provider-journal.types';
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
import { buildJournal, JOURNAL_WINDOW_DAYS, resolveTaskPatientId } from './helpers';

const ZAMBDA_NAME = 'get-provider-journal';
const ENCOUNTER_IDS_PER_TASK_SEARCH = 50;

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

  const visitResources = await getAllFhirSearchPages<Encounter | Appointment | Patient | RelatedPerson>(
    {
      resourceType: 'Encounter',
      params: [
        { name: 'participant', value: `Practitioner/${practitionerId}` },
        { name: 'appointment.date', value: `ge${windowStart}` },
        { name: 'appointment.date', value: `le${windowEnd}` },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
      ],
    },
    oystehr
  );
  const encounters = visitResources.filter((r): r is Encounter => r.resourceType === 'Encounter');

  const [ownedTaskResources, visitTasks] = await Promise.all([
    getAllFhirSearchPages<Task | Encounter | Appointment | Patient | DiagnosticReport>(
      {
        resourceType: 'Task',
        params: [
          { name: 'owner', value: `Practitioner/${practitionerId}` },
          { name: 'status', value: 'ready,in-progress' },
          { name: '_tag', value: 'task' },
          { name: '_include', value: 'Task:encounter' },
          { name: '_include:iterate', value: 'Encounter:appointment' },
          { name: '_include', value: 'Task:based-on:DiagnosticReport' },
        ],
      },
      oystehr
    ),
    Promise.all(
      chunkThings(
        encounters.map((encounter) => encounter.id!),
        ENCOUNTER_IDS_PER_TASK_SEARCH
      ).map((ids) =>
        getAllFhirSearchPages<Task>(
          {
            resourceType: 'Task',
            params: [
              { name: 'encounter', value: ids.map((id) => `Encounter/${id}`).join(',') },
              { name: 'status', value: 'ready,in-progress' },
              { name: '_tag', value: 'task' },
            ],
          },
          oystehr
        )
      )
    ).then((pages) => pages.flat()),
  ]);

  const tasks = [...ownedTaskResources.filter((r): r is Task => r.resourceType === 'Task'), ...visitTasks];
  const taskEncounters = ownedTaskResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const diagnosticReports = ownedTaskResources.filter(
    (r): r is DiagnosticReport => r.resourceType === 'DiagnosticReport'
  );
  const appointments = [...visitResources, ...ownedTaskResources].filter(
    (r): r is Appointment => r.resourceType === 'Appointment'
  );

  // Patients of owned tasks that are not on one of this journal's visits ("Not tied to a recent visit").
  const knownPatientIds = new Set(
    visitResources.filter((r): r is Patient => r.resourceType === 'Patient').map((patient) => patient.id!)
  );
  const missingPatientIds = [
    ...new Set(
      tasks
        .map((task) => {
          const encounterId = getIdFromReference(task.encounter?.reference, 'Encounter');
          const encounter = taskEncounters.find((e) => e.id === encounterId);
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
    encounters,
    appointments,
    patients: everything.filter((r): r is Patient => r.resourceType === 'Patient'),
    relatedPersons: everything.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson'),
    tasks,
    taskEncounters,
    diagnosticReports,
  });

  return lambdaResponse(200, journal);
});

/** Journals exist for Providers (attender) and Clinicians (admitter); the picker's choice is checked here. */
async function getJournalKind(oystehr: Oystehr, practitionerId: string): Promise<JournalKind> {
  const roles = await getPractitionerRoles(oystehr, practitionerId);
  if (roles?.includes(RoleType.Provider)) return 'provider';
  if (roles?.includes(RoleType.Clinician)) return 'clinician';
  throw INVALID_INPUT_ERROR('Journals exist only for users with the Provider or Clinician role');
}
