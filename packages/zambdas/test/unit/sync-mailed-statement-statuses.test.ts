import { Communication, Extension } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostGridLetter, PostGridLetterStatus } from '../../src/shared/postgrid';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPostGridLetter = vi.fn<(id: string, secrets: unknown) => Promise<PostGridLetter>>();

vi.mock('../../src/shared/postgrid', () => ({
  getPostGridLetter: (...args: unknown[]) => mockGetPostGridLetter(args[0] as string, args[1]),
}));

// Speed up tests by eliminating the rate-limit delay
vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler) => {
  if (typeof fn === 'function') fn();
  return 0 as unknown as ReturnType<typeof setTimeout>;
});

// We also need to mock luxon DateTime.now() for deterministic timestamps
vi.mock('luxon', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    DateTime: {
      ...(actual.DateTime as Record<string, unknown>),
      now: () => ({
        toUTC: () => ({
          toISO: () => '2025-06-01T00:00:00.000Z',
        }),
      }),
    },
  };
});

import { syncMailedStatementStatuses } from '../../src/shared/sync-mailed-statement-statuses';

const MAIL_VENDOR_EXTENSION_URL = 'https://extensions.fhir.ottehr.com/mail-vendor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommunication(id: string, vendorLetterId: string, vendorLetterStatus: string = 'ready'): Communication {
  return {
    resourceType: 'Communication',
    id,
    status: 'in-progress',
    extension: [
      {
        url: MAIL_VENDOR_EXTENSION_URL,
        extension: [
          { url: 'vendor-letter-id', valueString: vendorLetterId },
          { url: 'vendor-letter-status', valueString: vendorLetterStatus },
        ],
      },
    ],
  };
}

function makePostGridLetter(overrides: Partial<PostGridLetter> = {}): PostGridLetter {
  return {
    id: 'letter_123',
    object: 'letter',
    live: false,
    to: { addressLine1: '123 Main', city: 'NYC', provinceOrState: 'NY', postalOrZip: '10001', countryCode: 'US' },
    from: { addressLine1: '456 Oak', city: 'LA', provinceOrState: 'CA', postalOrZip: '90001', countryCode: 'US' },
    status: 'processed_for_delivery' as PostGridLetterStatus,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSearchBundle(communications: Communication[], hasNext = false) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    link: hasNext ? [{ relation: 'next', url: 'http://next' }] : [],
    unbundle: () => communications,
  };
}

