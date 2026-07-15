import { Claim, Patient, Provenance } from 'fhir/r4b';
import {
  AR_STAGE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusValues,
  claimStatusValuesToTags,
  emptyClaimStatusValues,
  formatClaimStatusValue,
  isValidClaimStatusValue,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it } from 'vitest';
import { ClaimPaymentSummary } from '../../../src/billing/claim-amounts';
import {
  deriveFinalizationDate,
  isActivePatientArClaim,
  isInActivePatientArStage,
  mapToPatientArClaimItem,
} from '../../../src/billing/search-billing-patient-ar-claims/handler';

const statuses = (overrides: Partial<ClaimStatusValues>): ClaimStatusValues => ({
  ...emptyClaimStatusValues(),
  ...overrides,
});

const activeStatuses = (overrides: Partial<ClaimStatusValues> = {}): ClaimStatusValues =>
  statuses({
    arStage: AR_STAGE.patient,
    insuranceArStatus: 'finalized',
    ...overrides,
  });

const payments = (overrides: Partial<ClaimPaymentSummary> = {}): ClaimPaymentSummary => ({
  allowed: 0,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  balance: 0,
  adjudicated: false,
  ...overrides,
});

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  resourceType: 'Claim',
  status: 'active',
  type: {
    coding: [],
  },
  use: 'claim',
  created: '2026-07-01',
  provider: {
    reference: 'Organization/prov',
  },
  priority: {
    coding: [],
  },
  insurance: [],
  patient: {
    reference: 'Patient/pat-1',
  },
  ...overrides,
});

const statusChangeProvenance = (recorded: string, field: string, newValue: string | null): Provenance => ({
  resourceType: 'Provenance',
  recorded,
  target: [
    {
      reference: 'Claim/claim-1',
    },
  ],
  agent: [],
  extension: [
    {
      url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
      valueString: JSON.stringify([
        {
          field,
          label: 'label',
          previousValue: null,
          newValue,
        },
      ]),
    },
  ],
});

const INSURANCE_FINALIZED_LABEL = formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.insuranceArStatus, 'finalized');
const PATIENT_AR_STAGE_LABEL = formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.arStage, AR_STAGE.patient);

describe('status model coherence', () => {
  it('uses codes that exist in the status model', () => {
    expect(isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.insuranceArStatus, 'finalized')).toBe(true);
    expect(isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.patientArStatus, 'finalized')).toBe(true);
    expect(isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.arStage, AR_STAGE.patient)).toBe(true);
    expect(INSURANCE_FINALIZED_LABEL).not.toBe('');
    expect(PATIENT_AR_STAGE_LABEL).not.toBe('');
  });
});

describe('isInActivePatientArStage', () => {
  it('accepts patient-ar with insurance finalized', () => {
    expect(isInActivePatientArStage(activeStatuses())).toBe(true);
  });

  it('accepts patient-ar with insurance never started (self-pay from the start)', () => {
    expect(isInActivePatientArStage(activeStatuses({ insuranceArStatus: '' }))).toBe(true);
  });

  it('accepts finalized regardless of paid or adjudication outcome', () => {
    const denied = activeStatuses({
      insurancePaidStatus: 'unpaid',
      adjudicationStatus: 'denied',
    });
    const partiallyPaid = activeStatuses({
      insurancePaidStatus: 'partially-paid',
      adjudicationStatus: 'approved',
    });
    expect(isInActivePatientArStage(denied)).toBe(true);
    expect(isInActivePatientArStage(partiallyPaid)).toBe(true);
  });

  it('accepts patient AR in progress (invoiced but not finalized)', () => {
    expect(isInActivePatientArStage(activeStatuses({ patientArStatus: 'invoiced' }))).toBe(true);
  });

  it('rejects claims outside the patient-ar stage', () => {
    expect(isInActivePatientArStage(statuses({ insuranceArStatus: 'finalized' }))).toBe(false);
    expect(
      isInActivePatientArStage(
        statuses({
          arStage: AR_STAGE.insurancePayer,
          insuranceArStatus: 'finalized',
        })
      )
    ).toBe(false);
  });

  it('rejects closed-out patient AR', () => {
    expect(isInActivePatientArStage(activeStatuses({ patientArStatus: 'finalized' }))).toBe(false);
  });

  it('rejects in-flight insurance AR states', () => {
    for (const inFlight of ['created', 'submitted', 'adjudicated']) {
      expect(isInActivePatientArStage(activeStatuses({ insuranceArStatus: inFlight }))).toBe(false);
    }
  });
});

describe('isActivePatientArClaim', () => {
  it('requires a positive balance', () => {
    expect(isActivePatientArClaim(activeStatuses(), payments({ balance: 25 }))).toBe(true);
    expect(isActivePatientArClaim(activeStatuses(), payments({ balance: 0 }))).toBe(false);
    expect(isActivePatientArClaim(activeStatuses(), payments({ balance: -10 }))).toBe(false);
  });

  it('requires the active patient AR stage', () => {
    expect(isActivePatientArClaim(statuses({}), payments({ balance: 25 }))).toBe(false);
  });
});

