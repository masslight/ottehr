import Oystehr from '@oystehr/sdk';
import { Claim } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/get-billing-invoice-recipient';

const makeClaim = (patientArStatus: string): Claim =>
  ({
    resourceType: 'Claim',
    id: 'claim-1',
    identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: 'enc-1' }],
    meta: {
      tag: [
        { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient },
        { system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus, code: patientArStatus },
      ],
    },
  }) as Claim;

// What the clinical get-billing-invoice-visit answers for the visit.
const recipient = {
  patient: { fullName: 'Katie Test', dob: '05/04/2010', gender: 'Female', phoneNumber: '+12025550199' },
  responsibleParty: { fullName: 'Jane Test', email: 'jane@example.com', phoneNumber: '+12025550101' },
  location: 'Downtown Clinic',
  visitDate: '07/01/2026',
};

const makeOystehr = (claim: Claim): { oystehr: Oystehr; execute: ReturnType<typeof vi.fn> } => {
  const execute = vi.fn(async () => ({ output: recipient }));
  return {
    oystehr: {
      fhir: { search: async () => ({ unbundle: () => [claim] }) },
      zambda: { execute },
    } as unknown as Oystehr,
    execute,
  };
};

describe('get-billing-invoice-recipient', () => {
  it("asks the clinical side who the claim's visit is invoiced to", async () => {
    const { oystehr, execute } = makeOystehr(makeClaim('ready-to-invoice'));

    expect(await performEffect(oystehr, 'claim-1')).toEqual(recipient);
    expect(execute).toHaveBeenCalledWith({ id: 'get-billing-invoice-visit', encounterId: 'enc-1' });
  });

  it('rejects a claim that cannot be invoiced before reading the visit', async () => {
    const { oystehr, execute } = makeOystehr(makeClaim('not-invoiced'));

    await expect(performEffect(oystehr, 'claim-1')).rejects.toMatchObject({
      message: 'Only Patient AR claims that are ready to invoice, invoiced or finalized can be invoiced',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
