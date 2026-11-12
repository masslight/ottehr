import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { SUPPORT_DIALOG_BASIC_TAG, SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockOystehr) };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token') };
});

import { index as adminUpdateSupportDialogRaw } from '../../src/ehr/support-dialog/admin-update-support-dialog/index';

const adminUpdateSupportDialog = adminUpdateSupportDialogRaw as unknown as ZambdaHandler;

const existingBasic: Basic = {
  resourceType: 'Basic',
  id: 'support-basic-1',
  meta: { versionId: '4', tag: [SUPPORT_DIALOG_BASIC_TAG] },
  code: { coding: [SUPPORT_DIALOG_BASIC_TAG] },
  extension: [{ url: SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL, valueString: '<p>Call us</p>' }],
};

const call = (bodyHtml: string): Promise<APIGatewayProxyResult> =>
  adminUpdateSupportDialog({
    headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify({ bodyHtml }),
    secrets: { ENVIRONMENT: 'local' },
  } as ZambdaInput);

const givenStored = (basics: Basic[]): void => {
  mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => basics });
};

describe('admin-update-support-dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.create.mockImplementation(async (resource: Basic) => resource);
    mockOystehr.fhir.update.mockImplementation(async (resource: Basic) => resource);
  });

  it('clearing the saved text updates the Basic without an empty valueString, keeping the version lock', async () => {
    givenStored([existingBasic]);

    const result = await call('');

    expect(result.statusCode).toBe(204);
    expect(mockOystehr.fhir.update).toHaveBeenCalledTimes(1);
    const [written, options] = mockOystehr.fhir.update.mock.calls[0];
    expect(written.id).toBe('support-basic-1');
    expect(written.extension).toBeUndefined();
    expect(options).toEqual({ optimisticLockingVersionId: '4' });
  });

  it('html that sanitizes down to whitespace is treated as cleared', async () => {
    givenStored([existingBasic]);

    await call('<script>alert(1)</script>  ');

    expect(mockOystehr.fhir.update.mock.calls[0][0].extension).toBeUndefined();
  });

  it('saving blank text when nothing is stored writes nothing', async () => {
    givenStored([]);

    const result = await call('');

    expect(result.statusCode).toBe(204);
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('non-blank text is still saved on the extension', async () => {
    givenStored([existingBasic]);

    await call('<p>New hours</p>');

    expect(mockOystehr.fhir.update.mock.calls[0][0].extension).toEqual([
      { url: SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL, valueString: '<p>New hours</p>' },
    ]);
  });
});
