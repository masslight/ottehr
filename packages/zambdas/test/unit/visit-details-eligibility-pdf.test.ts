import Oystehr from '@oystehr/sdk';
import { Coverage, CoverageEligibilityResponse, Organization } from 'fhir/r4b';
import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { OYSTEHR_RCM_PAYER_ID_SYSTEM } from 'utils/lib/fhir/constants';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { OrderedCoveragesWithSubscribers } from 'utils/lib/types/data/account';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findLatestCoverageCheck, getPatientCoverageChecks } from '../../src/shared/patient-coverage-checks';
import { PdfRenderConfig, renderPdf } from '../../src/shared/pdf/pdf-common';
import { PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import { composeEligibilityData, createEligibilitySection } from '../../src/shared/pdf/sections/eligibilityInfo';
import {
  composeInsuranceData,
  createPrimaryInsuranceSection,
  getDisplayedInsurancePayerAndMemberId,
} from '../../src/shared/pdf/sections/insuranceInfo';
import { EligibilityInfo, VisitDetailsData } from '../../src/shared/pdf/types';
import { visitDetailsRenderConfig } from '../../src/shared/pdf/visit-details-pdf';

const PATIENT_ID = 'patient-1';
const TIMEZONE = 'America/New_York';
const AETNA = '60054';
const CIGNA = '62308';

const payerOrganization = (payerId: string, name: string): Organization => ({
  resourceType: 'Organization',
  id: `org-${payerId}`,
  name,
  identifier: [{ system: OYSTEHR_RCM_PAYER_ID_SYSTEM, value: payerId }],
});
const INSURANCE_ORGS = [payerOrganization(AETNA, 'Aetna'), payerOrganization(CIGNA, 'Cigna')];

const makeCoverage = (
  id: string,
  payerId: string,
  memberId: string,
  { relationship = 'Child', payorRef = `https://rcm-api.zapehr.com/v1/payer/${payerId}` } = {}
): Coverage => ({
  resourceType: 'Coverage',
  id,
  status: 'active',
  beneficiary: { reference: `Patient/${PATIENT_ID}` },
  subscriberId: memberId,
  payor: [{ reference: payorRef }],
  identifier: [{ type: { coding: [{ code: 'MB' }] }, value: memberId, assigner: { reference: payorRef } }],
  relationship: relationship
    ? {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: relationship.toLowerCase(),
            display: relationship,
          },
        ],
      }
    : undefined,
  class: [
    {
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
      value: payerId,
    },
  ],
});

const AETNA_COVERAGE = makeCoverage('cov-aetna', AETNA, 'A-123');
const CIGNA_COVERAGE = makeCoverage('cov-cigna', CIGNA, 'C-456', { relationship: 'Self' });

const RAW_REQUEST = { pat_name_f: 'Oliver', pat_name_l: 'Black', pat_dob: '20200112' };

const healthPlanLine = {
  benefit_coverage_code: '1',
  benefit_code: '30',
  benefit_description: 'Health Benefit Plan Coverage',
  inplan_network: 'Y',
  policy_number: 'POL-55',
  insurance_type_code: 'MC',
  insurance_type_description: 'Medicaid',
  entity_name: ['Aetna Better Health'],
  entity_id: ['60054'],
  entity_addr_1: ['4545 Some Street, Apt. 454'],
  entity_city: 'Some City',
  entity_state: 'ST',
  entity_zip: '22334-7788',
  entity_website: ['aetna.com'],
  entity_phone: ['(212) 555-1212'],
  entity_fax: ['(212) 555-1213'],
};

const RAW_RESPONSE = {
  elig: {
    ins_name_f: 'Jerome',
    ins_name_l: 'Black',
    ins_dob: '19990110',
    ins_number: 'A-123',
    ins_addr_1: 'Old Town Road, 123',
    ins_city: 'New York',
    ins_state: 'NY',
    ins_zip: '12345',
    plan_number: 'PLAN-77',
    benefit: [healthPlanLine],
  },
};

type CheckKind = 'eligible' | 'not-eligible' | 'unsupported-ml-410';

