import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Patient, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { GetBillingPatientBalanceResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildPaymentNotice,
  claimRequestFor,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
} from '../../../src/billing/payments';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('get-billing-patient-balance', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const patientFamily = `Balance${randomUUID().slice(0, 8)}`;
  const owingEncounterId = randomUUID();
  const overpaidEncounterId = randomUUID();
  let patientId: string;
  let owingClaimId: string;
  let overpaidClaimId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T;
  };

  const seedPatientArClaim = async (encounterId: string, billed: number, paid: number): Promise<string> => {
    const claim = await seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-08-03',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${patientId}` },
      provider: { display: 'Integration Medical Group' },
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: billed, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate: '2026-08-03' }],
      meta: {
        tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }),
      },
    });
    await seed<PaymentNotice>(
      buildPaymentNotice({
        request: claimRequestFor(claim, encounterId),
        payee: { display: 'Integration Medical Group' },
        amountInCents: paid * 100,
        paymentMethod: 'cash',
        identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
        paymentDate: '2026-08-10',
        createdISO: '2026-08-10T15:00:00.000Z',
        disposition: 'cash payment collected manually',
      })
    );
    return claim.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-patient-balance.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    patientId = (
      await seed<Patient>({
        resourceType: 'Patient',
        active: true,
        name: [{ family: patientFamily, given: ['Avery'] }],
        birthDate: '1985-04-12',
      })
    ).id!;
    owingClaimId = await seedPatientArClaim(owingEncounterId, 200, 50);
    overpaidClaimId = await seedPatientArClaim(overpaidEncounterId, 40, 60);
  }, 120_000);

  afterAll(async () => {
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it("sums the encounters' patient AR claims net of what the patient paid, overpaid claims included", async () => {
    const response = (
      await oystehr.zambda.execute({
        id: 'get-billing-patient-balance',
        encounterIds: [owingEncounterId, overpaidEncounterId],
      })
    ).output as unknown as GetBillingPatientBalanceResponse;

    const byClaimId = new Map(response.claims.map((claim) => [claim.claimId, claim]));
    expect([...byClaimId.keys()].sort()).toEqual([owingClaimId, overpaidClaimId].sort());
    expect(byClaimId.get(owingClaimId)).toMatchObject({
      patientId,
      patientName: `${patientFamily}, Avery`,
      patientDob: '1985-04-12',
      encounterId: owingEncounterId,
      serviceDate: '2026-08-03',
      billed: 200,
      patientPaid: 50,
      balance: 150,
    });
    expect(byClaimId.get(overpaidClaimId)).toMatchObject({
      encounterId: overpaidEncounterId,
      billed: 40,
      patientPaid: 60,
      balance: -20,
    });
    expect(response.balance).toEqual({ currentBalance: 130, claimsWithPatientBalance: 1 });
  }, 120_000);
});
