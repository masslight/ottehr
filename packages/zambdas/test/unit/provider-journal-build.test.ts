import { Appointment, Encounter, Patient, QuestionnaireResponse, RelatedPerson, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FHIR_EXTENSION,
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  PRIVATE_EXTENSION_BASE_URL,
  ROOM_EXTENSION_URL,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { JournalPatient, JournalPhone, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { ERX_TASK, FAX_TASK, MANUAL_TASK, PATIENT_REQUEST_TASK, TaskAlertCode } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import { makeDmeDispenseTask } from '../../src/ehr/dme/shared/order-helpers';
import {
  buildJournal,
  consentSignerLabel,
  isOpenBoardTask,
  JournalSources,
  markTextUnread,
  phonesByBookingAppointment,
  quickTextLocation,
  taskToJournalItem,
  visitLocationIds,
} from '../../src/ehr/provider-journal/get-provider-journal/helpers';
import { createTask } from '../../src/shared/tasks';

const ME = 'prac-me';
const OTHER = 'prac-other';
const NOW = DateTime.fromISO('2026-11-07T15:00:00', { zone: 'America/New_York' });
const PARTICIPATION = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType';
const VISIT_STATUS_URL = FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url;

const patient = (id: string, given: string, family: string): Patient => ({
  resourceType: 'Patient',
  id,
  name: [{ given: [given], family }],
});

const userPhone = (id: string, patientId: string, number: string, user = true): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  id,
  patient: { reference: `Patient/${patientId}` },
  relationship: user
    ? [{ coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] }]
    : [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'MTH' }] }],
  telecom: [{ system: 'sms', value: number }],
});

interface VisitSpec {
  id: string;
  patientId: string;
  start: string;
  /** FHIR appointment status. */
  appointmentStatus: Appointment['status'];
  encounterStatus: Encounter['status'];
  attender?: { id: string; start?: string; end?: string };
  admitter?: { id: string; start?: string; end?: string };
  telemed?: boolean;
  room?: string;
  reason?: string;
  readyForProviderSince?: string;
  readySince?: string;
}

const visit = (spec: VisitSpec): { appointment: Appointment; encounter: Encounter } => {
  const participant: Encounter['participant'] = [];
  if (spec.admitter) {
    participant.push({
      type: [{ coding: [{ system: PARTICIPATION, code: 'ADM' }] }],
      individual: { reference: `Practitioner/${spec.admitter.id}` },
      period: { start: spec.admitter.start, end: spec.admitter.end },
    });
  }
  if (spec.attender) {
    participant.push({
      type: [{ coding: [{ system: PARTICIPATION, code: 'ATND' }] }],
      individual: { reference: `Practitioner/${spec.attender.id}` },
      period: { start: spec.attender.start, end: spec.attender.end },
    });
  }
  const statusHistory: Encounter['statusHistory'] = [];
  if (spec.readyForProviderSince) {
    statusHistory.push({
      status: 'in-progress',
      period: { start: spec.readyForProviderSince },
      extension: [{ url: VISIT_STATUS_URL, valueCode: 'ready for provider' }],
    });
  }
  if (spec.readySince) {
    statusHistory.push({
      status: 'arrived',
      period: { start: spec.readySince },
      extension: [{ url: VISIT_STATUS_URL, valueCode: 'ready' }],
    });
  }
  return {
    appointment: {
      resourceType: 'Appointment',
      id: `appt-${spec.id}`,
      status: spec.appointmentStatus,
      start: spec.start,
      description: spec.reason,
      meta: { tag: [{ code: spec.telemed ? OTTEHR_MODULE.TM : OTTEHR_MODULE.IP }] },
      extension: spec.room ? [{ url: ROOM_EXTENSION_URL, valueString: spec.room }] : undefined,
      participant: [{ actor: { reference: `Patient/${spec.patientId}` }, status: 'accepted' }],
    },
    encounter: {
      resourceType: 'Encounter',
      id: `enc-${spec.id}`,
      status: spec.encounterStatus,
      class: { code: 'AMB' },
      subject: { reference: `Patient/${spec.patientId}` },
      appointment: [{ reference: `Appointment/appt-${spec.id}` }],
      participant,
      statusHistory: statusHistory.length ? statusHistory : undefined,
    },
  };
};

const boardTask = (overrides: Partial<Task> & { category?: string; title?: string; encounterId?: string }): Task => {
  const { category = MANUAL_TASK.category.other, title = 'Do something', encounterId, ...rest } = overrides;
  return { ...createTask({ category, title, encounterId }), id: rest.id ?? `task-${title}`, ...rest };
};

const owner = (id: string, assignedAt = '2026-11-07T09:00:00.000Z'): Task['owner'] => ({
  reference: `Practitioner/${id}`,
  extension: [{ url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL, valueDateTime: assignedAt }],
});

const sources = (overrides: Partial<JournalSources>): JournalSources => ({
  kind: 'provider',
  practitionerId: ME,
  now: NOW,
  encounters: [],
  appointments: [],
  patients: [],
  relatedPersons: [],
  tasks: [],
  ...overrides,
});

const withVisits = (specs: VisitSpec[], overrides: Partial<JournalSources> = {}): JournalSources => {
  const built = specs.map(visit);
  return sources({
    encounters: built.map((v) => v.encounter),
    appointments: built.map((v) => v.appointment),
    ...overrides,
  });
};

const TODAY_READY = {
  id: 'ready',
  patientId: 'pat-maria',
  start: '2026-11-07T19:30:00.000Z',
  appointmentStatus: 'fulfilled' as const,
  encounterStatus: 'in-progress' as const,
  admitter: { id: OTHER, start: '2026-11-07T19:35:00.000Z', end: '2026-11-07T19:41:00.000Z' },
  attender: { id: ME },
  room: '3',
  reason: 'Injury to head',
  readyForProviderSince: '2026-11-07T19:41:00.000Z',
};

