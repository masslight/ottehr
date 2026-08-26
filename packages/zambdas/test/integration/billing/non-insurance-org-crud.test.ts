import Oystehr from '@oystehr/sdk';
import { Organization, OrganizationAffiliation } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getNioReferenceUrl } from 'utils/lib/helpers/helpers';
import {
  BillingPayerOption,
  CreatedResourceResponse,
  DeletedResponse,
  SavedResourceResponse,
  SearchBillingPayersResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { CreateNonInsuranceOrgInput } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import {
  ListNonInsuranceOrganizationsResponse,
  NIO_KIND_CODE,
  NIO_ORGANIZATION_KIND_SYSTEM,
  NioWorkersCompCoverage,
  SearchNonInsuranceOrgsResponse,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

// Happy-path NIO CRUD: create -> search/detail -> clinical directory -> update (covers
// reconciliation incl. reactivation) -> soft delete. Exercises all five zambdas in sequence.
describe('non-insurance-org CRUD', () => {
  let oystehr: Oystehr; // admin billing client used to assert / clean up
  let cleanup: () => Promise<void>;
  let processId: string;

  let nioName: string;
  let nioId: string;
  let payer: BillingPayerOption;

  const searchDetail = async (id: string): Promise<SearchNonInsuranceOrgsResponse> =>
    (await oystehr.zambda.execute({ id: 'search-billing-non-insurance-orgs', nioId: id }))
      .output as SearchNonInsuranceOrgsResponse;

  const fetchAffiliations = async (id: string): Promise<OrganizationAffiliation[]> =>
    (
      await oystehr.fhir.search<OrganizationAffiliation>({
        resourceType: 'OrganizationAffiliation',
        params: [{ name: 'primary-organization', value: `Organization/${id}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/non-insurance-org-crud.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;
    nioName = `NioCrud ${processId}`;

    const payersResponse = (await oystehr.zambda.execute({ id: 'search-billing-payers' }))
      .output as SearchBillingPayersResponse;
    expect(payersResponse.payers.length).toBeGreaterThan(0);
    payer = payersResponse.payers[0];
  }, 90_000);

  afterAll(async () => {
    // Hard-delete the NIO graph (the zambdas only soft-delete) before the shared cleanup.
    try {
      if (nioId) {
        const affiliations = await fetchAffiliations(nioId);
        await Promise.all(
          affiliations.map((affiliation) =>
            oystehr.fhir.delete({ resourceType: 'OrganizationAffiliation', id: affiliation.id! }).catch(() => undefined)
          )
        );
        const coverageOrgIds = affiliations
          .map((affiliation) => affiliation.participatingOrganization?.reference?.split('/')[1])
          .filter((id): id is string => !!id);
        await Promise.all(
          [...new Set(coverageOrgIds)].map((id) =>
            oystehr.fhir.delete({ resourceType: 'Organization', id }).catch(() => undefined)
          )
        );
        await oystehr.fhir.delete({ resourceType: 'Organization', id: nioId }).catch(() => undefined);
      }
    } catch {
      // best-effort cleanup
    }
    await cleanup();
  }, 90_000);

  it('create-billing-non-insurance-org creates the org, coverage orgs, and affiliations', async () => {
    const input: CreateNonInsuranceOrgInput = {
      name: nioName,
      employer: true,
      address: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' },
      contacts: [{ name: 'Jane Smith', title: 'Billing Manager', phone: '555-123-4567', email: 'jane@example.com' }],
      covers: [
        { category: 'workers-comp', billingMode: 'insurance', payerId: payer.id },
        { category: 'occupational-medicine', submission: { preferredMechanism: 'fax', fax: '555-999-0000' } },
        { category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } },
      ],
    };
    const { id } = (await oystehr.zambda.execute({ id: 'create-billing-non-insurance-org', ...input }))
      .output as CreatedResourceResponse;
    expect(id).toBeTruthy();
    nioId = id;

    const org = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id });
    expect(org.active).toBe(true);
    expect(
      org.type?.some(
        (t) => t.coding?.some((c) => c.system === NIO_ORGANIZATION_KIND_SYSTEM && c.code === NIO_KIND_CODE)
      )
    ).toBe(true);

    const affiliations = await fetchAffiliations(id);
    expect(affiliations).toHaveLength(3);
    expect(affiliations.every((affiliation) => affiliation.active)).toBe(true);

    const detail = (await searchDetail(id)).organizations[0];
    expect(detail).toMatchObject({
      id,
      name: nioName,
      employer: true,
      active: true,
      address: input.address,
      contacts: input.contacts,
    });
    expect(detail.covers.map((coverage) => coverage.category)).toEqual([
      'workers-comp',
      'occupational-medicine',
      'other',
    ]);
    const workersComp = detail.covers[0] as NioWorkersCompCoverage;
    expect(workersComp.billingMode).toBe('insurance');
    // The stored payer reference round-trips into the same option PayerSelect stores.
    expect(workersComp.payer?.id).toBe(payer.id);
    expect(workersComp.payer?.payerId).toBe(payer.payerId);
  }, 90_000);

  it('search-billing-non-insurance-orgs lists the created org by name', async () => {
    const response = (await oystehr.zambda.execute({ id: 'search-billing-non-insurance-orgs', name: nioName }))
      .output as SearchNonInsuranceOrgsResponse;
    expect(response.total).toBeGreaterThanOrEqual(1);
    expect(response.organizations.some((org) => org.id === nioId)).toBe(true);
  }, 90_000);

  it('list-non-insurance-organizations serves the minimal clinical option with the reference token', async () => {
    const response = (await oystehr.zambda.execute({ id: 'list-non-insurance-organizations', employerOnly: true }))
      .output as ListNonInsuranceOrganizationsResponse;
    const option = response.organizations.find((org) => org.id === nioId);
    expect(option).toEqual({
      id: nioId,
      reference: getNioReferenceUrl(nioId),
      name: nioName,
      employer: true,
      active: true,
      address: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' },
      coversCategories: ['workers-comp', 'occupational-medicine', 'other'],
    });
    // The minimal DTO never carries covers details or contacts.
    expect(option).not.toHaveProperty('covers');
    expect(option).not.toHaveProperty('contacts');
  }, 90_000);

  it('update reconciles the covers set: unchecked deactivates, re-checked reactivates the same pair', async () => {
    const occMedAffiliationId = (await fetchAffiliations(nioId)).find(
      (affiliation) =>
        affiliation.code?.some((concept) => concept.coding?.some((coding) => coding.code === 'occupational-medicine'))
    )?.id;
    expect(occMedAffiliationId).toBeTruthy();

    // Drop occ-med, flip workers-comp to direct billing.
    const updated = (
      await oystehr.zambda.execute({
        id: 'update-billing-non-insurance-org',
        nioId,
        name: nioName,
        employer: false,
        covers: [
          {
            category: 'workers-comp',
            billingMode: 'direct',
            submission: { preferredMechanism: 'mail', mailAddress: { line1: 'PO Box 9' } },
          },
          { category: 'other', name: 'Medical Clearance' },
        ],
      })
    ).output as SavedResourceResponse;
    expect(updated.id).toBe(nioId);

    const detail = (await searchDetail(nioId)).organizations[0];
    expect(detail.employer).toBe(false);
    expect(detail.covers.map((coverage) => coverage.category)).toEqual(['workers-comp', 'other']);
    const workersComp = detail.covers[0] as NioWorkersCompCoverage;
    expect(workersComp.billingMode).toBe('direct');
    expect(workersComp.submission).toEqual({ preferredMechanism: 'mail', mailAddress: { line1: 'PO Box 9' } });

    const occMedAffiliation = (await fetchAffiliations(nioId)).find(
      (affiliation) => affiliation.id === occMedAffiliationId
    );
    expect(occMedAffiliation?.active).toBe(false);

    // Re-check occ-med: the same inactive pair comes back to life instead of duplicating.
    await oystehr.zambda.execute({
      id: 'update-billing-non-insurance-org',
      nioId,
      name: nioName,
      employer: false,
      covers: [
        { category: 'workers-comp', billingMode: 'direct' },
        { category: 'occupational-medicine' },
        // Deliberately unnamed: an 'other' coverage without a name must still satisfy FHIR org-1
        // (the coverage org carries a kind identifier instead of a name).
        { category: 'other' },
      ],
    });
    const affiliationsAfter = await fetchAffiliations(nioId);
    expect(affiliationsAfter).toHaveLength(3);
    const reactivated = affiliationsAfter.find((affiliation) => affiliation.id === occMedAffiliationId);
    expect(reactivated?.active).toBe(true);
  }, 90_000);

  it('delete soft-deletes the whole graph but keeps it resolvable by id', async () => {
    const result = (await oystehr.zambda.execute({ id: 'delete-billing-non-insurance-org', nioId }))
      .output as DeletedResponse;
    expect(result.deleted).toBe(true);

    const org = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: nioId });
    expect(org.active).toBe(false);
    expect((await fetchAffiliations(nioId)).every((affiliation) => affiliation.active === false)).toBe(true);

    // Gone from the list...
    const list = (await oystehr.zambda.execute({ id: 'search-billing-non-insurance-orgs', name: nioName }))
      .output as SearchNonInsuranceOrgsResponse;
    expect(list.organizations.some((o) => o.id === nioId)).toBe(false);

    // ...but a stored clinical reference still resolves, flagged inactive.
    const byId = (await oystehr.zambda.execute({ id: 'list-non-insurance-organizations', nioId }))
      .output as ListNonInsuranceOrganizationsResponse;
    expect(byId.organizations[0]?.active).toBe(false);
    expect(byId.organizations[0]?.name).toBe(nioName);
  }, 90_000);
});
