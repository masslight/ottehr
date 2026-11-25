import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Organization, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getNPI, getTaxID } from 'utils/lib/fhir/helpers';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROVIDER_ROLE_BILLING, PROVIDER_ROLE_RENDERING, PROVIDER_ROLE_TAG } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

const VALID_NPI = '1234567893';

describe('update-billing-provider', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  let organizationId: string;
  let practitionerId: string;
  let claimId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.push({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  const claimHistory = async (): Promise<Provenance[]> =>
    (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/update-billing-provider.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const [organization, practitioner, claim] = await Promise.all([
      seed<Organization>({
        resourceType: 'Organization',
        name: 'Integration Billing Group',
        meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_BILLING }] },
      }),
      seed<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ given: ['Before'], family: 'Rename' }],
        meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_RENDERING }] },
      }),
      seed<Claim>({
        resourceType: 'Claim',
        status: 'draft',
        use: 'claim',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        patient: { display: 'Integration Test Patient' },
        created: '2026-01-01',
        provider: { display: 'Unknown' },
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      }),
    ]);
    organizationId = organization.id;
    practitionerId = practitioner.id;
    claimId = claim.id;
  }, 120_000);

  afterAll(async () => {
    const provenances = await claimHistory();
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

  it("updates an organization provider on the claim and records the change in that claim's history", async () => {
    const name = `Integration Group ${randomUUID()}`;
    const { output } = await caller.zambda.execute({
      id: 'update-billing-provider',
      kind: 'organization',
      providerId: organizationId,
      claimId,
      name,
      roles: ['billing', 'rendering'],
      npi: VALID_NPI,
      taxId: '123456789',
      address: { line1: '2 Market St', city: 'Albany', state: 'NY', postalCode: '12207' },
    });
    expect(output).toEqual({ id: organizationId });

    const organization = await billing.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId });
    expect(organization.name).toBe(name);
    expect(getNPI(organization)).toBe(VALID_NPI);
    expect(getTaxID(organization)).toBe('123456789');
    expect(organization.address).toEqual([{ line: ['2 Market St'], city: 'Albany', state: 'NY', postalCode: '12207' }]);
    expect(organization.meta?.tag).toEqual(
      expect.arrayContaining([
        { system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_BILLING },
        { system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_RENDERING },
      ])
    );

    const entry = (await claimHistory()).find((provenance) =>
      provenance.target.some((target) => target.reference === `Organization/${organizationId}`)
    );
    expect(entry?.activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.update);
    expect(entry?.agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);

  it("updates an individual provider on the claim and records the change in that claim's history", async () => {
    const lastName = `Integration${randomUUID().slice(0, 8)}`;
    const { output } = await caller.zambda.execute({
      id: 'update-billing-provider',
      kind: 'individual',
      providerId: practitionerId,
      claimId,
      firstName: 'After',
      lastName,
      roles: ['rendering'],
      npi: VALID_NPI,
    });
    expect(output).toEqual({ id: practitionerId });

    const practitioner = await billing.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
    expect(practitioner.name).toEqual([{ given: ['After'], family: lastName }]);
    expect(getNPI(practitioner)).toBe(VALID_NPI);
    expect(practitioner.meta?.tag).toContainEqual({ system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_RENDERING });

    const entry = (await claimHistory()).find((provenance) =>
      provenance.target.some((target) => target.reference === `Practitioner/${practitionerId}`)
    );
    expect(entry?.activity?.coding).toContainEqual(CLAIM_PROVENANCE_ACTIVITY.update);
    expect(entry?.agent.map((agent) => agent.who?.reference)).toEqual([callerProfile]);
  }, 60_000);
});