describe('buildJournal: ownership', () => {
  it('shows visits where the provider is the "Pr:" or the "In:", not other providers\' visits', () => {
    const journal = buildJournal(
      withVisits(
        [
          TODAY_READY,
          { ...TODAY_READY, id: 'theirs', patientId: 'pat-x', attender: { id: OTHER } },
          { ...TODAY_READY, id: 'intake-only', patientId: 'pat-y', attender: undefined, admitter: { id: ME } },
        ],
        { patients: [patient('pat-maria', 'Maria', 'Lopez'), patient('pat-x', 'X', 'Y'), patient('pat-y', 'Y', 'Z')] }
      )
    );
    expect(journal.comingUp.map((row) => row.patient?.name)).toEqual(['Maria Lopez']);
    expect(journal.today.map((row) => [row.patient?.name, row.visit?.status, row.role])).toEqual([
      ['Y Z', 'intake', 'clinician'],
    ]);
    expect(journal.recent).toEqual([]);
  });

  it("returns the patient's date of birth, the second identifier the tracking board shows", () => {
    const maria = { ...patient('pat-maria', 'Maria', 'Lopez'), birthDate: '1958-03-14' };
    const journal = buildJournal(withVisits([TODAY_READY], { patients: [maria] }));
    expect(journal.comingUp[0].patient?.birthDate).toBe('1958-03-14');
  });

  it('builds a clinician journal from visits where they are the admitter, Coming Up = Ready', () => {
    const journal = buildJournal(
      withVisits(
        [
          {
            id: 'ready',
            patientId: 'pat-a',
            start: '2026-11-07T19:30:00.000Z',
            appointmentStatus: 'checked-in',
            encounterStatus: 'arrived',
            admitter: { id: ME },
            readySince: '2026-11-07T19:32:00.000Z',
          },
          {
            id: 'intake',
            patientId: 'pat-b',
            start: '2026-11-07T19:00:00.000Z',
            appointmentStatus: 'checked-in',
            encounterStatus: 'in-progress',
            admitter: { id: ME, start: '2026-11-07T19:05:00.000Z' },
          },
          {
            id: 'not-mine',
            patientId: 'pat-c',
            start: '2026-11-07T19:30:00.000Z',
            appointmentStatus: 'checked-in',
            encounterStatus: 'arrived',
            admitter: { id: OTHER },
          },
        ],
        {
          kind: 'clinician',
          patients: [patient('pat-a', 'A', 'A'), patient('pat-b', 'B', 'B'), patient('pat-c', 'C', 'C')],
        }
      )
    );
    expect(journal.kind).toBe('clinician');
    expect(journal.comingUp).toHaveLength(1);
    expect(journal.comingUp[0].patient?.patientId).toBe('pat-a');
    expect(journal.comingUp[0].waitingSince).toBe('2026-11-07T19:32:00.000Z');
    expect(journal.comingUp[0].lookahead).toBeUndefined();
    // In intake with this clinician = in the room with them.
    expect(journal.today.map((row) => [row.patient?.patientId, row.visit?.status])).toEqual([['pat-b', 'intake']]);
  });
});

describe('buildJournal: Coming Up', () => {
  it('shows Ready for provider with the room and the time since ready, and intake as a lookahead', () => {
    const journal = buildJournal(
      withVisits(
        [
          TODAY_READY,
          {
            id: 'intake',
            patientId: 'pat-ava',
            start: '2026-11-07T20:00:00.000Z',
            appointmentStatus: 'checked-in',
            encounterStatus: 'in-progress',
            admitter: { id: OTHER, start: '2026-11-07T20:01:00.000Z' },
            attender: { id: ME },
            reason: 'Fever',
          },
        ],
        { patients: [patient('pat-maria', 'Maria', 'Lopez'), patient('pat-ava', 'Ava', 'Chen')] }
      )
    );
    expect(journal.comingUp).toHaveLength(2);
    const [maria, ava] = journal.comingUp;
    expect(maria.patient?.name).toBe('Maria Lopez');
    expect(maria.room).toBe('3');
    expect(maria.waitingSince).toBe('2026-11-07T19:41:00.000Z');
    expect(maria.visit?.status).toBe('ready for provider');
    expect(maria.visit?.reasonForVisit).toBe('Injury to head');
    expect(maria.visit?.hasProgressNote).toBe(true);
    expect(ava.lookahead).toBe(true);
    expect(ava.waitingSince).toBeUndefined();
    expect(ava.visit?.status).toBe('intake');
  });

  it('marks telemed visits', () => {
    const journal = buildJournal(
      withVisits([{ ...TODAY_READY, telemed: true, room: undefined }], {
        patients: [patient('pat-maria', 'Maria', 'Lopez')],
      })
    );
    expect(journal.comingUp[0].visit?.isTelemed).toBe(true);
    expect(journal.comingUp[0].room).toBeUndefined();
  });
});

