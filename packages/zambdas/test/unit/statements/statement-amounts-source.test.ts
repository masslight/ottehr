import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BILLING_APP_INVOICE_STATEMENT_INPUT,
  isBillingAppInvoiceStatement,
  resolveStatementAmountsSource,
} from '../../../src/shared/statements/get-statement-details';

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
    expect(amountsSource.billingOystehr.config.workspaceTag).toEqual(BILLING_RESOURCE_TAG);
    expect(amountsSource.eraReadOystehr.config.workspaceTag).toBeUndefined();
  });

  it('reads ottehr billing amounts for a billing app invoice even when PATIENT_BALANCE_SOURCE is candid', async () => {
    const amountsSource = await resolveStatementAmountsSource({
      secrets: secretsWith('candid'),
      oystehr,
      m2mToken: 'token',
      billingAppInvoice: true,
    });

    expect(amountsSource.source).toBe('ottehr-billing');
    expect(getOrCreateCandidApiClient).not.toHaveBeenCalled();
  });

  it('recognizes generate statement tasks the billing app asked for', () => {
    expect(isBillingAppInvoiceStatement({ input: [BILLING_APP_INVOICE_STATEMENT_INPUT] } as Task)).toBe(true);
    expect(isBillingAppInvoiceStatement({} as Task)).toBe(false);
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
