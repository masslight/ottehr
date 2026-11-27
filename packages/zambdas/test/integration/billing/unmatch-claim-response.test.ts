import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, ClaimResponse, FhirResource, Organization, Patient, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  ClaimFieldChange,
} from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  ManualEraBillingProviderAndPayer,
} from '../../../src/billing/manual-era';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('unmatch-claim-response', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  let seeded: FhirResource[] = [];
  let claim: Claim;
  let response: ClaimResponse;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/unmatch-claim-response.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const parties = (
      await billing.fhir.transaction<FhirResource>({
        requests: [
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({ resourceType: 'Organization', name: `Unmatch Payer ${unique}` }),
          },
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({ resourceType: 'Organization', name: `Unmatch Billing Group ${unique}` }),
          },
          {
            method: 'POST',
            url: '/Patient',
            fullUrl: 'urn:uuid:patient',
            resource: tagged<Patient>({
              resourceType: 'Patient',
              name: [{ family: `Unmatched${unique}`, given: ['Uma'] }],
            }),
          },
          {
            method: 'POST',
            url: '/Claim',
            resource: tagged<Claim>({
              resourceType: 'Claim',
              // not active, so the ERA-match subscription (request.status=active) leaves the claim alone
              status: 'draft',
              use: 'claim',
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
              patient: { reference: 'urn:uuid:patient' },
              created: '2026-03-01',
              provider: { display: 'Unknown' },
              priority: {
                coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
              },
              insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
              total: { value: 100, currency: 'USD' },
            }),
          },
        ],
      })
    ).entry!.map((entry) => entry.resource!);
    const [payer, billingProvider] = parties.filter(
      (resource): resource is Organization => resource.resourceType === 'Organization'
    );
    claim = parties.find((resource): resource is Claim => resource.resourceType === 'Claim')!;
    seeded.push(...parties);

    const header: ManualEraHeader = {
      payerId: payer.id!,
      billingProviderRef: `Organization/${billingProvider.id}`,
      checkNumber: `UNMATCH-${unique}`,
      checkAmountCents: 8000,
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
      {
        method: 'POST',
        url: '/ClaimResponse',
        fullUrl: 'urn:uuid:response',
        resource: tagged(
          buildManualClaimResponse({
            claim: {
              statusCode: '1',
              patientName: `Uma Unmatched${unique}`,
              serviceLines: [
                {
                  serviceDate: '2026-03-01',
                  procedureCode: '99213',
                  billedCents: 10000,
                  allowedCents: 8000,
                  paidCents: 8000,
                  adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 2000 }],
                  remarkCodes: [],
                },
              ],
            },
            header,
            billingProviderAndPayer,
            matchedClaim: { id: claim.id, patient: claim.patient, type: claim.type },
          })
        ),
      },
      {
        method: 'POST',
        url: '/Provenance',
        resource: tagged(
          buildManualEraProvenance({
            targets: ['urn:uuid:era', 'urn:uuid:response'],
            agent: { reference: callerProfile, display: 'Integration Biller' },
            recorded: '2026-03-10T12:00:00.000Z',
          })
        ),
      },
    ];
    const eraResources = (await billing.fhir.transaction<FhirResource>({ requests })).entry!.map(
      (entry) => entry.resource!
    );
    response = eraResources.find((resource): resource is ClaimResponse => resource.resourceType === 'ClaimResponse')!;
    seeded = [...seeded, ...eraResources];
  }, 60_000);

  afterAll(async () => {
    const history = (
      await admin.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `ClaimResponse/${response.id}` }],
      })
    ).unbundle();
    const urls = [
      ...new Set([
        ...history.map((provenance) => `Provenance/${provenance.id}`),
        ...seeded.reverse().map((resource) => `${resource.resourceType}/${resource.id}`),
      ]),
    ];
    await admin.fhir
      .batch({ requests: urls.map((url) => ({ method: 'DELETE' as const, url })) })
      .catch((error) => console.error('unmatch-claim-response cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('puts the remit back on its keyed claim and records the unmatch in the claim history as the caller', async () => {
    const output = (await caller.zambda.execute({ id: 'unmatch-claim-response', claimResponseId: response.id }))
      .output as ClaimResponse;

    expect(output.id).toBe(response.id);
    expect(output.request).toEqual({ reference: '#request' });
    expect(output.patient).toEqual({ reference: '#patient' });
    expect(output.insurer).toEqual(response.insurer);
    expect(output.type.coding?.[0]?.code).toBe('unknown');
    const stored = await billing.fhir.get<ClaimResponse>({ resourceType: 'ClaimResponse', id: response.id! });
    expect(stored.request).toEqual({ reference: '#request' });

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claim.id}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].target).toEqual([
      { reference: `ClaimResponse/${response.id}` },
      { reference: `Claim/${claim.id}` },
    ]);
    expect(history[0].activity?.coding).toEqual([CLAIM_PROVENANCE_ACTIVITY.update]);
    expect(history[0].agent).toEqual([
      { type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: callerProfile } },
    ]);
    const changes = JSON.parse(
      history[0].extension?.find((extension) => extension.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)?.valueString ??
        '[]'
    ) as ClaimFieldChange[];
    expect(changes).toContainEqual(expect.objectContaining({ field: 'matchedClaim', previousValue: claim.id }));
  }, 60_000);
});
