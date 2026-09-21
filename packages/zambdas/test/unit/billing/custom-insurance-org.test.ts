import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { CreateCustomInsuranceOrgInput } from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import {
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_TYPE_SYSTEM,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createInsuranceOrg } from '../../../src/billing/create-billing-custom-insurance-org';
import {
  buildCustomInsuranceOrganization,
  findCustomInsuranceOrgByBusinessId,
  isCustomInsuranceOrganization,
  mapClinicalCustomInsuranceOrgOption,
  mapCustomInsuranceOrganization,
} from '../../../src/billing/custom-insurance-org.helpers';
import { performEffect as deleteInsuranceOrg } from '../../../src/billing/delete-billing-custom-insurance-org';
import { performEffect as listCustomInsuranceOrgs } from '../../../src/billing/list-custom-insurance-organizations';
import { performEffect as searchInsuranceOrgs } from '../../../src/billing/search-billing-custom-insurance-orgs';
import { performEffect as updateInsuranceOrg } from '../../../src/billing/update-billing-custom-insurance-org';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

const fullInput: CreateCustomInsuranceOrgInput = {
  orgId: 'OTR-ACME',
  name: 'Acme Insurance',
  insuranceTypes: ['workers-comp', 'auto'],
  submissionMechanism: 'portal',
  submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
  acceptedClaimForm: 'cms-1500',
  note: 'Prefers electronic submission',
};

const orgResource: Organization = {
  ...buildCustomInsuranceOrganization(fullInput),
  id: ORG_ID,
  meta: { versionId: '2' },
};

interface MockOystehr {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

function makeOystehr(): MockOystehr {
  const transaction = vi.fn().mockImplementation(({ requests }) =>
    Promise.resolve({
      entry: requests.map((request: { resource?: { id?: string }; method: string }, index: number) => ({
        resource: request.resource ? { ...request.resource, id: request.resource.id ?? `created-${index}` } : undefined,
      })),
    })
  );
  const search = vi.fn();
  const create = vi.fn();
  const oystehr = { fhir: { transaction, search, create } } as unknown as Oystehr;
  return { oystehr, transaction, search, create };
}

describe('insurance-org FHIR mapping', () => {
  it('round-trips a full input through build/map back to the DTO', () => {
    const input: CreateCustomInsuranceOrgInput = {
      ...fullInput,
      contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
    };
    const org = { ...buildCustomInsuranceOrganization(input), id: ORG_ID };
    const item = mapCustomInsuranceOrganization(org);
    expect(item).toEqual({
      id: ORG_ID,
      orgId: 'OTR-ACME',
      name: 'Acme Insurance',
      active: true,
      insuranceTypes: ['workers-comp', 'auto'],
      submissionMechanism: 'portal',
      submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
      acceptedClaimForm: 'cms-1500',
      note: 'Prefers electronic submission',
      contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
    });
  });

  it('defaults contacts to an empty array when none are provided', () => {
    const org = buildCustomInsuranceOrganization({ ...fullInput, contacts: undefined });
    expect(org.contact).toBeUndefined();
    expect(mapCustomInsuranceOrganization(org).contacts).toEqual([]);
  });

  it('writes multiple contacts to Organization.contact and maps them back', () => {
    const org = buildCustomInsuranceOrganization({
      ...fullInput,
      contacts: [
        { name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' },
        { name: 'John Doe' },
      ],
    });
    expect(org.contact).toEqual([
      {
        name: { text: 'Jane Smith' },
        purpose: { text: 'Claims Manager' },
        telecom: [
          { system: 'phone', value: '555-123-4567' },
          { system: 'email', value: 'jane@acme.com' },
        ],
      },
      { name: { text: 'John Doe' } },
    ]);
    expect(mapCustomInsuranceOrganization(org).contacts).toEqual([
      { name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' },
      { name: 'John Doe' },
    ]);
  });

  it('omits note when not provided', () => {
    const org = buildCustomInsuranceOrganization({ ...fullInput, note: undefined });
    expect(org.extension?.some((ext) => ext.valueString === 'Prefers electronic submission')).toBe(false);
    expect(mapCustomInsuranceOrganization(org).note).toBeUndefined();
  });

  it('omits submissionDetails when none are provided', () => {
    const org = buildCustomInsuranceOrganization({ ...fullInput, submissionDetails: undefined });
    expect(org.telecom).toBeUndefined();
    expect(org.address).toBeUndefined();
    expect(mapCustomInsuranceOrganization(org).submissionDetails).toBeUndefined();
  });

  it('writes email to telecom for the email mechanism', () => {
    const org = buildCustomInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'email',
      submissionDetails: { email: 'claims@acme.com' },
    });
    expect(org.telecom).toEqual([{ system: 'email', value: 'claims@acme.com' }]);
    expect(mapCustomInsuranceOrganization(org).submissionDetails).toEqual({ email: 'claims@acme.com' });
  });

  it('writes portal url to telecom (system: url) and portal details to an extension', () => {
    const org = buildCustomInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'portal',
      submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
    });
    expect(org.telecom).toEqual([{ system: 'url', value: 'https://portal.acme.com' }]);
    expect(org.extension).toContainEqual({
      url: 'https://fhir.ottehr.com/billing/insurance-org-portal-details',
      valueString: 'Use the claims tab',
    });
    expect(mapCustomInsuranceOrganization(org).submissionDetails).toEqual({
      portalUrl: 'https://portal.acme.com',
      portalDetails: 'Use the claims tab',
    });
  });

