import { Appointment, Communication, Encounter, Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    waitForAsyncBulkBundle: vi.fn(),
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

import { index } from '../../src/ehr/mailed-statements-report/index';

const MAIL_VENDOR_EXTENSION_URL = 'https://extensions.fhir.ottehr.com/mail-vendor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return {
    headers: null,
    body: JSON.stringify(body),
    secrets: { POSTGRID_API_KEY: 'test' },
  };
}

// Synchronous search result (used for the Patient / Encounter `_id` lookups which remain sync)
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSearchBundle(resources: (Communication | Patient | Encounter | Appointment)[]) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    unbundle: () => resources,
  };
}

// Bundle returned by the async-bulk workflow (used for the Communications search)
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeAsyncBulkBundle(resources: (Communication | Patient | Encounter | Appointment)[]) {
  return {
    resourceType: 'Bundle',
    type: 'batch-response',
    entry: resources.map((resource) => ({ resource })),
  };
}

// Queue an async-bulk Communications search: the kickoff `search` returns a job handle and
// `waitForAsyncBulkBundle` resolves to the assembled bundle.
function mockCommunicationsAsyncSearch(communications: Communication[]): void {
  mockOystehrClient.fhir.search.mockResolvedValueOnce({ jobId: 'job-communications', contentLocation: '', mode: 'bulk' });
  mockOystehrClient.fhir.waitForAsyncBulkBundle.mockResolvedValueOnce(makeAsyncBulkBundle(communications));
}

function makeCommunication(id: string, overrides: Partial<Communication> = {}): Communication {
  return {
    resourceType: 'Communication',
    id,
    status: 'in-progress',
    medium: [{ coding: [{ code: 'MAILWRIT' }] }],
    subject: { reference: 'Patient/patient-1' },
    encounter: { reference: 'Encounter/encounter-1' },
    recipient: [{ display: 'John Doe' }],
    sent: '2025-01-15T10:00:00Z',
    payload: [
      { contentString: 'Statement for visit' },
      {
        contentAttachment: {
          contentType: 'text/html',
          data: Buffer.from('<p>Hello</p>').toString('base64'),
        },
      },
    ],
    extension: [
      {
        url: MAIL_VENDOR_EXTENSION_URL,
        extension: [
          { url: 'vendor-letter-id', valueString: 'letter_123' },
          { url: 'vendor-letter-status', valueString: 'ready' },
          { url: 'vendor-send-date', valueString: '2025-01-16' },
          { url: 'vendor-letter-url', valueString: 'https://pdf.url' },
          { url: 'vendor-mailing-class', valueString: 'first_class' },
          { url: 'vendor-page-count', valueString: '2' },
          { url: 'vendor-envelope-type', valueString: 'standard' },
          { url: 'vendor-status-synced-at', valueString: '2025-01-17T00:00:00Z' },
        ],
      },
    ],
    ...overrides,
  };
}

function makePatient(id: string): Patient {
  return {
    resourceType: 'Patient',
    id,
    name: [{ family: 'Smith', given: ['Jane'] }],
  };
}

function makeEncounter(id: string, appointmentId: string): Encounter {
  return {
    resourceType: 'Encounter',
    id,
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: `Appointment/${appointmentId}` }],
    period: { start: '2025-01-10T09:00:00Z' },
  };
}

function makeAppointment(id: string): Appointment {
  return {
    resourceType: 'Appointment',
    id,
    status: 'fulfilled',
    start: '2025-01-10T09:00:00Z',
    participant: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mailed-statements-report handler', () => {
  it('returns empty statements array when no Communications match', async () => {
    mockCommunicationsAsyncSearch([]);

    const result = await (index as (input: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(
      makeInput({ dateRange: { start: '2025-01-01', end: '2025-01-31' } })
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.statements).toHaveLength(0);
    expect(body.message).toContain('0');
  });

  it('returns mapped statement data for a single Communication', async () => {
    const comm = makeCommunication('comm-1');
    const patient = makePatient('patient-1');
    const encounter = makeEncounter('encounter-1', 'appt-1');
    const appointment = makeAppointment('appt-1');

    // Communication search (async-bulk workflow)
    mockCommunicationsAsyncSearch([comm]);
    // Patient search
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([patient]));
    // Encounter + Appointment search (_include)
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([encounter, appointment]));

    const result = await (index as (input: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(
      makeInput({ dateRange: { start: '2025-01-01', end: '2025-01-31' } })
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.statements).toHaveLength(1);

    const stmt = body.statements[0];
    expect(stmt.communicationId).toBe('comm-1');
    expect(stmt.patientId).toBe('patient-1');
    expect(stmt.patientName).toBe('Smith, Jane');
    expect(stmt.encounterId).toBe('encounter-1');
    expect(stmt.recipientName).toBe('John Doe');
    expect(stmt.sentDate).toBe('2025-01-15T10:00:00Z');
    expect(stmt.appointmentDate).toBe('2025-01-10T09:00:00Z');
    expect(stmt.appointmentId).toBe('appt-1');
    expect(stmt.vendorLetterId).toBe('letter_123');
    expect(stmt.vendorLetterStatus).toBe('ready');
    expect(stmt.vendorSendDate).toBe('2025-01-16');
    expect(stmt.vendorLetterUrl).toBe('https://pdf.url');
    expect(stmt.vendorMailingClass).toBe('first_class');
    expect(stmt.vendorPageCount).toBe(2);
    expect(stmt.vendorEnvelopeType).toBe('standard');
    expect(stmt.vendorStatusSyncedAt).toBe('2025-01-17T00:00:00Z');
    expect(stmt.description).toBe('Statement for visit');
    expect(stmt.htmlContent).toBe('<p>Hello</p>');
  });

  it('handles Communications without optional fields gracefully', async () => {
    const bareComm: Communication = {
      resourceType: 'Communication',
      id: 'comm-bare',
      status: 'in-progress',
    };

    mockCommunicationsAsyncSearch([bareComm]);
    // No patients or encounters to fetch (empty sets)

    const result = await (index as (input: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(
      makeInput({ dateRange: { start: '2025-01-01', end: '2025-01-31' } })
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.statements).toHaveLength(1);

    const stmt = body.statements[0];
    expect(stmt.communicationId).toBe('comm-bare');
    expect(stmt.patientId).toBe('');
    expect(stmt.patientName).toBe('Unknown');
    expect(stmt.vendorLetterId).toBe('');
    expect(stmt.htmlContent).toBe('');
    expect(stmt.description).toBe('');
  });

  it('returns all Communications from the async-bulk result', async () => {
    const comm1 = makeCommunication('comm-1');
    const comm2 = makeCommunication('comm-2', {
      subject: { reference: 'Patient/patient-1' },
      encounter: { reference: 'Encounter/encounter-1' },
    });

    // Async-bulk Communications search returns the complete result set in a single bundle
    mockCommunicationsAsyncSearch([comm1, comm2]);
    // Patient search
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([makePatient('patient-1')]));
    // Encounter search
    mockOystehrClient.fhir.search.mockResolvedValueOnce(
      makeSearchBundle([makeEncounter('encounter-1', 'appt-1'), makeAppointment('appt-1')])
    );

    const result = await (index as (input: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(
      makeInput({ dateRange: { start: '2025-01-01', end: '2025-01-31' } })
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.statements).toHaveLength(2);
    expect(body.message).toContain('2');
  });
});