describe('buildJournal: Today, Recent, Past and unsigned notes', () => {
  const seenToday = (id: string, patientId: string, start = '2026-11-07T16:30:00.000Z'): VisitSpec => ({
    id,
    patientId,
    start,
    appointmentStatus: 'fulfilled',
    encounterStatus: 'finished',
    attender: { id: ME, start, end: '2026-11-07T17:00:00.000Z' },
  });

  it('puts a discharged visit under Today with a "Review & Sign" item and a seen patient with nothing to do under +N more', () => {
    const journal = buildJournal(
      withVisits(
        [
          {
            id: 'discharged',
            patientId: 'pat-james',
            start: '2026-11-07T18:30:00.000Z',
            appointmentStatus: 'fulfilled',
            encounterStatus: 'in-progress',
            attender: { id: ME, start: '2026-11-07T18:35:00.000Z', end: '2026-11-07T18:52:00.000Z' },
          },
          seenToday('done', 'pat-olivia'),
          {
            id: 'with-provider',
            patientId: 'pat-lily',
            start: '2026-11-07T19:00:00.000Z',
            appointmentStatus: 'fulfilled',
            encounterStatus: 'in-progress',
            attender: { id: ME, start: '2026-11-07T19:05:00.000Z' },
          },
        ],
        {
          patients: [
            patient('pat-james', 'James', 'Carter'),
            patient('pat-olivia', 'Olivia', 'Brooks'),
            patient('pat-lily', 'Lily', 'Nguyen'),
          ],
        }
      )
    );
    expect(journal.today.map((row) => row.patient?.name)).toEqual(['Lily Nguyen', 'James Carter']);
    const james = journal.today[1];
    expect(james.items).toEqual([
      expect.objectContaining({
        id: 'note:enc-discharged',
        kind: 'unsigned-note',
        label: 'Review & Sign',
        when: 'discharged',
        since: '2026-11-07T18:52:00.000Z',
        appointmentId: 'appt-discharged',
        encounterId: 'enc-discharged',
      }),
    ]);
    expect(journal.today[0].visit?.status).toBe('provider');
    expect(journal.today[0].items).toEqual([]);
    expect(journal.todayDone.map((row) => row.patient?.name)).toEqual(['Olivia Brooks']);
    expect(journal.seenTodayCount).toBe(3);
  });

  it('asks to sign every earlier visit the Incomplete Encounters report lists, discharged or not', () => {
    const earlier = (id: string, overrides: Partial<VisitSpec>): VisitSpec => ({
      id,
      patientId: `pat-${id}`,
      start: '2026-11-03T15:00:00.000Z',
      appointmentStatus: 'fulfilled',
      encounterStatus: 'in-progress',
      ...overrides,
    });
    const journal = buildJournal(
      withVisits(
        [
          // Never discharged: still "provider" from Nov 3.
          earlier('provider', { attender: { id: ME, start: '2026-11-03T15:05:00.000Z' } }),
          // Still "ready for provider" from months ago (no age limit).
          earlier('rfp', { start: '2026-06-01T15:00:00.000Z', attender: { id: ME } }),
          // Booked and never started: no progress note to sign.
          earlier('pending', { appointmentStatus: 'booked', encounterStatus: 'planned', attender: { id: ME } }),
          // Signed.
          earlier('done', { encounterStatus: 'finished', attender: { id: ME, start: 'x', end: 'y' } }),
          // Today, in the room: not yet.
          earlier('in-room', {
            start: '2026-11-07T18:00:00.000Z',
            attender: { id: ME, start: '2026-11-07T18:05:00.000Z' },
          }),
        ],
        {
          patients: ['provider', 'rfp', 'pending', 'done', 'in-room'].map((id) => patient(`pat-${id}`, id, 'Test')),
        }
      )
    );
    const notes = [...journal.today, ...journal.recent, ...journal.past].flatMap((row) =>
      row.items.filter((item) => item.kind === 'unsigned-note').map((item) => [item.encounterId, item.when, item.since])
    );
    expect(notes).toEqual([
      ['enc-provider', 'seen', '2026-11-03T15:00:00.000Z'],
      // Never with the provider: "visit 5mo ago", not "seen".
      ['enc-rfp', 'visit', '2026-06-01T15:00:00.000Z'],
    ]);
    expect(journal.recent.map((row) => row.patient?.patientId)).toEqual(['pat-provider', 'pat-rfp']);
  });

  it('reads a visit awaiting supervisor approval as completed (seen, nothing to sign)', () => {
    const journal = buildJournal(
      withVisits([seenToday('approval', 'pat-nina')], {
        patients: [patient('pat-nina', 'Nina', 'Park')],
        encounters: [
          {
            ...visit(seenToday('approval', 'pat-nina')).encounter,
            extension: [{ url: 'awaiting-supervisor-approval', valueBoolean: true }],
          },
        ],
      })
    );
    expect(journal.todayDone.map((row) => [row.patient?.name, row.visit?.status, row.items])).toEqual([
      ['Nina Park', 'completed', []],
    ]);
  });

  it('does not create unsigned-note items on a clinician journal', () => {
    const journal = buildJournal(
      withVisits(
        [
          {
            id: 'discharged',
            patientId: 'pat-james',
            start: '2026-11-07T18:30:00.000Z',
            appointmentStatus: 'fulfilled',
            encounterStatus: 'in-progress',
            admitter: { id: ME, start: '2026-11-07T18:31:00.000Z', end: '2026-11-07T18:34:00.000Z' },
            attender: { id: OTHER, start: '2026-11-07T18:35:00.000Z', end: '2026-11-07T18:52:00.000Z' },
          },
        ],
        { kind: 'clinician', patients: [patient('pat-james', 'James', 'Carter')] }
      )
    );
    expect(journal.today).toEqual([]);
    expect(journal.todayDone).toHaveLength(1);
  });

  it('keeps an older open item under Today when the patient was seen today', () => {
    const journal = buildJournal(
      withVisits([seenToday('today', 'pat-lily'), { ...seenToday('old', 'pat-lily', '2026-11-02T20:10:00.000Z') }], {
        patients: [patient('pat-lily', 'Lily', 'Nguyen')],
        tasks: [
          boardTask({
            id: 'culture',
            category: LAB_ORDER_TASK.category,
            title: 'Review results',
            encounterId: 'enc-old',
            code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.reviewFinalResult }] },
            input: [
              { type: { coding: [{ code: LAB_ORDER_TASK.input.testName }] }, valueString: 'Throat culture' },
              {
                type: { coding: [{ code: LAB_ORDER_TASK.input.receivedDate }] },
                valueString: '2026-11-04T14:00:00.000Z',
              },
            ],
            basedOn: [{ reference: 'DiagnosticReport/dr-1' }, { reference: 'ServiceRequest/sr-1' }],
          }),
        ],
      })
    );
    expect(journal.recent).toEqual([]);
    expect(journal.today).toHaveLength(1);
    const lily = journal.today[0];
    expect(lily.visit?.appointmentId).toBe('appt-today');
    expect(lily.visits.map((v) => v.appointmentId)).toEqual(['appt-today', 'appt-old']);
    expect(lily.items).toEqual([
      expect.objectContaining({
        kind: 'external-lab',
        label: 'Review Throat culture',
        when: 'resulted',
        since: '2026-11-04T14:00:00.000Z',
        orderId: 'sr-1',
        diagnosticReportId: 'dr-1',
        appointmentId: 'appt-old',
        encounterId: 'enc-old',
        patientId: 'pat-lily',
      }),
    ]);
  });

  it('puts earlier visits with open items under Recent and finished ones from the last 7 days under Past', () => {
    const journal = buildJournal(
      withVisits(
        [
          seenToday('robert', 'pat-robert', '2026-11-03T15:20:00.000Z'),
          seenToday('past', 'pat-ben', '2026-11-05T15:00:00.000Z'),
          seenToday('too-old', 'pat-cara', '2026-10-20T15:00:00.000Z'),
        ],
        {
          patients: [
            patient('pat-robert', 'Robert', 'Hill'),
            patient('pat-ben', 'Ben', 'Ellis'),
            patient('pat-cara', 'C', 'D'),
          ],
          tasks: [
            boardTask({
              id: 'cbc',
              category: LAB_ORDER_TASK.category,
              title: 'Review results',
              encounterId: 'enc-robert',
            }),
          ],
        }
      )
    );
    expect(journal.recent.map((row) => [row.patient?.name, row.lastSeen])).toEqual([
      ['Robert Hill', '2026-11-03T15:20:00.000Z'],
    ]);
    expect(journal.past.map((row) => row.patient?.name)).toEqual(['Ben Ellis']);
    expect(journal.today).toEqual([]);
  });
});

describe('buildJournal: Recent "Seen"', () => {
  it('counts from the newest visit the patient was seen at, not a booking later today', () => {
    const journal = buildJournal(
      withVisits(
        [
          {
            id: 'last-week',
            patientId: 'pat-gus',
            start: '2026-11-02T15:00:00.000Z',
            appointmentStatus: 'fulfilled',
            encounterStatus: 'finished',
            attender: { id: ME, start: '2026-11-02T15:05:00.000Z', end: '2026-11-02T15:30:00.000Z' },
          },
          {
            id: 'later-today',
            patientId: 'pat-gus',
            start: '2026-11-07T21:00:00.000Z',
            appointmentStatus: 'booked',
            encounterStatus: 'planned',
            attender: { id: ME },
          },
          {
            id: 'next-week',
            patientId: 'pat-jane',
            start: '2026-11-14T15:00:00.000Z',
            appointmentStatus: 'booked',
            encounterStatus: 'planned',
            attender: { id: ME },
          },
        ],
        {
          patients: [patient('pat-gus', 'Gus', 'Pending'), patient('pat-jane', 'Jane', 'Doe')],
          tasks: [
            boardTask({ id: 'culture', category: LAB_ORDER_TASK.category, title: 'R', encounterId: 'enc-last-week' }),
            boardTask({
              id: 'text',
              category: PATIENT_REQUEST_TASK.category,
              title: 'T',
              encounterId: 'enc-next-week',
            }),
          ],
        }
      )
    );
    expect(journal.recent.map((row) => [row.patient?.name, row.lastSeen])).toEqual([
      ['Gus Pending', '2026-11-02T15:00:00.000Z'],
      ['Jane Doe', undefined],
    ]);
  });
});

