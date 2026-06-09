import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG, Secrets } from 'utils';
import { describe, expect, test, vi } from 'vitest';
import { performEffect } from '../../src/ehr/tag-encounter-erx-synced/index';
import { validateRequestParameters } from '../../src/ehr/tag-encounter-erx-synced/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

const secrets = {} as Secrets;

const makeInput = (body: unknown): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(body),
  secrets,
});

const makeEncounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: {
    system: 'system',
    code: 'ACUTE',
  },
  meta: {
    versionId: 'v1',
  },
  ...overrides,
});

describe('tag-encounter-erx-synced validateRequestParameters', () => {
  test('parses encounterId from the body and passes through secrets', () => {
    const result = validateRequestParameters(makeInput({ encounterId: 'enc-1' }));
    expect(result.encounterId).toBe('enc-1');
    expect(result.secrets).toBe(secrets);
  });

  test('throws when encounterId is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow();
  });

  test('throws when encounterId is not a string', () => {
    expect(() => validateRequestParameters(makeInput({ encounterId: 123 }))).toThrow();
  });

  test('throws when encounterId is an empty string', () => {
    expect(() => validateRequestParameters(makeInput({ encounterId: '' }))).toThrow();
  });

  test('throws when the body is not a JSON object', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: JSON.stringify('not-an-object'),
        secrets,
      })
    ).toThrow();
  });

  test('throws when the body is missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: null,
        secrets,
      })
    ).toThrow();
  });

  test('throws when secrets are missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: JSON.stringify({ encounterId: 'enc-1' }),
        secrets: null,
      })
    ).toThrow();
  });
});

describe('tag-encounter-erx-synced performEffect', () => {
  test('fetches the encounter by id, tags it, and reports tagged', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue(makeEncounter());
    const oystehr = {
      fhir: {
        get,
        patch,
      },
    } as unknown as Oystehr;

    const result = await performEffect(
      {
        encounterId: 'enc-1',
        secrets,
      },
      oystehr
    );

    expect(get).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      id: 'enc-1',
    });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ tagged: true });
  });

  test('does not patch when the encounter is already tagged', async () => {
    const patch = vi.fn();
    const get = vi.fn().mockResolvedValue(
      makeEncounter({
        meta: {
          tag: [FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG],
        },
      })
    );
    const oystehr = {
      fhir: {
        get,
        patch,
      },
    } as unknown as Oystehr;

    const result = await performEffect(
      {
        encounterId: 'enc-1',
        secrets,
      },
      oystehr
    );

    expect(patch).not.toHaveBeenCalled();
    expect(result).toEqual({ tagged: true });
  });
});
