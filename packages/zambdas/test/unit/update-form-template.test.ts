import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { FORM_TEMPLATE_CATEGORY_CODING } from 'utils/lib/fhir/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockOystehr) };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    requireAdminTierUser: vi.fn().mockResolvedValue(undefined),
  };
});

import { index as updateFormTemplateRaw } from '../../src/ehr/update-form-template/index';

const updateFormTemplate = updateFormTemplateRaw as unknown as ZambdaHandler;

const DOC_REF_ID = '11111111-1111-4111-8111-111111111111';

const template = (overrides: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: DOC_REF_ID,
  meta: { versionId: '3' },
  status: 'current',
  docStatus: 'preliminary',
  category: [{ coding: [FORM_TEMPLATE_CATEGORY_CODING] }],
  content: [{ attachment: { url: 'https://z3.example.com/form.pdf', title: 'Old title' } }],
  ...overrides,
});

const call = (body: Record<string, unknown>): Promise<APIGatewayProxyResult> =>
  updateFormTemplate({
    headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify({ documentReferenceId: DOC_REF_ID, ...body }),
    secrets: { ENVIRONMENT: 'local' },
  } as ZambdaInput);

const patchedOperations = (): unknown[] => mockOystehr.fhir.patch.mock.calls[0][0].operations;

describe('update-form-template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.patch.mockResolvedValue({});
  });

  it('renaming a template without a description does not add an empty description', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template());

    const result = await call({ title: 'New title', description: '' });

    expect(result.statusCode).toBe(200);
    expect(patchedOperations()).toEqual([{ op: 'replace', path: '/content/0/attachment/title', value: 'New title' }]);
  });

  it('clearing an existing description removes it instead of writing an empty string', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template({ description: 'Old description' }));

    const result = await call({ title: 'Old title', description: '   ' });

    expect(result.statusCode).toBe(200);
    expect(patchedOperations()).toContainEqual({ op: 'remove', path: '/description' });
    expect(JSON.stringify(patchedOperations())).not.toContain('"value":""');
  });

  it('a non-blank description is added or replaced as typed', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template());
    await call({ description: 'Consent form' });
    expect(patchedOperations()).toEqual([{ op: 'add', path: '/description', value: 'Consent form' }]);

    vi.clearAllMocks();
    mockOystehr.fhir.patch.mockResolvedValue({});
    mockOystehr.fhir.get.mockResolvedValue(template({ description: 'Old description' }));
    await call({ description: 'New description' });
    expect(patchedOperations()).toEqual([{ op: 'replace', path: '/description', value: 'New description' }]);
  });

  it('stores a description without surrounding whitespace, as create does', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template());
    await call({ description: '  Consent form \n' });
    expect(patchedOperations()).toEqual([{ op: 'add', path: '/description', value: 'Consent form' }]);
  });

  it('a blank description on a template without one sends no patch at all', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template());

    const result = await call({ description: '' });

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only title with a 400 and writes nothing', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template());

    const result = await call({ title: '   ' });

    expect(result.statusCode).toBe(400);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('keeps the publish operation and the optimistic lock when the description is cleared', async () => {
    mockOystehr.fhir.get.mockResolvedValue(template({ description: 'Old description' }));

    await call({ description: '', published: false });

    expect(patchedOperations()).toEqual([
      { op: 'remove', path: '/description' },
      { op: 'replace', path: '/docStatus', value: 'preliminary' },
    ]);
    expect(mockOystehr.fhir.patch.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '3' });
  });
});