describe('buildJournal: task ownership and placement', () => {
  const myVisit = (): VisitSpec => ({
    id: 'mine',
    patientId: 'pat-robert',
    start: '2026-11-03T15:20:00.000Z',
    appointmentStatus: 'fulfilled',
    encounterStatus: 'finished',
    attender: { id: ME, start: '2026-11-03T15:25:00.000Z', end: '2026-11-03T15:50:00.000Z' },
  });

  it('includes tasks owned by the person or linked to one of their visits, and drops the rest', () => {
    const journal = buildJournal(
      withVisits([myVisit()], {
        patients: [patient('pat-robert', 'Robert', 'Hill')],
        tasks: [
          boardTask({ id: 'linked', title: 'Linked to my visit', encounterId: 'enc-mine' }),
          boardTask({ id: 'owned', title: 'Owned', owner: owner(ME), encounterId: 'enc-mine' }),
          boardTask({ id: 'someone-elses', title: 'Not mine', owner: owner(OTHER), encounterId: 'enc-elsewhere' }),
          boardTask({ id: 'no-link', title: 'No link, no owner' }),
        ],
      })
    );
    expect(journal.recent).toHaveLength(1);
    expect(journal.recent[0].items.map((item) => item.id).sort()).toEqual(['linked', 'owned']);
    expect(journal.notTied).toEqual([]);
  });

  it('shows a clinician only the tasks assigned to them; unassigned visit tasks go to the "Pr:" journal', () => {
    const roomed: VisitSpec = { ...myVisit(), admitter: { id: ME }, attender: { id: OTHER } };
    const tasks = [
      boardTask({
        id: 'lipid',
        category: LAB_ORDER_TASK.category,
        title: 'Review Lipid panel',
        encounterId: 'enc-mine',
      }),
      boardTask({ id: 'text', category: PATIENT_REQUEST_TASK.category, title: 'Text', encounterId: 'enc-mine' }),
      boardTask({ id: 'mine', title: 'Assigned to me', owner: owner(ME), encounterId: 'enc-mine' }),
    ];
    const ids = (journal: ReturnType<typeof buildJournal>): string[] =>
      [...journal.recent, ...journal.notTied].flatMap((row) => row.items.map((item) => item.id)).sort();
    const shared = { patients: [patient('pat-robert', 'Robert', 'Hill')], tasks };
    expect(ids(buildJournal(withVisits([roomed], { ...shared, kind: 'clinician' })))).toEqual(['mine']);
    expect(ids(buildJournal(withVisits([roomed], { ...shared, practitionerId: OTHER })))).toEqual([
      'lipid',
      'mine',
      'text',
    ]);
  });

  it('places an owned task by visit, then patient row, then "Not tied to a recent visit" with the patient name', () => {
    const other = visit({
      id: 'elsewhere',
      patientId: 'pat-helen',
      start: '2026-11-01T15:00:00.000Z',
      appointmentStatus: 'fulfilled',
      encounterStatus: 'finished',
      attender: { id: OTHER },
    });
    const journal = buildJournal(
      withVisits([myVisit()], {
        patients: [patient('pat-robert', 'Robert', 'Hill'), patient('pat-helen', 'Helen', 'Park')],
        relatedPersons: [userPhone('rp-helen', 'pat-helen', '+14105550122')],
        taskEncounters: [other.encounter],
        appointments: [visit(myVisit()).appointment, other.appointment],
        tasks: [
          boardTask({
            id: 'fax',
            category: FAX_TASK.category,
            title: 'Review fax “Cardiology consult” for Helen Park',
            encounterId: 'enc-elsewhere',
            owner: owner(ME),
            code: { coding: [{ system: FAX_TASK.system, code: FAX_TASK.code.reviewInboundFax }] },
            input: [
              { type: { coding: [{ code: FAX_TASK.input.receivedDate }] }, valueString: '2026-11-07T18:20:00.000Z' },
              { type: { coding: [{ code: FAX_TASK.input.folderId }] }, valueString: 'folder-1' },
            ],
          }),
          boardTask({
            id: 'erx',
            category: ERX_TASK.category,
            title: 'Provider has notifications in DoseSpot',
            owner: owner(ME),
            authoredOn: '2026-11-06T13:00:00.000Z',
          }),
        ],
      })
    );
    expect(journal.notTied).toHaveLength(2);
    const [fax, erx] = journal.notTied;
    expect(fax.patient).toEqual(
      expect.objectContaining({
        patientId: 'pat-helen',
        name: 'Helen Park',
        phones: [{ number: '+14105550122', recipientResourceUri: 'RelatedPerson/rp-helen' }],
      })
    );
    expect(fax.items[0]).toEqual(
      expect.objectContaining({
        kind: 'fax',
        label: 'Review fax “Cardiology consult” for Helen Park',
        when: 'received',
        since: '2026-11-07T18:20:00.000Z',
        appointmentId: 'appt-elsewhere',
        folderId: 'folder-1',
        code: FAX_TASK.code.reviewInboundFax,
      })
    );
    expect(erx.patient).toBeUndefined();
    expect(erx.items[0]).toEqual(
      expect.objectContaining({ kind: 'erx', label: 'Check eRx notifications', when: 'first notified' })
    );
  });

  it('gives each patient one "Not tied to a recent visit" row; to-dos without a patient stay one row each', () => {
    const forHelen = (id: string, assignedAt: string): Task =>
      boardTask({
        id,
        title: id,
        owner: owner(ME, assignedAt),
        input: [
          {
            type: { coding: [{ code: MANUAL_TASK.input.patient }] },
            valueReference: { reference: 'Patient/pat-helen' },
          },
        ],
      });
    const erx = (id: string): Task => boardTask({ id, category: ERX_TASK.category, title: id, owner: owner(ME) });
    const journal = buildJournal(
      sources({
        patients: [patient('pat-helen', 'Helen', 'Park')],
        tasks: [
          forHelen('call', '2026-11-06T13:00:00.000Z'),
          erx('erx-1'),
          forHelen('fax', '2026-11-07T13:00:00.000Z'),
          erx('erx-2'),
        ],
      })
    );
    const helen = journal.notTied.filter((row) => row.patient?.patientId === 'pat-helen');
    expect(helen).toHaveLength(1);
    expect(helen[0].items.map((item) => item.id)).toEqual(['fax', 'call']);
    const noPatient = journal.notTied.filter((row) => !row.patient);
    expect(noPatient.map((row) => row.items.map((item) => item.id))).toEqual([['erx-1'], ['erx-2']]);
  });

  it('follows the Tasks board rule: hides tasks without the board tag (preliminary lab results) and excluded codes', () => {
    const hidden = boardTask({
      id: 'prelim',
      category: LAB_ORDER_TASK.category,
      title: 'Prelim',
      encounterId: 'enc-mine',
    });
    hidden.meta = undefined;
    const pst = boardTask({
      id: 'pst',
      category: LAB_ORDER_TASK.category,
      title: 'Collect sample',
      encounterId: 'enc-mine',
      code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.preSubmission }] },
    });
    const completed = boardTask({ id: 'done', title: 'Done', encounterId: 'enc-mine', status: 'completed' });
    expect(isOpenBoardTask(hidden)).toBe(false);
    expect(isOpenBoardTask(pst)).toBe(false);
    expect(isOpenBoardTask(completed)).toBe(false);
    const journal = buildJournal(
      withVisits([myVisit()], {
        patients: [patient('pat-robert', 'Robert', 'Hill')],
        tasks: [hidden, pst, completed, boardTask({ id: 'final', title: 'Final', encounterId: 'enc-mine' })],
      })
    );
    expect(journal.recent[0].items.map((item) => item.id)).toEqual(['final']);
  });

  it('marks abnormal results like the Tasks page and lists them first on the row', () => {
    const lab = (id: string, receivedDate: string, abnormal: boolean): Task =>
      boardTask({
        id,
        category: LAB_ORDER_TASK.category,
        title: 'Review results',
        encounterId: 'enc-mine',
        input: [
          { type: { coding: [{ code: LAB_ORDER_TASK.input.receivedDate }] }, valueString: receivedDate },
          ...(abnormal
            ? [
                {
                  type: { coding: [{ code: LAB_ORDER_TASK.input.alert }] },
                  valueString: TaskAlertCode.abnormalLabResult,
                },
              ]
            : []),
        ],
      });
    const journal = buildJournal(
      withVisits([myVisit()], {
        patients: [patient('pat-robert', 'Robert', 'Hill')],
        tasks: [lab('potassium', '2026-11-04T14:00:00.000Z', true), lab('cbc', '2026-11-06T14:00:00.000Z', false)],
      })
    );
    expect(journal.recent[0].items.map((item) => [item.id, item.alert])).toEqual([
      ['potassium', TaskAlertCode.abnormalLabResult],
      ['cbc', undefined],
    ]);
  });

  it('lists only account (user-relatedperson) SMS numbers as phones', () => {
    const journal = buildJournal(
      withVisits([myVisit()], {
        patients: [patient('pat-robert', 'Robert', 'Hill')],
        relatedPersons: [
          userPhone('rp-1', 'pat-robert', '+14105550175'),
          userPhone('rp-2', 'pat-robert', '+14105550176', false),
          userPhone('rp-3', 'pat-other', '+14105550199'),
        ],
        tasks: [boardTask({ id: 't', title: 'T', encounterId: 'enc-mine' })],
      })
    );
    expect(journal.recent[0].patient?.phones).toEqual([
      { number: '+14105550175', recipientResourceUri: 'RelatedPerson/rp-1' },
    ]);
  });
});

