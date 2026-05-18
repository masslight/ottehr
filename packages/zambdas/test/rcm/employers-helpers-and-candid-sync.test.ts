import { Address, Organization } from 'fhir/r4b';
import { MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOrCreateCandidApiClient = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOrCreateCandidApiClient: mockGetOrCreateCandidApiClient,
  };
});

const {
  createCandidClientIfConfigured,
  createCandidEmployerPayer,
  updateCandidEmployerPayer,
  toggleCandidEmployerPayer,
} = await import('../../src/rcm/employers/candid-sync');

const {
  EMPLOYER_NOTES_EXTENSION_URL,
  buildEmployerType,
  getCandidPayerIdFromOrganization,
  isEmployerOrganization,
  normalizeAddress,
  normalizeEmployerNotesExtension,
  normalizeIdentifier,
  normalizeTelecom,
  setOrUpdateCandidIdentifier,
} = await import('../../src/rcm/employers/helpers');

describe('RCM employer helpers', () => {
  it('detects employer organizations by type code', () => {
    const employerOrg = {
      resourceType: 'Organization',
      type: buildEmployerType('Occupational Medicine'),
    } as Organization;

    const nonEmployerOrg = {
      resourceType: 'Organization',
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'prov' }] }],
    } as Organization;

    expect(isEmployerOrganization(employerOrg)).toBe(true);
    expect(isEmployerOrganization(nonEmployerOrg)).toBe(false);
  });

  it('normalizes identifier/address/telecom and notes extension', () => {
    const identifier = normalizeIdentifier({ value: 'payer-1' });
    const address = normalizeAddress({
      line: [' 100 Main St ', 'Suite 2'],
      city: 'Austin',
      state: 'TX',
      postalCode: '73301',
    });
    const telecom = normalizeTelecom({ phone: '123', fax: '456', email: 'test@example.com' });

    expect(identifier?.[0].value).toBe('payer-1');
    expect(address?.[0].city).toBe('Austin');
    expect(telecom).toHaveLength(3);

    const extension = normalizeEmployerNotesExtension('new notes', [{ url: 'other-url', valueString: 'keep' }]);
    expect(extension).toContainEqual({ url: 'other-url', valueString: 'keep' });
    expect(extension).toContainEqual({ url: EMPLOYER_NOTES_EXTENSION_URL, valueString: 'new notes' });
  });

  it('extracts and updates Candid identifier', () => {
    const org = {
      resourceType: 'Organization',
      identifier: [{ system: 'x', value: '1' }],
    } as Organization;

    const updated = setOrUpdateCandidIdentifier(org, 'candid-123');
    expect(updated.some((id) => id.value === 'candid-123')).toBe(true);

    const withCandid = { ...org, identifier: updated } as Organization;
    expect(getCandidPayerIdFromOrganization(withCandid)).toBe('candid-123');
  });
});

describe('RCM candid-sync', () => {
  const createSpy = vi.fn();
  const updateSpy = vi.fn();
  const toggleSpy = vi.fn();
  const candidClient = {
    nonInsurancePayers: {
      v1: {
        create: createSpy,
        update: updateSpy,
        toggleEnablement: toggleSpy,
      },
    },
  } as any;

  const mockOystehr = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateCandidApiClient.mockResolvedValue(candidClient);
  });

  it('returns null when getOrCreateCandidApiClient rejects with MISSING_REQUEST_SECRETS', async () => {
    mockGetOrCreateCandidApiClient.mockRejectedValue(MISSING_REQUEST_SECRETS);
    expect(await createCandidClientIfConfigured(mockOystehr, null)).toBeNull();
  });

  it('rethrows non-MISSING_REQUEST_SECRETS errors from getOrCreateCandidApiClient', async () => {
    const boom = new Error('unexpected');
    mockGetOrCreateCandidApiClient.mockRejectedValue(boom);
    await expect(createCandidClientIfConfigured(mockOystehr, null)).rejects.toBe(boom);
  });

  it('returns the candid client when getOrCreateCandidApiClient resolves', async () => {
    const client = await createCandidClientIfConfigured(mockOystehr, null);
    expect(client).toBe(candidClient);
  });

  it('creates payer and returns payer id when create call succeeds', async () => {
    createSpy.mockResolvedValue({ ok: true, body: { nonInsurancePayerId: 'payer-abc' } });

    const addresses: Address[] = [{ line: ['100 Main St'], city: 'Austin', state: 'TX', postalCode: '73301-9999' }];
    const result = await createCandidEmployerPayer(candidClient, 'Test Employer', 'Occupational Medicine', addresses);

    expect(result).toBe('payer-abc');
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Employer',
        category: 'Occupational Medicine',
        address: expect.objectContaining({ zipCode: '73301', zipPlusFourCode: '9999' }),
      })
    );
  });

  it('updates payer with address remove when no address values are provided', async () => {
    await updateCandidEmployerPayer(candidClient, 'payer-1', 'Test Employer', 'Occupational Medicine', []);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'Test Employer',
        address: { type: 'remove' },
      })
    );
  });

  it('toggles payer enablement', async () => {
    await toggleCandidEmployerPayer(candidClient, 'payer-2', false);
    expect(toggleSpy).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });
});
