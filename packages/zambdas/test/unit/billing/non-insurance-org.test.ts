import Oystehr from '@oystehr/sdk';
import { Organization, OrganizationAffiliation } from 'fhir/r4b';
import { getNioReferenceUrl } from 'utils/lib/helpers/helpers';
import { CreateNonInsuranceOrgInput } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import {
  NIO_COVERAGE_CATEGORY_SYSTEM,
  NIO_ORGANIZATION_KIND_SYSTEM,
  NIO_PORTAL_NOTES_EXTENSION_URL,
  NIO_PREFERRED_SUBMISSION_EXTENSION_URL,
  NIO_WC_BILLING_MODE_EXTENSION_URL,
  NIO_WC_PAYER_EXTENSION_URL,
  NioWorkersCompCoverage,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createNio } from '../../../src/billing/create-billing-non-insurance-org';
import { performEffect as deleteNio } from '../../../src/billing/delete-billing-non-insurance-org';
import { performEffect as listNios } from '../../../src/billing/list-non-insurance-organizations';
import {
  buildCoverageOrganization,
  buildNioAffiliation,
  buildNioOrganization,
  computeCoverageChanges,
  fetchNioCoveragePairs,
  mapNonInsuranceOrganization,
  resolveWcPayerReference,
} from '../../../src/billing/non-insurance-org.helpers';
import { performEffect as searchNios } from '../../../src/billing/search-billing-non-insurance-orgs';
import { performEffect as updateNio } from '../../../src/billing/update-billing-non-insurance-org';

const NIO_ID = '11111111-1111-4111-8111-111111111111';
const PAYER_RCM_ID = '22222222-2222-4222-8222-222222222222';
const PAYER_URL = 'https://rcm-api.zapehr.com/v1/payer/PAYER123';

const fullInput: CreateNonInsuranceOrgInput = {
  name: 'FedEx',
  employer: true,
  address: { line1: '1 Main St', line2: 'Suite 2', city: 'Springfield', state: 'CA', zip: '90210' },
  contacts: [{ name: 'Jane Smith', title: 'Billing Manager', phone: '555-123-4567', email: 'jane@fedex.com' }],
  covers: [
    { category: 'workers-comp', billingMode: 'insurance', payerId: PAYER_RCM_ID },
    {
      category: 'occupational-medicine',
      submission: {
        preferredMechanism: 'fax',
        fax: '555-999-0000',
        email: 'occmed@fedex.com',
        portalNotes: 'portal.fedex.com',
        mailAddress: { line1: 'PO Box 5', city: 'Memphis' },
      },
    },
    { category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } },
  ],
};

function kindCoding(org: Organization, code: string): boolean {
  return !!org.type?.some((t) => t.coding?.some((c) => c.system === NIO_ORGANIZATION_KIND_SYSTEM && c.code === code));
}

const wcCoverageOrg: Organization = {
  resourceType: 'Organization',
  id: 'cov-wc',
  active: true,
  meta: { versionId: '2' },
  name: 'FedEx — Workers Comp',
  type: [
    { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: 'nio-coverage' }] },
    { coding: [{ system: NIO_COVERAGE_CATEGORY_SYSTEM, code: 'workers-comp' }] },
  ],
  extension: [
    { url: NIO_WC_BILLING_MODE_EXTENSION_URL, valueCode: 'insurance' },
    {
      url: NIO_WC_PAYER_EXTENSION_URL,
      valueReference: { reference: PAYER_URL, display: 'Acme Insurance (PAYER123)' },
    },
  ],
};

const wcAffiliation: OrganizationAffiliation = {
  resourceType: 'OrganizationAffiliation',
  id: 'aff-wc',
  active: true,
  meta: { versionId: '1' },
  organization: { reference: `Organization/${NIO_ID}` },
  participatingOrganization: { reference: 'Organization/cov-wc' },
  code: [{ coding: [{ system: NIO_COVERAGE_CATEGORY_SYSTEM, code: 'workers-comp' }] }],
};

const nioOrg: Organization = {
  ...buildNioOrganization(fullInput),
  id: NIO_ID,
  meta: { versionId: '3' },
};

