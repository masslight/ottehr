import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Coverage, FhirResource, Location, Patient, PaymentNotice, Practitioner } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { CODE_SYSTEM_CLAIM_TYPE } from 'utils/lib/helpers/rcm/constants';
import { AdHocBillingClaimsOutputSchema } from 'utils/lib/types/adhoc/datasets/billing-claims';
import { CLAIM_STATUS_DATE_EXTENSION_URLS, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADHOC_CLAIMS_BUILD_BUDGET_MS,
  ADHOC_CLAIMS_OVER_BUDGET_MESSAGE,
  fetchAdHocClaimRows,
} from '../../../src/billing/adhoc/claims';
import { X12_ADJUSTMENT_GROUP_SYSTEM } from '../../../src/billing/claim-amounts';
import { buildClaimLookups, mapClaimToItem } from '../../../src/billing/claim-search';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../../../src/billing/payments';
import { ERA_STATUS_CODE_EXTENSION } from '../../../src/billing/shared';
import { WRITE_OFF_REASON_EXT_URL, WRITE_OFF_SYSTEM } from '../../../src/billing/write-offs';

const ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
const PAYER_A = 'https://rcm-api.zapehr.com/v1/payer/payer-a';
const PAYER_B = 'https://rcm-api.zapehr.com/v1/payer/payer-b';
const DATE_RANGE = { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-19T23:59:59.999-04:00' };

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pt-1',
  name: [{ given: ['Ann'], family: 'Lee' }],
  birthDate: '1990-02-03',
};
const facility: Location = { resourceType: 'Location', id: 'loc-1', name: 'Midtown' };
const provider: Practitioner = { resourceType: 'Practitioner', id: 'pr-1', name: [{ given: ['Bo'], family: 'Kim' }] };
const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  subscriberId: 'M-1',
  beneficiary: { reference: 'Patient/pt-1' },
  payor: [{ reference: PAYER_A }],
};

const claim = (id: string, serviceDate: string, overrides: Partial<Claim> = {}): Claim => ({
  resourceType: 'Claim',
  id,
  status: 'active',
  use: 'claim',
  created: '2026-10-20T15:00:00Z',
  type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
  patient: { reference: 'Patient/pt-1' },
  provider: { reference: 'Practitioner/pr-1' },
  facility: { reference: 'Location/loc-1' },
  careTeam: [{ sequence: 1, provider: { reference: 'Practitioner/pr-1' } }],
  priority: { coding: [{ code: 'normal' }] },
  identifier: [{ system: ENCOUNTER_ID_SYSTEM, value: `enc-${id}` }],
  insurance: [],
  total: { value: 200, currency: 'USD' },
  item: [
    {
      sequence: 1,
      productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }] },
      modifier: [{ coding: [{ code: '25' }] }],
      quantity: { value: 1 },
      net: { value: 150, currency: 'USD' },
      servicedDate: serviceDate,
    },
    {
      sequence: 2,
      productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '87880' }] },
      quantity: { value: 2 },
      net: { value: 50, currency: 'USD' },
      servicedDate: serviceDate,
    },
  ],
  meta: { tag: [] },
  ...overrides,
});

const insuredClaim = claim('claim-1', '2026-10-05', {
  insurer: { reference: PAYER_A },
  insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-1' } }],
  meta: {
    tag: [
      { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: 'patient-ar' },
      { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'finalized' },
      { system: CLAIM_STATUS_TAG_SYSTEMS.adjudicationStatus, code: 'approved' },
    ],
  },
  diagnosis: [
    { sequence: 2, diagnosisCodeableConcept: { coding: [{ code: 'R05.9' }] } },
    { sequence: 1, diagnosisCodeableConcept: { coding: [{ code: 'J02.9' }] } },
  ],
  extension: [
    { url: CLAIM_STATUS_DATE_EXTENSION_URLS.insuranceFinalized, valueDateTime: '2026-10-12T14:00:00Z' },
    { url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr, valueDateTime: '2026-10-12T14:00:00Z' },
  ],
});

const selfPayClaim = claim('claim-2', '2026-10-10');
const outOfRangeClaim = claim('claim-3', '2026-09-15', { insurer: { reference: PAYER_B } });

const fillerClaims = Array.from({ length: 230 }, (_unused, index) =>
  claim(`claim-f${String(index).padStart(3, '0')}`, '2026-10-15', { insurer: { reference: PAYER_A } })
);

