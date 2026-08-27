import { Appointment, QuestionnaireResponse, Task } from 'fhir/r4b';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM, TaskIndicator } from 'utils/lib/types/common';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { index } from '../../src/patient/paperwork/patch-paperwork';
import { PatchPaperworkEffectInput, validatePatchInputs } from '../../src/patient/paperwork/validateRequestParameters';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { ZambdaInput } from '../../src/shared/types/common';

/**
 * Behavior tests for the patch-paperwork effect: the QuestionnaireResponse patch shape,
 * the consent-forms-page status forcing, the per-page harvest Task creation with its
 * dedup against already-active tasks, the silent skip for pages with no registered
 * harvest strategy, and the telemed appointment arrival transition. Validation is mocked
 * (covered by its own suites); everything downstream of it runs for real against a mocked
 * FHIR client.
 */

vi.mock('@sentry/aws-serverless', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sentry/aws-serverless')>();
  return { ...original, wrapHandler: (handler: unknown) => handler, captureException: vi.fn() };
});

vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn().mockResolvedValue('m2m-token') }));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shared/helpers')>();
  return { ...original, createClinicalOystehrClient: vi.fn() };
});

vi.mock('../../src/patient/paperwork/validateRequestParameters', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/patient/paperwork/validateRequestParameters')>();
  return { ...original, validatePatchInputs: vi.fn() };
});

const mockValidatePatchInputs = vi.mocked(validatePatchInputs);
const mockCreateClient = vi.mocked(createClinicalOystehrClient);

const UPDATED_QR: QuestionnaireResponse = { resourceType: 'QuestionnaireResponse', id: 'qr-1', status: 'in-progress' };

interface OystehrMock {
  fhir: {
    patch: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
}

const makeOystehr = (existingTasks: Task[] = [], appointment?: Appointment): OystehrMock => ({
  fhir: {
    patch: vi.fn(async (args: { resourceType: string }) =>
      args.resourceType === 'QuestionnaireResponse' ? UPDATED_QR : {}
    ),
    search: vi.fn().mockResolvedValue({ unbundle: () => existingTasks }),
    create: vi.fn(async (resource: unknown) => resource),
    get: vi.fn(async () => appointment ?? { resourceType: 'Appointment', id: 'appt-1', status: 'booked' }),
  },
});

const effectInput = (overrides: Partial<PatchPaperworkEffectInput> = {}): PatchPaperworkEffectInput => ({
  submittedAnswer: { linkId: 'contact-information-page', item: [] },
  updatedAnswers: [{ linkId: 'patient-first-name', answer: [{ valueString: 'Pat' }] }],
  patchIndex: 2,
  questionnaireResponseId: 'qr-1',
  currentQRStatus: 'in-progress',
  ...overrides,
});

const harvestTask = (pageIndex: number): Task => ({
  resourceType: 'Task',
  status: 'requested',
  intent: 'order',
  input: [
    {
      type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }] },
      valueUnsignedInt: pageIndex,
    },
  ],
});

const ZAMBDA_INPUT = { body: '{}', headers: {}, secrets: { ENVIRONMENT: 'testing' } } as unknown as ZambdaInput;

const invoke = async (oystehr: OystehrMock, input: PatchPaperworkEffectInput): Promise<{ statusCode: number }> => {
  mockCreateClient.mockReturnValue(oystehr as never);
  mockValidatePatchInputs.mockResolvedValue(input);
  return (index as unknown as (i: ZambdaInput) => Promise<{ statusCode: number }>)(ZAMBDA_INPUT);
};

beforeEach(() => {
  mockValidatePatchInputs.mockReset();
  mockCreateClient.mockReset();
});