describe('account phone labels', () => {
  const booked = (id: string, start: string, createdBy: string): Appointment => ({
    resourceType: 'Appointment',
    id,
    status: 'fulfilled',
    start,
    participant: [{ actor: { reference: 'Patient/pat-ava' }, status: 'accepted' }],
    meta: { tag: [{ system: CREATED_BY_SYSTEM, display: createdBy }] },
  });
  const phone = (number: string): JournalPhone => ({ number, recipientResourceUri: `RelatedPerson/${number}` });

  it('picks, per account phone, the newest visit that phone booked (walk-in QR too); staff bookings give none', () => {
    const mom = phone('+14105550123');
    const dad = phone('+14105550124');
    const never = phone('+14105550199');
    const ava: JournalPatient = { patientId: 'pat-ava', name: 'Ava Chen', phones: [mom, dad, never] };
    const bookings = phonesByBookingAppointment(
      [ava],
      [
        booked('old', '2026-09-01T15:00:00.000Z', 'Patient (410) 555-0123'),
        booked('new', '2026-11-01T15:00:00.000Z', 'QR - Patient (410) 555-0123'),
        booked('dad', '2026-10-01T15:00:00.000Z', 'Patient (410) 555-0124'),
        booked('staff', '2026-11-05T15:00:00.000Z', 'Staff someone@example.com'),
      ]
    );
    expect([...bookings.entries()]).toEqual([
      ['new', [mom]],
      ['dad', [dad]],
    ]);
  });

  it('labels with the consent signer and relationship, except the patient’s own number', () => {
    const qr = (name: string, relationship: string): QuestionnaireResponse => ({
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [
        {
          linkId: 'consent-forms-page',
          item: [
            { linkId: 'full-name', answer: [{ valueString: name }] },
            { linkId: 'consent-form-signer-relationship', answer: [{ valueString: relationship }] },
          ],
        },
      ],
    });
    expect(consentSignerLabel(qr('Mei Chen', 'Parent'))).toBe('Mei Chen (Parent)');
    expect(consentSignerLabel(qr('Ava Chen', 'Self'))).toBeUndefined();
    expect(consentSignerLabel({ resourceType: 'QuestionnaireResponse', status: 'completed' })).toBeUndefined();
  });
});

