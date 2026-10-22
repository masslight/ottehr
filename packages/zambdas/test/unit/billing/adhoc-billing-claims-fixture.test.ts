import Oystehr from '@oystehr/sdk';
import {
  Claim,
  ClaimResponse,
  Coverage,
  Device,
  FhirResource,
  Location,
  Patient,
  PaymentNotice,
  PaymentReconciliation,
  Practitioner,
  Provenance,
} from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  CLAIM_ACCIDENT_STATE_EXTENSION_URL,
  CLAIM_ACCIDENT_TYPE_EXTENSION_URLS,
  CODE_SYSTEM_CLAIM_TYPE,
} from 'utils/lib/helpers/rcm/constants';
import {
  AdHocBillingClaimsOutputSchema,
  BILLING_CLAIMS_LAYERS,
  BillingClaimsBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/billing-claims';
import { datasetRowSchema } from 'utils/lib/types/adhoc/datasets/dataset';
import { EM_CODES_VALUE_SET_URL } from 'utils/lib/types/api/em-codes.constants';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
  CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
} from 'utils/lib/types/data/billing/claim-history';
import { CLAIM_STATUS_DATE_EXTENSION_URLS, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { historyLayer } from '../../../src/billing/adhoc/claim-extras';
import {
  ADHOC_CLAIMS_BUILD_BUDGET_MS,
  ADHOC_CLAIMS_OVER_BUDGET_MESSAGE,
  fetchAdHocClaimRows,
} from '../../../src/billing/adhoc/claims';
import { dayFieldsOf, toReportDay } from '../../../src/billing/adhoc/report-dates';
import { X12_ADJUSTMENT_GROUP_SYSTEM } from '../../../src/billing/claim-amounts';
import { buildClaimLookups, mapClaimToItem } from '../../../src/billing/claim-search';
import {
  CLINICAL_PAYMENT_NOTICE_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
} from '../../../src/billing/payments';
import {
  BILLING_WORKING_COPY_TAG,
  CLAIM_PCN_IDENTIFIER_SYSTEM,
  ERA_CHECK_SYSTEM,
  ERA_PROCESSING_ACTIVITY_CODE,
  ERA_SOURCE_EXTENSION,
  ERA_STATUS_CODE_EXTENSION,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';
import { WRITE_OFF_PARTY_EXT_URL, WRITE_OFF_REASON_EXT_URL, WRITE_OFF_SYSTEM } from '../../../src/billing/write-offs';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

const ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
const PAYER_A = 'https://rcm-api.zapehr.com/v1/payer/payer-a';
const PAYER_B = 'https://rcm-api.zapehr.com/v1/payer/payer-b';
const DATE_RANGE = { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-19T23:59:59.999-04:00' };

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pt-1',
  name: [{ given: ['Ann'], family: 'Lee' }],
  birthDate: '1990-02-03',
  gender: 'female',
  address: [{ state: 'NY', postalCode: '10001' }],
};

// Each claim points at its own working copy of the patient; both copies carry the same clinical id.
const patientCopy = (id: string): Patient => ({
  ...patient,
  id,
  meta: { tag: [BILLING_WORKING_COPY_TAG] },
  identifier: [{ system: SOURCE_IDENTIFIER_SYSTEM, value: 'clinical-1' }],
});

const facility: Location = {
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Midtown',
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '2222222222' }],
};

const provider: Practitioner = {
  resourceType: 'Practitioner',
  id: 'pr-1',
  name: [{ given: ['Bo'], family: 'Kim' }],
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1111111111' }],
};

const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  subscriberId: 'M-1',
  beneficiary: { reference: 'Patient/pt-1' },
  payor: [{ reference: PAYER_A }],
  relationship: { coding: [{ code: 'self', display: 'Self' }] },
};

const secondaryCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-2',
  status: 'active',
  subscriberId: 'M-2',
  beneficiary: { reference: 'Patient/pt-1' },
  payor: [{ reference: PAYER_B }],
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
  patient: { reference: 'Patient/pt-copy-1' },
  insurer: { reference: PAYER_A },
  insurance: [
    { sequence: 2, focal: false, coverage: { reference: 'Coverage/cov-2' } },
    { sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-1' } },
  ],
  identifier: [
    { system: ENCOUNTER_ID_SYSTEM, value: 'enc-claim-1' },
    { system: CLAIM_PCN_IDENTIFIER_SYSTEM, value: 'PCN-1' },
  ],
  supportingInfo: [
    {
      sequence: 1,
      category: { coding: [{ code: 'attachment' }] },
      valueReference: { reference: 'DocumentReference/doc-1' },
    },
  ],
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
    { url: CLAIM_ACCIDENT_TYPE_EXTENSION_URLS.auto, valueBoolean: true },
    { url: CLAIM_ACCIDENT_STATE_EXTENSION_URL, valueString: 'NJ' },
  ],
});
insuredClaim.item![0].locationCodeableConcept = { coding: [{ code: '11' }] };
// A professional claim carries the visit as its billablePeriod; that is no admission.
insuredClaim.billablePeriod = { start: '2026-10-05', end: '2026-10-05' };

const selfPayClaim = claim('claim-2', '2026-10-10', { patient: { reference: 'Patient/pt-copy-2' } });
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
  insurer: { reference: PAYER_B },
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

const writeOff = (id: string, status: PaymentNotice['status'], party: string, reason: string): PaymentNotice => ({
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
  extension: [
    { url: WRITE_OFF_PARTY_EXT_URL, valueString: party },
    { url: WRITE_OFF_REASON_EXT_URL, valueString: reason },
  ],
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
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }],
};

// claim-2's other notices: a payment entered in the billing app and voided, and a card refund.
const billingPaymentNotice = (
  id: string,
  system: string,
  status: PaymentNotice['status'],
  amount: number,
  paymentDate: string
): PaymentNotice => ({
  ...patientPayment,
  id,
  status,
  paymentDate,
  identifier: [{ system, value: id }],
  amount: { value: amount, currency: 'USD' },
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
});

const voidedManualPayment = billingPaymentNotice(
  'pn-manual',
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
  'cancelled',
  25,
  '2026-10-12'
);

const cardRefund = billingPaymentNotice('pn-refund', STRIPE_PAYMENT_ID_SYSTEM, 'active', -5, '2026-10-14');

