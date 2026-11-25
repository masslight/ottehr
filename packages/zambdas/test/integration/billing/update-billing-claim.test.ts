import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Organization, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { CLAIM_NON_INSURANCE_PAYER_EXTENSION_URL } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCustomInsuranceOrganization } from '../../../src/billing/custom-insurance-org.helpers';
import { buildNioOrganization } from '../../../src/billing/non-insurance-org.helpers';
import { EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('update-billing-claim', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  const payerBusinessId = `OTR-${randomUUID()}`;
  let payerId: string;
  let nioId: string;
  let orderingProviderId: string;
  let claimId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/update-billing-claim.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const [payer, nio, orderingProvider, claim] = await Promise.all([
      seed<Organization>(
        buildCustomInsuranceOrganization({
          orgId: payerBusinessId,
          name: `Integration Payer ${payerBusinessId}`,
          insuranceTypes: ['medical'],
          submissionMechanism: 'mail',
          acceptedClaimForm: 'cms-1500',
        })
      ),
      seed<Organization>(buildNioOrganization({ name: `Integration NIO ${randomUUID()}`, employer: true })),
      seed<Practitioner>({ resourceType: 'Practitioner', name: [{ given: ['Ordering'], family: 'Provider' }] }),
      seed<Claim>({
        resourceType: 'Claim',
        status: 'draft',
        use: 'claim',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        patient: { display: 'Integration Test Patient' },
        created: '2026-01-01',
        provider: { display: 'Unknown' },
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        insurance: [{ sequence: 1, focal: true, coverage: { display: 'Integration Coverage' } }],
      }),
    ]);
    payerId = payer.id;
    nioId = nio.id;
    orderingProviderId = orderingProvider.id;
    claimId = claim.id;
  }, 120_000);

  afterAll(async () => {
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    await billing.fhir.batch({
      requests: [
        ...provenances.map(
          (provenance): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${provenance.id}` })
        ),
        ...deletes,
      ],
    });
    await cleanup();
  }, 120_000);

  it('re-points the payer, sets the non-insurance payer and replaces the service lines in one recorded change', async () => {
    const { output } = await caller.zambda.execute({
      id: 'update-billing-claim',
      resourceType: 'Claim',
      resourceId: claimId,
      claimId,
      fields: {
        payerId: payerBusinessId,
        nonInsurancePayer: { id: nioId },
        diagnoses: [{ code: 'J06.9', display: 'Acute upper respiratory infection' }],
        serviceLines: [
          {
            cptCode: '99213',
            units: 1,
            charges: 150,
            serviceDate: '2026-01-01',
            placeOfService: '11',
            diagnosisPointers: [1],
            orderingProvider: { firstName: 'Ordering', lastName: 'Provider', providerId: orderingProviderId },
          },
        ],
      },
    });
    expect(output).toEqual({ id: claimId });

    const claim = await billing.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
    expect(claim.insurer?.reference).toBe(`Organization/${payerId}`);
    expect(claim.extension).toContainEqual(
      expect.objectContaining({
        url: CLAIM_NON_INSURANCE_PAYER_EXTENSION_URL,
        valueReference: expect.objectContaining({ reference: `Organization/${nioId}` }),
      })
    );
    expect(claim.diagnosis?.map((diagnosis) => diagnosis.diagnosisCodeableConcept?.coding?.[0]?.code)).toEqual([
      'J06.9',
    ]);
    expect(claim.item).toHaveLength(1);
    expect(claim.item?.[0].productOrService.coding?.[0]?.code).toBe('99213');
    expect(
      claim.item?.[0].extension?.find((extension) => extension.url === EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER)
        ?.valueReference?.reference
    ).toBe(`Practitioner/${orderingProviderId}`);
    expect(claim.total?.value).toBe(150);

    const history = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history).toHaveLength(1);
    expect(history[0].activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.update);
    expect(history[0].agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
