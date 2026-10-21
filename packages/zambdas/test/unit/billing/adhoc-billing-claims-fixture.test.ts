import Oystehr from '@oystehr/sdk';
import {
  Claim,
  ClaimResponse,
  Coverage,
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
import { AdHocBillingClaimsOutputSchema } from 'utils/lib/types/adhoc/datasets/billing-claims';
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
import {
  ADHOC_CLAIMS_BUILD_BUDGET_MS,
  ADHOC_CLAIMS_OVER_BUDGET_MESSAGE,
  fetchAdHocClaimRows,
} from '../../../src/billing/adhoc/claims';
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
  agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE[by]] }, who: { reference: 'Device/d-1' } }],
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

// The ERA that carried cr-1, linked through its era-processing Provenance (untagged resources).
const era: PaymentReconciliation = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  status: 'active',
  created: '2026-10-11T10:00:00Z',
  paymentDate: '2026-10-10',
  paymentAmount: { value: 500, currency: 'USD' },
  identifier: [{ system: ERA_CHECK_SYSTEM, value: 'CHK-9' }],
  paymentIssuer: { reference: PAYER_B },
};
const eraProvenance: Provenance = {
  resourceType: 'Provenance',
  id: 'era-prov-1',
  recorded: '2026-10-11T10:00:00Z',
  activity: { coding: [{ code: ERA_PROCESSING_ACTIVITY_CODE }] },
  agent: [{ who: { display: 'Oystehr' } }],
  target: [{ reference: 'PaymentReconciliation/era-1' }, { reference: 'ClaimResponse/cr-1' }],
};

const claims = [insuredClaim, selfPayClaim, outOfRangeClaim, ...chainClaims, ...fillerClaims];

const store: FhirResource[] = [
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

    const targets = listOf('target');
    if (targets) {
      matches = matches.filter((r) => (r as Provenance).target?.some((t) => targets.includes(t.reference ?? '')));
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
      lastRemitDate: '2026-10-11T12:00:00Z',
      adjustmentReasonCodes: ['45', '3'],
      remits: [{ date: '2026-10-11T12:00:00Z', payerName: 'Payer B', allowed: 150, paid: 120, patientResp: 30 }],
      remitAdjustments: [
        { remitDate: '2026-10-11T12:00:00Z', payerName: 'Payer B', group: 'CO', code: '45', amount: 50 },
        { remitDate: '2026-10-11T12:00:00Z', payerName: 'Payer B', group: 'PR', code: '3', amount: 30 },
      ],
      insuranceFinalizedDate: '2026-10-12T14:00:00Z',
      enteredPatientArDate: '2026-10-12T14:00:00Z',
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

  it('gives every claim of one patient the same patientId, though each claim has its own patient copy', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr } = stubBillingClient();
    const rows = await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE });

    expect(rows.find((r) => r.claimId === 'claim-1')?.patientId).toBe('clinical-1');
    expect(rows.find((r) => r.claimId === 'claim-2')?.patientId).toBe('clinical-1');

    // A claim on a main billing patient with no clinical link keeps that patient's id.
    expect(rows.find((r) => r.claimId === 'claim-f000')?.patientId).toBe('pt-1');
  });

  it('stops a scan that runs out of time instead of scanning again', async () => {
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
      { date: '2026-10-10T12:00:00Z', amount: 75, kind: 'payment', method: 'cash', source: 'ehr', voided: false },
      { date: '2026-10-12', amount: 25, kind: 'payment', method: 'card', source: 'manual', voided: true },
      { date: '2026-10-14', amount: -5, kind: 'refund', method: 'card', source: 'card', voided: false },
    ]);
    expect(selfPay).toMatchObject({
      patientPaymentCount: 1,
      patientRefundedTotal: 5,
      lastPatientPaymentDate: '2026-10-10T12:00:00Z',
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
          remitDate: '2026-10-11T10:00:00Z',
          checkAmount: 500,
          payerName: 'Payer B',
        },
      ],
      statusChanges: [
        { date: '2026-10-05T14:00:00Z', field: 'arStage', from: '', to: 'insurance-payer-ar', by: 'system' },
        { date: '2026-10-12T14:00:00Z', field: 'arStage', from: 'insurance-payer-ar', to: 'patient-ar', by: 'user' },
        { date: '2026-10-12T14:00:00Z', field: 'insuranceArStatus', from: 'adjudicated', to: 'finalized', by: 'user' },
      ],
      firstSubmittedDate: '2026-10-06T13:59:00Z',
      lastSubmittedDate: '2026-10-06T13:59:00Z',
      submissionCount: 1,
      firstAcknowledgedDate: '2026-10-07T13:00:00Z',
      acknowledgments: [
        { date: '2026-10-07T13:00:00Z', entityKind: 'payer', entityName: 'Payer A', message: 'Accepted' },
      ],
      noteCount: 1,
      lastNoteDate: '2026-10-13T14:00:00Z',
      lastActivityDate: '2026-10-14T14:00:00Z',
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

  it('reads no history, coverage or ERA links when those layers are off', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { oystehr, search } = stubBillingClient();
    await fetchAdHocClaimRows(oystehr, { dateRange: DATE_RANGE, includeRemits: true });

    const searched = new Set(search.mock.calls.map(([arg]) => arg.resourceType));
    expect(searched.has('Provenance')).toBe(false);
    expect(searched.has('PaymentReconciliation')).toBe(false);
    const coverageReads = search.mock.calls.filter(
      ([arg]) => arg.resourceType === 'Coverage' && (arg.params as Param[]).some((p) => p.value.includes('payor'))
    );
    expect(coverageReads).toHaveLength(0);
  });
});