  it('writes fax number to telecom for the fax mechanism', () => {
    const org = buildCustomInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'fax',
      submissionDetails: { faxNumber: '555-123-4567' },
    });
    expect(org.telecom).toEqual([{ system: 'fax', value: '555-123-4567' }]);
    expect(mapCustomInsuranceOrganization(org).submissionDetails).toEqual({ faxNumber: '555-123-4567' });
  });

  it('writes the mail address for the mail mechanism', () => {
    const org = buildCustomInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'mail',
      submissionDetails: { mailAddress: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' } },
    });
    expect(org.address).toEqual([{ line: ['1 Main St'], city: 'Springfield', state: 'CA', postalCode: '90210' }]);
    expect(mapCustomInsuranceOrganization(org).submissionDetails).toEqual({
      mailAddress: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' },
    });
  });

  it('writes one type coding per selected insurance type plus the kind coding', () => {
    const org = buildCustomInsuranceOrganization({ ...fullInput, insuranceTypes: ['medical'] });
    expect(org.type).toEqual([
      { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: 'insurance-organization' }] },
      { coding: [{ system: CUSTOM_INSURANCE_ORG_TYPE_SYSTEM, code: 'medical' }] },
    ]);
  });

  it('carries the business id as an identifier', () => {
    const org = buildCustomInsuranceOrganization(fullInput);
    expect(org.identifier).toEqual([{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }]);
  });

  it('isCustomInsuranceOrganization recognizes only orgs with the insurance-organization kind coding', () => {
    expect(isCustomInsuranceOrganization(buildCustomInsuranceOrganization(fullInput))).toBe(true);
    expect(isCustomInsuranceOrganization({ resourceType: 'Organization' })).toBe(false);
  });
});

describe('findCustomInsuranceOrgByBusinessId', () => {
  it('searches by identifier + kind and excludes the given id', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource] });

    const found = await findCustomInsuranceOrgByBusinessId(oystehr, 'OTR-ACME');
    expect(found).toEqual(orgResource);
    expect(search.mock.calls[0][0].params).toContainEqual({
      name: 'identifier',
      value: `${CUSTOM_INSURANCE_ORG_ID_SYSTEM}|OTR-ACME`,
    });

    const excluded = await findCustomInsuranceOrgByBusinessId(oystehr, 'OTR-ACME', ORG_ID);
    expect(excluded).toBeUndefined();
  });
});

describe('create-billing-custom-insurance-org', () => {
  it('creates the Organization resource', async () => {
    const { oystehr, create } = makeOystehr();
    create.mockResolvedValue({ ...orgResource });

    const result = await createInsuranceOrg(oystehr, { ...fullInput, secrets: null });

    expect(result).toEqual({ id: ORG_ID });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].name).toBe('Acme Insurance');
  });
});

describe('update-billing-custom-insurance-org', () => {
  it('rewrites the org with an optimistic lock', async () => {
    const { oystehr, transaction } = makeOystehr();

    const result = await updateInsuranceOrg(
      oystehr,
      { ...fullInput, name: 'Acme Insurance Co', insuranceOrgId: ORG_ID, secrets: null },
      orgResource
    );

    expect(result).toEqual({ id: ORG_ID });
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'PUT', url: `Organization/${ORG_ID}`, ifMatch: 'W/"2"' });
    expect(requests[0].resource.name).toBe('Acme Insurance Co');
  });
});

describe('delete-billing-custom-insurance-org', () => {
  it('soft-deletes with an optimistic lock', async () => {
    const { oystehr, transaction } = makeOystehr();

    const result = await deleteInsuranceOrg(oystehr, orgResource);

    expect(result).toEqual({ deleted: true });
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'PUT', url: `Organization/${ORG_ID}`, ifMatch: 'W/"2"' });
    expect(requests[0].resource.active).toBe(false);
  });
});