const sourceExtension = (id: string): Patient['extension'] => [
  { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Patient/${id}` } },
];

const billingOnlyMain: Patient = { resourceType: 'Patient', id: 'bp-main', name: [{ family: 'Solo' }] };

const workingCopyOf = (id: string, parentId: string): Patient => ({
  resourceType: 'Patient',
  id,
  name: [{ family: 'Solo' }],
  meta: { tag: [BILLING_WORKING_COPY_TAG] },
  extension: sourceExtension(parentId),
});

const ehrMain: Patient = { ...patient, id: 'pt-main', extension: sourceExtension('clinical-1') };

const chainPatients = [
  billingOnlyMain,
  workingCopyOf('bp-copy-1', 'bp-main'),
  workingCopyOf('bp-copy-2', 'bp-copy-1'),
  ehrMain,
  workingCopyOf('pt-old-copy', 'pt-main'),
];

const chainClaims = [
  claim('claim-c1', '2026-10-06', { patient: { reference: 'Patient/bp-copy-1' } }),
  claim('claim-c2', '2026-10-07', { patient: { reference: 'Patient/bp-copy-2' } }),
  claim('claim-c3', '2026-10-08', { patient: { reference: 'Patient/pt-old-copy' } }),
];

// claim-1's history: created by the system, submitted, acknowledged, moved to patient AR by a user,
// a note, and one entry whose change set is unreadable.
const historyEntry = (
  id: string,
  recorded: string,
  activity: keyof typeof CLAIM_PROVENANCE_ACTIVITY,
  by: 'human' | 'system',
  extension: NonNullable<Provenance['extension']>
): Provenance => ({
  resourceType: 'Provenance',
  id,
  recorded,
  activity: { coding: [CLAIM_PROVENANCE_ACTIVITY[activity]] },
  agent: [
    {
      type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE[by]] },
      who: { reference: by === 'human' ? 'Practitioner/pr-manish' : 'Device/d-1' },
    },
  ],
  target: [{ reference: 'Claim/claim-1' }],
  extension,
});
const diff = (changes: unknown[]): { url: string; valueString: string } => ({
  url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  valueString: JSON.stringify(changes),
});
const claimHistory: Provenance[] = [
  historyEntry('h-create', '2026-10-05T14:00:00Z', 'create', 'system', [
    diff([
      { field: 'status.arStage', label: 'AR Stage', previousValue: null, newValue: 'Insurance Payer AR' },
      { field: 'memberId', label: 'Member ID', previousValue: null, newValue: 'M-1' },
    ]),
  ]),
  historyEntry('h-submit', '2026-10-06T14:00:00Z', 'submit', 'system', [
    diff([]),
    {
      url: CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
      valueString: JSON.stringify({ transmittedAt: '2026-10-06T13:59:00Z' }),
    },
  ]),
  historyEntry('h-ack', '2026-10-07T14:00:00Z', 'acknowledgment', 'system', [
    diff([]),
    {
      url: CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
      valueString: JSON.stringify({
        source: 'claimmd',
        entityName: 'Payer A',
        entityKind: 'payer',
        message: 'Accepted',
        responseId: 'r-1',
        eventTime: '2026-10-07T13:00:00Z',
      }),
    },
  ]),
  historyEntry('h-status', '2026-10-12T14:00:00Z', 'statusChange', 'human', [
    diff([
      { field: 'status.arStage', label: 'AR Stage', previousValue: 'Insurance Payer AR', newValue: 'Patient AR' },
      {
        field: 'status.insuranceArStatus',
        label: 'Insurance AR Status',
        previousValue: 'Adjudicated',
        newValue: 'Finalized',
      },
    ]),
  ]),
  historyEntry('h-note', '2026-10-13T14:00:00Z', 'note', 'human', [
    diff([]),
    { url: CLAIM_PROVENANCE_NOTE_EXTENSION_URL, valueString: 'Called the payer' },
  ]),
  historyEntry('h-broken', '2026-10-14T14:00:00Z', 'update', 'human', [
    { url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: '{not json' },
  ]),
];

const era: PaymentReconciliation = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  status: 'active',
  created: '2026-10-11T10:00:00Z',
  paymentDate: '2026-10-10',
  paymentAmount: { value: 500, currency: 'USD' },
  identifier: [{ system: ERA_CHECK_SYSTEM, value: 'CHK-9' }],
  extension: [{ url: ERA_SOURCE_EXTENSION, valueCode: 'manual' }],
  paymentIssuer: { reference: PAYER_B },
};

const eraProvenance: Provenance = {
  resourceType: 'Provenance',
  id: 'era-prov-1',
  recorded: '2026-10-11T10:00:00Z',
  activity: { coding: [{ code: ERA_PROCESSING_ACTIVITY_CODE }] },
  agent: [{ who: { reference: 'Practitioner/pr-manish' } }],
  target: [{ reference: 'PaymentReconciliation/era-1' }, { reference: 'ClaimResponse/cr-1' }],
};

const claims = [insuredClaim, selfPayClaim, outOfRangeClaim, ...chainClaims, ...fillerClaims];

const emCodeList = {
  resourceType: 'ValueSet',
  id: 'vs-em',
  status: 'active',
  url: EM_CODES_VALUE_SET_URL,
  expansion: { timestamp: '2026-01-01T00:00:00Z', contains: [{ code: '99213', display: 'Office visit, est.' }] },
} as FhirResource;

const store: FhirResource[] = [
  emCodeList,
  ...claims,
  patient,
  patientCopy('pt-copy-1'),
  patientCopy('pt-copy-2'),
  ...chainPatients,
  facility,
  provider,
  coverage,
  remit,
  writeOff('wo-1', 'active', 'patient', 'charity'),
  writeOff('wo-2', 'cancelled', 'insurance', 'interest'),
  patientPayment,
  secondaryCoverage,
  ...claimHistory,
  era,
  eraProvenance,
  voidedManualPayment,
  cardRefund,
];

type Param = { name: string; value: string };

function stubBillingClient({
  shortScans = 0,
  countPhantom = 0,
  onScan,
}: { shortScans?: number; countPhantom?: number; onScan?: () => void } = {}): {
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

    if (all('_summary')[0] === 'count') {
      return { resourceType: 'Bundle', type: 'searchset', total: matches.length + countPhantom, unbundle: () => [] };
    }

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

    const targets = listOf('target');

    if (targets) {
      matches = matches.filter((r) => (r as Provenance).target?.some((t) => targets.includes(t.reference ?? '')));
    }

    const urls = listOf('url');

    if (urls) matches = matches.filter((r) => urls.includes((r as { url?: string }).url ?? ''));

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

  const actors: Record<string, Practitioner | Device> = {
    'Practitioner/pr-manish': {
      resourceType: 'Practitioner',
      id: 'pr-manish',
      name: [{ given: ['Manish'], family: 'Biller' }],
    },
    'Device/d-1': {
      resourceType: 'Device',
      id: 'd-1',
      deviceName: [{ name: 'Ottehr Rules Engine', type: 'user-friendly-name' }],
    },
  };

  const batch = vi.fn(async ({ requests }: { requests: { url: string }[] }) => ({
    entry: requests.map(({ url }) => {
      const [type, query] = url.replace(/^\//, '').split('?_id=');
      return {
        resource: {
          entry: query
            .split(',')
            .map((id) => actors[`${type}/${id}`])
            .filter(Boolean)
            .map((resource) => ({ resource })),
        },
      };
    }),
  }));
  const oystehr = { fhir: { search, batch }, rcm: { getPayerByUrl } } as unknown as Oystehr;

  return { oystehr, search, getPayerByUrl };
}

const allLayers = {
  includeCodes: true,
  includeClaimDetails: true,
  includeCoverage: true,
  includeWriteOffs: true,
  includePatientPayments: true,
  includeRemits: true,
  includeTimeline: true,
  includeInsurancePayments: true,
  includeHistory: true,
};

describe('fetchAdHocClaimRows (billing-claims dataset)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds one schema-valid row per claim in the service-date range', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();

    const rows = await fetchAdHocClaimRows(
      oystehr,
      { dateRange: DATE_RANGE, ...allLayers },
      { eraReadClient: oystehr }
    );

    expect(() => AdHocBillingClaimsOutputSchema.parse({ rows })).not.toThrow();
    expect(rows).toHaveLength(claims.length - 1);
    expect(rows.map((r) => r.claimId)).not.toContain('claim-3');
  });

  it('carries the claims list amounts unchanged', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(
      oystehr,
      { dateRange: DATE_RANGE, ...allLayers },
      { eraReadClient: oystehr }
    );

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
      patientId: 'clinical-1',
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
    expect(rows.find((r) => r.claimId === 'claim-2')).toMatchObject({ patientPaid: 70, payerName: '' });
  });

  it('fills every layer from the hydrated claim and its lookups', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(
      oystehr,
      { dateRange: DATE_RANGE, ...allLayers },
      { eraReadClient: oystehr }
    );
    const insured = rows.find((r) => r.claimId === 'claim-1')!;

    expect(insured).toMatchObject({
      cptCodes: ['99213', '87880'],
      cptLines: [
        { code: '99213', modifiers: ['25'], units: 1, charge: 150 },
        { code: '87880', modifiers: [], units: 2, charge: 50 },
      ],
      icdCodes: ['J02.9', 'R05.9'],
      writeOffCount: 1,
      writeOffReasons: ['Charity or Financial Assistance'],
      remitCount: 1,
      lastRemitDate: '2026-10-11',
      adjustmentReasonCodes: ['45', '3'],
      remits: [{ date: '2026-10-11', payerName: 'Payer B', allowed: 150, paid: 120, patientResp: 30 }],
      remitAdjustments: [
        { remitDate: '2026-10-11', payerName: 'Payer B', group: 'CO', code: '45', amount: 50 },
        { remitDate: '2026-10-11', payerName: 'Payer B', group: 'PR', code: '3', amount: 30 },
      ],
      insuranceFinalizedDate: '2026-10-12',
      enteredPatientArDate: '2026-10-12',
    });
    expect(insured.writeOffs).toEqual([
      {
        date: '2026-10-13',
        amount: 10,
        party: 'patient',
        payer: '',
        reason: 'Charity or Financial Assistance',
        voided: false,
      },
      { date: '2026-10-13', amount: 10, party: 'insurance', payer: '', reason: 'Interest', voided: true },
    ]);
  });

  it('asks the server for the claim fields the layers read beyond the claims list', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr, search } = stubBillingClient();
    await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, ...allLayers }, { eraReadClient: oystehr });

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

  it('finishes a scan whose running total grew with a claim created mid-scan, without scanning again', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let scans = 0;
    const { oystehr } = stubBillingClient({ shortScans: 1, onScan: () => (scans += 1) });

    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });

    expect(rows).toHaveLength(claims.length - 1);
    expect(scans).toBe(1);
  });

  it('fails rather than leaving claims out when the scan returns fewer claims than existed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient({ countPhantom: 1 });

    await expect(fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE })).rejects.toThrow(
      `Claim scan returned ${claims.length} of the ${claims.length + 1} claims that existed when it began`
    );
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

  it('asks again on a later page for a payer whose lookup failed, and counts only real payer refs', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { oystehr, getPayerByUrl } = stubBillingClient();
    // claim-2 points at something that is no payer reference at all: skipped, not "unresolved".
    selfPayClaim.insurer = { reference: 'Patient/pt-1' };
    getPayerByUrl.mockRejectedValueOnce(new Error('rcm down'));
    // Enough Payer A claims for a second group of pages after the one whose lookup failed.
    const moreClaims = Array.from({ length: 300 }, (_unused, index) =>
      claim(`claim-g${String(index).padStart(3, '0')}`, '2026-10-15', { insurer: { reference: PAYER_A } })
    );
    store.push(...moreClaims);
    let rows;
    try {
      rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });
    } finally {
      delete selfPayClaim.insurer;
      store.splice(store.length - moreClaims.length, moreClaims.length);
    }

    // The first group of pages shares the failed lookup; the next group asks again.
    expect(getPayerByUrl).toHaveBeenCalledTimes(2);
    expect(rows.find((r) => r.claimId === 'claim-g299')?.payerName).toBe('Payer A');
    expect(
      warn.mock.calls.map(([message]) => String(message)).filter((m) => m.includes('could not be resolved'))
    ).toEqual([]);
  });

  it('stops asking for a payer that is not found after a few pages', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { oystehr, getPayerByUrl } = stubBillingClient();
    getPayerByUrl.mockRejectedValue(new Error('not found'));

    await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });

    expect(getPayerByUrl.mock.calls.length).toBeLessThanOrEqual(3);
    expect(warn.mock.calls.map(([message]) => String(message))).toContainEqual(
      expect.stringContaining('1 payer reference(s)')
    );
  });

  it('fails the run when user names cannot be looked up, rather than leaving byName empty', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    (oystehr.fhir.batch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('batch down'));

    await expect(
      fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeHistory: true }, { eraReadClient: oystehr })
    ).rejects.toThrow('batch down');
  });

  it('fails the run when one lookup inside the name batch fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    (oystehr.fhir.batch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: [{ response: { status: '500 Internal Server Error' } }],
    });

    await expect(
      fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeHistory: true }, { eraReadClient: oystehr })
    ).rejects.toThrow('Actor name lookup failed with status 500');
  });

  it('gives every claim of one patient the same patientId, though each claim has its own patient copy', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });

    expect(rows.find((r) => r.claimId === 'claim-1')?.patientId).toBe('clinical-1');
    expect(rows.find((r) => r.claimId === 'claim-2')?.patientId).toBe('clinical-1');

    // A claim on a main billing patient with no clinical link keeps that patient's id.
    expect(rows.find((r) => r.claimId === 'claim-f000')?.patientId).toBe('pt-1');
  });

  it('stops a scan that runs out of time', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let scans = 0;
    // The first scan comes up short and uses up the budget on its first page.
    const { oystehr } = stubBillingClient({
      shortScans: 1,
      onScan: () => {
        scans += 1;
        now += ADHOC_CLAIMS_BUILD_BUDGET_MS + 1;
      },
    });

    await expect(fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE })).rejects.toThrow(
      ADHOC_CLAIMS_OVER_BUDGET_MESSAGE
    );
    expect(scans).toBe(1);
  });

  it('follows patient copy chains to one id per patient, fetching each ancestor once', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr, search } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });
    const patientIdOf = (claimId: string): string | undefined => rows.find((r) => r.claimId === claimId)?.patientId;

    // A billing-only patient: its copy and its copy's copy both resolve to the main billing patient.
    expect(patientIdOf('claim-c1')).toBe('bp-main');
    expect(patientIdOf('claim-c2')).toBe('bp-main');
    // An older copy with no clinical id resolves through its main patient to the same EHR id as newer copies.
    expect(patientIdOf('claim-c3')).toBe('clinical-1');
    expect(patientIdOf('claim-1')).toBe('clinical-1');

    const fetchedAncestors = search.mock.calls
      .filter(([arg]) => arg.resourceType === 'Patient')
      .flatMap(([arg]) => ((arg.params as Param[]).find((p) => p.name === '_id')?.value ?? '').split(','));
    expect(fetchedAncestors.sort()).toEqual(['bp-copy-1', 'bp-main', 'pt-main']);
  });

  it('lists every patient payment and refund, adding up to patientPaid', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includePatientPayments: true });
    const selfPay = rows.find((r) => r.claimId === 'claim-2')!;

    expect(selfPay.patientPayments).toEqual([
      { date: '2026-10-10', amount: 75, kind: 'payment', method: 'cash', source: 'ehr', voided: false },
      { date: '2026-10-12', amount: 25, kind: 'payment', method: 'card', source: 'manual', voided: true },
      { date: '2026-10-14', amount: -5, kind: 'refund', method: 'card', source: 'card', voided: false },
    ]);
    expect(selfPay).toMatchObject({
      patientPaymentCount: 1,
      patientRefundedTotal: 5,
      lastPatientPaymentDate: '2026-10-10',
    });
    const counted = selfPay.patientPayments!.filter((p) => !p.voided).reduce((sum, p) => sum + p.amount, 0);
    expect(counted).toBe(selfPay.patientPaid);

    const insured = rows.find((r) => r.claimId === 'claim-1')!;
    expect(insured).toMatchObject({ patientPayments: [], patientPaymentCount: 0, patientRefundedTotal: 0 });
    expect(insured.lastPatientPaymentDate).toBeNull();
    expect(() => AdHocBillingClaimsOutputSchema.parse({ rows })).not.toThrow();
  });

  it('fills the claim details, coverage, insurance payment and history layers', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(
      oystehr,
      { dateRange: DATE_RANGE, ...allLayers },
      { eraReadClient: oystehr }
    );
    const insured = rows.find((r) => r.claimId === 'claim-1')!;

    expect(insured).toMatchObject({
      billingProvider: 'Kim, Bo',
      billingProviderNpi: '1111111111',
      renderingProviderNpi: '1111111111',
      facilityNpi: '2222222222',
      placeOfService: '11',
      patientControlNumber: 'PCN-1',
      accidentTypes: ['auto'],
      accidentState: 'NJ',
      attachmentCount: 1,
      admissionDate: null,
      dischargeDate: null,
      patientSex: 'female',
      patientState: 'NY',
      patientZip: '10001',
      coverageCount: 2,
      primarySubscriberRelationship: 'Self',
      primaryCoverageStatus: 'active',
      secondaryPayerName: 'Payer B',
      secondaryMemberId: 'M-2',
      tertiaryPayerName: '',
      checkNumbers: ['CHK-9'],
      lastCheckDate: '2026-10-10',
      insurancePayments: [
        {
          checkNumber: 'CHK-9',
          checkDate: '2026-10-10',
          remitDate: '2026-10-11',
          checkAmount: 500,
          payerName: 'Payer B',
          eraSource: 'manual',
          enteredBy: 'Biller, Manish',
        },
      ],
      statusChanges: [
        { date: '2026-10-05', field: 'arStage', from: '', to: 'insurance-payer-ar', by: 'system' },
        {
          date: '2026-10-12',
          field: 'arStage',
          from: 'insurance-payer-ar',
          to: 'patient-ar',
          by: 'user',
          byName: 'Biller, Manish',
        },
        { date: '2026-10-12', field: 'insuranceArStatus', from: 'adjudicated', to: 'finalized', by: 'user' },
      ],
      firstSubmittedDate: '2026-10-06',
      lastSubmittedDate: '2026-10-06',
      submissionCount: 1,
      submissions: [{ date: '2026-10-06', by: 'system', byName: 'Ottehr Rules Engine' }],
      emCode: '99213',
      firstAcknowledgedDate: '2026-10-07',
      acknowledgments: [{ date: '2026-10-07', entityKind: 'payer', entityName: 'Payer A', message: 'Accepted' }],
      noteCount: 1,
      lastNoteDate: '2026-10-13',
      lastActivityDate: '2026-10-14',
      userActionCount: 3,
      systemActionCount: 3,
    });
    expect(insured.remits?.[0]).toMatchObject({ eraStatusCode: '1' });
    expect(insured.cptLines?.[0]).toMatchObject({
      serviceDate: '2026-10-05',
      placeOfService: '11',
      revenueCode: '',
      ndc: '',
    });

    const selfPay = rows.find((r) => r.claimId === 'claim-2')!;
    expect(selfPay).toMatchObject({
      coverageCount: 0,
      checkNumbers: [],
      insurancePayments: [],
      statusChanges: [],
      submissionCount: 0,
      firstSubmittedDate: null,
      lastActivityDate: null,
    });
    expect(() => AdHocBillingClaimsOutputSchema.parse({ rows })).not.toThrow();
  });

  it('refuses the insurance payments layer without the untagged ERA client', async () => {
    const { oystehr } = stubBillingClient();
    await expect(
      fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeInsurancePayments: true })
    ).rejects.toThrow('untagged ERA read client');
  });

  it('refuses the remits layer without the untagged ERA client', async () => {
    const { oystehr } = stubBillingClient();
    await expect(fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeRemits: true })).rejects.toThrow(
      'untagged ERA read client'
    );
  });

  it('reads no history, coverage or ERA links when those layers are off', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr, search } = stubBillingClient();
    await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeCodes: true });

    const searched = new Set(search.mock.calls.map(([arg]) => arg.resourceType));
    expect(searched.has('Provenance')).toBe(false);
    expect(searched.has('PaymentReconciliation')).toBe(false);
    const coverageReads = search.mock.calls.filter(
      ([arg]) => arg.resourceType === 'Coverage' && (arg.params as Param[]).some((p) => p.value.includes('payor'))
    );
    expect(coverageReads).toHaveLength(0);
  });

  it('fails a page that hangs past the budget instead of waiting for the worker timeout', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      const { oystehr, search } = stubBillingClient();
      const answer = search.getMockImplementation() as (args: unknown) => Promise<unknown>;
      // Claim hydration never answers.
      search.mockImplementation(async (args: { resourceType: string; params: Param[] }) =>
        args.resourceType === 'Claim' && args.params.some((p) => p.name === '_id')
          ? new Promise(() => undefined)
          : answer(args)
      );

      const run = fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });
      const outcome = expect(run).rejects.toThrow(ADHOC_CLAIMS_OVER_BUDGET_MESSAGE);
      await vi.advanceTimersByTimeAsync(ADHOC_CLAIMS_BUILD_BUDGET_MS + 1);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('billing-claims review fixes', () => {
  it('counts a failed submit attempt as no submission, and orders instants by time, not text', () => {
    const failedAttempt = historyEntry('h-failed', '2026-10-06T10:00:00Z', 'submit', 'human', [
      diff([{ field: 'error', label: 'Error', previousValue: null, newValue: 'Rejected' }]),
    ]);
    // 10:00Z: after the fixture's 13:59Z transmit as text, before it in time.
    const earlierTransmit = historyEntry('h-early', '2026-10-06T10:01:00Z', 'submit', 'system', [
      diff([]),
      {
        url: CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
        valueString: JSON.stringify({ transmittedAt: '2026-10-06T15:00:00+05:00' }),
      },
    ]);
    const layer = historyLayer([...claimHistory, earlierTransmit, failedAttempt], new Map());

    expect(layer.submissionCount).toBe(2);
    expect(layer.firstSubmittedDate).toBe('2026-10-06T15:00:00+05:00');
    expect(layer.lastSubmittedDate).toBe('2026-10-06T13:59:00Z');
  });

  it('takes emCode from the EHR E&M list only, and leaves it empty when the list is not configured', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const withList = stubBillingClient();
    const rows = await fetchAdHocClaimRows(
      withList.oystehr,
      { dateRange: DATE_RANGE, includeCodes: true },
      { eraReadClient: withList.oystehr }
    );
    expect(rows.find((r) => r.claimId === 'claim-1')?.emCode).toBe('99213');

    store.splice(store.indexOf(emCodeList), 1);
    try {
      const withoutList = stubBillingClient();
      const bare = await fetchAdHocClaimRows(
        withoutList.oystehr,
        { dateRange: DATE_RANGE, includeCodes: true },
        { eraReadClient: withoutList.oystehr }
      );
      expect(bare.find((r) => r.claimId === 'claim-1')?.emCode).toBe('');
    } finally {
      store.unshift(emCodeList);
    }
  });

  it("attributes a remit to its ERA's issuer, not a ClaimResponse.insurer a manual match overwrote", async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const insurer = remit.insurer;
    remit.insurer = { reference: PAYER_A };
    try {
      const { oystehr } = stubBillingClient();
      const rows = await fetchAdHocClaimRows(
        oystehr,
        { dateRange: DATE_RANGE, includeRemits: true },
        { eraReadClient: oystehr }
      );
      const row = rows.find((r) => r.claimId === 'claim-1')!;
      expect(row.remits?.map((r) => r.payerName)).toEqual(['Payer B']);
      expect(new Set(row.remitAdjustments?.map((a) => a.payerName))).toEqual(new Set(['Payer B']));
    } finally {
      remit.insurer = insurer;
    }
  });

  it('sends every field the schema calls a yyyy-MM-dd date as a day, with every layer on', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(
      oystehr,
      { dateRange: DATE_RANGE, ...allLayers },
      { eraReadClient: oystehr }
    );
    const { fields, nested } = dayFieldsOf(datasetRowSchema(BillingClaimsBaseRowSchema, BILLING_CLAIMS_LAYERS));

    // The schema walk finds top-level and nested dates alike.
    expect(fields).toEqual(expect.arrayContaining(['serviceDate', 'patientDob', 'lastActivityDate', 'lastCheckDate']));
    expect(nested).toMatchObject({ submissions: ['date'], insurancePayments: ['checkDate', 'remitDate'] });

    const isDay = (value: unknown): boolean => value === null || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
    for (const row of rows as unknown as Record<string, unknown>[]) {
      for (const field of fields) if (field in row) expect(isDay(row[field]), `${row.claimId}.${field}`).toBe(true);
      for (const [field, days] of Object.entries(nested)) {
        for (const item of (row[field] as Record<string, unknown>[] | undefined) ?? []) {
          for (const day of days) expect(isDay(item[day]), `${row.claimId}.${field}[].${day}`).toBe(true);
        }
      }
    }
  });

  it('puts an instant on its New York day, whatever zone it was stored in', () => {
    expect(toReportDay('2026-10-12T02:30:00Z')).toBe('2026-10-11');
    expect(toReportDay('2026-10-11T22:30:00-04:00')).toBe('2026-10-11');
    expect(toReportDay('2026-10-11')).toBe('2026-10-11');
    expect(toReportDay('2026-10-11T23:30:00')).toBe('2026-10-11');
    expect(toReportDay('')).toBeNull();
  });

  it('names who entered a manual ERA only; an imported one records no importer', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const run = async (): Promise<string | undefined> => {
      const { oystehr } = stubBillingClient();
      const rows = await fetchAdHocClaimRows(
        oystehr,
        { dateRange: DATE_RANGE, includeInsurancePayments: true },
        { eraReadClient: oystehr }
      );
      return rows.find((r) => r.claimId === 'claim-1')?.insurancePayments?.[0]?.enteredBy;
    };

    expect(await run()).toBe('Biller, Manish');
    const extension = era.extension;
    era.extension = [{ url: ERA_SOURCE_EXTENSION, valueCode: 'x12-import' }];
    try {
      expect(await run()).toBe('');
    } finally {
      era.extension = extension;
    }
  });
});