const remit: ClaimResponse = {
  resourceType: 'ClaimResponse',
  id: 'cr-1',
  status: 'active',
  use: 'claim',
  outcome: 'complete',
  created: '2026-10-11T12:00:00Z',
  type: { coding: [{ code: 'professional' }] },
  patient: { reference: 'Patient/pt-1' },
  insurer: { reference: PAYER_A },
  request: { reference: 'Claim/claim-1' },
  extension: [{ url: ERA_STATUS_CODE_EXTENSION, valueString: '1' }],
  total: [{ category: { coding: [{ code: 'paid' }] }, amount: { value: 120, currency: 'USD' } }],
  item: [
    {
      itemSequence: 1,
      adjudication: [
        { category: { coding: [{ code: 'allowed' }] }, amount: { value: 150, currency: 'USD' } },
        { category: { coding: [{ code: 'paid' }] }, amount: { value: 120, currency: 'USD' } },
        {
          category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'CO' }] },
          reason: { coding: [{ code: '45' }] },
          amount: { value: 50, currency: 'USD' },
        },
        {
          category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'PR' }] },
          reason: { coding: [{ code: '3' }] },
          amount: { value: 30, currency: 'USD' },
        },
      ],
    },
  ],
};

const writeOff = (id: string, status: PaymentNotice['status'], reason: string): PaymentNotice => ({
  resourceType: 'PaymentNotice',
  id,
  status,
  created: '2026-10-13T12:00:00Z',
  paymentDate: '2026-10-13',
  identifier: [{ system: WRITE_OFF_SYSTEM, value: id }],
  request: { reference: 'Claim/claim-1' },
  payment: { display: 'write-off' },
  recipient: { display: 'n/a' },
  amount: { value: 10, currency: 'USD' },
  extension: [{ url: WRITE_OFF_REASON_EXT_URL, valueString: reason }],
});

const patientPayment: PaymentNotice = {
  resourceType: 'PaymentNotice',
  id: 'pn-pay-1',
  status: 'active',
  created: '2026-10-10T12:00:00Z',
  identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: 'clinical-1' }],
  request: { identifier: { system: ENCOUNTER_ID_SYSTEM, value: 'enc-claim-2' } },
  payment: { display: 'card' },
  recipient: { display: 'n/a' },
  amount: { value: 75, currency: 'USD' },
};

const claims = [insuredClaim, selfPayClaim, outOfRangeClaim, ...fillerClaims];
const store: FhirResource[] = [
  ...claims,
  patient,
  facility,
  provider,
  coverage,
  remit,
  writeOff('wo-1', 'active', 'small'),
  writeOff('wo-2', 'cancelled', 'other'),
  patientPayment,
];

type Param = { name: string; value: string };

