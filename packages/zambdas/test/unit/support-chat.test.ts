import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient, Practitioner, Reference, Resource, Schedule, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  TASK_LOCATION_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { SupportChatTopic } from 'utils/lib/types/api/support-chat.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { findActivePromptIndex } from 'utils/lib/utils/support-chat';
import { describe, expect, it, vi } from 'vitest';
import { BOT_TEXT, resolveStep } from '../../src/shared/support-chat/bot';
import {
  buildRequestTask,
  buildRequestTitle,
  canAutoAssign,
  getLinkedProviderId,
  getVisitProviderOwner,
  getVisits,
  moveRequestTask,
  Visit,
} from '../../src/shared/support-chat/request-task';
import { ThreadMessage } from '../../src/shared/support-chat/thread';

const visits = [
  { id: 'appointment-1', label: 'Sarah Black 07/11/2026' },
  { id: 'appointment-2', label: 'Oliver Black 07/09/2026' },
];

const greeting: ThreadMessage = { kind: 'greeting', options: [] };

const visitPrompt: ThreadMessage = {
  kind: 'visit-prompt',
  topic: SupportChatTopic.prescriptionRefill,
  options: visits,
};

const confirmation: ThreadMessage = { kind: 'confirmation', options: [] };
const text: ThreadMessage = { kind: 'text', options: [] };