describe('taskToJournalItem wording', () => {
  it('uses "assigned" for an owned task and "created" otherwise, never "overdue"', () => {
    const call = boardTask({
      id: 'call',
      category: MANUAL_TASK.category.patientFollowUp,
      title: 'Call about culture results',
      owner: owner(ME, '2026-11-07T14:00:00.000Z'),
      authoredOn: '2026-11-07T09:00:00.000Z',
    });
    expect(taskToJournalItem(call, {})).toEqual(
      expect.objectContaining({
        kind: 'task',
        label: 'Call about culture results',
        when: 'assigned',
        since: '2026-11-07T14:00:00.000Z',
        isCallTask: true,
        assigneeId: ME,
      })
    );
    const unassigned = boardTask({ id: 'u', title: 'Unassigned', authoredOn: '2026-11-07T09:00:00.000Z' });
    expect(taskToJournalItem(unassigned, {})).toEqual(
      expect.objectContaining({ when: 'created', since: '2026-11-07T09:00:00.000Z', isCallTask: undefined })
    );
  });

  it('maps patient texts and unread portal messages to replies', () => {
    const text = boardTask({
      id: 'text',
      category: PATIENT_REQUEST_TASK.category,
      title: 'Text message from Robert Hill 11/03/2026',
      code: { coding: [{ system: PATIENT_REQUEST_TASK.system, code: PATIENT_REQUEST_TASK.code.textMessage }] },
      lastModified: '2026-11-07T19:35:00.000Z',
    });
    // Support Chat's switch: the task title once read; "Reply to text" while the patient's texts are unread.
    const textItem = taskToJournalItem(text, { patientId: 'pat-robert' });
    expect(textItem).toEqual(
      expect.objectContaining({
        kind: 'text-message',
        label: 'Text message from Robert Hill 11/03/2026',
        when: 'received',
        since: '2026-11-07T19:35:00.000Z',
      })
    );
    expect(textItem.unread).toBeUndefined();
    markTextUnread(textItem);
    expect(textItem).toEqual(expect.objectContaining({ label: 'Reply to text', unread: true }));
    const portal = boardTask({
      id: 'portal',
      category: PATIENT_REQUEST_TASK.category,
      title: 'Prescription Refill for Robert Hill 11/03/2026',
      code: { coding: [{ system: PATIENT_REQUEST_TASK.system, code: PATIENT_REQUEST_TASK.code.prescriptionRefill }] },
      meta: { tag: [{ code: 'task' }, SUPPORT_CHAT_UNREAD_TAG] },
    });
    expect(taskToJournalItem(portal, {})).toEqual(
      expect.objectContaining({
        kind: 'patient-request',
        label: 'Reply to patient message',
        when: 'received',
        // The page opens the Tasks page's Support Chat dialog, titled with the task title.
        unread: true,
        title: 'Prescription Refill for Robert Hill 11/03/2026',
      })
    );
    const readPortal = { ...portal, meta: { tag: [{ code: 'task' }] } };
    expect(taskToJournalItem(readPortal, {}).label).toBe('Prescription Refill for Robert Hill 11/03/2026');
    expect(taskToJournalItem(readPortal, {}).unread).toBeUndefined();
  });

  it('marks reflex results and keeps the lab task code (for the Tasks page links)', () => {
    const labTask = (code: string, drTag?: string): Task =>
      boardTask({
        id: code,
        category: LAB_ORDER_TASK.category,
        code: { coding: [{ system: LAB_ORDER_TASK.system, code }] },
        basedOn: [{ reference: 'DiagnosticReport/dr-1' }],
        input: drTag ? [{ type: { coding: [{ code: LAB_ORDER_TASK.input.drTag }] }, valueString: drTag }] : undefined,
      });
    expect(taskToJournalItem(labTask(LAB_ORDER_TASK.code.reviewFinalResult, 'reflex'), {})).toEqual(
      expect.objectContaining({ kind: 'external-lab', diagnosticReportId: 'dr-1', isReflex: true })
    );
    expect(taskToJournalItem(labTask(LAB_ORDER_TASK.code.matchUnsolicitedResult), {})).toEqual(
      expect.objectContaining({ code: LAB_ORDER_TASK.code.matchUnsolicitedResult, isReflex: undefined })
    );
  });

  it('titles an unmatched unsolicited result as the Tasks page does', () => {
    const input = (code: string, valueString: string): NonNullable<Task['input']>[number] => ({
      type: { coding: [{ code }] },
      valueString,
    });
    const match = (inputs: Task['input']): Task =>
      boardTask({
        id: 'match',
        category: LAB_ORDER_TASK.category,
        code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.matchUnsolicitedResult }] },
        basedOn: [{ reference: 'DiagnosticReport/dr-1' }],
        input: inputs,
      });
    expect(
      taskToJournalItem(
        match([
          input(LAB_ORDER_TASK.input.testName, 'CBC'),
          input(LAB_ORDER_TASK.input.receivedDate, '2026-11-05T10:00:00.000Z'),
        ]),
        {}
      ).label
    ).toBe('Match unsolicited test results for CBC');
    expect(
      taskToJournalItem(
        match([input(LAB_ORDER_TASK.input.testName, 'CBC'), input(LAB_ORDER_TASK.input.labName, 'Quest')]),
        {}
      ).label
    ).toBe('Match unsolicited test results for CBC / Quest');
  });

  it("keeps a fax's Communication id (for the Tasks page's Match link)", () => {
    const fax = boardTask({
      id: 'fax',
      category: FAX_TASK.category,
      code: { coding: [{ system: FAX_TASK.system, code: FAX_TASK.code.matchInboundFax }] },
      input: [{ type: { coding: [{ code: FAX_TASK.input.communicationId }] }, valueString: 'comm-1' }],
    });
    expect(taskToJournalItem(fax, {})).toEqual(
      expect.objectContaining({ kind: 'fax', code: FAX_TASK.code.matchInboundFax, communicationId: 'comm-1' })
    );
  });

  it("keeps a DME dispense task's DeviceRequest id (for the Tasks page's Go to Order link)", () => {
    const encounter = { resourceType: 'Encounter', id: 'enc-1', status: 'in-progress' } as Encounter;
    const dispense = makeDmeDispenseTask({
      deviceRequestReference: 'DeviceRequest/dr-1',
      itemName: 'Crutches',
      orderDate: '2026-11-07',
      providerName: 'Ana Rivera',
      context: { encounter, patient: patient('pat-mia', 'Mia', 'Lin'), appointmentId: 'appt-1' } as Parameters<
        typeof makeDmeDispenseTask
      >[0]['context'],
    });
    expect(taskToJournalItem(dispense, {})).toEqual(
      expect.objectContaining({ kind: 'task', category: 'dme', orderId: 'dr-1' })
    );
  });

  it('treats a completed-form review task (submit-paperwork) as a task, not a call', () => {
    const form = boardTask({
      id: 'form',
      category: MANUAL_TASK.category.patientFollowUp,
      title: 'Ava Doe completed Vanderbilt Parent Follow-up',
      owner: owner(ME),
      input: [{ type: { coding: [{ code: MANUAL_TASK.input.documentReferenceId }] }, valueString: 'doc-1' }],
    });
    expect(taskToJournalItem(form, { patientId: 'pat-ava' })).toEqual(
      expect.objectContaining({
        kind: 'task',
        category: MANUAL_TASK.category.patientFollowUp,
        documentReferenceId: 'doc-1',
        isCallTask: undefined,
        assigneeId: undefined,
      })
    );
  });

  it('keeps the order and Progress Note section of a manual task (for the Tasks page link)', () => {
    const input = (code: string, value: string): NonNullable<Task['input']>[number] => ({
      type: { coding: [{ code }] },
      valueString: value,
    });
    const vaccine = boardTask({
      id: 'vax',
      category: MANUAL_TASK.category.immunization,
      input: [input(MANUAL_TASK.input.orderId, 'order-1')],
    });
    expect(taskToJournalItem(vaccine, {})).toEqual(
      expect.objectContaining({ category: MANUAL_TASK.category.immunization, orderId: 'order-1' })
    );
    const vitals = boardTask({
      id: 'bp',
      category: MANUAL_TASK.category.nursingOrders,
      input: [input(MANUAL_TASK.input.progressNoteSection, 'vitals')],
    });
    expect(taskToJournalItem(vitals, {})).toEqual(expect.objectContaining({ progressNoteSection: 'vitals' }));
  });

  it('keeps the task category identifier system used by the board', () => {
    expect(boardTask({ title: 'x' }).groupIdentifier?.system).toBe(ottehrIdentifierSystem('task-category'));
  });
});

