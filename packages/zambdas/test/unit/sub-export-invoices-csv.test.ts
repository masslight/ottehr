import { Account, Appointment, Bundle, Encounter, Patient, RelatedPerson, Slot, Task as FhirTask } from 'fhir/r4b';
import { EXPORT_INVOICES_CSV_TASK_SYSTEM, PATIENT_BILLING_ACCOUNT_TYPE, RCM_TASK_SYSTEM, RcmTaskCode } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const mockCreatePresignedUrl = vi.fn();
vi.mock('../../src/shared/z3Utils', () => ({
  createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
}));

const mockMakeZ3Url = vi.fn();
vi.mock('../../src/shared/presigned-file-urls', () => ({
  makeZ3UrlForVisitAudio: (...args: unknown[]) => mockMakeZ3Url(...args),
}));

// Mock global fetch for CSV upload
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// The subscription uses wrapTaskHandler; mock it to extract the inner handler
let capturedHandler: (input: { task: FhirTask; secrets: Record<string, string> }, oystehr: unknown) => Promise<unknown>;

vi.mock('../../src/subscriptions/task/helpers', () => ({
  wrapTaskHandler: (_name: string, fn: typeof capturedHandler) => {
    capturedHandler = fn;
    return fn;
  },
}));

// Helper to build a FHIR search result bundle
function makeFhirBundle(
  resources: Bundle['entry'],
  total: number
): { resourceType: string; type: string; total: number; entry: Bundle['entry']; unbundle: () => any[] } {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total,
    entry: resources,
    unbundle: () => (resources ?? []).map((e) => e?.resource),
  };
}

// Minimal FHIR fixtures
function makeExportTask(overrides?: Partial<FhirTask>): FhirTask {
  return {
    resourceType: 'Task',
    id: 'export-task-1',
    status: 'requested',
    intent: 'order',
    code: {
      coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'export-invoices-csv' }],
    },
    encounter: { reference: 'Encounter/enc-1' },
    ...overrides,
  } as FhirTask;
}

function makeInvoiceTask(id: string): FhirTask {
  return {
    resourceType: 'Task',
    id,
    status: 'completed',
    intent: 'order',
    code: { coding: [{ system: RCM_TASK_SYSTEM, code: RcmTaskCode.sendInvoiceToPatient }] },
    encounter: { reference: 'Encounter/enc-1' },
    authoredOn: '2025-01-15T10:00:00Z',
    executionPeriod: { start: '2025-01-10T08:00:00Z' },
    input: [
      {
        type: { coding: [{ system: RCM_TASK_SYSTEM, code: 'claim-id' }] },
        valueString: 'CLAIM-001',
      },
      {
        type: { coding: [{ system: RCM_TASK_SYSTEM, code: 'amount-cents' }] },
        valueInteger: 5000,
      },
    ],
  } as FhirTask;
}

function makeEncounter(): Encounter {
  return {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'finished',
    class: { code: 'AMB' },
    subject: { reference: 'Patient/pat-1' },
    appointment: [{ reference: 'Appointment/appt-1' }],
  } as Encounter;
}

function makePatient(): Patient {
  return {
    resourceType: 'Patient',
    id: 'pat-1',
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1990-05-15',
  };
}

function makeAppointment(): Appointment {
  return {
    resourceType: 'Appointment',
    id: 'appt-1',
    status: 'fulfilled',
    start: '2025-01-10T08:00:00-05:00',
    participant: [{ actor: { reference: 'Location/loc-1' }, status: 'accepted' }],
    slot: [{ reference: 'Slot/slot-1' }],
  } as Appointment;
}

function makeSlot(): Slot {
  return {
    resourceType: 'Slot',
    id: 'slot-1',
    status: 'busy',
    start: '2025-01-10T08:00:00-05:00',
    end: '2025-01-10T08:30:00-05:00',
    schedule: { reference: 'Schedule/sched-1' },
  };
}

function makeAccount(): Account {
  return {
    resourceType: 'Account',
    id: 'acct-1',
    status: 'active',
    type: PATIENT_BILLING_ACCOUNT_TYPE,
    subject: [{ reference: 'Patient/pat-1' }],
    guarantor: [{ party: { reference: 'Patient/pat-1' } }],
  } as Account;
}

function makeRelatedPerson(): RelatedPerson {
  return {
    resourceType: 'RelatedPerson',
    id: 'rp-1',
    patient: { reference: 'Patient/pat-1' },
    name: [{ given: ['Jane'], family: 'Doe' }],
    relationship: [{ coding: [{ code: 'user-relatedperson' }] }],
  };
}

