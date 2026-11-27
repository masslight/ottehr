import Oystehr from '@oystehr/sdk';
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
import {
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  TASK_INPUT_SYSTEM,
  TASK_LOCATION_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import {
  SUPPORT_CHAT_NO_VISIT_OPTION_ID,
  SupportChatMessageKind,
  SupportChatTopic,
} from 'utils/lib/types/api/support-chat.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { MANUAL_TASK, PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { findActivePromptIndex } from 'utils/lib/utils/support-chat';
import { describe, expect, it, vi } from 'vitest';
import { BOT_TEXT, BotVisit, resolveStep, ResolveStepInput } from '../../src/shared/support-chat/bot';
import {
  buildRequestTask,
  buildRequestTitle,
  canAutoAssign,
  findLatestVisitLocation,
  getDefaultPatientId,
  getVisitProviderOwner,
  getVisits,
  moveRequestTask,
  Visit,
} from '../../src/shared/support-chat/request-task';
import { buildThreadMessage, getLastThreadMessage, ThreadMessage } from '../../src/shared/support-chat/thread';

const SARAH = { id: 'patient-sarah', label: 'Sarah Black' };
const OLIVER = { id: 'patient-oliver', label: 'Oliver Black' };
const NEW_PATIENT = { id: 'patient-new', label: 'Nina Black' };
const patients = [SARAH, OLIVER, NEW_PATIENT];

const visits: BotVisit[] = [
  { id: 'appointment-1', patientId: SARAH.id, label: 'Sarah Black 07/11/2026', date: '07/11/2026' },
  { id: 'appointment-2', patientId: OLIVER.id, label: 'Oliver Black 07/09/2026', date: '07/09/2026' },
  { id: 'appointment-3', patientId: SARAH.id, label: 'Sarah Black 04/22/2026', date: '04/22/2026' },
];

const greeting: ThreadMessage = { kind: 'greeting', options: [] };
const confirmation: ThreadMessage = { kind: 'confirmation', options: [] };
const text: ThreadMessage = { kind: 'text', options: [] };
const sarahVisitOptions = [
  { id: 'appointment-1', label: '07/11/2026' },
  { id: 'appointment-3', label: '04/22/2026' },
  { id: SUPPORT_CHAT_NO_VISIT_OPTION_ID, label: BOT_TEXT.noVisit },
];

const topicPatientPrompt: ThreadMessage = {
  kind: 'patient-prompt',
  topic: SupportChatTopic.prescriptionRefill,
  options: patients,
};
const topicVisitPrompt: ThreadMessage = {
  kind: 'visit-prompt',
  topic: SupportChatTopic.prescriptionRefill,
  patientId: SARAH.id,
  options: sarahVisitOptions,
};
const textPatientPrompt: ThreadMessage = {
  kind: 'patient-prompt',
  requestText: 'Fax it',
  patientId: SARAH.id,
  taskId: 'task-1',
  options: patients,
};
const textVisitPrompt: ThreadMessage = {
  kind: 'visit-prompt',
  requestText: 'Fax it',
  patientId: SARAH.id,
  taskId: 'task-1',
  options: sarahVisitOptions,
};

const step = (input: Partial<ResolveStepInput> & Pick<ResolveStepInput, 'action'>): ReturnType<typeof resolveStep> =>
  resolveStep({ last: greeting, patients, visits, hasOpenTask: false, ...input });

const kinds = (result: ReturnType<typeof resolveStep>): SupportChatMessageKind[] =>
  result.messages.map((message) => message.kind);

describe('support chat bot', () => {
  it('stores the greeting before the first action of an empty thread', () => {
    const result = step({
      last: undefined,
      action: { action: 'select-topic', topic: SupportChatTopic.schoolWorkNote },
    });

    expect(kinds(result)).toEqual(['greeting', 'recap', 'patient-prompt']);
    expect(result.task).toBeUndefined();
  });

  it('starts a new request with the greeting', () => {
    const result = step({ last: text, action: { action: 'new-request' }, hasOpenTask: true });

    expect(kinds(result)).toEqual(['greeting']);
    expect(result.messages[0].options?.map((o) => o.label)).toEqual([
      'Prescription Refill',
      'School/Work Note',
      'Medical Record',
    ]);
  });

  describe('topic request', () => {
    const selectTopic = { action: 'select-topic' as const, topic: SupportChatTopic.prescriptionRefill };

    it('asks who the request is for, listing every patient', () => {
      const result = step({ action: selectTopic });

      expect(kinds(result)).toEqual(['recap', 'patient-prompt']);
      expect(result.messages[1]).toMatchObject({ text: BOT_TEXT.patientPrompt, options: patients });
      expect(result.task).toBeUndefined();
    });

    it('does not ask about the patient on a single-patient account', () => {
      const result = step({ action: selectTopic, patients: [SARAH] });

      expect(kinds(result)).toEqual(['recap', 'visit-prompt']);
      expect(result.patientId).toBe(SARAH.id);
    });

    it("asks for one of the chosen patient's visits", () => {
      const result = step({ last: topicPatientPrompt, action: { action: 'select-patient', patientId: SARAH.id } });

      expect(result.messages[0].text).toBe('Specified: Prescription Refill for Sarah Black');
      expect(result.messages[1]).toMatchObject({ kind: 'visit-prompt', options: sarahVisitOptions });
      expect(result.patientId).toBe(SARAH.id);
      expect(result.task).toBeUndefined();
    });

    it('asks for the visit even when the patient has one visit', () => {
      const result = step({ last: topicPatientPrompt, action: { action: 'select-patient', patientId: OLIVER.id } });

      expect(kinds(result)).toEqual(['recap', 'visit-prompt']);
      expect(result.messages[1].options).toHaveLength(2);
      expect(result.task).toBeUndefined();
    });

    it('registers the request when the chosen patient has no visits', () => {
      const result = step({
        last: topicPatientPrompt,
        action: { action: 'select-patient', patientId: NEW_PATIENT.id },
      });

      expect(kinds(result)).toEqual(['recap', 'confirmation']);
      expect(result.task).toEqual({
        type: 'create',
        code: SupportChatTopic.prescriptionRefill,
        patientId: NEW_PATIENT.id,
        appointmentId: undefined,
        text: undefined,
        details: undefined,
      });
    });

    it('registers the request at once for a single patient without visits', () => {
      const result = step({ action: selectTopic, patients: [NEW_PATIENT] });

      expect(kinds(result)).toEqual(['recap', 'confirmation']);
      expect(result.task).toMatchObject({ type: 'create', patientId: NEW_PATIENT.id });
    });

    it('creates the task for the selected visit', () => {
      const result = step({
        last: topicVisitPrompt,
        action: { action: 'select-visit', appointmentId: 'appointment-1' },
      });

      expect(result.messages.map((m) => m.text)).toEqual([
        'Specified: Prescription Refill for the visit of Sarah Black 07/11/2026',
        BOT_TEXT.confirmation,
      ]);
      expect(result.task).toMatchObject({ type: 'create', patientId: SARAH.id, appointmentId: 'appointment-1' });
    });

    it('creates the task without a visit when the patient says it is not about a visit', () => {
      const action = { action: 'select-visit' as const, appointmentId: SUPPORT_CHAT_NO_VISIT_OPTION_ID };
      const result = step({ last: topicVisitPrompt, action });

      expect(result.messages[0].text).toBe('Specified: Not about a specific visit');
      expect(result.task).toMatchObject({ type: 'create', patientId: SARAH.id, appointmentId: undefined });
    });

    it('creates the task without a visit when the patient types instead of selecting a visit', () => {
      const result = step({ last: topicVisitPrompt, action: { action: 'text', text: 'Asap' }, hasOpenTask: true });

      expect(kinds(result)).toEqual(['text', 'confirmation']);
      expect(result.task).toMatchObject({ type: 'create', appointmentId: undefined, details: 'Asap' });
    });

    it('only saves text typed instead of selecting a patient', () => {
      const result = step({ last: topicPatientPrompt, action: { action: 'text', text: 'Hm' }, hasOpenTask: true });

      expect(kinds(result)).toEqual(['text']);
      expect(result.task).toBeUndefined();
    });

    it('uses the patient of the visit for an old prompt without a patient', () => {
      const legacy: ThreadMessage = {
        ...topicVisitPrompt,
        patientId: undefined,
        options: [{ id: 'appointment-2', label: 'Oliver Black 07/09/2026' }],
      };
      const result = step({ last: legacy, action: { action: 'select-visit', appointmentId: 'appointment-2' } });

      expect(result.task).toMatchObject({ type: 'create', patientId: OLIVER.id, appointmentId: 'appointment-2' });
    });
  });

  describe('free-text request', () => {
    it('creates the task at once for the default patient and asks who it is for', () => {
      const result = step({
        action: { action: 'text', text: 'Fax it' },
        defaultPatientId: OLIVER.id,
        hasOpenTask: true,
      });

      expect(kinds(result)).toEqual(['text', 'patient-prompt']);
      expect(result.messages[1].requestText).toBe('Fax it');
      expect(result.patientId).toBe(OLIVER.id);
      expect(result.task).toEqual({
        type: 'create',
        code: PATIENT_REQUEST_TASK.code.followUp,
        patientId: OLIVER.id,
        text: 'Fax it',
      });
    });

    it('falls back to the first patient when the default patient is not on the account', () => {
      const result = step({ last: text, action: { action: 'text', text: 'Hi' }, defaultPatientId: 'gone' });
      expect(result.task).toMatchObject({ type: 'create', patientId: SARAH.id });
    });

    it('creates the task and asks for the visit on a single-patient account', () => {
      const result = step({ action: { action: 'text', text: 'Hi' }, patients: [SARAH] });

      expect(kinds(result)).toEqual(['text', 'visit-prompt']);
      expect(result.task).toMatchObject({ type: 'create', patientId: SARAH.id });
      expect(result.task).not.toHaveProperty('appointmentId');
    });

    it('registers the request at once for a single patient without visits', () => {
      const result = step({ action: { action: 'text', text: 'Hi' }, patients: [NEW_PATIENT] });

      expect(kinds(result)).toEqual(['text', 'confirmation']);
      expect(result.task).toMatchObject({ type: 'create', patientId: NEW_PATIENT.id });
    });

    it('moves the task to the selected patient and asks for the visit', () => {
      const result = step({ last: textPatientPrompt, action: { action: 'select-patient', patientId: OLIVER.id } });

      expect(result.messages[0].text).toBe('Selected: Oliver Black');
      expect(kinds(result)).toEqual(['recap', 'visit-prompt']);
      expect(result.task).toEqual({ type: 'update', patientId: OLIVER.id, text: 'Fax it' });
    });

    it('registers the request when the selected patient has no visits', () => {
      const result = step({ last: textPatientPrompt, action: { action: 'select-patient', patientId: NEW_PATIENT.id } });

      expect(kinds(result)).toEqual(['recap', 'confirmation']);
      expect(result.task).toMatchObject({ type: 'update', patientId: NEW_PATIENT.id, appointmentId: undefined });
    });

    it('sets the selected visit on the task', () => {
      const result = step({
        last: textVisitPrompt,
        action: { action: 'select-visit', appointmentId: 'appointment-3' },
      });

      expect(result.messages[0].text).toBe('Initiated request: Fax it for Sarah Black 04/22/2026');
      expect(result.task).toEqual({
        type: 'update',
        patientId: SARAH.id,
        appointmentId: 'appointment-3',
        text: 'Fax it',
      });
    });

    it('keeps the task without a visit when the patient says it is not about a visit', () => {
      const action = { action: 'select-visit' as const, appointmentId: SUPPORT_CHAT_NO_VISIT_OPTION_ID };
      const result = step({ last: textVisitPrompt, action });

      expect(result.messages[0].text).toBe('Initiated request: Fax it for Sarah Black');
      expect(result.task).toMatchObject({ type: 'update', patientId: SARAH.id, appointmentId: undefined });
    });

    it.each([textPatientPrompt, textVisitPrompt])(
      'adds text typed at a bot prompt to its own task, not to another open task',
      (last) => {
        const result = step({ last, action: { action: 'text', text: 'More' }, hasOpenTask: true });

        expect(kinds(result)).toEqual(['text']);
        expect(result.task).toEqual({ type: 'attach', text: 'More', taskId: 'task-1' });
      }
    );
  });

  it('attaches text to the open task and acknowledges only the first details', () => {
    const first = step({ last: confirmation, action: { action: 'text', text: 'a' }, hasOpenTask: true });
    expect(first.messages.map((m) => m.text)).toEqual(['a', BOT_TEXT.ack]);
    expect(first.task).toEqual({ type: 'attach', text: 'a' });

    const next = step({ last: text, action: { action: 'text', text: 'b' }, hasOpenTask: true });
    expect(next.messages.map((m) => m.text)).toEqual(['b']);
  });

  it('attaches text to an old free-text prompt without a stored request text only through the open task', () => {
    const legacy: ThreadMessage = { kind: 'visit-prompt', taskId: 'task-1', options: sarahVisitOptions };
    const result = step({ last: legacy, action: { action: 'text', text: 'x' }, hasOpenTask: true });

    expect(result.task).toEqual({ type: 'attach', text: 'x' });
  });

  it.each([
    [text, { action: 'select-topic' as const, topic: SupportChatTopic.prescriptionRefill }],
    [greeting, { action: 'select-visit' as const, appointmentId: 'appointment-1' }],
    [topicVisitPrompt, { action: 'select-visit' as const, appointmentId: 'appointment-2' }],
    [topicPatientPrompt, { action: 'select-patient' as const, patientId: 'patient-other' }],
    [topicVisitPrompt, { action: 'select-patient' as const, patientId: SARAH.id }],
  ])('rejects an action that does not match the active prompt', (last, action) => {
    expect(() => step({ last, action })).toThrow();
  });

  it('rejects a chip whose visit is no longer available', () => {
    const action = { action: 'select-visit' as const, appointmentId: 'appointment-1' };
    expect(() => step({ last: topicVisitPrompt, action, visits: [visits[1]] })).toThrow();
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

  it('moves from the patient prompt to the visit prompt', () => {
    expect(findActivePromptIndex(['greeting', 'recap', 'patient-prompt'])).toBe(2);
    expect(findActivePromptIndex(['greeting', 'recap', 'patient-prompt', 'recap', 'visit-prompt'])).toBe(4);
  });
});

describe('getLastThreadMessage', () => {
  const message = (
    input: Partial<Parameters<typeof buildThreadMessage>[0]> & { kind: SupportChatMessageKind }
  ): Communication =>
    buildThreadMessage({ threadId: 'thread-1', text: '', sent: '2026-07-01T00:00:00.000Z', ...input });

  it('returns nothing for an empty thread', () => {
    expect(getLastThreadMessage([])).toBeUndefined();
  });

  it('returns the active prompt even when texts follow it', () => {
    const thread = [message({ kind: 'greeting' }), message({ kind: 'text', text: 'hi' })];
    expect(getLastThreadMessage(thread)?.kind).toBe('greeting');
  });

  it('returns the last message when the prompt is answered', () => {
    const thread = [message({ kind: 'visit-prompt' }), message({ kind: 'confirmation' }), message({ kind: 'text' })];
    expect(getLastThreadMessage(thread)?.kind).toBe('text');
  });

  it('reads the request state stored in a prompt', () => {
    const prompt = message({
      kind: 'visit-prompt',
      requestText: 'Fax it',
      patientId: SARAH.id,
      taskReference: 'Task/task-1',
    });

    expect(getLastThreadMessage([prompt])).toMatchObject({
      requestText: 'Fax it',
      patientId: SARAH.id,
      taskId: 'task-1',
    });
  });

  it('restores the request text of an old free-text prompt from the message before it', () => {
    const thread = [message({ kind: 'text', text: 'Fax it' }), message({ kind: 'visit-prompt', patientId: SARAH.id })];
    expect(getLastThreadMessage(thread)?.requestText).toBe('Fax it');
  });

  it('does not restore a request text for a topic prompt', () => {
    const thread = [
      message({ kind: 'text', text: 'other' }),
      message({ kind: 'visit-prompt', topic: SupportChatTopic.medicalRecord }),
    ];
    expect(getLastThreadMessage(thread)?.requestText).toBeUndefined();
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
    date: '07/11/2026',
    label: 'Sarah Black 07/11/2026',
  };
  const otherVisit: Visit = {
    appointmentId: 'appointment-2',
    encounterId: 'encounter-2',
    patient,
    location: { id: 'location-2', name: 'Other clinic' },
    providerId: 'practitioner-2',
    date: '07/09/2026',
    label: 'Sarah Black 07/09/2026',
  };
  const oliver: Patient = { resourceType: 'Patient', id: 'patient-2', name: [{ given: ['Oliver'], family: 'Black' }] };
  const inputCodes = (task: Task): string[] =>
    (task.input ?? []).flatMap((input) =>
      (input.type.coding ?? [])
        .filter((coding) => coding.system === TASK_INPUT_SYSTEM)
        .map((coding) => coding.code ?? '')
    );
  const locationTags = (task: Task): unknown[] =>
    (task.meta?.tag ?? []).filter((tag) => tag.system === TASK_LOCATION_SYSTEM);
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

  const buildWithoutVisit = (location?: Visit['location'], target: Patient = patient): Task =>
    buildRequestTask({
      code: PATIENT_REQUEST_TASK.code.followUp,
      threadId: 'thread-1',
      patient: target,
      location,
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

    it('creates a task without a visit at the given location', () => {
      const task = buildRequestTask({
        code: SupportChatTopic.prescriptionRefill,
        threadId: 'thread-1',
        patient,
        location: { id: 'location-2', name: 'Other clinic' },
      });

      expect(task.description).toBe('Prescription Refill for Sarah Black');
      expect(task.encounter).toBeUndefined();
      expect(task.location).toEqual({ reference: 'Location/location-2', display: 'Other clinic' });
      expect(locationTags(task)).toHaveLength(1);
      expect(inputCodes(task)).not.toContain(MANUAL_TASK.input.appointmentId);
      expect(inputCodes(task)).not.toContain(MANUAL_TASK.input.encounterId);
    });

    it('creates a task without a visit and without a location', () => {
      const task = buildWithoutVisit();

      expect(task.location).toBeUndefined();
      expect(locationTags(task)).toHaveLength(0);
    });

    it("uses the visit's location even when another location is given", () => {
      const task = buildRequestTask({
        code: SupportChatTopic.prescriptionRefill,
        threadId: 'thread-1',
        patient,
        visit,
        location: { id: 'location-2' },
      });

      expect(task.location?.reference).toBe('Location/location-1');
    });
  });

  describe('canAutoAssign', () => {
    const visits = [visit, otherVisit];

    it('allows an unassigned task', () => {
      expect(canAutoAssign(build(), visits)).toBe(true);
    });

    it("allows a task still assigned to its linked visit's provider", () => {
      expect(canAutoAssign(build({ owner: owner('practitioner-1') }), visits)).toBe(true);
    });

    it('keeps a task staff reassigned to someone else', () => {
      expect(canAutoAssign(build({ owner: owner('practitioner-9') }), visits)).toBe(false);
    });

    it('keeps a task whose linked visit is unknown', () => {
      expect(canAutoAssign(build({ owner: owner('practitioner-1') }), [otherVisit])).toBe(false);
    });

    it('keeps a completed task', () => {
      expect(canAutoAssign({ ...build(), status: 'completed' }, visits)).toBe(false);
    });

    it('allows an unassigned task without a visit', () => {
      expect(canAutoAssign(buildWithoutVisit(), visits)).toBe(true);
    });

    it('keeps a task without a visit that staff assigned', () => {
      expect(canAutoAssign({ ...buildWithoutVisit(), owner: owner('practitioner-9') }, visits)).toBe(false);
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

    it('moves a task to another patient without a visit', () => {
      const task = { ...withTag(build()), id: 'task-1' };
      const moved = moveRequestTask(task, buildWithoutVisit({ id: 'location-2', name: 'Other clinic' }, oliver), true);

      expect(moved.id).toBe('task-1');
      expect(moved.encounter).toBeUndefined();
      expect(moved.description).toBe('“Hi” for Oliver Black');
      expect(moved.location?.reference).toBe('Location/location-2');
      expect(locationTags(moved)).toEqual([
        { system: TASK_LOCATION_SYSTEM, code: 'location-2', display: 'Other clinic' },
      ]);
      expect(inputCodes(moved)).not.toContain(MANUAL_TASK.input.appointmentId);
      expect(moved.input?.find((input) => input.valueReference)?.valueReference?.reference).toBe('Patient/patient-2');
      expect(moved.meta?.tag).toEqual(
        expect.arrayContaining(task.meta!.tag!.filter((tag) => tag.system !== TASK_LOCATION_SYSTEM))
      );
    });

    it('drops the location when the new patient has no visits', () => {
      const moved = moveRequestTask(build(), buildWithoutVisit(undefined, oliver), true);

      expect(moved.location).toBeUndefined();
      expect(locationTags(moved)).toHaveLength(0);
    });

    it('does not assign a task when only the patient is chosen', () => {
      const moved = moveRequestTask(buildWithoutVisit(), buildWithoutVisit(undefined, oliver), true);

      expect(moved.status).toBe('ready');
      expect(moved.owner).toBeUndefined();
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

describe('findLatestVisitLocation', () => {
  const visitOf = (patientId: string, locationId?: string): Visit =>
    ({
      appointmentId: `appointment-${patientId}-${locationId}`,
      encounterId: 'encounter',
      patient: { resourceType: 'Patient', id: patientId },
      location: locationId ? { id: locationId } : undefined,
      date: '01/01/2026',
      label: '',
    }) as Visit;

  const visits = [
    visitOf('patient-2', 'location-other'),
    visitOf('patient-1', 'location-new'),
    visitOf('patient-1', 'location-old'),
  ];

  it("returns the location of the patient's latest visit and ignores other patients", () => {
    expect(findLatestVisitLocation(visits, 'patient-1')).toEqual({ id: 'location-new' });
  });

  it('returns nothing without visits or a patient', () => {
    expect(findLatestVisitLocation(visits, 'patient-3')).toBeUndefined();
    expect(findLatestVisitLocation(visits, undefined)).toBeUndefined();
  });
});

describe('getDefaultPatientId', () => {
  const communication = (input: { subject?: string; about?: string }): Communication => ({
    resourceType: 'Communication',
    status: 'completed',
    subject: input.subject ? { reference: `Patient/${input.subject}` } : undefined,
    about: input.about ? [{ reference: input.about }] : undefined,
  });
  const visits = [{ patient: { resourceType: 'Patient', id: 'patient-visit' } }] as Visit[];

  it('takes the patient of the last task in the thread', () => {
    const thread = [
      communication({ subject: 'patient-1', about: 'Task/task-1' }),
      communication({ subject: 'patient-2', about: 'Task/task-2' }),
      communication({ subject: 'patient-3' }),
    ];
    expect(getDefaultPatientId(thread, visits)).toBe('patient-2');
  });

  it('falls back to the patient of the newest visit, then to nothing', () => {
    expect(getDefaultPatientId([communication({ subject: 'patient-3' })], visits)).toBe('patient-visit');
    expect(getDefaultPatientId([], [])).toBeUndefined();
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

  type SearchInput = { resourceType: string; params: { name: string; value: string }[] };

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

  const paramsOf = (search: ReturnType<typeof vi.fn>, call: number): Record<string, string> =>
    Object.fromEntries((search.mock.calls[call][0] as SearchInput).params.map((param) => [param.name, param.value]));

  it('loads only the last three years of visits with their encounters', async () => {
    const { oystehr, search } = makeOystehr([appointment, encounter]);
    await getVisits(oystehr, [patient]);

    const params = paramsOf(search, 0);
    const since = DateTime.fromISO(params.date.replace('ge', ''));

    expect(params.date.startsWith('ge')).toBe(true);
    expect(Math.round(DateTime.now().diff(since, 'years').years)).toBe(3);
    expect(params.patient).toBe('Patient/patient-1');
    expect(params._revinclude).toBe('Encounter:appointment');
    expect(params._include).toBeUndefined();
    expect(params._count).toBe('200');
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
        date: '07/11/2026',
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