describe('non-insurance-org FHIR mapping', () => {
  it('round-trips a full input through the FHIR graph back to the DTO', () => {
    const org = { ...buildNioOrganization(fullInput), id: NIO_ID };
    const coverageOrgs = fullInput.covers!.map((coverage, i) => ({
      ...buildCoverageOrganization({
        nioName: fullInput.name,
        coverage,
        payerRef:
          coverage.category === 'workers-comp'
            ? { reference: PAYER_URL, display: 'Acme Insurance (PAYER123)' }
            : undefined,
      }),
      id: `cov-${i}`,
    }));
    const affiliations = fullInput.covers!.map((coverage, i) =>
      buildNioAffiliation({
        nioReference: `Organization/${NIO_ID}`,
        coverageReference: `Organization/cov-${i}`,
        category: coverage.category,
      })
    );

    const item = mapNonInsuranceOrganization({
      org,
      affiliations,
      coverageOrgsById: new Map(coverageOrgs.map((c) => [c.id!, c])),
    });

    expect(item).toEqual({
      id: NIO_ID,
      name: 'FedEx',
      employer: true,
      active: true,
      address: fullInput.address,
      contacts: fullInput.contacts,
      covers: [
        {
          category: 'workers-comp',
          billingMode: 'insurance',
          // No live RCM resolution in this test — the stored reference + display fill the option.
          payer: { id: '', name: 'Acme Insurance (PAYER123)', payerId: 'PAYER123' },
        },
        {
          category: 'occupational-medicine',
          submission: fullInput.covers![1].submission,
        },
        { category: 'other', name: 'Medical Clearance', submission: { preferredMechanism: 'portal' } },
      ],
    });
  });

  it('marks employer with an extra kind coding only when toggled on', () => {
    expect(kindCoding(buildNioOrganization(fullInput), 'employer')).toBe(true);
    expect(kindCoding(buildNioOrganization({ ...fullInput, employer: false }), 'employer')).toBe(false);
    expect(kindCoding(buildNioOrganization(fullInput), 'non-insurance-organization')).toBe(true);
  });

  it("keeps 'other' coverage org name exactly as entered and derives names for coded categories", () => {
    const other = buildCoverageOrganization({
      nioName: 'FedEx',
      coverage: { category: 'other', name: 'Medical Clearance' },
    });
    expect(other.name).toBe('Medical Clearance');
    const unnamedOther = buildCoverageOrganization({ nioName: 'FedEx', coverage: { category: 'other' } });
    expect(unnamedOther.name).toBeUndefined();
    const occMed = buildCoverageOrganization({
      nioName: 'FedEx',
      coverage: { category: 'occupational-medicine' },
    });
    expect(occMed.name).toBe('FedEx — Occupational Medicine');
  });

  it('always carries the kind identifier so FHIR org-1 holds even for an unnamed coverage org', () => {
    const unnamedOther = buildCoverageOrganization({ nioName: 'FedEx', coverage: { category: 'other' } });
    expect(unnamedOther.name).toBeUndefined();
    expect(unnamedOther.identifier).toEqual([{ system: NIO_ORGANIZATION_KIND_SYSTEM, value: 'nio-coverage' }]);
  });

  it('writes submission details to telecom, address, and extensions', () => {
    const org = buildCoverageOrganization({ nioName: 'FedEx', coverage: fullInput.covers![1] });
    expect(org.telecom).toEqual([
      { system: 'email', value: 'occmed@fedex.com' },
      { system: 'fax', value: '555-999-0000' },
    ]);
    expect(org.address).toEqual([{ line: ['PO Box 5'], city: 'Memphis' }]);
    expect(org.extension).toEqual([
      { url: NIO_PREFERRED_SUBMISSION_EXTENSION_URL, valueCode: 'fax' },
      { url: NIO_PORTAL_NOTES_EXTENSION_URL, valueString: 'portal.fedex.com' },
    ]);
  });
});