const makeResponse = (
  id: string,
  created: string,
  coverageReference: string,
  kind: CheckKind = 'eligible',
  rawResponse: object = RAW_RESPONSE
): CoverageEligibilityResponse => {
  const base: CoverageEligibilityResponse = {
    resourceType: 'CoverageEligibilityResponse',
    id,
    status: 'active',
    purpose: ['benefits'],
    patient: { reference: `Patient/${PATIENT_ID}` },
    created,
    request: { reference: `CoverageEligibilityRequest/req-${id}` },
    insurer: { reference: 'Organization/payer' },
    outcome: kind === 'eligible' ? 'complete' : 'error',
  };
  const coverage = { coverage: { reference: coverageReference } };
  if (kind === 'eligible') {
    return {
      ...base,
      insurance: [
        {
          ...coverage,
          item: [{ category: { coding: [{ code: '30' }] }, benefit: [{ type: { text: 'Active Coverage' } }] }],
        },
      ],
      extension: [
        { url: 'https://extensions.fhir.oystehr.com/raw-request', valueString: JSON.stringify(RAW_REQUEST) },
        { url: 'https://extensions.fhir.oystehr.com/raw-response', valueString: JSON.stringify(rawResponse) },
      ],
    };
  }
  const [code, text] =
    kind === 'not-eligible'
      ? ['75', 'Subscriber/Insured Not Found']
      : ['ml-410', 'Real-time eligibility checks are not supported for payer: Aetna (60054)'];
  return { ...base, insurance: [coverage], error: [{ code: { coding: [{ code }], text } }] };
};

interface Store {
  responses: CoverageEligibilityResponse[];
  coverages: Coverage[];
  unreadableResponseIds?: string[];
  unreadableCoverageIds?: string[];
  msPerSearch?: number;
}

const fakeOystehr = (store: Store, calls: string[] = []): Oystehr =>
  ({
    fhir: {
      search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        calls.push(`search ${params.map((p) => `${p.name}=${p.value}`).join('&')}`);
        const param = (name: string): string | undefined => params.find((p) => p.name === name)?.value;
        if (
          resourceType !== 'CoverageEligibilityResponse' ||
          param('_sort') !== '-created' ||
          param('_elements') !== 'id'
        ) {
          throw new Error(`unexpected search ${resourceType}`);
        }
        if (store.msPerSearch) vi.setSystemTime(Date.now() + store.msPerSearch);
        const offset = Number(param('_offset') ?? 0);
        const ids = store.responses
          .filter((r) => r.patient.reference === `Patient/${param('patient._id')}`)
          .sort((a, b) => Date.parse(b.created) - Date.parse(a.created))
          .slice(offset, offset + Number(param('_count')))
          .map((r) => ({ resourceType: r.resourceType, id: r.id }));
        return { unbundle: () => ids };
      },
      get: async ({ id }: { id: string }) => {
        calls.push(`get ${id}`);
        if (store.unreadableResponseIds?.includes(id)) throw new Error('response-too-large');
        return structuredClone(store.responses.find((r) => r.id === id));
      },
      batch: async ({ requests }: { requests: { url: string }[] }) => {
        calls.push(`batch ${requests.map(({ url }) => url).join(',')}`);
        return {
          entry: requests.map(({ url }) => {
            if (store.unreadableCoverageIds?.some((id) => url === `Coverage/${id}`))
              return { response: { status: '500' } };
            const resource = store.coverages.find((c) => `Coverage/${c.id}` === url);
            return resource ? { resource, response: { status: '200' } } : { response: { status: '404' } };
          }),
        };
      },
    },
  }) as unknown as Oystehr;

const pdfEligibility = async (
  store: Store,
  coverages: OrderedCoveragesWithSubscribers,
  calls: string[] = []
): Promise<EligibilityInfo> => {
  const insurances = composeInsuranceData({ coverages, insuranceOrgs: INSURANCE_ORGS });
  const displayed = getDisplayedInsurancePayerAndMemberId(coverages, insurances);
  const check =
    displayed && (await findLatestCoverageCheck(PATIENT_ID, displayed, fakeOystehr(store, calls), Date.now() + 60_000));
  return composeEligibilityData({
    coverages,
    insurances,
    coverageChecks: check ? [check] : [],
    timezone: TIMEZONE,
  });
};

const withInsuranceConfig = async <T>(
  { hiddenFields = [], sectionHidden = false }: { hiddenFields?: string[]; sectionHidden?: boolean },
  run: () => Promise<T>
): Promise<T> => {
  const insurance = PATIENT_RECORD_CONFIG.FormFields.insurance;
  const originalHiddenFields = insurance.hiddenFields;
  insurance.hiddenFields = hiddenFields;
  if (sectionHidden) PATIENT_RECORD_CONFIG.hiddenFormSections.push('insurance-section');
  try {
    return await run();
  } finally {
    insurance.hiddenFields = originalHiddenFields;
    if (sectionHidden) PATIENT_RECORD_CONFIG.hiddenFormSections.pop();
  }
};

