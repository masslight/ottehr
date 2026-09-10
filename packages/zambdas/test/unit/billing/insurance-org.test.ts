import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { CreateInsuranceOrgInput } from 'utils/lib/types/data/billing/insurance-org.schemas';
import { INSURANCE_ORG_ID_SYSTEM, INSURANCE_ORG_TYPE_SYSTEM } from 'utils/lib/types/data/billing/insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createInsuranceOrg } from '../../../src/billing/create-billing-insurance-org';
import { performEffect as deleteInsuranceOrg } from '../../../src/billing/delete-billing-insurance-org';
import {
  buildInsuranceOrganization,
  findInsuranceOrgByBusinessId,
  isInsuranceOrganization,
  mapInsuranceOrganization,
} from '../../../src/billing/insurance-org.helpers';
import { performEffect as searchInsuranceOrgs } from '../../../src/billing/search-billing-insurance-orgs';
import { performEffect as updateInsuranceOrg } from '../../../src/billing/update-billing-insurance-org';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

const fullInput: CreateInsuranceOrgInput = {
  orgId: 'OTR-ACME',
  name: 'Acme Insurance',
  insuranceTypes: ['workers-comp', 'auto'],
  submissionMechanism: 'portal',
  submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
  acceptedClaimForm: 'cms-1500',
  note: 'Prefers electronic submission',
};

const orgResource: Organization = { ...buildInsuranceOrganization(fullInput), id: ORG_ID, meta: { versionId: '2' } };

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
    const input: CreateInsuranceOrgInput = {
      ...fullInput,
      contacts: [{ name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' }],
    };
    const org = { ...buildInsuranceOrganization(input), id: ORG_ID };
    const item = mapInsuranceOrganization(org);
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
    const org = buildInsuranceOrganization({ ...fullInput, contacts: undefined });
    expect(org.contact).toBeUndefined();
    expect(mapInsuranceOrganization(org).contacts).toEqual([]);
  });

  it('writes multiple contacts to Organization.contact and maps them back', () => {
    const org = buildInsuranceOrganization({
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
    expect(mapInsuranceOrganization(org).contacts).toEqual([
      { name: 'Jane Smith', title: 'Claims Manager', phone: '555-123-4567', email: 'jane@acme.com' },
      { name: 'John Doe' },
    ]);
  });

  it('omits note when not provided', () => {
    const org = buildInsuranceOrganization({ ...fullInput, note: undefined });
    expect(org.extension?.some((ext) => ext.valueString === 'Prefers electronic submission')).toBe(false);
    expect(mapInsuranceOrganization(org).note).toBeUndefined();
  });

  it('omits submissionDetails when none are provided', () => {
    const org = buildInsuranceOrganization({ ...fullInput, submissionDetails: undefined });
    expect(org.telecom).toBeUndefined();
    expect(org.address).toBeUndefined();
    expect(mapInsuranceOrganization(org).submissionDetails).toBeUndefined();
  });

  it('writes email to telecom for the email mechanism', () => {
    const org = buildInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'email',
      submissionDetails: { email: 'claims@acme.com' },
    });
    expect(org.telecom).toEqual([{ system: 'email', value: 'claims@acme.com' }]);
    expect(mapInsuranceOrganization(org).submissionDetails).toEqual({ email: 'claims@acme.com' });
  });

  it('writes portal url to telecom (system: url) and portal details to an extension', () => {
    const org = buildInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'portal',
      submissionDetails: { portalUrl: 'https://portal.acme.com', portalDetails: 'Use the claims tab' },
    });
    expect(org.telecom).toEqual([{ system: 'url', value: 'https://portal.acme.com' }]);
    expect(org.extension).toContainEqual({
      url: 'https://fhir.ottehr.com/billing/insurance-org-portal-details',
      valueString: 'Use the claims tab',
    });
    expect(mapInsuranceOrganization(org).submissionDetails).toEqual({
      portalUrl: 'https://portal.acme.com',
      portalDetails: 'Use the claims tab',
    });
  });

  it('writes fax number to telecom for the fax mechanism', () => {
    const org = buildInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'fax',
      submissionDetails: { faxNumber: '555-123-4567' },
    });
    expect(org.telecom).toEqual([{ system: 'fax', value: '555-123-4567' }]);
    expect(mapInsuranceOrganization(org).submissionDetails).toEqual({ faxNumber: '555-123-4567' });
  });

  it('writes the mail address for the mail mechanism', () => {
    const org = buildInsuranceOrganization({
      ...fullInput,
      submissionMechanism: 'mail',
      submissionDetails: { mailAddress: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' } },
    });
    expect(org.address).toEqual([{ line: ['1 Main St'], city: 'Springfield', state: 'CA', postalCode: '90210' }]);
    expect(mapInsuranceOrganization(org).submissionDetails).toEqual({
      mailAddress: { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' },
    });
  });

  it('writes one type coding per selected insurance type plus the kind coding', () => {
    const org = buildInsuranceOrganization({ ...fullInput, insuranceTypes: ['medical'] });
    expect(org.type).toEqual([
      { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: 'insurance-organization' }] },
      { coding: [{ system: INSURANCE_ORG_TYPE_SYSTEM, code: 'medical' }] },
    ]);
  });

  it('carries the business id as an identifier', () => {
    const org = buildInsuranceOrganization(fullInput);
    expect(org.identifier).toEqual([{ system: INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }]);
  });

  it('isInsuranceOrganization recognizes only orgs with the insurance-organization kind coding', () => {
    expect(isInsuranceOrganization(buildInsuranceOrganization(fullInput))).toBe(true);
    expect(isInsuranceOrganization({ resourceType: 'Organization' })).toBe(false);
  });
});

describe('findInsuranceOrgByBusinessId', () => {
  it('searches by identifier + kind and excludes the given id', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource] });

    const found = await findInsuranceOrgByBusinessId(oystehr, 'OTR-ACME');
    expect(found).toEqual(orgResource);
    expect(search.mock.calls[0][0].params).toContainEqual({
      name: 'identifier',
      value: `${INSURANCE_ORG_ID_SYSTEM}|OTR-ACME`,
    });

    const excluded = await findInsuranceOrgByBusinessId(oystehr, 'OTR-ACME', ORG_ID);
    expect(excluded).toBeUndefined();
  });
});

describe('create-billing-insurance-org', () => {
  it('creates the Organization resource', async () => {
    const { oystehr, create } = makeOystehr();
    create.mockResolvedValue({ ...orgResource });

    const result = await createInsuranceOrg(oystehr, { ...fullInput, secrets: null });

    expect(result).toEqual({ id: ORG_ID });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].name).toBe('Acme Insurance');
  });
});

describe('update-billing-insurance-org', () => {
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

describe('delete-billing-insurance-org', () => {
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

describe('search-billing-insurance-orgs', () => {
  it('maps a page of orgs and searches by the insurance-organization kind coding', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [orgResource], total: 1 });

    const result = await searchInsuranceOrgs(oystehr, { secrets: null });

    expect(result.total).toBe(1);
    expect(result.organizations).toEqual([mapInsuranceOrganization(orgResource)]);
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
});
