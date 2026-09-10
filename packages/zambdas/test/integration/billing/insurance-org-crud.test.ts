import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  CreatedResourceResponse,
  DeletedResponse,
  SavedResourceResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { CreateInsuranceOrgInput } from 'utils/lib/types/data/billing/insurance-org.schemas';
import { INSURANCE_ORG_KIND_CODE, SearchInsuranceOrgsResponse } from 'utils/lib/types/data/billing/insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

// Happy-path custom Insurance Organization CRUD: create -> search/detail -> update -> soft delete,
// plus the orgId-uniqueness guard. Exercises all four zambdas in sequence.
describe('insurance-org CRUD', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  let orgName: string;
  let orgId: string;
  let insuranceOrgId: string;

  const searchDetail = async (id: string): Promise<SearchInsuranceOrgsResponse> =>
    (await oystehr.zambda.execute({ id: 'search-billing-insurance-orgs', insuranceOrgId: id }))
      .output as SearchInsuranceOrgsResponse;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/insurance-org-crud.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;
    orgName = `InsuranceOrgCrud ${processId}`;
    orgId = `OTR-${processId}`;
  }, 90_000);

  afterAll(async () => {
    try {
      if (insuranceOrgId) {
        await oystehr.fhir.delete({ resourceType: 'Organization', id: insuranceOrgId }).catch(() => undefined);
      }
    } catch {
      // best-effort cleanup
    }
    await cleanup();
  }, 90_000);

  it('create-billing-insurance-org creates the org', async () => {
    const input: CreateInsuranceOrgInput = {
      orgId,
      name: orgName,
      insuranceTypes: ['workers-comp', 'auto'],
      submissionMechanism: 'portal',
      submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
      acceptedClaimForm: 'cms-1500',
      note: 'Prefers electronic submission',
      contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
    };
    const { id } = (await oystehr.zambda.execute({ id: 'create-billing-insurance-org', ...input }))
      .output as CreatedResourceResponse;
    expect(id).toBeTruthy();
    insuranceOrgId = id;

    const org = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id });
    expect(org.active).toBe(true);
    expect(
      org.type?.some(
        (t) => t.coding?.some((c) => c.system === NIO_ORGANIZATION_KIND_SYSTEM && c.code === INSURANCE_ORG_KIND_CODE)
      )
    ).toBe(true);

    const detail = (await searchDetail(id)).organizations[0];
    expect(detail).toEqual({
      id,
      orgId,
      name: orgName,
      active: true,
      insuranceTypes: ['workers-comp', 'auto'],
      submissionMechanism: 'portal',
      submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
      acceptedClaimForm: 'cms-1500',
      note: 'Prefers electronic submission',
      contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
    });
  }, 90_000);

  it('rejects creating a second org with the same orgId', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'create-billing-insurance-org',
        orgId,
        name: 'Duplicate',
        submissionMechanism: 'email',
        acceptedClaimForm: 'other',
      })
    ).rejects.toBeTruthy();
  }, 90_000);

  it('search-billing-insurance-orgs lists the created org by name', async () => {
    const response = (await oystehr.zambda.execute({ id: 'search-billing-insurance-orgs', name: orgName }))
      .output as SearchInsuranceOrgsResponse;
    expect(response.total).toBeGreaterThanOrEqual(1);
    expect(response.organizations.some((org) => org.id === insuranceOrgId)).toBe(true);
  }, 90_000);

  it('update-billing-insurance-org rewrites the org fields (full replace), swapping the contact', async () => {
    const updated = (
      await oystehr.zambda.execute({
        id: 'update-billing-insurance-org',
        insuranceOrgId,
        orgId,
        name: `${orgName} Updated`,
        insuranceTypes: ['medical'],
        submissionMechanism: 'fax',
        submissionDetails: { faxNumber: '555-999-0000' },
        acceptedClaimForm: 'cms-1450',
        contacts: [{ name: 'John Doe' }],
      })
    ).output as SavedResourceResponse;
    expect(updated.id).toBe(insuranceOrgId);

    const detail = (await searchDetail(insuranceOrgId)).organizations[0];
    expect(detail).toMatchObject({
      name: `${orgName} Updated`,
      insuranceTypes: ['medical'],
      submissionMechanism: 'fax',
      submissionDetails: { faxNumber: '555-999-0000' },
      acceptedClaimForm: 'cms-1450',
      contacts: [{ name: 'John Doe' }],
    });
    expect(detail.note).toBeUndefined();
  }, 90_000);

  it('delete-billing-insurance-org soft-deletes but keeps the org resolvable by id', async () => {
    const result = (await oystehr.zambda.execute({ id: 'delete-billing-insurance-org', insuranceOrgId }))
      .output as DeletedResponse;
    expect(result.deleted).toBe(true);

    const org = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: insuranceOrgId });
    expect(org.active).toBe(false);

    const list = (await oystehr.zambda.execute({ id: 'search-billing-insurance-orgs', name: orgName }))
      .output as SearchInsuranceOrgsResponse;
    expect(list.organizations.some((o) => o.id === insuranceOrgId)).toBe(false);

    const byId = await searchDetail(insuranceOrgId);
    expect(byId.organizations[0]?.active).toBe(false);
  }, 90_000);
});