describe('sub-export-invoices-csv', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockMakeZ3Url.mockReturnValue('https://api.example.com/z3/test-project-invoiceable-patients-reports/export.csv');
    mockCreatePresignedUrl.mockResolvedValue('https://presigned-upload-url.com');
    mockFetch.mockResolvedValue({ ok: true });

    // Import to trigger wrapTaskHandler and capture the handler
    await import('../../src/subscriptions/sub-export-invoices-csv/index');
  });

  it('generates CSV and uploads to Z3 for a single task group', async () => {
    const invoiceTask = makeInvoiceTask('inv-task-1');
    const encounter = makeEncounter();
    const patient = makePatient();
    const appointment = makeAppointment();
    const slot = makeSlot();
    const account = makeAccount();
    const relatedPerson = makeRelatedPerson();

    const bundle = makeFhirBundle(
      [invoiceTask, encounter, patient, appointment, slot, account, relatedPerson].map((r) => ({
        resource: r,
      })),
      1
    );
    mockOystehrClient.fhir.search.mockResolvedValue(bundle);

    const exportTask = makeExportTask();
    const result = await capturedHandler(
      { task: exportTask, secrets: { PROJECT_ID: 'test-project', PROJECT_API: 'https://api.example.com' } },
      mockOystehrClient
    );

    expect(result).toEqual(expect.objectContaining({ taskStatus: 'completed', statusReason: 'Exported 1 records' }));

    // Verify CSV upload
    expect(mockCreatePresignedUrl).toHaveBeenCalledWith('mock-token', expect.stringContaining('z3/'), 'upload');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://presigned-upload-url.com',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
      })
    );

    // Verify task output was patched with Z3 URL
    expect(mockOystehrClient.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Task',
        id: 'export-task-1',
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: 'add',
            path: '/output',
          }),
        ]),
      })
    );
  });

  it('generates CSV with headers only when no tasks found', async () => {
    const emptyBundle = makeFhirBundle([], 0);
    mockOystehrClient.fhir.search.mockResolvedValue(emptyBundle);

    const exportTask = makeExportTask();
    const result = await capturedHandler(
      { task: exportTask, secrets: { PROJECT_ID: 'test-project', PROJECT_API: 'https://api.example.com' } },
      mockOystehrClient
    );

    expect(result).toEqual(expect.objectContaining({ taskStatus: 'completed', statusReason: 'Exported 0 records' }));

    // The CSV should still be uploaded (headers only)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://presigned-upload-url.com',
      expect.objectContaining({ method: 'PUT' })
    );

    // Verify the uploaded body is a Uint8Array containing at least the header row
    const uploadCall = mockFetch.mock.calls.find(
      (call: unknown[]) => (call[1] as { method: string })?.method === 'PUT'
    );
    const csvBytes = uploadCall?.[1]?.body as Uint8Array;
    const csvText = new TextDecoder().decode(csvBytes);
    expect(csvText).toContain('RCM Claim ID');
    expect(csvText).toContain('Patient Name');
    // Should only have the header line
    expect(csvText.split('\n')).toHaveLength(1);
  });

  it('extracts filters from task input', async () => {
    const emptyBundle = makeFhirBundle([], 0);
    mockOystehrClient.fhir.search.mockResolvedValue(emptyBundle);

    const exportTask = makeExportTask({
      input: [
        {
          type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'filter-status' }] },
          valueString: 'completed',
        },
        {
          type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'hide-zero-balance' }] },
          valueBoolean: true,
        },
      ],
    });

    await capturedHandler(
      { task: exportTask, secrets: { PROJECT_ID: 'test-project', PROJECT_API: 'https://api.example.com' } },
      mockOystehrClient
    );

    // Verify filters were passed to FHIR search
    const searchCall = mockOystehrClient.fhir.search.mock.calls[0][0];
    const params = searchCall.params as { name: string; value: unknown }[];
    expect(params.find((p) => p.name === 'status')?.value).toBe('completed');
    expect(params.find((p) => p.name === 'business-status:not')).toBeDefined();
  });

  it('paginates through multiple pages', async () => {
    // First page: returns 200 total but only our single-item page
    const invoiceTask = makeInvoiceTask('inv-task-1');
    const encounter = makeEncounter();
    const patient = makePatient();

    const page1Bundle = makeFhirBundle(
      [invoiceTask, encounter, patient].map((r) => ({ resource: r })),
      2 // total > page size will not trigger pagination since we only have 1 task
    );

    const page2Bundle = makeFhirBundle(
      [{ ...invoiceTask, id: 'inv-task-2' }, encounter, patient].map((r) => ({ resource: r })),
      2
    );

    mockOystehrClient.fhir.search.mockResolvedValueOnce(page1Bundle).mockResolvedValueOnce(page2Bundle);

    // Use a small total that fits in 2 pages (mock returns 2 tasks across 2 calls)
    // The handler uses CSV_PAGE_SIZE=200 so total=2 won't actually paginate.
    // Let's test with total > CSV_PAGE_SIZE
    const largePage1 = makeFhirBundle(
      [invoiceTask, encounter, patient].map((r) => ({ resource: r })),
      201
    );
    const largePage2 = makeFhirBundle([], 201);
    mockOystehrClient.fhir.search.mockReset();
    mockOystehrClient.fhir.search.mockResolvedValueOnce(largePage1).mockResolvedValueOnce(largePage2);

    const exportTask = makeExportTask();
    await capturedHandler(
      { task: exportTask, secrets: { PROJECT_ID: 'test-project', PROJECT_API: 'https://api.example.com' } },
      mockOystehrClient
    );

    // Should have made 2 search calls due to pagination
    expect(mockOystehrClient.fhir.search).toHaveBeenCalledTimes(2);
  });
});