let mockOystehr: {
  fhir: {
    search: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const secrets = { POSTGRID_API_KEY: 'test-key' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockOystehr = {
    fhir: {
      search: vi.fn(),
      update: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncMailedStatementStatuses', () => {
  it('returns zero counts when no in-progress Communications exist', async () => {
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([]));

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result).toEqual({
      total: 0,
      updated: 0,
      alreadyTerminal: 0,
      errors: [],
    });
    expect(mockGetPostGridLetter).not.toHaveBeenCalled();
  });

  it('updates a Communication when PostGrid returns a new status', async () => {
    const comm = makeCommunication('comm-1', 'letter_abc', 'ready');
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));
    mockGetPostGridLetter.mockResolvedValueOnce(
      makePostGridLetter({
        status: 'processed_for_delivery',
        url: 'https://pdf.url',
        mailingClass: 'first_class',
        pageCount: 2,
        envelopeType: 'standard',
      })
    );
    mockOystehr.fhir.update.mockResolvedValueOnce({});

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.total).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify the FHIR update was called with correct status
    expect(mockOystehr.fhir.update).toHaveBeenCalledOnce();
    const updateCall = mockOystehr.fhir.update.mock.calls[0][0];
    expect(updateCall.resourceType).toBe('Communication');
    expect(updateCall.id).toBe('comm-1');
    expect(updateCall.status).toBe('in-progress'); // processed_for_delivery maps to in-progress

    // Verify mail vendor extension was updated
    const mailVendorExt = updateCall.extension.find((ext: Extension) => ext.url === MAIL_VENDOR_EXTENSION_URL);
    expect(mailVendorExt).toBeDefined();
    const getSubExt = (url: string): string | undefined =>
      mailVendorExt.extension?.find((e: Extension) => e.url === url)?.valueString;
    expect(getSubExt('vendor-letter-status')).toBe('processed_for_delivery');
    expect(getSubExt('vendor-letter-url')).toBe('https://pdf.url');
    expect(getSubExt('vendor-mailing-class')).toBe('first_class');
    expect(getSubExt('vendor-page-count')).toBe('2');
    expect(getSubExt('vendor-envelope-type')).toBe('standard');
    expect(getSubExt('vendor-status-synced-at')).toBe('2025-06-01T00:00:00.000Z');
  });

  it('maps PostGrid "completed" to FHIR "completed"', async () => {
    const comm = makeCommunication('comm-2', 'letter_def', 'printing');
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));
    mockGetPostGridLetter.mockResolvedValueOnce(makePostGridLetter({ status: 'completed' }));
    mockOystehr.fhir.update.mockResolvedValueOnce({});

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.updated).toBe(1);
    const updateCall = mockOystehr.fhir.update.mock.calls[0][0];
    expect(updateCall.status).toBe('completed');
  });

  it('maps PostGrid "cancelled" to FHIR "stopped"', async () => {
    const comm = makeCommunication('comm-3', 'letter_ghi', 'printing');
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));
    mockGetPostGridLetter.mockResolvedValueOnce(makePostGridLetter({ status: 'cancelled' }));
    mockOystehr.fhir.update.mockResolvedValueOnce({});

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.updated).toBe(1);
    const updateCall = mockOystehr.fhir.update.mock.calls[0][0];
    expect(updateCall.status).toBe('stopped');
  });

  it('skips Communications that are already in a terminal status', async () => {
    const comm = makeCommunication('comm-4', 'letter_jkl', 'completed');
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.total).toBe(1);
    expect(result.alreadyTerminal).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockGetPostGridLetter).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('records an error when Communication has no mail-vendor extension', async () => {
    const comm: Communication = {
      resourceType: 'Communication',
      id: 'comm-5',
      status: 'in-progress',
      extension: [],
    };
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      communicationId: 'comm-5',
      error: 'No mail-vendor extension found',
    });
  });

  it('records an error when Communication has no vendor-letter-id', async () => {
    const comm: Communication = {
      resourceType: 'Communication',
      id: 'comm-6',
      status: 'in-progress',
      extension: [
        {
          url: MAIL_VENDOR_EXTENSION_URL,
          extension: [{ url: 'vendor-letter-status', valueString: 'ready' }],
        },
      ],
    };
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      communicationId: 'comm-6',
      error: 'No vendor-letter-id found',
    });
  });

  it('records an error when PostGrid API call fails', async () => {
    const comm = makeCommunication('comm-7', 'letter_mno', 'ready');
    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([comm]));
    mockGetPostGridLetter.mockRejectedValueOnce(new Error('PostGrid API error (500): internal — server error'));

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].communicationId).toBe('comm-7');
    expect(result.errors[0].error).toContain('PostGrid API error');
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('paginates through multiple pages of Communications', async () => {
    const comm1 = makeCommunication('comm-p1', 'letter_p1', 'ready');
    const comm2 = makeCommunication('comm-p2', 'letter_p2', 'ready');

    mockOystehr.fhir.search
      .mockResolvedValueOnce(makeSearchBundle([comm1], true)) // page 1 has next
      .mockResolvedValueOnce(makeSearchBundle([comm2], false)); // page 2 is last

    mockGetPostGridLetter
      .mockResolvedValueOnce(makePostGridLetter({ status: 'completed' }))
      .mockResolvedValueOnce(makePostGridLetter({ status: 'completed' }));

    mockOystehr.fhir.update.mockResolvedValue({});

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.total).toBe(2);
    expect(result.updated).toBe(2);
    expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(2);
  });

  it('handles a mix of success, terminal, and error Communications', async () => {
    const commSuccess = makeCommunication('comm-s', 'letter_s', 'ready');
    const commTerminal = makeCommunication('comm-t', 'letter_t', 'completed');
    const commError = makeCommunication('comm-e', 'letter_e', 'ready');

    mockOystehr.fhir.search.mockResolvedValueOnce(makeSearchBundle([commSuccess, commTerminal, commError]));

    mockGetPostGridLetter
      .mockResolvedValueOnce(makePostGridLetter({ status: 'completed' }))
      .mockRejectedValueOnce(new Error('Network error'));

    mockOystehr.fhir.update.mockResolvedValue({});

    const result = await syncMailedStatementStatuses(mockOystehr as any, secrets);

    expect(result.total).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.alreadyTerminal).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].communicationId).toBe('comm-e');
  });
});