describe('computeCoverageChanges', () => {
  const inactiveOtherPair = {
    affiliation: {
      ...wcAffiliation,
      id: 'aff-other',
      active: false,
      participatingOrganization: { reference: 'Organization/cov-other' },
      code: [{ coding: [{ system: NIO_COVERAGE_CATEGORY_SYSTEM, code: 'other' }] }],
    },
    coverageOrg: { ...wcCoverageOrg, id: 'cov-other', active: false },
  };

  it('keeps, reactivates, creates, and deactivates per the input covers set', () => {
    const pairs = [{ affiliation: wcAffiliation, coverageOrg: wcCoverageOrg }, inactiveOtherPair];
    const changes = computeCoverageChanges(
      [
        { category: 'workers-comp', billingMode: 'direct' },
        { category: 'other', name: 'Med Clearance' },
        { category: 'occupational-medicine' },
      ],
      pairs
    );
    expect(changes.creates.map((c) => c.category)).toEqual(['occupational-medicine']);
    expect(changes.updates.map((u) => [u.coverage.category, u.pair.affiliation.id])).toEqual([
      ['workers-comp', 'aff-wc'],
      ['other', 'aff-other'],
    ]);
    expect(changes.deactivates).toEqual([]);
  });

  it('deactivates active pairs whose category was unchecked', () => {
    const changes = computeCoverageChanges([], [{ affiliation: wcAffiliation, coverageOrg: wcCoverageOrg }]);
    expect(changes.creates).toEqual([]);
    expect(changes.updates).toEqual([]);
    expect(changes.deactivates.map((p) => p.affiliation.id)).toEqual(['aff-wc']);
  });

  it('recreates a category whose pair lost its coverage org instead of reusing it', () => {
    const orglessPair = { affiliation: wcAffiliation, coverageOrg: undefined };
    const changes = computeCoverageChanges([{ category: 'workers-comp', billingMode: 'direct' }], [orglessPair]);
    expect(changes.creates.map((c) => c.category)).toEqual(['workers-comp']);
    expect(changes.deactivates).toEqual([orglessPair]);
  });
});

interface MockOystehr {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
  getPayer: ReturnType<typeof vi.fn>;
  getPayerByUrl: ReturnType<typeof vi.fn>;
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
  const getPayer = vi.fn();
  const getPayerByUrl = vi.fn();
  const oystehr = { fhir: { transaction, search }, rcm: { getPayer, getPayerByUrl } } as unknown as Oystehr;
  return { oystehr, transaction, search, getPayer, getPayerByUrl };
}

describe('fetchNioCoveragePairs', () => {
  it('queries affiliations by the primary-organization search parameter and pairs the included orgs', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockResolvedValue({ unbundle: () => [wcAffiliation, wcCoverageOrg] });

    const pairs = await fetchNioCoveragePairs(oystehr, NIO_ID);

    expect(pairs).toEqual([{ affiliation: wcAffiliation, coverageOrg: wcCoverageOrg }]);
    expect(search.mock.calls[0][0].params).toContainEqual({
      name: 'primary-organization',
      value: `Organization/${NIO_ID}`,
    });
  });
});

describe('create-billing-non-insurance-org', () => {
  it('writes the NIO, coverage orgs, and affiliations in one urn-linked transaction', async () => {
    const { oystehr, transaction } = makeOystehr();

    const result = await createNio(oystehr, { ...fullInput, secrets: null }, { reference: PAYER_URL });

    expect(result).toEqual({ id: 'created-0' });
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests).toHaveLength(1 + 3 * 2);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].fullUrl).toMatch(/^urn:uuid:/);
    expect(kindCoding(requests[0].resource, 'non-insurance-organization')).toBe(true);

    const affiliations = requests.filter(
      (r: { resource: { resourceType: string } }) => r.resource.resourceType === 'OrganizationAffiliation'
    );
    expect(affiliations).toHaveLength(3);
    for (const request of affiliations) {
      expect(request.resource.organization.reference).toBe(requests[0].fullUrl);
      const coverageRequest = requests.find(
        (r: { fullUrl?: string }) => r.fullUrl === request.resource.participatingOrganization.reference
      );
      expect(coverageRequest).toBeDefined();
      expect(kindCoding(coverageRequest.resource, 'nio-coverage')).toBe(true);
    }

    const wcOrg = requests[1].resource;
    expect(wcOrg.extension).toContainEqual({ url: NIO_WC_BILLING_MODE_EXTENSION_URL, valueCode: 'insurance' });
    expect(wcOrg.extension).toContainEqual({
      url: NIO_WC_PAYER_EXTENSION_URL,
      valueReference: { reference: PAYER_URL },
    });
  });
});

