import { PlanDefinition } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOutreachTaskIdentityQuery,
  buildTaskInput,
  createOutreachTaskIdempotent,
  produceOutreachTasks,
} from '../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import type { OutreachAction } from '../../../src/rcm/scheduled-outreach-config/helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockSearch = vi.fn();
const mockGet = vi.fn();

const mockOystehrClient = {
  fhir: {
    create: mockCreate,
    search: mockSearch,
    get: mockGet,
    update: vi.fn(),
    patch: vi.fn(),
    transaction: vi.fn(),
  },
};

const mockPatientWithValidContacts = {
  resourceType: 'Patient',
  id: 'pat-1',
  telecom: [
    { system: 'phone', value: '2125551234' },
    { system: 'email', value: 'test@example.com' },
  ],
};

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    FEATURE_FLAGS_CONFIG: {
      automatedPatientOutreachEnabled: true,
      mailingPaperStatementsEnabled: true,
    },
  };
});

vi.mock('../../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getPatchBinary: vi.fn(({ resourceId, resourceType, patchOperations }) => ({
      method: 'PATCH',
      url: `/${resourceType}/${resourceId}`,
      resource: { resourceType: 'Binary', data: JSON.stringify(patchOperations) },
    })),
  };
});

function makePlanDefinition(actions: OutreachAction[]): PlanDefinition {
  return {
    resourceType: 'PlanDefinition',
    id: 'plan-1',
    status: 'active',
    url: 'https://ottehr.com/r4/PlanDefinition/scheduled-patient-outreach-workflow',
    name: 'ScheduledPatientOutreachWorkflow',
    meta: {
      tag: [
        { system: 'https://fhir.ottehr.com/r4/rcm', code: 'rcm' },
        { system: 'https://fhir.ottehr.com/r4/rcm', code: 'scheduled-outreach-config' },
      ],
    },
    action: actions.map((a) => ({
      id: a.id,
      code: [
        {
          coding: [{ system: 'https://ottehr.com/CodeSystem/outreach-action-type', code: a.actionType }],
        },
      ],
      trigger: [{ type: 'named-event', name: a.trigger.event }],
      ...(a.trigger.daysAfter > 0
        ? {
            relatedAction: [
              {
                actionId: 'start',
                relationship: a.trigger.direction === 'before' ? 'before' : 'after',
                offsetDuration: {
                  value: a.trigger.daysAfter,
                  unit: 'days',
                  system: 'http://unitsofmeasure.org',
                  code: 'd',
                },
              },
            ],
          }
        : {}),
      ...(a.actionType === 'send-notification' && a.sendNotificationConfig
        ? {
            action: a.sendNotificationConfig.mediums.map((m) => ({
              code: [{ coding: [{ system: 'https://ottehr.com/CodeSystem/notification-medium', code: m }] }],
              ...(m === 'sms' && a.sendNotificationConfig?.smsTemplate
                ? {
                    documentation: [
                      {
                        type: 'documentation',
                        label: 'sms-template',
                        document: {
                          contentType: 'text/plain',
                          data: Buffer.from(a.sendNotificationConfig.smsTemplate).toString('base64'),
                        },
                      },
                    ],
                  }
                : {}),
              ...(m === 'email' && a.sendNotificationConfig?.emailTemplate
                ? {
                    documentation: [
                      {
                        type: 'documentation',
                        label: 'email-template',
                        document: {
                          contentType: 'text/plain',
                          data: Buffer.from(a.sendNotificationConfig.emailTemplate).toString('base64'),
                        },
                      },
                    ],
                  }
                : {}),
            })),
          }
        : {}),
    })) as any[],
  };
}

function makeAction(overrides?: Partial<OutreachAction>): OutreachAction {
  return {
    id: 'action-1',
    trigger: { event: 'invoice-due', daysAfter: 7, timeUnit: 'days', direction: 'after' },
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums: ['sms'],
      smsTemplate: 'Pay now!',
      emailTemplate: '',
    },
    ...overrides,
  };
}