describe('support chat bot', () => {
  it('stores the greeting before the first action of an empty thread', () => {
    const step = resolveStep({
      last: undefined,
      action: { action: 'select-topic', topic: SupportChatTopic.schoolWorkNote },
      visits,
      hasOpenTask: false,
    });
    expect(step.messages.map((m) => m.kind)).toEqual(['greeting', 'recap', 'visit-prompt']);
    expect(step.task).toBeUndefined();
  });

  it('starts a new request with the greeting', () => {
    const step = resolveStep({ last: text, action: { action: 'new-request' }, visits, hasOpenTask: true });
    expect(step.messages.map((m) => m.kind)).toEqual(['greeting']);
    expect(step.messages[0].options?.map((o) => o.label)).toEqual([
      'Prescription Refill',
      'School/Work Note',
      'Medical Record',
    ]);
  });

  it('asks for a visit after a topic', () => {
    const step = resolveStep({
      last: greeting,
      action: { action: 'select-topic', topic: SupportChatTopic.prescriptionRefill },
      visits,
      hasOpenTask: false,
    });
    expect(step.messages[0]).toMatchObject({ author: 'patient', text: 'Initiated request: Prescription Refill' });
    expect(step.messages[1]).toMatchObject({
      kind: 'visit-prompt',
      topic: SupportChatTopic.prescriptionRefill,
      options: visits,
    });
  });

  it('creates a task without a visit when the account has no visits', () => {
    const step = resolveStep({
      last: greeting,
      action: { action: 'select-topic', topic: SupportChatTopic.medicalRecord },
      visits: [],
      hasOpenTask: false,
    });
    expect(step.messages.map((m) => m.kind)).toEqual(['recap', 'confirmation']);
    expect(step.task).toMatchObject({ type: 'create', code: SupportChatTopic.medicalRecord });
  });

  it('creates a task for the selected visit', () => {
    const step = resolveStep({
      last: visitPrompt,
      action: { action: 'select-visit', appointmentId: 'appointment-1' },
      visits,
      hasOpenTask: false,
    });
    expect(step.messages[0].text).toBe('Specified: Prescription Refill for the visit of Sarah Black 07/11/2026');
    expect(step.messages[1].text).toBe(BOT_TEXT.confirmation);
    expect(step.task).toMatchObject({
      type: 'create',
      code: SupportChatTopic.prescriptionRefill,
      appointmentId: 'appointment-1',
    });
  });

  it('creates a follow-up task right away and asks for a visit after free text', () => {
    const step = resolveStep({ last: greeting, action: { action: 'text', text: 'Fax it' }, visits, hasOpenTask: true });
    expect(step.messages.map((m) => m.kind)).toEqual(['text', 'visit-prompt']);
    expect(step.messages[1].topic).toBeUndefined();
    expect(step.task).toEqual({ type: 'create', code: PATIENT_REQUEST_TASK.code.followUp, text: 'Fax it' });
  });

  it('sets the selected visit on the follow-up task', () => {
    const step = resolveStep({
      last: { kind: 'visit-prompt', options: visits },
      requestText: 'Fax it',
      action: { action: 'select-visit', appointmentId: 'appointment-2' },
      visits,
      hasOpenTask: true,
    });

    expect(step.messages.map((m) => m.text)).toEqual([
      'Initiated request: Fax it for Oliver Black 07/09/2026',
      BOT_TEXT.confirmation,
    ]);

    expect(step.task).toEqual({ type: 'set-visit', appointmentId: 'appointment-2', text: 'Fax it' });
  });

  it('adds text to the follow-up task when the patient types instead of selecting a visit', () => {
    const step = resolveStep({
      last: { kind: 'visit-prompt', options: visits },
      action: { action: 'text', text: 'More' },
      visits,
      hasOpenTask: true,
    });
    expect(step.task).toEqual({ type: 'attach', text: 'More' });
  });

  it('uses the only visit without asking', () => {
    const step = resolveStep({
      last: text,
      action: { action: 'text', text: 'Hi' },
      visits: [visits[0]],
      hasOpenTask: false,
    });
    expect(step.messages.map((m) => m.text)).toEqual([
      'Hi',
      'Initiated request: Hi for Sarah Black 07/11/2026',
      BOT_TEXT.confirmation,
    ]);
    expect(step.task).toMatchObject({ code: PATIENT_REQUEST_TASK.code.followUp, appointmentId: 'appointment-1' });
  });

  it('creates the pending request without a visit when the patient types instead of selecting', () => {
    const step = resolveStep({
      last: visitPrompt,
      action: { action: 'text', text: 'Asap' },
      visits,
      hasOpenTask: true,
    });
    expect(step.messages.map((m) => m.kind)).toEqual(['text', 'confirmation']);
    expect(step.task).toMatchObject({
      code: SupportChatTopic.prescriptionRefill,
      appointmentId: undefined,
      details: 'Asap',
    });
  });

  it('attaches text to the open task and acknowledges only the first details', () => {
    const first = resolveStep({ last: confirmation, action: { action: 'text', text: 'a' }, visits, hasOpenTask: true });
    expect(first.messages.map((m) => m.text)).toEqual(['a', BOT_TEXT.ack]);
    expect(first.task).toEqual({ type: 'attach', text: 'a' });

    const next = resolveStep({ last: text, action: { action: 'text', text: 'b' }, visits, hasOpenTask: true });
    expect(next.messages.map((m) => m.text)).toEqual(['b']);
  });

  it.each([
    [text, { action: 'select-topic' as const, topic: SupportChatTopic.prescriptionRefill }],
    [greeting, { action: 'select-visit' as const, appointmentId: 'appointment-1' }],
    [visitPrompt, { action: 'select-visit' as const, appointmentId: 'unknown' }],
  ])('rejects an action that does not match the active prompt', (last, action) => {
    expect(() => resolveStep({ last, action, visits, hasOpenTask: false })).toThrow();
  });
});

describe('findActivePromptIndex', () => {
  it('keeps a prompt active after staff replies and patient texts', () => {
    expect(findActivePromptIndex(['greeting', 'text', 'visit-prompt', 'text', 'text'])).toBe(2);
  });

  it('disables a prompt after it is answered', () => {
    expect(findActivePromptIndex(['greeting', 'recap', 'visit-prompt', 'recap', 'confirmation', 'text'])).toBe(-1);
  });

  it('uses only the newest prompt', () => {
    expect(findActivePromptIndex(['visit-prompt', 'text', 'greeting'])).toBe(2);
  });
});