describe('update-billing-non-insurance-org', () => {
  const params = { ...fullInput, nioId: NIO_ID, secrets: null };

  it('rewrites the org, updates kept coverage, creates new pairs, all with optimistic locks', async () => {
    const { oystehr, transaction } = makeOystehr();
    const pairs = [{ affiliation: wcAffiliation, coverageOrg: wcCoverageOrg }];

    const result = await updateNio(oystehr, params, nioOrg, pairs, { reference: PAYER_URL });

    expect(result).toEqual({ id: NIO_ID });
    const requests = transaction.mock.calls[0][0].requests;

    expect(requests[0]).toMatchObject({ method: 'PUT', url: `Organization/${NIO_ID}`, ifMatch: 'W/"3"' });
    expect(requests[0].resource.active).toBe(true);

    const wcPut = requests.find((r: { url?: string }) => r.url === 'Organization/cov-wc');
    expect(wcPut).toMatchObject({ method: 'PUT', ifMatch: 'W/"2"' });

    // occ-med and other are new: 2 coverage POSTs + 2 affiliation POSTs, pointed at the stored NIO id.
    const posts = requests.filter((r: { method: string }) => r.method === 'POST');
    expect(posts).toHaveLength(4);
    const postedAffiliations = posts.filter(
      (r: { resource: { resourceType: string } }) => r.resource.resourceType === 'OrganizationAffiliation'
    );
    postedAffiliations.forEach((request: { resource: OrganizationAffiliation }) => {
      expect(request.resource.organization?.reference).toBe(`Organization/${NIO_ID}`);
    });
  });

  it('reactivates an inactive pair when its category is re-checked', async () => {
    const { oystehr, transaction } = makeOystehr();
    const inactivePair = {
      affiliation: { ...wcAffiliation, active: false },
      coverageOrg: { ...wcCoverageOrg, active: false },
    };

    await updateNio(
      oystehr,
      { ...params, covers: [{ category: 'workers-comp', billingMode: 'direct' }] },
      nioOrg,
      [inactivePair],
      undefined
    );

    const requests = transaction.mock.calls[0][0].requests;
    const affiliationPut = requests.find((r: { url?: string }) => r.url === 'OrganizationAffiliation/aff-wc');
    expect(affiliationPut.resource.active).toBe(true);
    const coveragePut = requests.find((r: { url?: string }) => r.url === 'Organization/cov-wc');
    expect(coveragePut.resource.active).toBe(true);
    expect(coveragePut.resource.extension).toContainEqual({
      url: NIO_WC_BILLING_MODE_EXTENSION_URL,
      valueCode: 'direct',
    });
  });

  it('deactivates the pair for an unchecked category', async () => {
    const { oystehr, transaction } = makeOystehr();

    await updateNio(oystehr, { ...params, covers: [] }, nioOrg, [
      { affiliation: wcAffiliation, coverageOrg: wcCoverageOrg },
    ]);

    const requests = transaction.mock.calls[0][0].requests;
    expect(requests).toHaveLength(3);
    const affiliationPut = requests.find((r: { url?: string }) => r.url === 'OrganizationAffiliation/aff-wc');
    expect(affiliationPut.resource.active).toBe(false);
    const coveragePut = requests.find((r: { url?: string }) => r.url === 'Organization/cov-wc');
    expect(coveragePut.resource.active).toBe(false);
  });
});

describe('delete-billing-non-insurance-org', () => {
  it('soft-deletes the whole graph in one transaction', async () => {
    const { oystehr, transaction } = makeOystehr();

    const result = await deleteNio(oystehr, nioOrg, [{ affiliation: wcAffiliation, coverageOrg: wcCoverageOrg }]);

    expect(result).toEqual({ deleted: true });
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests).toHaveLength(3);
    requests.forEach((request: { method: string; resource: { active: boolean }; ifMatch?: string }) => {
      expect(request.method).toBe('PUT');
      expect(request.resource.active).toBe(false);
      expect(request.ifMatch).toBeDefined();
    });
  });
});

describe('search-billing-non-insurance-orgs', () => {
  it('maps a page of orgs with covers resolved from one affiliation search', async () => {
    const { oystehr, search, getPayerByUrl } = makeOystehr();
    search.mockImplementation(({ resourceType }) => {
      if (resourceType === 'Organization') {
        return Promise.resolve({ unbundle: () => [nioOrg], total: 1 });
      }
      return Promise.resolve({ unbundle: () => [wcAffiliation, wcCoverageOrg] });
    });
    getPayerByUrl.mockResolvedValue({
      resourceType: 'Organization',
      id: PAYER_RCM_ID,
      name: 'Acme Insurance',
      identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: 'PAYER123' }],
    });

    const result = await searchNios(oystehr, { secrets: null });

    expect(result.total).toBe(1);
    expect(result.organizations).toHaveLength(1);
    const item = result.organizations[0];
    expect(item.name).toBe('FedEx');
    const wc = item.covers.find((c) => c.category === 'workers-comp') as NioWorkersCompCoverage;
    expect(wc.billingMode).toBe('insurance');
    expect(wc.payer).toEqual({ id: PAYER_RCM_ID, name: 'Acme Insurance', payerId: 'PAYER123' });

    const orgParams = search.mock.calls[0][0].params;
    expect(orgParams).toContainEqual({
      name: 'type',
      value: `${NIO_ORGANIZATION_KIND_SYSTEM}|non-insurance-organization`,
    });
    expect(orgParams).toContainEqual({ name: 'active', value: 'true' });
    // R4 names the OrganizationAffiliation.organization search parameter primary-organization.
    expect(search.mock.calls[1][0].params).toContainEqual({
      name: 'primary-organization',
      value: `Organization/${NIO_ID}`,
    });
  });

  it('falls back to the stored payer display when RCM resolution fails', async () => {
    const { oystehr, search, getPayerByUrl } = makeOystehr();
    search.mockImplementation(({ resourceType }) =>
      resourceType === 'Organization'
        ? Promise.resolve({ unbundle: () => [nioOrg], total: 1 })
        : Promise.resolve({ unbundle: () => [wcAffiliation, wcCoverageOrg] })
    );
    getPayerByUrl.mockRejectedValue(new Error('rcm down'));

    const result = await searchNios(oystehr, { secrets: null });
    const wc = result.organizations[0].covers.find((c) => c.category === 'workers-comp') as NioWorkersCompCoverage;
    expect(wc.payer).toEqual({ id: '', name: 'Acme Insurance (PAYER123)', payerId: 'PAYER123' });
  });
});

