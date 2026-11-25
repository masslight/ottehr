import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, ClaimResponse, FhirResource, Organization, Patient, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { setNpi } from 'utils/lib/fhir/helpers';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { SaveManualEraResponse } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCustomInsuranceOrganization } from '../../../src/billing/custom-insurance-org.helpers';
import { PROVIDER_ROLE_BILLING, PROVIDER_ROLE_TAG } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('save-billing-manual-era', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  const unique = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const payerBusinessId = `OTR-${unique}`;
  const billingProviderName = `Integration Group ${unique}`;
  let payerId: string;
  let billingProviderId: string;
  let patientId: string;
  let firstClaimId: string;
  let secondClaimId: string;
  let eraId: string | undefined;
  const claimResponseIds: string[] = [];

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.push({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  const provenancesTargeting = async (references: string[]): Promise<Provenance[]> =>
    (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: references.join(',') }],
      })
    ).unbundle();

  const header = (notes: string): ManualEraHeader => ({
    payerId: payerBusinessId,
    billingProviderRef: `Organization/${billingProviderId}`,
    checkNumber: `CHK${unique}`,
    checkAmountCents: 20000,
    remitDate: '2026-11-20',
    checkDate: '2026-11-18',
    notes,
  });

  const remitClaim = (clientKey: string, matchedClaimId: string): ManualEraClaim => ({
    clientKey,
    matchedClaimId,
    statusCode: '1',
    patientName: 'DOE, JANE',
    serviceLines: [
      {
        serviceDate: '2026-11-01',
        procedureCode: '99213',
        billedCents: 15000,
        allowedCents: 10000,
        paidCents: 10000,
        adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 5000 }],
        remarkCodes: [],
      },
    ],
  });

  const draftClaim = (): Claim => ({
    resourceType: 'Claim',
    status: 'draft',
    use: 'claim',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    patient: { reference: `Patient/${patientId}` },
    created: '2026-11-01',
    provider: { reference: `Organization/${billingProviderId}` },
    priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
    insurance: [{ sequence: 1, focal: true, coverage: { display: 'Integration Coverage' } }],
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/save-billing-manual-era.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const billingProvider: Organization = {
      resourceType: 'Organization',
      name: billingProviderName,
      meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_BILLING }] },
    };
    setNpi(billingProvider, '1234567893');
    const [payer, provider, patient] = await Promise.all([
      seed<Organization>(
        buildCustomInsuranceOrganization({
          orgId: payerBusinessId,
          name: `Integration Payer ${unique}`,
          insuranceTypes: ['medical'],
          submissionMechanism: 'mail',
          acceptedClaimForm: 'cms-1500',
        })
      ),
      seed<Organization>(billingProvider),
      seed<Patient>({ resourceType: 'Patient', name: [{ given: ['Jane'], family: 'Doe' }] }),
    ]);
    payerId = payer.id;
    billingProviderId = provider.id;
    patientId = patient.id;
    const [firstClaim, secondClaim] = await Promise.all([seed<Claim>(draftClaim()), seed<Claim>(draftClaim())]);
    firstClaimId = firstClaim.id;
    secondClaimId = secondClaim.id;
  }, 120_000);

  afterAll(async () => {
    const provenances = await provenancesTargeting([
      `Claim/${firstClaimId}`,
      `Claim/${secondClaimId}`,
      ...(eraId ? [`PaymentReconciliation/${eraId}`] : []),
    ]);
    await billing.fhir.batch({
      requests: [
        ...provenances.map(
          (provenance): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${provenance.id}` })
        ),
        ...claimResponseIds.map((id): BatchInputDeleteRequest => ({ method: 'DELETE', url: `ClaimResponse/${id}` })),
        ...(eraId ? [{ method: 'DELETE', url: `PaymentReconciliation/${eraId}` } as BatchInputDeleteRequest] : []),
        ...deletes.reverse(),
      ],
    });
    await cleanup();
  }, 120_000);

  it('adds a claim to a stored manual remit and saves the changed remit details', async () => {
    const created = (
      await caller.zambda.execute({
        id: 'save-billing-manual-era',
        header: header('Keyed from paper'),
        claims: [remitClaim('first', firstClaimId)],
      })
    ).output as SaveManualEraResponse;
    eraId = created.eraId;
    claimResponseIds.push(...created.claims.map((claim) => claim.claimResponseId));
    expect(created.claims).toEqual([{ clientKey: 'first', claimResponseId: expect.any(String) }]);

    const updated = (
      await caller.zambda.execute({
        id: 'save-billing-manual-era',
        eraId: created.eraId,
        expectedVersionId: created.versionId,
        header: header('Corrected after a call'),
        claims: [remitClaim('second', secondClaimId)],
      })
    ).output as SaveManualEraResponse;
    claimResponseIds.push(...updated.claims.map((claim) => claim.claimResponseId));
    expect(updated.eraId).toBe(created.eraId);
    expect(updated.versionId).not.toBe(created.versionId);
    expect(updated.claims).toEqual([{ clientKey: 'second', claimResponseId: expect.any(String) }]);
    const [firstClaimResponseId, secondClaimResponseId] = claimResponseIds;

    const remit = await billing.fhir.get<PaymentReconciliation>({
      resourceType: 'PaymentReconciliation',
      id: created.eraId,
    });
    expect(remit.paymentIssuer?.reference).toBe(`Organization/${payerId}`);
    expect(remit.requestor).toEqual({ reference: `Organization/${billingProviderId}`, display: billingProviderName });
    expect(remit.processNote).toEqual([{ type: 'display', text: 'Corrected after a call' }]);

    const secondClaimResponse = await billing.fhir.get<ClaimResponse>({
      resourceType: 'ClaimResponse',
      id: secondClaimResponseId,
    });
    expect(secondClaimResponse.request?.reference).toBe(`Claim/${secondClaimId}`);
    expect(secondClaimResponse.patient.reference).toBe(`Patient/${patientId}`);
    expect(secondClaimResponse.insurer.reference).toBe(`Organization/${payerId}`);

    const [eraProvenance] = await provenancesTargeting([`PaymentReconciliation/${created.eraId}`]);
    expect(eraProvenance.target.map((target) => target.reference)).toEqual([
      `PaymentReconciliation/${created.eraId}`,
      `ClaimResponse/${firstClaimResponseId}`,
      `ClaimResponse/${secondClaimResponseId}`,
    ]);
    expect(eraProvenance.agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);

    const secondClaimHistory = await provenancesTargeting([`Claim/${secondClaimId}`]);
    expect(secondClaimHistory).toHaveLength(1);
    expect(secondClaimHistory[0].target.map((target) => target.reference)).toEqual([
      `ClaimResponse/${secondClaimResponseId}`,
      `Claim/${secondClaimId}`,
    ]);
    expect(secondClaimHistory[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.create);
    expect(secondClaimHistory[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
