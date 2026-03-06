import { Task } from 'fhir/r4b';
import { pageHarvestStrategy, TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { extractPatchIndex, extractQrId } from '../src/subscriptions/task/sub-harvest-paperwork/index';
import {
  executePageHarvest,
  HarvestContext,
  strategyHandlers,
} from '../src/subscriptions/task/sub-harvest-paperwork/page-handlers';

// Mock the harvest module so strategy handlers don't make real FHIR calls
vi.mock('../src/ehr/shared/harvest', () => ({
  createMasterRecordPatchOperations: vi.fn(() => ({
    patient: { patchOpsForDirectUpdate: [] },
  })),
  createUpdatePharmacyPatchOps: vi.fn(() => []),
  updatePatientAccountFromQuestionnaire: vi.fn(async () => {}),
  createDocumentResources: vi.fn(async () => {}),
  createConsentResources: vi.fn(async () => {}),
}));

vi.mock('../src/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared')>();
  return {
    ...actual,
    getAuth0Token: vi.fn(async () => 'mock-token'),
  };
});

// ── Helper: build a well-formed Task ──────────────────────────────────────

const buildTask = (overrides?: Partial<Task>): Task => ({
  resourceType: 'Task',
  status: 'requested',
  intent: 'order',
  focus: { reference: 'QuestionnaireResponse/test-qr-123' },
  input: [
    {
      type: {
        coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }],
      },
      valueUnsignedInt: 2,
    },
  ],
  ...overrides,
});

// ── extractPatchIndex ─────────────────────────────────────────────────────

describe('extractPatchIndex', () => {
  it('returns the correct index from a well-formed Task', () => {
    const task = buildTask();
    expect(extractPatchIndex(task)).toBe(2);
  });

  it('returns 0 when patchIndex is 0', () => {
    const task = buildTask({
      input: [
        {
          type: {
            coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }],
          },
          valueUnsignedInt: 0,
        },
      ],
    });
    expect(extractPatchIndex(task)).toBe(0);
  });

  it('throws when Task has no input array', () => {
    const task = buildTask({ input: undefined });
    expect(() => extractPatchIndex(task)).toThrow('Task is missing page-index input');
  });

  it('throws when Task input lacks the page-index coding', () => {
    const task = buildTask({
      input: [
        {
          type: { coding: [{ system: 'some-other-system', code: 'other' }] },
          valueUnsignedInt: 5,
        },
      ],
    });
    expect(() => extractPatchIndex(task)).toThrow('Task is missing page-index input');
  });

  it('throws when page-index input has no valueUnsignedInt', () => {
    const task = buildTask({
      input: [
        {
          type: {
            coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }],
          },
          // valueUnsignedInt intentionally omitted
        },
      ],
    });
    expect(() => extractPatchIndex(task)).toThrow('Task is missing page-index input');
  });
});

// ── extractQrId ───────────────────────────────────────────────────────────

describe('extractQrId', () => {
  it('returns QR ID from a well-formed Task focus', () => {
    const task = buildTask();
    expect(extractQrId(task)).toBe('test-qr-123');
  });

  it('throws when focus reference is missing', () => {
    const task = buildTask({ focus: undefined });
    expect(() => extractQrId(task)).toThrow('Task focus is not a QuestionnaireResponse');
  });

  it('throws when focus reference is not a QuestionnaireResponse', () => {
    const task = buildTask({ focus: { reference: 'Patient/abc' } });
    expect(() => extractQrId(task)).toThrow('Task focus is not a QuestionnaireResponse');
  });

  it('throws when focus has no reference string', () => {
    const task = buildTask({ focus: { display: 'some display' } });
    expect(() => extractQrId(task)).toThrow('Task focus is not a QuestionnaireResponse');
  });
});

// ── executePageHarvest dispatch ───────────────────────────────────────────

describe('executePageHarvest', () => {
  const mockOystehr = {
    fhir: {
      patch: vi.fn(async () => ({})),
      search: vi.fn(async () => ({ unbundle: () => [] })),
    },
  } as any;

  const buildContext = (pageLinkId: string): HarvestContext => ({
    qr: { resourceType: 'QuestionnaireResponse', status: 'completed', item: [] },
    pageLinkId,
    patient: { resourceType: 'Patient', id: 'pat-1' },
    encounter: { resourceType: 'Encounter', id: 'enc-1', status: 'in-progress', class: { code: 'AMB' } },
    appointment: { resourceType: 'Appointment', id: 'apt-1', status: 'booked', participant: [] },
    location: undefined,
    questionnaire: undefined,
    oystehr: mockOystehr,
    secrets: {} as any,
  });

  it('returns skip message for unmapped page linkIds', async () => {
    const result = await executePageHarvest(buildContext('medical-history-page'));
    expect(result).toContain('no harvest strategy registered');
    expect(result).toContain('medical-history-page');
  });

  it('dispatches master-record strategy for contact-information-page', async () => {
    const result = await executePageHarvest(buildContext('contact-information-page'));
    expect(result).toContain('master record updated');
    expect(result).toContain('contact-information-page');
  });

  it('dispatches pharmacy strategy for pharmacy-page', async () => {
    const result = await executePageHarvest(buildContext('pharmacy-page'));
    expect(result).toBe('pharmacy updated');
  });

  it('dispatches account-coverage strategy for payment-option-page', async () => {
    const result = await executePageHarvest(buildContext('payment-option-page'));
    expect(result).toBe('account / coverage updated');
  });

  it('dispatches documents strategy for photo-id-page', async () => {
    const result = await executePageHarvest(buildContext('photo-id-page'));
    expect(result).toBe('documents created');
  });

  it('dispatches consent strategy for consent-forms-page', async () => {
    const result = await executePageHarvest(buildContext('consent-forms-page'));
    expect(result).toBe('consent resources created');
  });
});

// ── Strategy completeness ─────────────────────────────────────────────────

describe('pageHarvestStrategy completeness', () => {
  it('every strategy referenced in pageHarvestStrategy has a handler in strategyHandlers', () => {
    const strategies = new Set(Object.values(pageHarvestStrategy));
    for (const strategy of strategies) {
      expect(strategyHandlers).toHaveProperty(strategy);
    }
  });
});
