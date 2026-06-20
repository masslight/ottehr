import { Basic } from 'fhir/r4b';
import {
  DEFAULT_ELIGIBILITY_PRIMARY_CODE,
  DEFAULT_ELIGIBILITY_SHORT_LIST_CODES,
  ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG,
  ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL,
} from 'utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/eligibility-verification-config/admin-update-eligibility-verification-config/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';
import {
  getEligibilityVerificationConfigPayload,
  saveEligibilityVerificationConfig,
} from '../../src/shared/eligibility-verification-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

function makeConfigBasic(overrides?: { id?: string; versionId?: string; valueString?: string | null }): Basic {
  const basic: Basic = {
    resourceType: 'Basic',
    id: overrides?.id ?? 'basic-1',
    meta: {
      tag: [ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG],
      ...(overrides?.versionId ? { versionId: overrides.versionId } : {}),
    },
    code: { coding: [ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG] },
  };
  if (overrides?.valueString !== null) {
    basic.extension = [
      {
        url: ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL,
        valueString: overrides?.valueString ?? JSON.stringify({ shortListCodes: ['UC'], primaryCode: 'UC' }),
      },
    ];
  }
  return basic;
}

function createMockOystehr(existing: Basic[] = []): {
  client: any;
  search: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue({ unbundle: () => existing });
  const create = vi.fn().mockImplementation((resource: Basic) => Promise.resolve({ ...resource, id: 'created-id' }));
  const update = vi.fn().mockImplementation((resource: Basic) => Promise.resolve(resource));
  return {
    client: { fhir: { search, create, update } } as any,
    search,
    create,
    update,
  };
}

// ---------------------------------------------------------------------------
// getEligibilityVerificationConfigPayload
// ---------------------------------------------------------------------------

describe('getEligibilityVerificationConfigPayload', () => {
  test('returns defaults with undefined id when no Basic exists', async () => {
    const { client, search } = createMockOystehr([]);

    const result = await getEligibilityVerificationConfigPayload(client);

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Basic',
        params: [
          {
            name: '_tag',
            value: `${ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG.system}|${ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG.code}`,
          },
        ],
      })
    );
    expect(result.shortListCodes).toEqual([...DEFAULT_ELIGIBILITY_SHORT_LIST_CODES]);
    expect(result.primaryCode).toBe(DEFAULT_ELIGIBILITY_PRIMARY_CODE);
    expect(result.id).toBeUndefined();
  });

  test('returns defaults with the Basic id when the resource exists but has no stored JSON', async () => {
    const { client } = createMockOystehr([makeConfigBasic({ id: 'basic-99', valueString: null })]);

    const result = await getEligibilityVerificationConfigPayload(client);

    expect(result.shortListCodes).toEqual([...DEFAULT_ELIGIBILITY_SHORT_LIST_CODES]);
    expect(result.primaryCode).toBe(DEFAULT_ELIGIBILITY_PRIMARY_CODE);
    expect(result.id).toBe('basic-99');
  });

  test('parses stored JSON and returns config with the Basic id', async () => {
    const stored = JSON.stringify({ shortListCodes: ['UC', '30'], primaryCode: '30' });
    const { client } = createMockOystehr([makeConfigBasic({ id: 'basic-7', valueString: stored })]);

    const result = await getEligibilityVerificationConfigPayload(client);

    expect(result.shortListCodes).toEqual(['UC', '30']);
    expect(result.primaryCode).toBe('30');
    expect(result.id).toBe('basic-7');
  });

  test('drops primaryCode when it is not part of shortListCodes', async () => {
    const stored = JSON.stringify({ shortListCodes: ['UC'], primaryCode: '30' });
    const { client } = createMockOystehr([makeConfigBasic({ valueString: stored })]);

    const result = await getEligibilityVerificationConfigPayload(client);

    expect(result.shortListCodes).toEqual(['UC']);
    expect(result.primaryCode).toBeUndefined();
  });

  test('coerces a non-array shortListCodes to an empty array', async () => {
    const stored = JSON.stringify({ shortListCodes: 'UC', primaryCode: 'UC' });
    const { client } = createMockOystehr([makeConfigBasic({ valueString: stored })]);

    const result = await getEligibilityVerificationConfigPayload(client);

    expect(result.shortListCodes).toEqual([]);
    expect(result.primaryCode).toBeUndefined();
  });

  test('falls back to defaults (with id) when stored JSON is invalid', async () => {
    const { client } = createMockOystehr([makeConfigBasic({ id: 'basic-bad', valueString: '{not valid json' })]);

    const result = await getEligibilityVerificationConfigPayload(client);

    expect(result.shortListCodes).toEqual([...DEFAULT_ELIGIBILITY_SHORT_LIST_CODES]);
    expect(result.primaryCode).toBe(DEFAULT_ELIGIBILITY_PRIMARY_CODE);
    expect(result.id).toBe('basic-bad');
  });
});

