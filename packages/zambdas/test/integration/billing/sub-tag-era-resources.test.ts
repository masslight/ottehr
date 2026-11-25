import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { ClaimResponse, FhirResource, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OYSTEHR_ADJUDICATION_SYSTEM } from '../../../src/billing/claim-amounts';
import { ERA_PROCESSING_ACTIVITY_CODE, PROVENANCE_ACTIVITY_TYPE_SYSTEM } from '../../../src/billing/shared';
import { index } from '../../../src/subscriptions/payment-reconciliation/sub-tag-era-resources/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

const hasBillingTag = (resource: FhirResource): boolean =>
  resource.meta?.tag?.some(
    (tag) => tag.system === BILLING_RESOURCE_TAG.system && tag.code === BILLING_RESOURCE_TAG.code
  ) ?? false;

describe('sub-tag-era-resources', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const payer = `Era Payer ${randomUUID().slice(0, 8)}`;
  const now = DateTime.now().toUTC();
  let paymentReconciliation: PaymentReconciliation;
  let claimResponses: ClaimResponse[];
  let provenance: Provenance;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<T> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T;
  };

  const eraClaimResponse = (paid: number): ClaimResponse => ({
    resourceType: 'ClaimResponse',
    status: 'active',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    use: 'claim',
    patient: { display: 'Era Patient' },
    created: now.toISO()!,
    insurer: { display: payer },
    outcome: 'complete',
    total: [
      {
        category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: 'paid' }] },
        amount: { value: paid, currency: 'USD' },
      },
    ],
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/sub-tag-era-resources.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    [paymentReconciliation, ...claimResponses] = await Promise.all([
      seed<PaymentReconciliation>(oystehrBilling, {
        resourceType: 'PaymentReconciliation',
        status: 'active',
        created: now.toISO()!,
        paymentDate: now.toISODate()!,
        paymentAmount: { value: 125, currency: 'USD' },
        paymentIssuer: { display: payer },
      }),
      seed<ClaimResponse>(oystehr, eraClaimResponse(100)),
      seed<ClaimResponse>(oystehr, eraClaimResponse(25)),
    ]);

    provenance = await seed<Provenance>(oystehr, {
      resourceType: 'Provenance',
      target: [
        { reference: `PaymentReconciliation/${paymentReconciliation.id}` },
        ...claimResponses.map((claimResponse) => ({ reference: `ClaimResponse/${claimResponse.id}` })),
      ],
      recorded: now.toISO()!,
      activity: { coding: [{ system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code: ERA_PROCESSING_ACTIVITY_CODE }] },
      agent: [{ who: { display: 'Oystehr RCM' } }],
    });
  }, 60_000);

  afterAll(async () => {
    if (seededDeletes.length > 0) await oystehr.fhir.batch({ requests: seededDeletes });
    await cleanup();
  }, 60_000);

  it('tags the untagged provenance and claim responses of the ERA as billing resources', async () => {
    expect(hasBillingTag(paymentReconciliation)).toBe(true);
    expect([provenance, ...claimResponses].some(hasBillingTag)).toBe(false);

    const { statusCode, output } = await invokeZambdaHandler<{ tagged: number }>(index, paymentReconciliation, {
      token,
    });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ tagged: 3 });

    const stored = await Promise.all([
      oystehr.fhir.get<PaymentReconciliation>({ resourceType: 'PaymentReconciliation', id: paymentReconciliation.id! }),
      oystehr.fhir.get<Provenance>({ resourceType: 'Provenance', id: provenance.id! }),
      ...claimResponses.map((claimResponse) =>
        oystehr.fhir.get<ClaimResponse>({ resourceType: 'ClaimResponse', id: claimResponse.id! })
      ),
    ]);
    expect(stored.map(hasBillingTag)).toEqual([true, true, true, true]);
    expect(stored.every((resource) => resource.meta?.tag?.some((tag) => tag.code === processId))).toBe(true);
  });
});
