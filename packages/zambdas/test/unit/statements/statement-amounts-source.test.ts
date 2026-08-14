import Oystehr from '@oystehr/sdk';
import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStatementAmountsSource } from '../../../src/shared/statements/get-statement-details';

const getOrCreateCandidApiClient = vi.hoisted(() => vi.fn());

vi.mock('utils/lib/helpers/candidApi', () => ({
  getOrCreateCandidApiClient,
}));

const oystehr = {} as Oystehr;
const secretsWith = (patientBalanceSource?: string): Secrets =>
  ({
    FHIR_API: 'https://fhir-api.example.com/r4',
    PROJECT_API: 'https://project-api.example.com/v1',
    ...(patientBalanceSource === undefined
      ? {}
      : {
          PATIENT_BALANCE_SOURCE: patientBalanceSource,
        }),
  }) as unknown as Secrets;

describe('resolveStatementAmountsSource', () => {
  beforeEach(() => {
    getOrCreateCandidApiClient.mockReset();
    getOrCreateCandidApiClient.mockResolvedValue({ candid: true });
  });

  it('reads statement amounts from ottehr billing when PATIENT_BALANCE_SOURCE says so', async () => {
    const amountsSource = await resolveStatementAmountsSource({
      secrets: secretsWith('ottehr'),
      oystehr,
      m2mToken: 'token',
    });

    expect(amountsSource.source).toBe('ottehr-billing');
    expect(getOrCreateCandidApiClient).not.toHaveBeenCalled();
  });

  it('builds a billing client and an untagged era client, since ERA resources carry no tag', async () => {
    const amountsSource = await resolveStatementAmountsSource({
      secrets: secretsWith('ottehr'),
      oystehr,
      m2mToken: 'token',
    });

    if (amountsSource.source !== 'ottehr-billing') throw new Error('expected the ottehr billing source');
    expect(amountsSource.billingOystehr).not.toBe(amountsSource.eraReadOystehr);
  });

  it.each([['candid'], [undefined], ['#{var/PATIENT_BALANCE_SOURCE}']])(
    'falls back to candid when PATIENT_BALANCE_SOURCE is %s',
    async (patientBalanceSource) => {
      const amountsSource = await resolveStatementAmountsSource({
        secrets: secretsWith(patientBalanceSource),
        oystehr,
        m2mToken: 'token',
      });

      expect(amountsSource).toEqual({
        source: 'candid',
        candidApiClient: { candid: true },
      });
      expect(getOrCreateCandidApiClient).toHaveBeenCalledWith(oystehr, secretsWith(patientBalanceSource));
    }
  );
});