describe('search-billing-custom-insurance-orgs', () => {
  it('maps a page of orgs and searches by the insurance-organization kind coding', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource], total: 1 });

    const result = await searchInsuranceOrgs(oystehr, { secrets: null });

    expect(result.total).toBe(1);
    expect(result.organizations).toEqual([mapCustomInsuranceOrganization(orgResource)]);
    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({
      name: 'type',
      value: `${NIO_ORGANIZATION_KIND_SYSTEM}|insurance-organization`,
    });
    expect(params).toContainEqual({ name: 'active', value: 'true' });
  });

  it('filters by _id and skips the active filter when insuranceOrgId is given', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [{ ...orgResource, active: false }], total: 1 });

    const result = await searchInsuranceOrgs(oystehr, { insuranceOrgId: ORG_ID, secrets: null });

    expect(result.organizations[0].active).toBe(false);
    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: '_id', value: ORG_ID });
    expect(params.some((p: { name: string }) => p.name === 'active')).toBe(false);
  });

  it('searches by name when the query is not shaped like a business id', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [], total: 0 });

    await searchInsuranceOrgs(oystehr, { name: 'Acme', secrets: null });

    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: 'name', value: 'Acme' });
    expect(params.some((p: { name: string }) => p.name === 'identifier')).toBe(false);
  });

  it('searches by the business-id identifier instead of name when the query looks like one', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource], total: 1 });

    await searchInsuranceOrgs(oystehr, { name: 'OTR-ACME', secrets: null });

    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: 'identifier', value: `${CUSTOM_INSURANCE_ORG_ID_SYSTEM}|OTR-ACME` });
    expect(params.some((p: { name: string }) => p.name === 'name')).toBe(false);
  });

  it('normalizes a lowercase-typed business-id prefix without touching the suffix case', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource], total: 1 });

    await searchInsuranceOrgs(oystehr, { name: 'otr-AcMe', secrets: null });

    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: 'identifier', value: `${CUSTOM_INSURANCE_ORG_ID_SYSTEM}|OTR-AcMe` });
  });
});

describe('mapClinicalCustomInsuranceOrgOption', () => {
  it('maps to a minimal clinical option carrying a reference token, not a direct Organization reference', () => {
    expect(mapClinicalCustomInsuranceOrgOption(orgResource)).toEqual({
      id: ORG_ID,
      reference: `https://fhir.ottehr.com/billing/custom-insurance-organization/${ORG_ID}`,
      orgId: 'OTR-ACME',
      name: 'Acme Insurance',
      active: true,
    });
  });

  it('carries active: false for a soft-deleted org', () => {
    expect(mapClinicalCustomInsuranceOrgOption({ ...orgResource, active: false }).active).toBe(false);
  });
});

describe('list-custom-insurance-organizations', () => {
  it('returns minimal clinical options carrying a direct Organization reference', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource] });

    const result = await listCustomInsuranceOrgs(oystehr, { secrets: null });

    expect(result.organizations).toEqual([mapClinicalCustomInsuranceOrgOption(orgResource)]);
    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({
      name: 'type',
      value: `${NIO_ORGANIZATION_KIND_SYSTEM}|insurance-organization`,
    });
    expect(params).toContainEqual({ name: 'active', value: 'true' });
  });

  it('resolves a deleted org by id with active=false', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [{ ...orgResource, active: false }] });

    const result = await listCustomInsuranceOrgs(oystehr, { insuranceOrgId: ORG_ID, secrets: null });

    expect(result.organizations[0].active).toBe(false);
    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: '_id', value: ORG_ID });
    expect(params.some((p: { name: string }) => p.name === 'active')).toBe(false);
  });

  it('follows next links so more than one page comes back complete', async () => {
    const secondOrgId = '33333333-3333-4333-8333-333333333333';
    const { oystehr, search } = makeOystehr();
    let orgPage = 0;
    search.mockImplementation(() => {
      orgPage += 1;
      return orgPage === 1
        ? Promise.resolve({ unbundle: () => [orgResource], link: [{ relation: 'next', url: 'next-page' }] })
        : Promise.resolve({ unbundle: () => [{ ...orgResource, id: secondOrgId, name: 'Other Insurance' }] });
    });

    const result = await listCustomInsuranceOrgs(oystehr, { secrets: null });

    expect(result.organizations.map((org) => org.id)).toEqual([ORG_ID, secondOrgId]);
    const secondPageParams = search.mock.calls[1][0].params;
    expect(secondPageParams).toContainEqual({ name: '_offset', value: '1000' });
  });
});