// A tiny FHIR search over `store`: _id / request / request:identifier / identifier filters, offset
// paging with a total, and Claim _include of patient / facility / provider.
// `shortScans`: how many claim scans report one claim more than they return — what a claim created
// mid-scan does to an offset scan. `onScan` runs at the start of every claim scan.
function stubBillingClient({ shortScans = 0, onScan }: { shortScans?: number; onScan?: () => void } = {}): {
  oystehr: Oystehr;
  search: ReturnType<typeof vi.fn>;
  getPayerByUrl: ReturnType<typeof vi.fn>;
} {
  let scansStarted = 0;
  const search = vi.fn(async ({ resourceType, params }: { resourceType: string; params: Param[] }) => {
    const all = (name: string): string[] => params.filter((p) => p.name === name).map((p) => p.value);
    const isScan = resourceType === 'Claim' && all('_elements')[0] === 'id,meta,created,item';
    if (isScan && Number(all('_offset')[0] ?? 0) === 0) {
      scansStarted += 1;
      onScan?.();
    }
    const phantom = isScan && scansStarted <= shortScans ? 1 : 0;
    const listOf = (name: string): string[] | undefined => all(name)[0]?.split(',');
    const tokenMatches = (tokens: string[], identifiers: { system?: string; value?: string }[] = []): boolean =>
      tokens.some((token) => {
        const [system, value] = token.split('|');
        return identifiers.some((id) => id.system === system && (!value || id.value === value));
      });

    let matches = store.filter((r) => r.resourceType === resourceType);
    const ids = listOf('_id');
    if (ids) matches = matches.filter((r) => ids.includes(r.id ?? ''));
    const requests = listOf('request');
    if (requests)
      matches = matches.filter((r) =>
        requests.includes((r as { request?: { reference?: string } }).request?.reference ?? '')
      );
    const requestIdentifiers = listOf('request:identifier');
    if (requestIdentifiers) {
      matches = matches.filter((r) => {
        const identifier = (r as PaymentNotice).request?.identifier;
        return identifier ? tokenMatches(requestIdentifiers, [identifier]) : false;
      });
    }
    const identifiers = listOf('identifier');
    if (identifiers) matches = matches.filter((r) => tokenMatches(identifiers, (r as { identifier?: [] }).identifier));
    if (all('_sort')[0] === '_id') matches = [...matches].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));

    const offset = Number(all('_offset')[0] ?? 0);
    const count = Number(all('_count')[0] ?? matches.length);
    const page = matches.slice(offset, offset + count);

    const included: FhirResource[] = [];
    if (resourceType === 'Claim' && all('_include').length > 0) {
      const refs = new Set(
        (page as Claim[]).flatMap((c) => [c.patient?.reference, c.facility?.reference, c.provider?.reference])
      );
      included.push(...store.filter((r) => refs.has(`${r.resourceType}/${r.id}`)));
    }

    const entry = [
      ...page.map((resource) => ({ resource, search: { mode: 'match' as const } })),
      ...included.map((resource) => ({ resource, search: { mode: 'include' as const } })),
    ];
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: matches.length + phantom,
      entry,
      link: offset + count < matches.length ? [{ relation: 'next', url: 'next' }] : [],
      unbundle: () => entry.map((e) => e.resource),
    };
  });
  const getPayerByUrl = vi.fn(async ({ url }: { url: string }) => ({
    resourceType: 'Organization',
    id: url.split('/').pop(),
    name: url === PAYER_A ? 'Payer A' : 'Payer B',
  }));
  const oystehr = { fhir: { search }, rcm: { getPayerByUrl } } as unknown as Oystehr;
  return { oystehr, search, getPayerByUrl };
}

const allLayers = { includeCodes: true, includeWriteOffs: true, includeRemits: true, includeTimeline: true };