// ---------------------------------------------------------------------------
// saveEligibilityVerificationConfig
// ---------------------------------------------------------------------------

describe('saveEligibilityVerificationConfig', () => {
  test('creates a new Basic when none exists', async () => {
    const { client, create, update } = createMockOystehr([]);

    await saveEligibilityVerificationConfig(client, { shortListCodes: ['UC', '30'], primaryCode: 'UC' });

    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    const created = create.mock.calls[0][0] as Basic;
    expect(created.resourceType).toBe('Basic');
    expect(created.meta?.tag).toEqual([ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG]);
    expect(created.code?.coding).toEqual([ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG]);
    const ext = created.extension?.find((e) => e.url === ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL);
    expect(JSON.parse(ext!.valueString!)).toEqual({ shortListCodes: ['UC', '30'], primaryCode: 'UC' });
  });

  test('updates the existing Basic with optimistic locking when one exists', async () => {
    const { client, create, update } = createMockOystehr([makeConfigBasic({ id: 'basic-42', versionId: 'v3' })]);

    await saveEligibilityVerificationConfig(client, { shortListCodes: ['30'], primaryCode: '30' });

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    const [updatedResource, options] = update.mock.calls[0];
    expect((updatedResource as Basic).id).toBe('basic-42');
    expect(options).toEqual({ optimisticLockingVersionId: 'v3' });
    const ext = (updatedResource as Basic).extension?.find(
      (e) => e.url === ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL
    );
    expect(JSON.parse(ext!.valueString!)).toEqual({ shortListCodes: ['30'], primaryCode: '30' });
  });

  test('updates without optimistic locking when the existing Basic has no versionId', async () => {
    const { client, update } = createMockOystehr([makeConfigBasic({ id: 'basic-77' })]);

    await saveEligibilityVerificationConfig(client, { shortListCodes: ['UC'], primaryCode: 'UC' });

    expect(update).toHaveBeenCalledTimes(1);
    const [, options] = update.mock.calls[0];
    expect(options).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateRequestParameters (admin-update-eligibility-verification-config)
// ---------------------------------------------------------------------------

describe('validateRequestParameters (admin-update-eligibility-verification-config)', () => {
  function makeZambdaInput(
    body: unknown,
    headers: Record<string, string> | null = { Authorization: 'Bearer tkn' }
  ): ZambdaInput {
    return {
      body: typeof body === 'string' ? body : JSON.stringify(body),
      secrets: { SECRET_KEY: 'test-value' },
      headers,
      requestContext: null,
      callerAccessToken: null,
    } as unknown as ZambdaInput;
  }

  test('accepts valid input and strips the bearer prefix', () => {
    const result = validateRequestParameters(makeZambdaInput({ shortListCodes: ['UC', '30'], primaryCode: 'UC' }));

    expect(result.shortListCodes).toEqual(['UC', '30']);
    expect(result.primaryCode).toBe('UC');
    expect(result.userToken).toBe('tkn');
  });

  test('accepts input without a primaryCode', () => {
    const result = validateRequestParameters(makeZambdaInput({ shortListCodes: ['UC'] }));

    expect(result.shortListCodes).toEqual(['UC']);
    expect(result.primaryCode).toBeUndefined();
  });

  test('throws when the request body is missing', () => {
    expect(() => validateRequestParameters(makeZambdaInput(undefined as unknown as string))).toThrow();
  });

  test('throws when the Authorization header is missing', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ shortListCodes: ['UC'] }, null))).toThrow();
  });

  test('throws when the body is not valid JSON', () => {
    expect(() => validateRequestParameters(makeZambdaInput('{not json'))).toThrow();
  });

  test('throws when shortListCodes exceeds the maximum of 3', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ shortListCodes: ['UC', '30', '1', '2'] }))).toThrow();
  });

  test('throws when primaryCode is not one of shortListCodes', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ shortListCodes: ['UC'], primaryCode: '30' }))).toThrow();
  });
});
