import type { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: null };
}

const mockOystehrClient = {
  fhir: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    search: vi.fn(),
  },
};

const mockCreateCandidClientIfConfigured = vi.fn();
const mockCreateCandidEmployerPayer = vi.fn();
const mockUpdateCandidEmployerPayer = vi.fn();
const mockToggleCandidEmployerPayer = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/rcm/employers/candid-sync', () => ({
  createCandidClientIfConfigured: mockCreateCandidClientIfConfigured,
  createCandidEmployerPayer: mockCreateCandidEmployerPayer,
  updateCandidEmployerPayer: mockUpdateCandidEmployerPayer,
  toggleCandidEmployerPayer: mockToggleCandidEmployerPayer,
}));

const { index: createEmployerHandler } = (await import('../../src/rcm/employers/create-employer/index')) as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { index: updateEmployerHandler } = (await import('../../src/rcm/employers/update-employer/index')) as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};
const { index: listEmployersHandler } = (await import('../../src/rcm/employers/list-employers/index')) as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const employerType = [
  {
    text: 'Occupational Medicine',
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/organization-type',
        code: 'occupational-medicine-employer',
      },
    ],
  },
];

const EMPLOYER_ID = '00000000-0000-0000-0000-000000000001';

function makeEmployer(overrides?: Partial<Organization>): Organization {
  return {
    resourceType: 'Organization',
    id: EMPLOYER_ID,
    name: 'Wayne Enterprises',
    active: true,
    type: employerType,
    address: [{ line: ['100 Main'], city: 'Gotham', state: 'NY', postalCode: '10001' }],
    ...overrides,
  } as Organization;
}

describe('RCM employer zambdas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCandidClientIfConfigured.mockReturnValue(null);
  });

  it('create-employer creates org and persists Candid payer id when Candid sync succeeds', async () => {
    const created = makeEmployer({ identifier: undefined });
    const updated = makeEmployer({
      identifier: [
        {
          system: 'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id',
          value: 'candid-payer-1',
        },
      ],
    });

    mockOystehrClient.fhir.create.mockResolvedValue(created);
    mockOystehrClient.fhir.update.mockResolvedValue(updated);
    mockCreateCandidClientIfConfigured.mockReturnValue({});
    mockCreateCandidEmployerPayer.mockResolvedValue('candid-payer-1');

    const result = await createEmployerHandler(makeInput({ name: 'Wayne Enterprises' }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.create).toHaveBeenCalledTimes(1);
    expect(mockCreateCandidEmployerPayer).toHaveBeenCalledWith(
      {},
      'Wayne Enterprises',
      'Occupational Medicine',
      created.address
    );
    expect(mockOystehrClient.fhir.update).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.body).identifier[0].value).toBe('candid-payer-1');
  });

  it('create-employer skips Candid sync when client is not configured', async () => {
    const created = makeEmployer();
    mockOystehrClient.fhir.create.mockResolvedValue(created);

    const result = await createEmployerHandler(makeInput({ name: 'Wayne Enterprises' }));

    expect(result.statusCode).toBe(200);
    expect(mockCreateCandidEmployerPayer).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.update).not.toHaveBeenCalled();
  });

  it('update-employer updates FHIR and Candid when org has Candid identifier', async () => {
    const existing = makeEmployer({
      meta: { versionId: '3' },
      identifier: [
        {
          system: 'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id',
          value: 'candid-payer-1',
        },
      ],
    });
    const updated = makeEmployer({
      name: 'Wayne Ent',
      type: [{ ...employerType[0], text: 'Occupational Medicine' }],
      identifier: existing.identifier,
    });

    mockOystehrClient.fhir.get.mockResolvedValue(existing);
    mockOystehrClient.fhir.update.mockResolvedValue(updated);
    mockCreateCandidClientIfConfigured.mockReturnValue({});

    const result = await updateEmployerHandler(
      makeInput({ employerId: EMPLOYER_ID, name: 'Wayne Ent', category: 'Occupational Medicine' })
    );

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.update).toHaveBeenCalledTimes(1);
    expect(mockUpdateCandidEmployerPayer).toHaveBeenCalledWith(
      {},
      'candid-payer-1',
      'Wayne Ent',
      'Occupational Medicine',
      updated.address
    );
  });

  it('update-employer toggles active true in FHIR and Candid', async () => {
    const existing = makeEmployer({
      active: false,
      meta: { versionId: '7' },
      identifier: [
        {
          system: 'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id',
          value: 'candid-payer-2',
        },
      ],
    });
    const updated = makeEmployer({
      active: true,
      identifier: existing.identifier,
    });

    mockOystehrClient.fhir.get.mockResolvedValue(existing);
    mockOystehrClient.fhir.update.mockResolvedValue(updated);
    mockCreateCandidClientIfConfigured.mockReturnValue({});

    const result = await updateEmployerHandler(makeInput({ employerId: EMPLOYER_ID, active: true }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: true }),
      expect.objectContaining({ optimisticLockingVersionId: '7' })
    );
    expect(mockToggleCandidEmployerPayer).toHaveBeenCalledWith({}, 'candid-payer-2', true);
  });

  it('update-employer toggles active false in FHIR and Candid', async () => {
    const existing = makeEmployer({
      active: true,
      meta: { versionId: '8' },
      identifier: [
        {
          system: 'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id',
          value: 'candid-payer-3',
        },
      ],
    });
    const updated = makeEmployer({
      active: false,
      identifier: existing.identifier,
    });

    mockOystehrClient.fhir.get.mockResolvedValue(existing);
    mockOystehrClient.fhir.update.mockResolvedValue(updated);
    mockCreateCandidClientIfConfigured.mockReturnValue({});

    const result = await updateEmployerHandler(makeInput({ employerId: EMPLOYER_ID, active: false }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
      expect.objectContaining({ optimisticLockingVersionId: '8' })
    );
    expect(mockToggleCandidEmployerPayer).toHaveBeenCalledWith({}, 'candid-payer-3', false);
  });

  it('list-employers returns all organizations from search results', async () => {
    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [makeEmployer()],
    });

    const result = await listEmployersHandler({ headers: null, body: JSON.stringify({}), secrets: null });
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Wayne Enterprises');
  });
});
