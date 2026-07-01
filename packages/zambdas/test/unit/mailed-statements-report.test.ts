import { Appointment, Communication, Encounter, Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSearchBundle(resources: (Communication | Patient | Encounter | Appointment)[], hasNext = false) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    link: hasNext ? [{ relation: 'next', url: 'http://next' }] : [],
    unbundle: () => resources,
  };
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
  // Default fallback so the trailing sync-state Basic search (getMailedStatementSyncState)
  // and any otherwise-unmatched search resolve to an empty bundle.
  mockOystehrClient.fhir.search.mockResolvedValue(makeSearchBundle([]));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mailed-statements-report handler', () => {
  it('returns empty statements array when no Communications match', async () => {
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([]));

    const result = await (index as (input: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(
      makeInput({ dateRange: { start: '2025-01-01', end: '2025-01-31' } })
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.statements).toHaveLength(0);
    expect(body.message).toContain('0');
    expect(body.lastSyncRunAt).toBeNull();
  });

  it('returns the persisted lastSyncRunAt when a sync-state Basic exists', async () => {
    // Communication search (empty)
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([]));
    // Sync-state Basic search
    mockOystehrClient.fhir.search.mockResolvedValueOnce({
      resourceType: 'Bundle',
      type: 'searchset',
      link: [],
      unbundle: () => [
        {
          resourceType: 'Basic',
          id: 'sync-state-1',
          extension: [
            {
              url: 'https://fhir.ottehr.com/mailed-statement-sync/last-run-at',
              valueDateTime: '2026-06-22T06:00:00.000Z',
            },
          ],
        },
      ],
    });

    const result = await (index as (input: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(
      makeInput({ dateRange: { start: '2025-01-01', end: '2025-01-31' } })
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.lastSyncRunAt).toBe('2026-06-22T06:00:00.000Z');
  });

  it('returns mapped statement data for a single Communication', async () => {
    const comm = makeCommunication('comm-1');
    const patient = makePatient('patient-1');
    const encounter = makeEncounter('encounter-1', 'appt-1');
    const appointment = makeAppointment('appt-1');

    // Communication search (single page)
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));
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

    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([bareComm]));
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

  it('paginates Communications correctly', async () => {
    const comm1 = makeCommunication('comm-page1');
    const comm2 = makeCommunication('comm-page2', {
      subject: { reference: 'Patient/patient-1' },
      encounter: { reference: 'Encounter/encounter-1' },
    });

    // Page 1 with next link
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm1], true));
    // Page 2 without next link
    mockOystehrClient.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm2], false));
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