const daily = (count: number, prefix: string, coverageReference: string, lastDay = 28): CoverageEligibilityResponse[] =>
  Array.from({ length: count }, (_, i) =>
    makeResponse(
      `${prefix}-${i}`,
      new Date(Date.UTC(2026, 9, lastDay - i, 10)).toISOString(),
      coverageReference,
      'not-eligible'
    )
  );

const AETNA_PAIR = { payerId: AETNA, memberId: 'A-123' };
const find = (
  store: Store,
  calls: string[] = [],
  deadline = Date.now() + 60_000
): ReturnType<typeof findLatestCoverageCheck> =>
  findLatestCoverageCheck(PATIENT_ID, AETNA_PAIR, fakeOystehr(store, calls), deadline);
const searches = (calls: string[]): string[] => calls.filter((call) => call.startsWith('search'));

const table = (info: EligibilityInfo): [string, string, string][] =>
  info.groups.flatMap((group) =>
    group.rows.map((row): [string, string, string] => [group.title ?? '', row.label, row.value])
  );

const SECTION_LAYOUT: [string, string[]][] = [
  ['', ['Status', 'Last checked']],
  ['Subscriber/Insured', ['First name, last name', 'Member ID', 'DOB', 'Address']],
  ['Patient', ['First name, last name', 'DOB', 'Relationship to insured']],
  ['Insurance/Plan', ['Plan number', 'Policy number', 'Funding type', 'Insurance type']],
  ['Payer info', ['Name of the payer', 'Payer ID', 'Address', 'Website', 'Phone', 'Fax']],
];

const withValues = (values: string[]): [string, string, string][] => {
  const cells = SECTION_LAYOUT.flatMap(([title, labels]) => labels.map((label) => [title, label] as const));
  expect(values).toHaveLength(cells.length);
  return cells.map(([title, label], index) => [title, label, values[index]]);
};

const ALL_DASHES = withValues(Array(19).fill('-'));

const checkWithoutDetails = (status: string, lastChecked: string): [string, string, string][] =>
  ALL_DASHES.map(([group, label, value]) => {
    if (label === 'Status') return [group, label, status];
    if (label === 'Last checked') return [group, label, lastChecked];
    if (label === 'Relationship to insured') return [group, label, 'Child'];
    return [group, label, value];
  });

const allDashGroups = (): EligibilityInfo['groups'] =>
  SECTION_LAYOUT.map(([title, labels]) => ({
    ...(title ? { title } : {}),
    rows: labels.map((label) => ({ label, value: '-' })),
  }));

const FULL_SECTION = withValues([
  'Eligible',
  '11/20/2026 09:30',
  'Black, Jerome',
  'A-123',
  '01/10/1999',
  'Old Town Road, 123 New York, NY 12345',
  'Black, Oliver',
  '01/12/2020',
  'Child',
  'PLAN-77',
  'POL-55',
  '-',
  'Medicaid',
  'Aetna Better Health',
  '60054',
  '4545 Some Street, Apt. 454 Some City, ST 22334-7788',
  'aetna.com',
  '(212) 555-1212',
  '(212) 555-1213',
]);