describe('visit selection', () => {
  it('rejects a chip whose visit is no longer available', () => {
    const action = { action: 'select-visit' as const, appointmentId: 'appointment-1' };
    expect(() => resolveStep({ last: visitPrompt, action, visits: [visits[1]], hasOpenTask: false })).toThrow();
  });
});

describe('buildRequestTitle', () => {
  it('builds a structured title', () => {
    expect(buildRequestTitle(SupportChatTopic.prescriptionRefill, 'Sarah Black 07/11/2026')).toBe(
      'Prescription Refill for Sarah Black 07/11/2026'
    );
  });

  it('quotes the message for a follow-up', () => {
    expect(buildRequestTitle(PATIENT_REQUEST_TASK.code.followUp, 'Oliver Black 07/09/2026', 'Fax it, please')).toBe(
      '“Fax it, please” for Oliver Black 07/09/2026'
    );
  });

  it('shortens a long follow-up message', () => {
    const title = buildRequestTitle(PATIENT_REQUEST_TASK.code.followUp, 'Oliver Black', 'x'.repeat(150));
    expect(title).toBe(`“${'x'.repeat(100)}…” for Oliver Black`);
  });
});

describe('patient request assignment', () => {
  const patient: Patient = { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Sarah'], family: 'Black' }] };
  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    id: 'practitioner-1',
    name: [{ given: ['Jane'], family: 'Doe' }],
  };
  const visit: Visit = {
    appointmentId: 'appointment-1',
    encounterId: 'encounter-1',
    patient,
    location: { id: 'location-1', name: 'Clinic' },
    providerId: 'practitioner-1',
    label: 'Sarah Black 07/11/2026',
  };
  const otherVisit: Visit = {
    appointmentId: 'appointment-2',
    encounterId: 'encounter-2',
    patient,
    location: { id: 'location-2', name: 'Other clinic' },
    providerId: 'practitioner-2',
    label: 'Sarah Black 07/09/2026',
  };
  const owner = (id: string): Reference => ({ reference: `Practitioner/${id}` });
  const notifiedTag = { system: PROVIDER_NOTIFICATION_TAG_SYSTEM, code: 'task_assigned' };

  const makeOystehr = (
    roles: string[] | undefined,
    getPractitioner = async (): Promise<Practitioner> => practitioner
  ): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } => {
    const get = vi.fn(getPractitioner);
    const oystehr = {
      fhir: { get },
      user: {
        listV2: vi.fn(async () => ({ data: roles ? [{ id: 'user-1' }] : [] })),
        get: vi.fn(async () => ({ roles: (roles ?? []).map((name) => ({ name })) })),
      },
    } as unknown as Oystehr;
    return { oystehr, get };
  };

  const build = (input: { visit?: Visit; owner?: Reference } = {}): Task =>
    buildRequestTask({
      code: PATIENT_REQUEST_TASK.code.followUp,
      threadId: 'thread-1',
      patient,
      visit: input.visit ?? visit,
      owner: input.owner,
      text: 'Hi',
    });

  describe('getVisitProviderOwner', () => {
    it("resolves the visit's provider", async () => {
      const { oystehr, get } = makeOystehr([RoleType.Provider]);
      const result = await getVisitProviderOwner(oystehr, visit);

      expect(get).toHaveBeenCalledWith({ resourceType: 'Practitioner', id: 'practitioner-1' });
      expect(result).toMatchObject({ reference: 'Practitioner/practitioner-1', display: 'Jane Doe' });
      expect(result?.extension?.[0]).toMatchObject({ url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL });
    });

    it('omits the display for a provider without a name', async () => {
      const { oystehr } = makeOystehr([RoleType.Provider], async () => ({ ...practitioner, name: undefined }));
      const result = await getVisitProviderOwner(oystehr, visit);

      expect(result?.reference).toBe('Practitioner/practitioner-1');
      expect(result?.display).toBeUndefined();
    });

    it('resolves a provider whose roles cannot be resolved', async () => {
      const { oystehr } = makeOystehr(undefined);
      expect(await getVisitProviderOwner(oystehr, visit)).toMatchObject({ reference: 'Practitioner/practitioner-1' });
    });

    it.each([
      ['deactivated', [RoleType.Provider, RoleType.Inactive]],
      ['no longer a provider', [RoleType.Staff]],
    ])('returns nothing when the provider is %s', async (_, roles) => {
      const { oystehr } = makeOystehr(roles);
      expect(await getVisitProviderOwner(oystehr, visit)).toBeUndefined();
    });

    it('returns nothing when the visit has no provider', async () => {
      const { oystehr, get } = makeOystehr([RoleType.Provider]);

      expect(await getVisitProviderOwner(oystehr, { ...visit, providerId: undefined })).toBeUndefined();
      expect(await getVisitProviderOwner(oystehr, undefined)).toBeUndefined();
      expect(get).not.toHaveBeenCalled();
    });

    it('returns nothing when the provider cannot be read', async () => {
      const { oystehr } = makeOystehr([RoleType.Provider], async () => {
        throw new Error('gone');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(await getVisitProviderOwner(oystehr, visit)).toBeUndefined();
    });
  });

  describe('buildRequestTask', () => {
    it('creates an assigned task in progress', () => {
      expect(build({ owner: owner('practitioner-1') })).toMatchObject({
        status: 'in-progress',
        owner: owner('practitioner-1'),
      });
    });

    it('creates an unassigned task as pending', () => {
      const task = build();
      expect(task.status).toBe('ready');
      expect(task.owner).toBeUndefined();
    });
  });

  describe('canAutoAssign', () => {
    it('allows an unassigned task', () => {
      expect(canAutoAssign(build(), undefined)).toBe(true);
    });

    it("allows a task still assigned to its linked visit's provider", () => {
      expect(canAutoAssign(build({ owner: owner('practitioner-1') }), 'practitioner-1')).toBe(true);
    });

    it('keeps a task staff reassigned to someone else', () => {
      expect(canAutoAssign(build({ owner: owner('practitioner-9') }), 'practitioner-1')).toBe(false);
    });

    it('keeps a task whose linked provider is unknown', () => {
      expect(canAutoAssign(build({ owner: owner('practitioner-1') }), undefined)).toBe(false);
    });

    it('keeps a completed task', () => {
      expect(canAutoAssign({ ...build(), status: 'completed' }, undefined)).toBe(false);
    });
  });

  describe('getLinkedProviderId', () => {
    const encounterOf = (providerId: string): Encounter => ({
      resourceType: 'Encounter',
      id: 'encounter-1',
      status: 'finished',
      class: { code: 'ACUTE' },
      participant: [
        {
          type: [{ coding: PRACTITIONER_CODINGS.Attender }],
          individual: { reference: `Practitioner/${providerId}` },
        },
      ],
    });
    const oystehrWith = (get: () => Promise<Encounter>): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } => {
      const fn = vi.fn(get);
      return { oystehr: { fhir: { get: fn } } as unknown as Oystehr, get: fn };
    };

    it('takes the provider of a loaded visit without a request', async () => {
      const { oystehr, get } = oystehrWith(async () => encounterOf('practitioner-9'));

      expect(await getLinkedProviderId(oystehr, build({ owner: owner('practitioner-1') }), [visit])).toBe(
        'practitioner-1'
      );
      expect(get).not.toHaveBeenCalled();
    });

    it('reads the linked encounter when its visit is outside the loaded visits', async () => {
      const { oystehr, get } = oystehrWith(async () => encounterOf('practitioner-1'));

      expect(await getLinkedProviderId(oystehr, build({ owner: owner('practitioner-1') }), [otherVisit])).toBe(
        'practitioner-1'
      );
      expect(get).toHaveBeenCalledWith({ resourceType: 'Encounter', id: 'encounter-1' });
    });

    it('needs no provider for an unassigned task', async () => {
      const { oystehr, get } = oystehrWith(async () => encounterOf('practitioner-1'));

      expect(await getLinkedProviderId(oystehr, build(), [])).toBeUndefined();
      expect(get).not.toHaveBeenCalled();
    });

    it('keeps the assignee when the encounter cannot be read', async () => {
      const { oystehr } = oystehrWith(async () => {
        throw new Error('gone');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(await getLinkedProviderId(oystehr, build({ owner: owner('practitioner-1') }), [])).toBeUndefined();
    });
  });

  describe('moveRequestTask', () => {
    const withTag = (task: Task): Task => ({ ...task, meta: { ...task.meta, tag: [...task.meta!.tag!, notifiedTag] } });

    it('links the selected visit and reassigns to its provider', () => {
      const task = withTag(build({ owner: owner('practitioner-1') }));
      const next = build({ visit: otherVisit, owner: owner('practitioner-2') });
      const moved = moveRequestTask({ ...task, id: 'task-1' }, next, true);

      expect(moved).toMatchObject({
        id: 'task-1',
        status: 'in-progress',
        owner: owner('practitioner-2'),
        encounter: { reference: 'Encounter/encounter-2' },
        location: { reference: 'Location/location-2' },
      });
      expect(moved.meta?.tag).not.toContainEqual(notifiedTag);
      expect(moved.meta?.tag?.filter((tag) => tag.system === TASK_LOCATION_SYSTEM)).toEqual([
        { system: TASK_LOCATION_SYSTEM, code: 'location-2', display: 'Other clinic' },
      ]);
    });

    it('assigns a task created unassigned', () => {
      const moved = moveRequestTask(build(), build({ visit: otherVisit, owner: owner('practitioner-2') }), true);
      expect(moved).toMatchObject({ status: 'in-progress', owner: owner('practitioner-2') });
    });

    it('returns the task to unassigned when the selected visit has no provider', () => {
      const moved = moveRequestTask(build({ owner: owner('practitioner-1') }), build({ visit: otherVisit }), true);

      expect(moved.status).toBe('ready');
      expect(moved.owner).toBeUndefined();
    });

    it('keeps the assignment when both visits share the provider', () => {
      const current = { ...owner('practitioner-1'), display: 'Original' };
      const task = withTag(build({ owner: current }));
      const moved = moveRequestTask(task, build({ visit: otherVisit, owner: owner('practitioner-1') }), true);

      expect(moved.owner).toEqual(current);
      expect(moved.meta?.tag).toContainEqual(notifiedTag);
    });

    it('keeps a staff assignment and status', () => {
      const task = withTag({ ...build({ owner: owner('practitioner-9') }), status: 'completed' });
      const moved = moveRequestTask(task, build({ visit: otherVisit }), false);

      expect(moved).toMatchObject({
        status: 'completed',
        owner: owner('practitioner-9'),
        encounter: { reference: 'Encounter/encounter-2' },
      });
      expect(moved.meta?.tag).toContainEqual(notifiedTag);
    });
  });
});

describe('getVisits', () => {
  const patient: Patient = { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Sarah'], family: 'Black' }] };
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: 'appointment-1',
    status: 'fulfilled',
    start: '2026-07-12T02:00:00.000Z',
    participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
  };
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'finished',
    class: { code: 'ACUTE' },
    appointment: [{ reference: 'Appointment/appointment-1' }],
    location: [{ location: { reference: 'Location/location-1' } }],
  };
  const location: Location = { resourceType: 'Location', id: 'location-1', name: 'Clinic' };
  const schedule: Schedule = {
    resourceType: 'Schedule',
    id: 'schedule-1',
    actor: [{ reference: 'Location/location-1' }],
    extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/Los_Angeles' }],
  };

  type SearchInput = { resourceType: string; params: { name: string; value: string | number }[] };

  const makeOystehr = (visitResources: Resource[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
    const search = vi.fn(async ({ resourceType }: SearchInput) => {
      const resources = resourceType === 'Appointment' ? visitResources : [location, schedule];
      const matches = resources.filter((resource) => resource.resourceType === resourceType);
      return {
        total: matches.length,
        entry: resources.map((resource) => ({
          resource,
          search: { mode: resource.resourceType === resourceType ? 'match' : 'include' },
        })),
        unbundle: () => resources,
      };
    });
    return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
  };

  const paramsOf = (search: ReturnType<typeof vi.fn>, call: number): Record<string, string | number> =>
    Object.fromEntries((search.mock.calls[call][0] as SearchInput).params.map((param) => [param.name, param.value]));

  it("loads each patient's five latest visits of the last three years with their encounters", async () => {
    const { oystehr, search } = makeOystehr([appointment, encounter]);
    await getVisits(oystehr, [patient]);

    const params = paramsOf(search, 0);
    const since = DateTime.fromISO(String(params.date).replace('ge', ''));

    expect(String(params.date).startsWith('ge')).toBe(true);
    expect(Math.round(DateTime.now().diff(since, 'years').years)).toBe(3);
    expect(params).toMatchObject({
      patient: 'Patient/patient-1',
      'status:not': 'entered-in-error',
      _sort: '-date',
      _count: 5,
      _revinclude: 'Encounter:appointment',
    });
    expect(params._include).toBeUndefined();
  });

  it('fails when the visits of a patient cannot be loaded', async () => {
    const { oystehr, search } = makeOystehr([appointment, encounter]);
    search.mockRejectedValueOnce(new Error('timeout'));

    await expect(getVisits(oystehr, [{ ...patient, id: 'patient-2' }, patient])).rejects.toThrow('timeout');
  });

  it('loads a selected visit that is no longer among the latest ones', async () => {
    const { oystehr, search } = makeOystehr([appointment, encounter]);
    search.mockResolvedValueOnce({ total: 0, entry: [], unbundle: () => [] });

    const visits = await getVisits(oystehr, [patient], 'appointment-1');

    expect(paramsOf(search, 1)).toMatchObject({
      _id: 'appointment-1',
      patient: 'Patient/patient-1',
      'status:not': 'entered-in-error',
    });
    expect(visits.map((visit) => visit.appointmentId)).toEqual(['appointment-1']);
  });

  it('does not search again when the selected visit is among the latest ones', async () => {
    const { oystehr, search } = makeOystehr([appointment, encounter]);
    await getVisits(oystehr, [patient], 'appointment-1');

    expect(search.mock.calls.filter(([input]) => (input as SearchInput).resourceType === 'Appointment')).toHaveLength(
      1
    );
  });

  it('searches the visits of every patient separately', async () => {
    const { oystehr, search } = makeOystehr([]);
    await getVisits(oystehr, [patient, { ...patient, id: 'patient-2' }]);

    expect(search).toHaveBeenCalledTimes(2);
    expect([paramsOf(search, 0).patient, paramsOf(search, 1).patient]).toEqual([
      'Patient/patient-1',
      'Patient/patient-2',
    ]);
  });

  it("labels a visit with the date in its location's timezone", async () => {
    const { oystehr, search } = makeOystehr([appointment, encounter]);
    const visits = await getVisits(oystehr, [patient]);

    expect(paramsOf(search, 1)).toMatchObject({ _id: 'location-1', _revinclude: 'Schedule:actor' });
    expect(visits).toEqual([
      {
        appointmentId: 'appointment-1',
        encounterId: 'encounter-1',
        patient,
        location: { id: 'location-1', name: 'Clinic' },
        providerId: undefined,
        label: 'Sarah Black 07/11/2026',
      },
    ]);
  });

  it('skips the location lookup when no visit has a location', async () => {
    const { oystehr, search } = makeOystehr([appointment, { ...encounter, location: undefined } as Encounter]);
    const visits = await getVisits(oystehr, [patient]);

    expect(search).toHaveBeenCalledTimes(1);
    expect(visits[0].location).toBeUndefined();
  });

  it('does not search without patients', async () => {
    const { oystehr, search } = makeOystehr([]);

    expect(await getVisits(oystehr, [])).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