describe('list-non-insurance-organizations', () => {
  it('returns minimal clinical options carrying the NIO reference token', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockImplementation(({ resourceType }) =>
      resourceType === 'Organization'
        ? Promise.resolve({ unbundle: () => [nioOrg] })
        : Promise.resolve({ unbundle: () => [wcAffiliation] })
    );

    const result = await listNios(oystehr, { employerOnly: true, secrets: null });

    expect(result.organizations).toEqual([
      {
        id: NIO_ID,
        reference: getNioReferenceUrl(NIO_ID),
        name: 'FedEx',
        employer: true,
        active: true,
        address: fullInput.address,
        coversCategories: ['workers-comp'],
      },
    ]);

    const orgParams = search.mock.calls[0][0].params;
    expect(orgParams).toContainEqual({ name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|employer` });
    // The affiliation pass filters by primary-organization and never asks for the coverage orgs.
    expect(search.mock.calls[1][0].params).toContainEqual({
      name: 'primary-organization',
      value: `Organization/${NIO_ID}`,
    });
    expect(search.mock.calls[1][0].params.some((p: { name: string }) => p.name === '_include')).toBe(false);
  });

  it('resolves a deleted NIO by id with active=false', async () => {
    const { oystehr, search } = makeOystehr();
    search.mockImplementation(({ resourceType }) =>
      resourceType === 'Organization'
        ? Promise.resolve({ unbundle: () => [{ ...nioOrg, active: false }] })
        : Promise.resolve({ unbundle: () => [] })
    );

    const result = await listNios(oystehr, { nioId: NIO_ID, secrets: null });

    expect(result.organizations[0].active).toBe(false);
    const orgParams = search.mock.calls[0][0].params;
    expect(orgParams).toContainEqual({ name: '_id', value: NIO_ID });
    expect(orgParams.some((p: { name: string }) => p.name === 'active')).toBe(false);
  });
});

describe('resolveWcPayerReference', () => {
  it('persists a UUID RCM payer as a plain Organization reference with display', async () => {
    const { oystehr, getPayer } = makeOystehr();
    getPayer.mockResolvedValue({
      resourceType: 'Organization',
      id: PAYER_RCM_ID,
      name: 'Acme Insurance',
      identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: 'PAYER123' }],
    });

    const ref = await resolveWcPayerReference(oystehr, [
      { category: 'workers-comp', billingMode: 'insurance', payerId: PAYER_RCM_ID },
    ]);

    expect(ref).toEqual({ reference: `Organization/${PAYER_RCM_ID}`, display: 'Acme Insurance (PAYER123)' });
  });

  it('throws INVALID_INPUT for an unknown payer id', async () => {
    const { oystehr, getPayer } = makeOystehr();
    getPayer.mockRejectedValue(new Error('not found'));

    await expect(
      resolveWcPayerReference(oystehr, [{ category: 'workers-comp', billingMode: 'insurance', payerId: 'nope' }])
    ).rejects.toMatchObject({ message: expect.stringContaining('Unknown payer id') });
  });

  it('returns undefined when no workers-comp payer was selected', async () => {
    const { oystehr, getPayer } = makeOystehr();
    await expect(
      resolveWcPayerReference(oystehr, [{ category: 'workers-comp', billingMode: 'direct' }])
    ).resolves.toBeUndefined();
    expect(getPayer).not.toHaveBeenCalled();
  });
});
