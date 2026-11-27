import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { ClaimResponse, FhirResource, Organization, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ERA_VOID_STATUS } from 'utils/lib/types/data/billing/billing.constants';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { OkResponse } from 'utils/lib/types/data/billing/billing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  ManualEraBillingProviderAndPayer,
} from '../../../src/billing/manual-era';
import { ERA_VOID_ACTIVITY_CODE, PROVENANCE_ACTIVITY_TYPE_SYSTEM } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('void-billing-era', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  let seeded: FhirResource[] = [];
  let era: PaymentReconciliation;
  let responses: ClaimResponse[];

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  const remitClaim = (patientName: string, procedureCode: string): ManualEraClaim => ({
    statusCode: '1',
    patientName,
    serviceLines: [
      {
        serviceDate: '2026-03-01',
        procedureCode,
        billedCents: 10000,
        allowedCents: 8000,
        paidCents: 8000,
        adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 2000 }],
        remarkCodes: [],
      },
    ],
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/void-billing-era.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const [payer, billingProvider] = (
      await billing.fhir.transaction<Organization>({
        requests: [
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({ resourceType: 'Organization', name: `Void Payer ${unique}` }),
          },
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({ resourceType: 'Organization', name: `Void Billing Group ${unique}` }),
          },
        ],
      })
    ).entry!.map((entry) => entry.resource!);
    seeded.push(payer, billingProvider);

    const header: ManualEraHeader = {
      payerId: payer.id!,
      billingProviderRef: `Organization/${billingProvider.id}`,
      checkNumber: `VOID-${unique}`,
      checkAmountCents: 16000,
      remitDate: '2026-03-10',
      checkDate: '2026-03-09',
    };
    const billingProviderAndPayer: ManualEraBillingProviderAndPayer = {
      payer: { reference: `Organization/${payer.id}`, display: payer.name! },
      billingProvider: { reference: `Organization/${billingProvider.id}`, name: billingProvider.name! },
    };
    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/PaymentReconciliation',
        fullUrl: 'urn:uuid:era',
        resource: tagged(
          buildManualPaymentReconciliation({
            header,
            billingProviderAndPayer,
            created: '2026-03-10T12:00:00.000Z',
            editedAt: '2026-03-10T12:00:00.000Z',
          })
        ),
      },
      ...['99213', '99214'].map(
        (procedureCode, index): BatchInputRequest<FhirResource> => ({
          method: 'POST',
          url: '/ClaimResponse',
          fullUrl: `urn:uuid:response-${index}`,
          resource: tagged(
            buildManualClaimResponse({
              claim: remitClaim(`Pat Voided${unique}`, procedureCode),
              header,
              billingProviderAndPayer,
            })
          ),
        })
      ),
      {
        method: 'POST',
        url: '/Provenance',
        resource: tagged(
          buildManualEraProvenance({
            targets: ['urn:uuid:era', 'urn:uuid:response-0', 'urn:uuid:response-1'],
            agent: { reference: callerProfile, display: 'Integration Biller' },
            recorded: '2026-03-10T12:00:00.000Z',
          })
        ),
      },
    ];
    const eraResources = (await billing.fhir.transaction<FhirResource>({ requests })).entry!.map(
      (entry) => entry.resource!
    );
    era = eraResources.find(
      (resource): resource is PaymentReconciliation => resource.resourceType === 'PaymentReconciliation'
    )!;
    responses = eraResources.filter((resource): resource is ClaimResponse => resource.resourceType === 'ClaimResponse');
    seeded = [...seeded, ...eraResources];
  }, 60_000);

  afterAll(async () => {
    const voidRecords = (
      await admin.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `PaymentReconciliation/${era.id}` }],
      })
    ).unbundle();
    const urls = [
      ...new Set([
        ...voidRecords.map((provenance) => `Provenance/${provenance.id}`),
        ...seeded.reverse().map((resource) => `${resource.resourceType}/${resource.id}`),
      ]),
    ];
    await admin.fhir
      .batch({ requests: urls.map((url) => ({ method: 'DELETE' as const, url })) })
      .catch((error) => console.error('void-billing-era cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('voids the ERA and every remit on it and records the void as the caller', async () => {
    const output = (await caller.zambda.execute({ id: 'void-billing-era', eraId: era.id })).output as OkResponse;

    expect(output).toEqual({ ok: true });
    const [voidedEra, ...voidedResponses] = await Promise.all([
      billing.fhir.get<PaymentReconciliation>({ resourceType: 'PaymentReconciliation', id: era.id! }),
      ...responses.map((response) =>
        billing.fhir.get<ClaimResponse>({ resourceType: 'ClaimResponse', id: response.id! })
      ),
    ]);
    expect(voidedEra.status).toBe(ERA_VOID_STATUS);
    expect(voidedResponses.map((response) => response.status)).toEqual([ERA_VOID_STATUS, ERA_VOID_STATUS]);

    const voidRecords = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `PaymentReconciliation/${era.id}` }],
      })
    )
      .unbundle()
      .filter((provenance) => provenance.activity?.coding?.[0]?.code === ERA_VOID_ACTIVITY_CODE);
    expect(voidRecords).toHaveLength(1);
    expect(voidRecords[0].activity?.coding).toEqual([
      { system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code: ERA_VOID_ACTIVITY_CODE },
    ]);
    expect(voidRecords[0].target.map((target) => target.reference)).toEqual([
      `PaymentReconciliation/${era.id}`,
      ...responses.map((response) => `ClaimResponse/${response.id}`),
    ]);
    expect(voidRecords[0].agent[0].who?.reference).toBe(callerProfile);
  }, 60_000);
});