describe('patch-paperwork effect', () => {
  test('patches the page answers into the QR and creates a harvest task for the page index', async () => {
    const oystehr = makeOystehr();
    const input = effectInput();
    const result = await invoke(oystehr, input);

    expect(result.statusCode).toBe(200);
    expect(oystehr.fhir.patch).toHaveBeenCalledTimes(1);
    expect(oystehr.fhir.patch.mock.calls[0][0]).toEqual({
      id: 'qr-1',
      resourceType: 'QuestionnaireResponse',
      operations: [{ op: 'add', path: '/item/2/item', value: input.updatedAnswers }],
    });

    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Task',
      params: [
        { name: 'code', value: `${TaskIndicator.harvestPaperwork.system}|${TaskIndicator.harvestPaperwork.code}` },
        { name: 'focus', value: 'QuestionnaireResponse/qr-1' },
        { name: 'status', value: 'requested,in-progress' },
      ],
    });
    expect(oystehr.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        code: { coding: [{ ...TaskIndicator.harvestPaperwork }] },
        focus: { reference: 'QuestionnaireResponse/qr-1' },
        input: [
          {
            type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }] },
            valueUnsignedInt: 2,
          },
        ],
      })
    );
  });

  test('skips task creation when an active task already covers the same page index', async () => {
    const oystehr = makeOystehr([harvestTask(2)]);
    await invoke(oystehr, effectInput({ patchIndex: 2 }));
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  test('still creates a task when active tasks cover only other page indexes', async () => {
    const oystehr = makeOystehr([harvestTask(3)]);
    await invoke(oystehr, effectInput({ patchIndex: 2 }));
    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
  });

  // The registry gate: a page with no entry in pageHarvestStrategy silently never
  // harvests. The certification lint makes this a hard failure for harvestable pages;
  // here we pin the runtime behavior the lint protects against.
  test('creates no task for a page with no registered harvest strategy', async () => {
    const oystehr = makeOystehr();
    await invoke(oystehr, effectInput({ submittedAnswer: { linkId: 'not-a-mapped-page', item: [] } }));
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  test('a completed QR flips to amended when a page is re-saved', async () => {
    const oystehr = makeOystehr();
    await invoke(oystehr, effectInput({ currentQRStatus: 'completed' }));
    expect(oystehr.fhir.patch.mock.calls[0][0].operations).toEqual([
      { op: 'add', path: '/item/2/item', value: effectInput().updatedAnswers },
      { op: 'replace', path: '/status', value: 'amended' },
    ]);
  });

  test('the consent page forces the QR to completed and stamps authored', async () => {
    const oystehr = makeOystehr();
    await invoke(oystehr, effectInput({ submittedAnswer: { linkId: 'consent-forms-page', item: [] } }));
    const operations = oystehr.fhir.patch.mock.calls[0][0].operations;
    expect(operations).toContainEqual({ op: 'replace', path: '/status', value: 'completed' });
    expect(operations).toContainEqual({ op: 'add', path: '/authored', value: expect.any(String) });
  });

  test('saving the consent page moves a proposed telemed appointment to arrived', async () => {
    const telemedProposed: Appointment = {
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'proposed',
      participant: [{ status: 'accepted' }],
      meta: { tag: [{ code: OTTEHR_MODULE.TM }] },
    };
    const oystehr = makeOystehr([], telemedProposed);
    await invoke(
      oystehr,
      effectInput({ submittedAnswer: { linkId: 'consent-forms-page', item: [] }, appointmentId: 'appt-1' })
    );
    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      id: 'appt-1',
      resourceType: 'Appointment',
      operations: [{ op: 'replace', path: '/status', value: 'arrived' }],
    });
  });

  test('leaves a non-telemed appointment untouched on consent save', async () => {
    const inPersonProposed: Appointment = {
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'proposed',
      participant: [{ status: 'accepted' }],
      meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
    };
    const oystehr = makeOystehr([], inPersonProposed);
    await invoke(
      oystehr,
      effectInput({ submittedAnswer: { linkId: 'consent-forms-page', item: [] }, appointmentId: 'appt-1' })
    );
    const appointmentPatches = oystehr.fhir.patch.mock.calls.filter((call) => call[0].resourceType === 'Appointment');
    expect(appointmentPatches).toHaveLength(0);
  });

  // Harvest-task failures must never block the patient: the QR patch already succeeded
  // and the error is swallowed (and reported) so paperwork can continue.
  test('a task-creation failure does not fail the request', async () => {
    const oystehr = makeOystehr();
    oystehr.fhir.create.mockRejectedValue(new Error('task service down'));
    const result = await invoke(oystehr, effectInput());
    expect(result.statusCode).toBe(200);
  });
});