describe('fetchAdHocClaimRows (billing-claims dataset)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds one schema-valid row per claim in the service-date range', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();

    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, ...allLayers });

    expect(() => AdHocBillingClaimsOutputSchema.parse({ rows })).not.toThrow();
    expect(rows).toHaveLength(claims.length - 1);
    expect(rows.map((r) => r.claimId)).not.toContain('claim-3');
  });

  it('carries the claims list amounts unchanged', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, ...allLayers });

    const lookups = await buildClaimLookups({
      oystehr,
      claims: [insuredClaim, selfPayClaim],
      includedResources: [patient, facility, provider],
    });
    for (const source of [insuredClaim, selfPayClaim]) {
      const item = mapClaimToItem(source, lookups);
      const row = rows.find((r) => r.claimId === source.id)!;
      expect(row).toMatchObject({
        billed: item.billed,
        allowed: item.allowed,
        insurancePaid: item.insurancePaid,
        patientResp: item.patientResp,
        patientPaid: item.patientPaid,
        writeOffsTotal: item.writeOffsTotal,
        claimBalance: item.claimBalance,
        adjudicated: item.adjudicated,
      });
    }

    const insured = rows.find((r) => r.claimId === 'claim-1')!;
    expect(insured).toMatchObject({
      encounterId: 'enc-claim-1',
      patientId: 'pt-1',
      patientName: 'Lee, Ann',
      patientDob: '1990-02-03',
      serviceDate: '2026-10-05',
      payerName: 'Payer A',
      memberId: 'M-1',
      facility: 'Midtown',
      arStage: 'patient-ar',
      insuranceArStatus: 'finalized',
      patientArStatus: '',
      insurancePaid: 120,
      writeOffsTotal: 10,
    });
    expect(rows.find((r) => r.claimId === 'claim-2')).toMatchObject({ patientPaid: 75, payerName: '' });
  });

  it('fills every layer from the hydrated claim and its lookups', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, ...allLayers });
    const insured = rows.find((r) => r.claimId === 'claim-1')!;

    expect(insured).toMatchObject({
      cptCodes: ['99213', '87880'],
      cptLines: [
        { code: '99213', modifiers: ['25'], units: 1, charge: 150 },
        { code: '87880', modifiers: [], units: 2, charge: 50 },
      ],
      icdCodes: ['J02.9', 'R05.9'],
      writeOffCount: 1,
      writeOffReasons: ['small'],
      remitCount: 1,
      lastRemitDate: '2026-10-11T12:00:00Z',
      adjustmentReasonCodes: ['45', '3'],
      remits: [{ date: '2026-10-11T12:00:00Z', allowed: 150, paid: 120, patientResp: 30 }],
      remitAdjustments: [
        { remitDate: '2026-10-11T12:00:00Z', group: 'CO', code: '45', amount: 50 },
        { remitDate: '2026-10-11T12:00:00Z', group: 'PR', code: '3', amount: 30 },
      ],
      insuranceFinalizedDate: '2026-10-12T14:00:00Z',
      enteredPatientArDate: '2026-10-12T14:00:00Z',
    });
    expect(insured.writeOffs).toEqual([
      { date: '2026-10-13', amount: 10, party: '', payer: '', reason: 'small', voided: false },
      { date: '2026-10-13', amount: 10, party: '', payer: '', reason: 'other', voided: true },
    ]);
  });

  it('asks the server for the claim fields the layers read beyond the claims list', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr, search } = stubBillingClient();
    await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, ...allLayers });

    const hydration = search.mock.calls
      .map(([arg]) => arg as { resourceType: string; params: Param[] })
      .filter((arg) => arg.resourceType === 'Claim' && arg.params.some((p) => p.name === '_id'));
    expect(hydration.length).toBeGreaterThan(1);
    for (const call of hydration) {
      const elements = call.params.find((p) => p.name === '_elements')?.value.split(',') ?? [];
      expect(elements).toEqual(expect.arrayContaining(['Claim.diagnosis', 'Claim.extension', 'Claim.item']));
    }
  });

  it('leaves out the layers that were not selected', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeCodes: true });
    const insured = rows.find((r) => r.claimId === 'claim-1')!;

    expect(insured.icdCodes).toEqual(['J02.9', 'R05.9']);
    for (const field of ['writeOffs', 'writeOffCount', 'remits', 'remitCount', 'insuranceFinalizedDate'] as const) {
      expect(insured).not.toHaveProperty(field);
    }
    expect(() => AdHocBillingClaimsOutputSchema.parse({ rows })).not.toThrow();
  });

  it('looks each payer up once for the whole run, not once per page', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr, getPayerByUrl } = stubBillingClient();
    await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });

    // Payer A spans three hydration pages; the out-of-range claim's payer B is never looked up.
    expect(getPayerByUrl).toHaveBeenCalledTimes(1);
    expect(getPayerByUrl).toHaveBeenCalledWith({ url: PAYER_A });
  });

  it('scans again when a claim created mid-scan left the first scan short', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient({ shortScans: 1 });

    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });

    expect(rows).toHaveLength(claims.length - 1);
  });

  it('fails rather than leaving claims out when the scan comes up short twice', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient({ shortScans: 2 });

    await expect(fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE })).rejects.toThrow('short of the total, twice');
  });

  it('stops with a narrow-the-range message before the worker would be killed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    // The scan itself eats the whole budget.
    const { oystehr, search } = stubBillingClient({
      onScan: () => {
        now += ADHOC_CLAIMS_BUILD_BUDGET_MS + 1;
      },
    });

    await expect(fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE })).rejects.toThrow(
      ADHOC_CLAIMS_OVER_BUDGET_MESSAGE
    );
    // No page was hydrated after the deadline passed.
    const hydrations = search.mock.calls.filter(
      ([arg]) => arg.resourceType === 'Claim' && (arg.params as Param[]).some((p) => p.name === '_id')
    );
    expect(hydrations).toHaveLength(0);
  });

  it('counts as unresolved only payer references it actually looked up', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { oystehr, getPayerByUrl } = stubBillingClient();
    // claim-2 points at something that is no payer reference at all: skipped, not "unresolved".
    selfPayClaim.insurer = { reference: 'Patient/pt-1' };
    getPayerByUrl.mockRejectedValueOnce(new Error('rcm down'));
    try {
      await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });
    } finally {
      delete selfPayClaim.insurer;
    }

    const unresolved = warn.mock.calls
      .map(([message]) => String(message))
      .filter((m) => m.includes('could not be resolved'));
    expect(unresolved).toEqual([expect.stringContaining('1 payer reference(s)')]);
  });
});