function mockBundle(resources: any[]): { unbundle: () => any[]; total: number; link: never[] } {
  return { unbundle: () => resources, total: resources.length, link: [] };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('produce-outreach-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockGet.mockResolvedValue(mockPatientWithValidContacts);
  });

  describe('buildTaskInput', () => {
    it('includes action-id, trigger-event, and action-type for all actions', () => {
      const action = makeAction();
      const inputs = buildTaskInput(action);

      expect(inputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: { text: 'action-id' }, valueString: 'action-1' }),
          expect.objectContaining({ type: { text: 'trigger-event' }, valueString: 'invoice-due' }),
          expect.objectContaining({ type: { text: 'action-type' }, valueString: 'send-notification' }),
        ])
      );
    });

    it('includes mediums and sms-template for send-notification', () => {
      const action = makeAction();
      const inputs = buildTaskInput(action);

      expect(inputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: { text: 'mediums' }, valueString: 'sms' }),
          expect.objectContaining({ type: { text: 'sms-template' }, valueString: 'Pay now!' }),
        ])
      );
    });

    it('includes charge-card-config for charge-card actions', () => {
      const action = makeAction({
        actionType: 'charge-card',
        sendNotificationConfig: undefined,
        chargeCardConfig: {
          retryAttempts: 2,
          retryIntervalDays: 3,
          onSuccess: { enabled: true, mediums: ['sms'], smsTemplate: 'Success!', emailTemplate: '' },
          onFailure: { enabled: false, mediums: [], smsTemplate: '', emailTemplate: '' },
        },
      });
      const inputs = buildTaskInput(action);

      const configInput = inputs!.find((i: any) => i.type?.text === 'charge-card-config');
      expect(configInput).toBeDefined();
      const parsed = JSON.parse(configInput!.valueString!);
      expect(parsed.retryAttempts).toBe(2);
      expect(parsed.retryIntervalDays).toBe(3);
      expect(parsed.onSuccess.enabled).toBe(true);
    });

    it('includes refer-to-collections-config for refer-to-collections actions', () => {
      const action = makeAction({
        actionType: 'refer-to-collections',
        sendNotificationConfig: undefined,
        referToCollectionsConfig: { agency: 'IC System', minimumBalance: 100, includePaymentHistory: true },
      });
      const inputs = buildTaskInput(action);

      const configInput = inputs!.find((i: any) => i.type?.text === 'refer-to-collections-config');
      expect(configInput).toBeDefined();
      const parsed = JSON.parse(configInput!.valueString!);
      expect(parsed.agency).toBe('IC System');
    });

    it('includes statement-type for send-notification with statementType', () => {
      const action = makeAction({
        sendNotificationConfig: {
          mediums: ['paper-mail'],
          smsTemplate: '',
          emailTemplate: '',
          statementType: 'past-due',
        },
      });
      const inputs = buildTaskInput(action);

      expect(inputs).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: { text: 'statement-type' }, valueString: 'past-due' })])
      );
    });
  });

  describe('produceOutreachTasks', () => {
    it('creates draft tasks for matching trigger events', async () => {
      const actions = [makeAction()];
      const planDef = makePlanDefinition(actions);

      // getOrCreateOutreachConfig returns the plan
      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      // findExistingOutreachTasks returns empty (no duplicates)
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      // create returns a task
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(1);
      expect(result.skipped).toHaveLength(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);

      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.resourceType).toBe('Task');
      expect(createdTask.status).toBe('draft');
      expect(createdTask.for).toEqual({ reference: 'Patient/pat-1' });
      expect(createdTask.focus).toEqual({ reference: 'Encounter/enc-1' });
    });

    it('skips actions when tasks already exist', async () => {
      const actions = [makeAction()];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      // Existing task with matching action-id
      mockSearch.mockResolvedValueOnce(
        mockBundle([
          {
            resourceType: 'Task',
            id: 'existing-task-1',
            status: 'draft',
            meta: {
              tag: [
                { system: 'https://fhir.zapehr.com/r4/StructureDefinitions/outreach-task/action-id', code: 'action-1' },
              ],
            },
          },
        ])
      );

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe('Task already exists');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('skips actions that do not match the trigger event', async () => {
      const actions = [makeAction({ trigger: { event: 'discharge-time', daysAfter: 0 } })];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });

    it('calculates due date time using days after', async () => {
      const actions = [
        makeAction({ trigger: { event: 'invoice-due', daysAfter: 7, timeUnit: 'days', direction: 'after' } }),
      ];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      const createdTask = mockCreate.mock.calls[0][0];
      const expectedDate = DateTime.fromISO('2025-01-15T10:00:00.000Z').plus({ days: 7 }).toISO();
      expect(createdTask.executionPeriod.start).toBe(expectedDate);
    });

    it('calculates due date time using "before" direction', async () => {
      const actions = [
        makeAction({ trigger: { event: 'patient-birthday', daysAfter: 3, timeUnit: 'days', direction: 'before' } }),
      ];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      await produceOutreachTasks({
        triggerEvent: 'patient-birthday',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Patient/pat-1' },
        eventTimestamp: '2025-06-15T00:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      const createdTask = mockCreate.mock.calls[0][0];
      const expectedDate = DateTime.fromISO('2025-06-15T00:00:00.000Z').minus({ days: 3 }).toISO();
      expect(createdTask.executionPeriod.start).toBe(expectedDate);
    });

    it('applies actionFilter when provided', async () => {
      const actions = [makeAction({ id: 'a1' }), makeAction({ id: 'a2' })];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
        actionFilter: (a: any) => a.id === 'a1',
      });

      expect(result.created).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('includes appointment in basedOn when provided', async () => {
      const actions = [makeAction()];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        appointment: { reference: 'Appointment/appt-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.basedOn).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reference: 'PlanDefinition/plan-1' }),
          expect.objectContaining({ reference: 'Appointment/appt-1' }),
        ])
      );
    });

    it('tags task with trigger event and action id', async () => {
      const actions = [makeAction()];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.meta.tag).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'invoice-due' }),
          expect.objectContaining({ code: 'action-1' }),
          expect.objectContaining({ code: 'rcm' }),
        ])
      );
    });

    it('creates cancelled task when patient has no valid phone for sms-only notification', async () => {
      const actions = [
        makeAction({ sendNotificationConfig: { mediums: ['sms'], smsTemplate: 'Pay!', emailTemplate: '' } }),
      ];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockGet.mockResolvedValue({ resourceType: 'Patient', id: 'pat-1', telecom: [] });
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'cancelled' });

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(1);
      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.status).toBe('cancelled');
      expect(createdTask.statusReason?.text).toContain('no valid phone number');
    });

    it('creates cancelled task when patient has invalid phone and no email for sms+email notification', async () => {
      const actions = [
        makeAction({
          sendNotificationConfig: { mediums: ['sms', 'email'], smsTemplate: 'Pay!', emailTemplate: 'Pay!' },
        }),
      ];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockGet.mockResolvedValue({
        resourceType: 'Patient',
        id: 'pat-1',
        telecom: [{ system: 'phone', value: '000' }],
      });
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'cancelled' });

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(1);
      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.status).toBe('cancelled');
      expect(createdTask.statusReason?.text).toContain('no valid phone number');
      expect(createdTask.statusReason?.text).toContain('no valid email address');
    });

    it('creates draft task when sms contact is invalid but email is valid', async () => {
      const actions = [
        makeAction({
          sendNotificationConfig: { mediums: ['sms', 'email'], smsTemplate: 'Pay!', emailTemplate: 'Pay!' },
        }),
      ];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockGet.mockResolvedValue({
        resourceType: 'Patient',
        id: 'pat-1',
        telecom: [{ system: 'email', value: 'test@example.com' }],
      });
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(1);
      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.status).toBe('draft');
    });

    it('creates draft task when electronic contacts are invalid but paper-mail is included', async () => {
      const actions = [
        makeAction({
          sendNotificationConfig: { mediums: ['sms', 'paper-mail'], smsTemplate: 'Pay!', emailTemplate: '' },
        }),
      ];
      const planDef = makePlanDefinition(actions);

      mockSearch.mockResolvedValueOnce(mockBundle([planDef]));
      mockSearch.mockResolvedValueOnce(mockBundle([]));
      mockGet.mockResolvedValue({ resourceType: 'Patient', id: 'pat-1', telecom: [] });
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: 'Patient/pat-1' },
        focus: { reference: 'Encounter/enc-1' },
        eventTimestamp: '2025-01-15T10:00:00.000Z',
        oystehr: mockOystehrClient as any,
      });

      expect(result.created).toHaveLength(1);
      const createdTask = mockCreate.mock.calls[0][0];
      expect(createdTask.status).toBe('draft');
    });
  });

  describe('buildOutreachTaskIdentityQuery', () => {
    it('encodes focus, trigger, action-id, and active statuses', () => {
      const query = buildOutreachTaskIdentityQuery({ reference: 'Encounter/enc-1' }, 'invoice-due', 'action-1');

      expect(query).toContain('focus=Encounter%2Fenc-1');
      expect(query).toContain('invoice-due');
      expect(query).toContain('action-id');
      expect(query).toContain('action-1');
      expect(query).toContain('status=draft,requested,in-progress,completed,failed');
      expect(query).not.toContain('birthday-year');
    });

    it('adds the birthday-year tag when provided', () => {
      const query = buildOutreachTaskIdentityQuery(
        { reference: 'Patient/pat-1' },
        'patient-birthday',
        'action-1',
        2025
      );

      expect(query).toContain('birthday-year');
      expect(query).toContain('2025');
    });
  });

  describe('createOutreachTaskIdempotent', () => {
    const taskDraft = { resourceType: 'Task', status: 'draft' } as any;

    it('falls back to a plain create when no raw FHIR connection is available', async () => {
      mockCreate.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'draft' });
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const outcome = await createOutreachTaskIdempotent(
        mockOystehrClient as any,
        taskDraft,
        'focus=Encounter%2Fenc-1'
      );

      expect(outcome).toEqual({ status: 'created', resource: { resourceType: 'Task', id: 'task-1', status: 'draft' } });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('issues a conditional-create transaction and reports created on 201', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          entry: [{ resource: { resourceType: 'Task', id: 'task-9' }, response: { status: '201 Created' } }],
        }),
        text: async () => '',
      });
      vi.stubGlobal('fetch', fetchSpy);

      const oystehrWithConn = {
        ...mockOystehrClient,
        config: { accessToken: 'tok', projectId: 'proj', services: { fhirApiUrl: 'https://fhir.example.com' } },
      };

      const outcome = await createOutreachTaskIdempotent(oystehrWithConn as any, taskDraft, 'focus=Encounter%2Fenc-1');

      expect(outcome).toEqual({ status: 'created', resource: { resourceType: 'Task', id: 'task-9' } });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://fhir.example.com/');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.type).toBe('transaction');
      expect(body.entry[0].request).toEqual({ method: 'POST', url: 'Task', ifNoneExist: 'focus=Encounter%2Fenc-1' });
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(init.headers['x-zapehr-project-id']).toBe('proj');
    });

    it('reports duplicate when the conditional create matches an existing task (200)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          entry: [{ resource: { resourceType: 'Task', id: 'existing-1' }, response: { status: '200 OK' } }],
        }),
        text: async () => '',
      });
      vi.stubGlobal('fetch', fetchSpy);

      const oystehrWithConn = {
        ...mockOystehrClient,
        config: { accessToken: 'tok', services: { fhirApiUrl: 'https://fhir.example.com' } },
      };

      const outcome = await createOutreachTaskIdempotent(oystehrWithConn as any, taskDraft, 'focus=Encounter%2Fenc-1');

      expect(outcome).toEqual({ status: 'duplicate' });
    });

    it('reports duplicate when the server returns 412 (multiple matches)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 412,
        json: async () => ({}),
        text: async () => 'Precondition Failed',
      });
      vi.stubGlobal('fetch', fetchSpy);

      const oystehrWithConn = {
        ...mockOystehrClient,
        config: { accessToken: 'tok', services: { fhirApiUrl: 'https://fhir.example.com' } },
      };

      const outcome = await createOutreachTaskIdempotent(oystehrWithConn as any, taskDraft, 'focus=Encounter%2Fenc-1');

      expect(outcome).toEqual({ status: 'duplicate' });
    });
  });
});