describe('getPatientCoverageChecks (shared by get-patient-account and the Visit Details PDF)', () => {
  it('reads the 10 newest responses and keeps those whose coverage it can resolve, newest first', async () => {
    const responses = Array.from({ length: 12 }, (_, i) =>
      makeResponse(`check-${i}`, `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, 'Coverage/cov-aetna')
    );
    responses[11] = makeResponse('check-11', '2026-11-12T10:00:00.000Z', 'Coverage/cov-missing');
    const calls: string[] = [];
    const checks = await getPatientCoverageChecks(
      PATIENT_ID,
      fakeOystehr({ responses, coverages: [AETNA_COVERAGE] }, calls)
    );
    expect(calls[0]).toBe('search patient._id=patient-1&_sort=-created&_elements=id&_count=10');
    expect(calls.filter((call) => call.startsWith('get'))).toHaveLength(10);
    expect(checks.map((check) => check.dateISO)).toEqual(
      Array.from({ length: 9 }, (_, i) => `2026-11-${String(11 - i).padStart(2, '0')}T10:00:00.000Z`)
    );
  });

  it('carries the payer ID, member ID and relationship of the coverage each check was run for', async () => {
    const contained = makeResponse('check-contained', '2026-11-20T14:30:00.000Z', '#covPrimary');
    contained.contained = [{ ...CIGNA_COVERAGE, id: 'covPrimary' }];
    const checks = await getPatientCoverageChecks(
      PATIENT_ID,
      fakeOystehr({
        responses: [makeResponse('check-ref', '2026-11-19T14:30:00.000Z', 'Coverage/cov-aetna'), contained],
        coverages: [AETNA_COVERAGE],
      })
    );
    expect(checks.map(({ payerId, subscriberId, relationship }) => ({ payerId, subscriberId, relationship }))).toEqual([
      { payerId: CIGNA, subscriberId: 'C-456', relationship: 'Self' },
      { payerId: AETNA, subscriberId: 'A-123', relationship: 'Child' },
    ]);
  });

  it('makes only the one search, and no eligibility request, when the patient has no saved checks', async () => {
    const calls: string[] = [];
    expect(await getPatientCoverageChecks(PATIENT_ID, fakeOystehr({ responses: [], coverages: [] }, calls))).toEqual(
      []
    );
    expect(calls).toEqual(['search patient._id=patient-1&_sort=-created&_elements=id&_count=10']);
  });
});

describe('findLatestCoverageCheck (Visit Details PDF only)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds a matching check older than the latest ten, which the account loader does not see', async () => {
    const store = {
      responses: [
        ...daily(12, 'cigna', 'Coverage/cov-cigna'),
        makeResponse('aetna', '2026-10-01T14:30:00.000Z', 'Coverage/cov-aetna'),
      ],
      coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
    };
    const calls: string[] = [];
    expect((await find(store, calls))?.dateISO).toBe('2026-10-01T14:30:00.000Z');
    expect(searches(calls)).toEqual([
      'search patient._id=patient-1&_sort=-created&_elements=id&_count=10&_offset=0',
      'search patient._id=patient-1&_sort=-created&_elements=id&_count=10&_offset=10',
    ]);
    const accountChecks = await getPatientCoverageChecks(PATIENT_ID, fakeOystehr(store));
    expect(accountChecks).toHaveLength(10);
    expect(accountChecks.some((check) => check.payerId === AETNA)).toBe(false);
  });

  it('reports no match only after reading every response', async () => {
    const calls: string[] = [];
    expect(
      await find({ responses: daily(23, 'cigna', 'Coverage/cov-cigna'), coverages: [CIGNA_COVERAGE] }, calls)
    ).toBeUndefined();
    expect(searches(calls).map((call) => call.split('&').pop())).toEqual(['_offset=0', '_offset=10', '_offset=20']);
    expect(calls.filter((call) => call.startsWith('get'))).toHaveLength(23);
  });

  it('returns the newest of several matching checks without reading further pages', async () => {
    const calls: string[] = [];
    const store = { responses: daily(15, 'aetna', 'Coverage/cov-aetna'), coverages: [AETNA_COVERAGE] };
    store.responses[3] = makeResponse('aetna-newest', '2026-10-30T10:00:00.000Z', 'Coverage/cov-aetna');
    expect((await find(store, calls))?.dateISO).toBe('2026-10-30T10:00:00.000Z');
    expect(searches(calls)).toHaveLength(1);
  });

  it('matches a check whose coverage is a contained snapshot', async () => {
    const contained = makeResponse('aetna-contained', '2026-11-20T14:30:00.000Z', '#snapshot');
    contained.contained = [{ ...AETNA_COVERAGE, id: 'snapshot' }];
    expect((await find({ responses: [contained], coverages: [] }))?.dateISO).toBe('2026-11-20T14:30:00.000Z');
  });

  it('returns the match when only an older response could not be read', async () => {
    const store = {
      responses: [
        makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna'),
        makeResponse('oversized', '2026-11-19T14:30:00.000Z', 'Coverage/cov-cigna'),
      ],
      coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
      unreadableResponseIds: ['oversized'],
    };
    expect((await find(store))?.dateISO).toBe('2026-11-20T14:30:00.000Z');
  });

  it('fails instead of returning an older match when a newer response could not be read', async () => {
    const store = {
      responses: [
        makeResponse('oversized', '2026-11-21T14:30:00.000Z', 'Coverage/cov-cigna'),
        makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna'),
      ],
      coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
      unreadableResponseIds: ['oversized'],
    };
    await expect(find(store)).rejects.toThrow(/newer responses could not be read.*oversized/);
  });

  it('fails instead of reporting no match when an unread response could have matched', async () => {
    const store = {
      responses: [
        ...daily(12, 'cigna', 'Coverage/cov-cigna'),
        makeResponse('oversized', '2026-09-01T10:00:00.000Z', 'Coverage/cov-aetna'),
      ],
      coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
      unreadableResponseIds: ['oversized'],
    };
    await expect(find(store)).rejects.toThrow(/no readable response matched.*oversized/);
  });

  it('treats a coverage the batch could not read as unread, but skips one that no longer exists', async () => {
    const responses = [
      makeResponse('flaky', '2026-11-21T14:30:00.000Z', 'Coverage/cov-flaky'),
      makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna'),
    ];
    await expect(
      find({ responses, coverages: [AETNA_COVERAGE], unreadableCoverageIds: ['cov-flaky'] })
    ).rejects.toThrow(/flaky/);
    expect((await find({ responses, coverages: [AETNA_COVERAGE] }))?.dateISO).toBe('2026-11-20T14:30:00.000Z');
  });

  it('fails instead of reporting no match when its time budget runs out', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const calls: string[] = [];
    const store = {
      responses: daily(40, 'cigna', 'Coverage/cov-cigna'),
      coverages: [CIGNA_COVERAGE],
      msPerSearch: 2_000,
    };
    await expect(find(store, calls, Date.now() + 5_000)).rejects.toThrow(/time budget after 30 responses/);
    expect(searches(calls)).toHaveLength(3);
  });

  it('still returns a match found on a page started within its time budget', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const store = {
      responses: [
        ...daily(12, 'cigna', 'Coverage/cov-cigna'),
        makeResponse('aetna', '2026-09-01T10:00:00.000Z', 'Coverage/cov-aetna'),
      ],
      coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
      msPerSearch: 4_000,
    };
    expect((await find(store, [], Date.now() + 5_000))?.dateISO).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('Visit Details PDF "Eligibility Check Details" section', () => {
  it('prints every field of the check for the payer and member ID shown in the document', async () => {
    const info = await pdfEligibility(
      {
        responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
        coverages: [AETNA_COVERAGE],
      },
      { primary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(FULL_SECTION);
    expect(info.unavailable).toBeUndefined();
  });

  it('matches a check run for a separate Coverage resource with the same payer and member ID', async () => {
    const recreated = makeCoverage('cov-aetna-recreated', AETNA, 'A-123', {
      payorRef: 'Organization/b9cd24f9-813e-442a-9682-ec146ce3e6c3',
    });
    const info = await pdfEligibility(
      {
        responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
        coverages: [AETNA_COVERAGE],
      },
      { primary: recreated }
    );
    expect(table(info)).toEqual(FULL_SECTION);
  });

  it.each([
    ['the same payer with a different member ID', makeCoverage('cov-aetna-2', AETNA, 'A-999')],
    ['the same member ID with a different payer', makeCoverage('cov-cigna-2', CIGNA, 'A-123')],
  ])('shows "-" in every field when the only check is for %s', async (_, documentCoverage) => {
    const info = await pdfEligibility(
      {
        responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
        coverages: [AETNA_COVERAGE],
      },
      { primary: documentCoverage }
    );
    expect(table(info)).toEqual(ALL_DASHES);
  });

  it('shows "-" in every field when the patient has insurance but no saved checks', async () => {
    const info = await pdfEligibility({ responses: [], coverages: [] }, { primary: AETNA_COVERAGE });
    expect(table(info)).toEqual(ALL_DASHES);
    expect(info.unavailable).toBeUndefined();
  });

  it('shows "-" in every field for a patient without insurance', async () => {
    const info = await pdfEligibility(
      {
        responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
        coverages: [AETNA_COVERAGE],
      },
      {}
    );
    expect(table(info)).toEqual(ALL_DASHES);
  });

  it('uses the latest matching check when the pair was checked several times', async () => {
    const info = await pdfEligibility(
      {
        responses: [
          makeResponse('older', '2026-11-19T14:30:00.000Z', 'Coverage/cov-aetna', 'not-eligible'),
          makeResponse('newer', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna'),
        ],
        coverages: [AETNA_COVERAGE],
      },
      { primary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(FULL_SECTION);
  });

  it('ignores a newer check for different insurance', async () => {
    const info = await pdfEligibility(
      {
        responses: [
          makeResponse('aetna', '2026-11-19T14:30:00.000Z', 'Coverage/cov-aetna', 'not-eligible'),
          makeResponse('cigna-newer', '2026-11-20T14:30:00.000Z', 'Coverage/cov-cigna'),
        ],
        coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
      },
      { primary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(checkWithoutDetails('Not eligible', '11/19/2026 09:30'));
  });

  it('uses the secondary insurance when it is the only one the document shows', async () => {
    const info = await pdfEligibility(
      {
        responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
        coverages: [AETNA_COVERAGE],
      },
      { secondary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(FULL_SECTION);
  });

  it('shows "-" in every field when the only insurance is secondary and its pair has no check', async () => {
    const info = await pdfEligibility(
      {
        responses: [makeResponse('cigna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-cigna')],
        coverages: [CIGNA_COVERAGE],
      },
      { secondary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(ALL_DASHES);
  });

  it('uses the secondary insurance when the primary exists but its section is not printed', async () => {
    const unprintedPrimary = makeCoverage('cov-unlisted', '99999', 'U-1');
    const info = await pdfEligibility(
      {
        responses: [
          makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna'),
          makeResponse('unlisted-newer', '2026-11-21T14:30:00.000Z', 'Coverage/cov-unlisted', 'not-eligible'),
        ],
        coverages: [AETNA_COVERAGE, unprintedPrimary],
      },
      { primary: unprintedPrimary, secondary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(FULL_SECTION);
  });

  it('pairs the section with the primary insurance even when the secondary has a newer check', async () => {
    const store = {
      responses: [makeResponse('cigna-secondary', '2026-11-20T14:30:00.000Z', 'Coverage/cov-cigna')],
      coverages: [CIGNA_COVERAGE],
    };
    expect(table(await pdfEligibility(store, { primary: AETNA_COVERAGE, secondary: CIGNA_COVERAGE }))).toEqual(
      ALL_DASHES
    );
    store.responses.push(makeResponse('aetna-primary', '2026-11-18T14:30:00.000Z', 'Coverage/cov-aetna'));
    store.coverages.push(AETNA_COVERAGE);
    const withPrimaryCheck = table(await pdfEligibility(store, { primary: AETNA_COVERAGE, secondary: CIGNA_COVERAGE }));
    expect(withPrimaryCheck[1]).toEqual(['', 'Last checked', '11/18/2026 09:30']);
    expect(withPrimaryCheck[8]).toEqual(['Patient', 'Relationship to insured', 'Child']);
  });

  it('shows "-" for the fields a matching check does not report', async () => {
    const sparseResponse = {
      elig: {
        ...RAW_RESPONSE.elig,
        plan_number: undefined,
        benefit: [{ ...healthPlanLine, policy_number: undefined, entity_website: undefined, entity_fax: undefined }],
      },
    };
    const withoutRelationship = makeCoverage('cov-aetna', AETNA, 'A-123', { relationship: '' });
    const info = await pdfEligibility(
      {
        responses: [
          makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna', 'eligible', sparseResponse),
        ],
        coverages: [withoutRelationship],
      },
      { primary: withoutRelationship }
    );
    expect(table(info)).toEqual(
      FULL_SECTION.map(([group, label, value]) =>
        ['Relationship to insured', 'Plan number', 'Policy number', 'Website', 'Fax'].includes(label)
          ? [group, label, '-']
          : [group, label, value]
      )
    );
  });

  it.each([
    ['not-eligible', 'Not eligible'],
    ['unsupported-ml-410', 'Unknown'],
  ] as const)(
    'shows a matching %s check as "%s" with "-" where the check returned no details',
    async (kind, status) => {
      const info = await pdfEligibility(
        {
          responses: [makeResponse('failed', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna', kind)],
          coverages: [AETNA_COVERAGE],
        },
        { primary: AETNA_COVERAGE }
      );
      expect(table(info)).toEqual(checkWithoutDetails(status, '11/20/2026 09:30'));
    }
  );

  it.each([
    ['the primary Member ID', ['insurance-member-id'], { primary: AETNA_COVERAGE, secondary: CIGNA_COVERAGE }],
    ['the primary carrier', ['insurance-carrier'], { primary: AETNA_COVERAGE, secondary: CIGNA_COVERAGE }],
    ['the Member ID of the only, secondary, insurance', ['insurance-member-id-2'], { secondary: AETNA_COVERAGE }],
    ['the carrier of the only, secondary, insurance', ['insurance-carrier-2'], { secondary: AETNA_COVERAGE }],
  ])(
    'shows "-" in every field, without searching, when the printed insurance hides %s',
    async (_, hiddenFields, coverages) => {
      const calls: string[] = [];
      const info = await withInsuranceConfig({ hiddenFields }, () =>
        pdfEligibility(
          {
            responses: [
              makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna'),
              makeResponse('cigna', '2026-11-21T14:30:00.000Z', 'Coverage/cov-cigna'),
            ],
            coverages: [AETNA_COVERAGE, CIGNA_COVERAGE],
          },
          coverages,
          calls
        )
      );
      expect(table(info)).toEqual(ALL_DASHES);
      expect(calls).toEqual([]);
    }
  );

  it('keeps the primary insurance when only the secondary Member ID is hidden', async () => {
    const info = await withInsuranceConfig({ hiddenFields: ['insurance-member-id-2'] }, () =>
      pdfEligibility(
        {
          responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
          coverages: [AETNA_COVERAGE],
        },
        { primary: AETNA_COVERAGE, secondary: CIGNA_COVERAGE }
      )
    );
    expect(table(info)).toEqual(FULL_SECTION);
  });

  it('shows "-" in every field, without searching, when the Insurance section is hidden', async () => {
    const calls: string[] = [];
    const info = await withInsuranceConfig({ sectionHidden: true }, () =>
      pdfEligibility(
        {
          responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
          coverages: [AETNA_COVERAGE],
        },
        { primary: AETNA_COVERAGE },
        calls
      )
    );
    expect(table(info)).toEqual(ALL_DASHES);
    expect(calls).toEqual([]);
  });

  it('shows "-" for a matching check whose payer reports no subscriber DOB or address', async () => {
    const {
      ins_dob: _dob,
      ins_addr_1: _street,
      ins_city: _city,
      ins_state: _state,
      ins_zip: _zip,
      ...elig
    } = RAW_RESPONSE.elig;
    const info = await pdfEligibility(
      {
        responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna', 'eligible', { elig })],
        coverages: [AETNA_COVERAGE],
      },
      { primary: AETNA_COVERAGE }
    );
    expect(table(info)).toEqual(
      FULL_SECTION.map(([group, label, value]) =>
        group === 'Subscriber/Insured' && ['DOB', 'Address'].includes(label)
          ? [group, label, '-']
          : [group, label, value]
      )
    );
  });

  it('prints only the subscriber address parts a matching check reports', async () => {
    const info = await pdfEligibility(
      {
        responses: [
          makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna', 'eligible', {
            elig: { ...RAW_RESPONSE.elig, ins_addr_1: undefined, ins_zip: undefined },
          }),
        ],
        coverages: [AETNA_COVERAGE],
      },
      { primary: AETNA_COVERAGE }
    );
    expect(table(info)).toContainEqual(['Subscriber/Insured', 'Address', 'New York, NY']);
    expect(table(info)).toContainEqual(['Subscriber/Insured', 'DOB', '01/10/1999']);
  });

  it('reports a failed eligibility lookup separately from a missing check', () => {
    const coverages = { primary: AETNA_COVERAGE };
    const info = composeEligibilityData({
      coverages,
      insurances: composeInsuranceData({ coverages, insuranceOrgs: INSURANCE_ORGS }),
      coverageChecks: undefined,
      timezone: TIMEZONE,
    });
    expect(info.unavailable).toBe(true);
    expect(table(info)).toEqual(ALL_DASHES);
  });
});

describe('Visit Details PDF "Eligibility Check Details" rendering', () => {
  const fromPackageRoot = (paths: Record<string, string> | undefined): Record<string, string> | undefined =>
    paths && Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, join(__dirname, '..', '..', path)]));

  const render = async (
    eligibility: EligibilityInfo,
    {
      insurances,
      sections = visitDetailsRenderConfig.sections,
    }: Partial<VisitDetailsData> & {
      sections?: PdfRenderConfig<VisitDetailsData>['sections'];
    } = {}
  ): Promise<{ text: string; x: number; width: number }[]> => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    drawText.mockClear();
    await renderPdf(
      { eligibility, insurances } as VisitDetailsData,
      {
        ...visitDetailsRenderConfig,
        sections,
        assetPaths: { fonts: fromPackageRoot(visitDetailsRenderConfig.assetPaths.fonts) as never },
      },
      ''
    );
    const drawn = drawText.mock.calls.map(([rawText, options]) => {
      const text = rawText.trimEnd();
      return { text, x: options?.x ?? 0, width: options?.font?.widthOfTextAtSize(text, options?.size ?? 0) ?? 0 };
    });
    drawText.mockRestore();
    return drawn;
  };

  it('is a two-column section placed right after Responsible party', () => {
    const titles = visitDetailsRenderConfig.sections.map((section) => section.title);
    const eligibility = visitDetailsRenderConfig.sections[titles.indexOf('Eligibility Check Details')];
    expect(eligibility.preferredWidth).toBe('column');
    expect(titles[titles.indexOf('Eligibility Check Details') - 1]).toBe('Responsible party information');
  });

  it('draws the title, group headings and every row inside its column, wrapping a long address', async () => {
    const longStreet = '4545 Some Extraordinarily Long Street Name, Building 7, Apt. 454';
    const printedAddress = `${longStreet} Some City, ST 22334-7788`;
    const info = await pdfEligibility(
      {
        responses: [
          makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna', 'eligible', {
            elig: { ...RAW_RESPONSE.elig, benefit: [{ ...healthPlanLine, entity_addr_1: [longStreet] }] },
          }),
        ],
        coverages: [AETNA_COVERAGE],
      },
      { primary: AETNA_COVERAGE }
    );
    const drawn = await render(info);
    const texts = drawn.map((item) => item.text);
    for (const heading of [
      'Eligibility Check Details',
      'Subscriber/Insured',
      'Patient',
      'Insurance/Plan',
      'Payer info',
    ]) {
      expect(texts).toContain(heading);
    }
    const { initialPage } = PDF_CLIENT_STYLES;
    const left = initialPage.pageMargins.left ?? 0;
    const columnRight = left + (initialPage.width - left - (initialPage.pageMargins.right ?? 0)) / 2 - 10;
    const section = drawn.slice(texts.indexOf('Eligibility Check Details')).filter((item) => item.text);
    expect(section.length).toBeGreaterThan(19);
    for (const item of section) {
      expect(item.x, `"${item.text}" starts left of the column`).toBeGreaterThanOrEqual(left - 0.5);
      expect(item.x + item.width, `"${item.text}" runs past the column`).toBeLessThanOrEqual(columnRight + 0.5);
    }
    expect(texts).not.toContain(printedAddress);
    expect(texts.join(' ')).toContain(printedAddress);
  });

  it('draws the lookup failure message above the dashed fields', async () => {
    const texts = (await render({ groups: allDashGroups(), unavailable: true })).map((item) => item.text);
    expect(texts).toContain('Eligibility information could not be retrieved.');
    expect(texts.filter((text) => text === '-')).toHaveLength(19);
  });

  it('prints neither the hidden member ID nor a check for it when the Insurance section hides it', async () => {
    const store = {
      responses: [makeResponse('aetna', '2026-11-20T14:30:00.000Z', 'Coverage/cov-aetna')],
      coverages: [AETNA_COVERAGE],
    };
    const coverages = { primary: AETNA_COVERAGE };
    const visible = (
      await render(await pdfEligibility(store, coverages), {
        insurances: composeInsuranceData({ coverages, insuranceOrgs: INSURANCE_ORGS }),
        sections: [createPrimaryInsuranceSection(), createEligibilitySection()],
      })
    ).map((item) => item.text);
    expect(visible.filter((text) => text === 'A-123')).toHaveLength(2);

    const hidden = await withInsuranceConfig({ hiddenFields: ['insurance-member-id'] }, async () =>
      (
        await render(await pdfEligibility(store, coverages), {
          insurances: composeInsuranceData({ coverages, insuranceOrgs: INSURANCE_ORGS }),
          sections: [createPrimaryInsuranceSection(), createEligibilitySection()],
        })
      ).map((item) => item.text)
    );
    expect(hidden).toContain('Aetna');
    expect(hidden).not.toContain('A-123');
    expect(hidden).not.toContain('Eligible');
    expect(hidden.slice(hidden.indexOf('Eligibility Check Details')).filter((text) => text === '-')).toHaveLength(19);
  });

  it('skips the section together with a hidden Insurance section', async () => {
    const section = await withInsuranceConfig({ sectionHidden: true }, async () => createEligibilitySection());
    expect(section.skip).toBe(true);
    expect(createEligibilitySection().skip).toBe(false);
  });
});