describe('deriveFinalizationDate', () => {
  const testClaim = claim({
    id: 'claim-1',
    created: '2026-06-01',
    meta: {
      lastUpdated: '2026-06-20T10:00:00Z',
    },
  });

  it('uses the insuranceArStatus -> finalized change', () => {
    const provenances = [
      statusChangeProvenance('2026-06-10T10:00:00Z', 'status.arStage', PATIENT_AR_STAGE_LABEL),
      statusChangeProvenance('2026-06-05T10:00:00Z', 'status.insuranceArStatus', INSURANCE_FINALIZED_LABEL),
    ];
    expect(deriveFinalizationDate(provenances, testClaim)).toBe('2026-06-05T10:00:00Z');
  });

  it('uses the latest finalized change when there are several', () => {
    const provenances = [
      statusChangeProvenance('2026-06-05T10:00:00Z', 'status.insuranceArStatus', INSURANCE_FINALIZED_LABEL),
      statusChangeProvenance('2026-06-12T10:00:00Z', 'status.insuranceArStatus', INSURANCE_FINALIZED_LABEL),
    ];
    expect(deriveFinalizationDate(provenances, testClaim)).toBe('2026-06-12T10:00:00Z');
  });

  it('ignores other status changes and non-finalized values', () => {
    const provenances = [
      statusChangeProvenance('2026-06-10T10:00:00Z', 'status.insuranceArStatus', 'Submitted'),
      statusChangeProvenance('2026-06-11T10:00:00Z', 'status.patientArStatus', 'Finalized'),
    ];
    expect(deriveFinalizationDate(provenances, testClaim)).toBe('2026-06-20T10:00:00Z');
  });

  it('falls back to the arStage -> Patient AR change (self-pay creation)', () => {
    const provenances = [statusChangeProvenance('2026-06-03T10:00:00Z', 'status.arStage', PATIENT_AR_STAGE_LABEL)];
    expect(deriveFinalizationDate(provenances, testClaim)).toBe('2026-06-03T10:00:00Z');
  });

  it('falls back to meta.lastUpdated, then created, with no matching provenances', () => {
    expect(deriveFinalizationDate([], testClaim)).toBe('2026-06-20T10:00:00Z');
    expect(deriveFinalizationDate([], claim({ created: '2026-06-01' }))).toBe('2026-06-01');
    expect(deriveFinalizationDate([], claim({ created: undefined }))).toBe('');
  });

  it('tolerates malformed change sets', () => {
    const malformed: Provenance = {
      resourceType: 'Provenance',
      recorded: '2026-06-05T10:00:00Z',
      target: [
        {
          reference: 'Claim/claim-1',
        },
      ],
      agent: [],
      extension: [
        {
          url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
          valueString: 'not json {',
        },
      ],
    };
    const notArray: Provenance = {
      ...malformed,
      extension: [
        {
          url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
          valueString: '{"field":"status.insuranceArStatus"}',
        },
      ],
    };
    expect(deriveFinalizationDate([malformed, notArray], testClaim)).toBe('2026-06-20T10:00:00Z');
  });
});

describe('mapToPatientArClaimItem', () => {
  const patient: Patient = {
    resourceType: 'Patient',
    id: 'pat-1',
    name: [
      {
        given: ['Katie'],
        family: 'Test',
      },
    ],
    birthDate: '1990-01-15',
  };

  it('maps claim, patient, and payment data', () => {
    const testClaim = claim({
      id: 'claim-1',
      identifier: [
        {
          system: ottehrIdentifierSystem('claim-encounter-id'),
          value: 'enc-1',
        },
        {
          system: ottehrIdentifierSystem('claim-appointment-id'),
          value: 'appt-1',
        },
      ],
      total: { value: 250 },
      meta: {
        tag: claimStatusValuesToTags(activeStatuses()).map((tag) => ({ ...tag })),
      },
    });
    const item = mapToPatientArClaimItem({
      claim: testClaim,
      patient,
      payments: payments({
        allowed: 200,
        insurancePaid: 150,
        patientResp: 50,
        balance: 50,
        adjudicated: true,
      }),
      finalizationDate: '2026-06-05T10:00:00Z',
    });

    expect(item).toEqual({
      claimId: 'claim-1',
      patientId: 'pat-1',
      patientName: 'Test, Katie',
      patientDob: '1990-01-15',
      encounterId: 'enc-1',
      appointmentId: 'appt-1',
      serviceDate: '2026-07-01',
      finalizationDate: '2026-06-05T10:00:00Z',
      billed: 250,
      allowed: 200,
      insurancePaid: 150,
      patientResp: 50,
      patientPaid: 0,
      balance: 50,
      adjudicated: true,
    });
  });

  it('returns null linkage for claims without encounter identifiers', () => {
    const item = mapToPatientArClaimItem({
      claim: claim({ id: 'claim-2' }),
      patient: undefined,
      payments: payments(),
      finalizationDate: '',
    });
    expect(item.encounterId).toBeNull();
    expect(item.appointmentId).toBeNull();
    expect(item.patientName).toBe('');
    expect(item.patientDob).toBe('');
  });

  it('prefers servicedPeriod.start, then servicedDate, then created for the service date', () => {
    const withPeriod = claim({
      item: [
        {
          sequence: 1,
          productOrService: {
            coding: [],
          },
          servicedPeriod: {
            start: '2026-05-01',
          },
          servicedDate: '2026-05-02',
        },
      ],
    });
    const withDate = claim({
      item: [
        {
          sequence: 1,
          productOrService: {
            coding: [],
          },
          servicedDate: '2026-05-02',
        },
      ],
    });
    const base = {
      patient: undefined,
      payments: payments(),
      finalizationDate: '',
    };
    expect(mapToPatientArClaimItem({ ...base, claim: withPeriod }).serviceDate).toBe('2026-05-01');
    expect(mapToPatientArClaimItem({ ...base, claim: withDate }).serviceDate).toBe('2026-05-02');
    expect(mapToPatientArClaimItem({ ...base, claim: claim() }).serviceDate).toBe('2026-07-01');
  });
});