describe('visit locations for quick texts', () => {
  it('reads each visit’s Location from its encounter, like the tracking board', () => {
    const visit = { encounterId: 'enc-1' } as JournalVisit;
    const bare = { encounterId: 'enc-2' } as JournalVisit;
    const encounters: Encounter[] = [
      {
        resourceType: 'Encounter',
        id: 'enc-1',
        status: 'finished',
        class: {},
        location: [{ location: { reference: 'Location/loc-1' } }],
      },
      { resourceType: 'Encounter', id: 'enc-2', status: 'finished', class: {} },
    ];
    expect([...visitLocationIds([visit, bare], encounters)]).toEqual([[visit, 'loc-1']]);
  });

  it('keeps only the name, phone and review link', () => {
    const review = { url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://review.example' };
    expect(
      quickTextLocation({
        resourceType: 'Location',
        id: 'loc-1',
        name: 'New York',
        address: { line: ['1 Main St'] },
        telecom: [
          { system: 'fax', value: '+19195550101' },
          { system: 'phone', value: '+19195550100' },
        ],
        extension: [{ url: 'https://example/timezone', valueString: 'America/New_York' }, review],
      })
    ).toEqual({
      resourceType: 'Location',
      id: 'loc-1',
      name: 'New York',
      telecom: [{ system: 'phone', value: '+19195550100' }],
      extension: [review],
    });
  });
});

describe('buildJournal: OTR-3941 review answers', () => {
  const TODAY_TELEMED = {
    id: 'tm',
    patientId: 'pat-maria',
    start: '2026-11-07T19:30:00.000Z',
    appointmentStatus: 'arrived' as const,
    encounterStatus: 'arrived' as const,
    attender: { id: ME },
    telemed: true,
  };

  it('puts a virtual visit waiting in the virtual waiting room on Coming Up as ready (item 49)', () => {
    const journal = buildJournal(withVisits([TODAY_TELEMED], { patients: [patient('pat-maria', 'Maria', 'Lopez')] }));
    expect(journal.comingUp).toHaveLength(1);
    expect(journal.comingUp[0].lookahead).toBeUndefined();
    expect(journal.comingUp[0].visit?.isTelemed).toBe(true);
  });

  it('reads an on-demand virtual visit still booked while the patient waits as the tracking board does (arrived)', () => {
    const journal = buildJournal(
      withVisits([{ ...TODAY_TELEMED, appointmentStatus: 'booked', encounterStatus: 'planned' }], {
        patients: [patient('pat-maria', 'Maria', 'Lopez')],
      })
    );
    expect(journal.comingUp).toHaveLength(1);
    expect(journal.comingUp[0].visit?.status).toBe('arrived');
    expect(journal.comingUp[0].lookahead).toBeUndefined();
    // "Waiting …" counts from the booking, the moment the patient joined the waiting room.
    expect(journal.comingUp[0].waitingSince).toBe(TODAY_TELEMED.start);
  });

  it('leaves an in-person visit that has only arrived off a provider’s Coming Up', () => {
    const journal = buildJournal(
      withVisits([{ ...TODAY_TELEMED, telemed: false }], { patients: [patient('pat-maria', 'Maria', 'Lopez')] })
    );
    expect(journal.comingUp).toEqual([]);
  });

  it('shows a clinician their arrived patient as a look-ahead (item 56)', () => {
    const journal = buildJournal(
      withVisits([{ ...TODAY_TELEMED, telemed: false, attender: undefined, admitter: { id: ME } }], {
        kind: 'clinician',
        patients: [patient('pat-maria', 'Maria', 'Lopez')],
      })
    );
    expect(journal.comingUp).toHaveLength(1);
    expect(journal.comingUp[0].lookahead).toBe(true);
  });

  it('shows a task on the provider’s visit held by someone else with their name (item 67)', () => {
    const journal = buildJournal(
      withVisits([{ ...TODAY_READY }], {
        patients: [patient('pat-maria', 'Maria', 'Lopez')],
        tasks: [
          boardTask({
            id: 'theirs',
            title: 'Call pharmacy',
            encounterId: 'enc-ready',
            owner: { ...owner(OTHER), display: 'Joe Lin' },
          }),
          boardTask({ id: 'mine', title: 'Mine', encounterId: 'enc-ready', owner: owner(ME) }),
          boardTask({ id: 'unassigned', title: 'Nobody', encounterId: 'enc-ready' }),
        ],
      })
    );
    const items = journal.comingUp[0].items;
    expect(items.find((item) => item.id === 'theirs')?.assignedTo).toBe('Joe Lin');
    expect(items.find((item) => item.id === 'mine')?.assignedTo).toBeUndefined();
    expect(items.find((item) => item.id === 'unassigned')?.assignedTo).toBeUndefined();
  });

  it('lists the provider’s own to-dos before ones held by someone else, even when theirs are newer', () => {
    const journal = buildJournal(
      withVisits([{ ...TODAY_READY }], {
        patients: [patient('pat-maria', 'Maria', 'Lopez')],
        tasks: [
          boardTask({
            id: 'theirs',
            title: 'Call pharmacy',
            encounterId: 'enc-ready',
            authoredOn: '2026-11-07T18:00:00.000Z',
            owner: { ...owner(OTHER), display: 'Joe Lin' },
          }),
          boardTask({ id: 'mine', title: 'Mine', encounterId: 'enc-ready', authoredOn: '2026-11-06T18:00:00.000Z' }),
        ],
      })
    );
    expect(journal.comingUp[0].items.map((item) => item.id)).toEqual(['mine', 'theirs']);
  });

  it('gives a text task its assignee and keeps its title after it is marked unread (item 51)', () => {
    const text = boardTask({
      id: 'text',
      category: PATIENT_REQUEST_TASK.category,
      title: 'Text message from Robert Hill 11/03/2026',
      code: { coding: [{ system: PATIENT_REQUEST_TASK.system, code: PATIENT_REQUEST_TASK.code.textMessage }] },
      owner: owner(ME),
    });
    const item = taskToJournalItem(text, { patientId: 'pat-robert' });
    markTextUnread(item);
    expect(item).toEqual(
      expect.objectContaining({ assigneeId: ME, title: 'Text message from Robert Hill 11/03/2026' })
    );
  });
});

describe('buildJournal: a provider who is also the "In:" (decision 11-22)', () => {
  const PATIENTS = { patients: [patient('pat-kelly', 'Kelly', 'Smith')] };
  const kelly = (spec: Partial<VisitSpec>): VisitSpec => ({
    id: 'kelly',
    patientId: 'pat-kelly',
    start: '2026-11-07T19:30:00.000Z',
    appointmentStatus: 'checked-in',
    encounterStatus: 'arrived',
    room: '2',
    ...spec,
  });

  it('lists a Ready patient on Coming Up for intake, whether or not they are also the "Pr:"', () => {
    [{ id: OTHER }, { id: ME }, undefined].forEach((attender) => {
      const journal = buildJournal(
        withVisits([kelly({ admitter: { id: ME }, attender, readySince: '2026-11-07T19:32:00.000Z' })], PATIENTS)
      );
      expect(journal.comingUp).toHaveLength(1);
      expect(journal.comingUp[0]).toMatchObject({
        role: 'clinician',
        waitingSince: '2026-11-07T19:32:00.000Z',
        visit: { status: 'ready' },
      });
      expect(journal.comingUp[0].lookahead).toBeUndefined();
    });
  });

  it('shows an arrived patient as "Arrived, next up" (the clinician look-ahead)', () => {
    const journal = buildJournal(
      withVisits([kelly({ appointmentStatus: 'arrived', admitter: { id: ME }, attender: { id: ME } })], PATIENTS)
    );
    expect(journal.comingUp[0]).toMatchObject({ role: 'clinician', lookahead: true, visit: { status: 'arrived' } });
  });

  it('puts their own intake in Today as "In intake"', () => {
    const journal = buildJournal(
      withVisits(
        [
          kelly({
            encounterStatus: 'in-progress',
            admitter: { id: ME, start: '2026-11-07T19:35:00.000Z' },
            attender: { id: ME },
          }),
        ],
        PATIENTS
      )
    );
    expect(journal.comingUp).toEqual([]);
    expect(journal.today[0]).toMatchObject({ role: 'clinician', visit: { status: 'intake' } });
  });

  it('keeps Ready for provider in Today, with the wait and Start Provider, after their own intake', () => {
    const journal = buildJournal(
      withVisits(
        [
          kelly({
            appointmentStatus: 'fulfilled',
            encounterStatus: 'in-progress',
            admitter: { id: ME, start: '2026-11-07T19:35:00.000Z', end: '2026-11-07T19:41:00.000Z' },
            attender: { id: ME },
            readyForProviderSince: '2026-11-07T19:41:00.000Z',
          }),
        ],
        PATIENTS
      )
    );
    expect(journal.comingUp).toEqual([]);
    expect(journal.today[0]).toMatchObject({
      role: 'provider',
      room: '2',
      waitingSince: '2026-11-07T19:41:00.000Z',
      visit: { status: 'ready for provider' },
    });
  });

  it('keeps Ready for provider on Coming Up when someone else did the intake', () => {
    const journal = buildJournal(withVisits([TODAY_READY], { patients: [patient('pat-maria', 'Maria', 'Lopez')] }));
    expect(journal.comingUp[0]).toMatchObject({ role: 'provider', visit: { status: 'ready for provider' } });
    expect(journal.today).toEqual([]);
  });

  it('keeps Start Provider on a virtual waiting room visit when they are also the "Pr:"', () => {
    const journal = buildJournal(
      withVisits(
        [kelly({ telemed: true, appointmentStatus: 'arrived', admitter: { id: ME }, attender: { id: ME } })],
        PATIENTS
      )
    );
    expect(journal.comingUp[0]).toMatchObject({ role: 'provider', visit: { status: 'arrived' } });
    expect(journal.comingUp[0].lookahead).toBeUndefined();
  });

  it('marks an "In:" only visit with the provider as not in the room', () => {
    const journal = buildJournal(
      withVisits(
        [
          kelly({
            appointmentStatus: 'fulfilled',
            encounterStatus: 'in-progress',
            admitter: { id: ME, start: '2026-11-07T19:35:00.000Z', end: '2026-11-07T19:41:00.000Z' },
            attender: { id: OTHER, start: '2026-11-07T19:45:00.000Z' },
          }),
        ],
        {
          ...PATIENTS,
          tasks: [boardTask({ id: 'task-mine', title: 'Mine', encounterId: 'enc-kelly', owner: owner(ME) })],
        }
      )
    );
    expect(journal.today[0]).toMatchObject({ role: 'clinician', visit: { status: 'provider' } });
  });

  it('drops an "In:" only visit older than 90 days, so it does not tie a to-do to the patient', () => {
    const old = kelly({
      start: '2026-04-01T14:00:00.000Z',
      appointmentStatus: 'fulfilled',
      encounterStatus: 'in-progress',
      admitter: { id: ME, start: '2026-04-01T14:05:00.000Z', end: '2026-04-01T14:10:00.000Z' },
      attender: { id: OTHER, start: '2026-04-01T14:15:00.000Z' },
    });
    const mine = boardTask({
      id: 'task-mine',
      title: 'Mine',
      owner: owner(ME),
      input: [
        { type: { coding: [{ code: MANUAL_TASK.input.patient }] }, valueReference: { reference: 'Patient/pat-kelly' } },
      ],
    });
    const journal = buildJournal(withVisits([old], { ...PATIENTS, tasks: [mine] }));
    expect(journal.recent).toEqual([]);
    expect(journal.notTied.map((row) => row.items.map((item) => item.id))).toEqual([['task-mine']]);
  });

  it('gives an "In:" only visit no note to sign and only the tasks assigned to them', () => {
    const intakeOnly = kelly({
      start: '2026-11-05T15:00:00.000Z',
      appointmentStatus: 'fulfilled',
      encounterStatus: 'finished',
      admitter: { id: ME, start: '2026-11-05T15:05:00.000Z', end: '2026-11-05T15:15:00.000Z' },
      attender: { id: OTHER, start: '2026-11-05T15:20:00.000Z', end: '2026-11-05T15:40:00.000Z' },
    });
    const unassigned = boardTask({ id: 'task-unassigned', title: 'Unassigned', encounterId: 'enc-kelly' });
    const mine = boardTask({ id: 'task-mine', title: 'Mine', encounterId: 'enc-kelly', owner: owner(ME) });
    const journal = buildJournal(withVisits([intakeOnly], { ...PATIENTS, tasks: [unassigned, mine] }));
    expect(journal.recent).toHaveLength(1);
    expect(journal.recent[0].items.map((item) => item.id)).toEqual(['task-mine']);
    expect(journal.recent[0].lastSeen).toBe('2026-11-05T15:00:00.000Z');
  });
});
