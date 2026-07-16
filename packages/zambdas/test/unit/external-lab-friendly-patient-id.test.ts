import { Organization, Patient, ServiceRequest } from 'fhir/r4b';
import {
  DiagnosisDTO,
  externalLabOrderUsesFriendlyPatientId,
  FRIENDLY_PATIENT_ID_SYSTEM_BASE,
  getPatientIdForLabOrder,
  IN_HOUSE_TEST_CODE_SYSTEM,
  LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  PSC_HOLD_CONFIG,
} from 'utils';
import { describe, expect, it } from 'vitest';
import {
  formatServiceRequestConfig,
  ResourcesForRequestFormatting,
} from '../../src/ehr/lab/external/create-lab-order/helpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
  resourceType: 'Patient',
  id: 'pat-uuid-1',
  name: [{ family: 'Smith', given: ['Jane'] }],
  ...overrides,
});

const makePatientWithFriendlyId = (friendlyId = 'A1B2C3'): Patient =>
  makePatient({
    identifier: [
      {
        system: `${FRIENDLY_PATIENT_ID_SYSTEM_BASE}/test-tenant`,
        value: friendlyId,
      },
    ],
  });

/** Minimal external lab ServiceRequest (has OYSTEHR_LAB_OI_CODE_SYSTEM coding). */
const makeExternalLabSR = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: 'sr-ext-1',
  status: 'draft',
  intent: 'order',
  subject: { reference: 'Patient/pat-uuid-1' },
  code: {
    coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '12345', display: 'Test A' }],
  },
  ...overrides,
});

/** External lab SR that already has the friendly-ID orderDetail coding. */
const makeExternalLabSRWithFriendlyDetail = (): ServiceRequest =>
  makeExternalLabSR({
    orderDetail: [
      {
        coding: [
          {
            system: LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.system,
            code: LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.code,
            display: LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.display,
          },
        ],
      },
    ],
  });

/** Minimal in-house lab ServiceRequest (has IN_HOUSE_TEST_CODE_SYSTEM coding). */
const makeInHouseLabSR = (): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: 'sr-ihl-1',
  status: 'draft',
  intent: 'order',
  subject: { reference: 'Patient/pat-uuid-1' },
  code: {
    coding: [{ system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'ihl-001', display: 'Strep A Rapid' }],
  },
});

/** ServiceRequest with neither external- nor in-house-lab code. */
const makeGenericSR = (): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: 'sr-generic-1',
  status: 'draft',
  intent: 'order',
  subject: { reference: 'Patient/pat-uuid-1' },
  code: { coding: [{ system: 'http://some.other.system', code: 'OTH' }] },
});

// ---------------------------------------------------------------------------
// Minimal OrderableItemSearchResult + ResourcesForRequestFormatting stubs
// ---------------------------------------------------------------------------

const makeOrderableItem = (): OrderableItemSearchResult => ({
  item: {
    itemCode: '12345',
    itemLoinc: '94534-5',
    itemType: 'test',
    itemName: 'Test A',
    uniqueName: 'Test A / LabCorp',
    specimens: [],
    components: [],
    cptCodes: [],
    aoe: null,
  },
  lab: {
    labGuid: 'lab-guid-1',
    labName: 'LabCorp',
    labType: 'external',
    compendiumVersion: '1',
  },
});

const makeLabOrganization = (): Organization => ({
  resourceType: 'Organization',
  id: 'org-lab-1',
  name: 'LabCorp',
  identifier: [{ system: OYSTEHR_LAB_GUID_SYSTEM, value: 'lab-guid-1' }],
});

const makeResources = (patient: Patient, psc = false): ResourcesForRequestFormatting => ({
  patient,
  encounter: {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'in-progress',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: 'Patient/pat-uuid-1' },
  },
  labOrganization: makeLabOrganization(),
  orderingLocation: { resourceType: 'Location', id: 'loc-1', name: 'Clinic' },
  coverageDetails: { type: 'selfPay' as any },
  selectedPaymentMethod: 'selfPay' as any,
  requisitionNumber: 'REQ-001',
  dx: [{ code: 'J06.9', display: 'Acute URI', isPrimary: true } as DiagnosisDTO],
  psc,
  attendingPractitionerId: 'prac-attending-1',
  currentUserPractitioner: {
    resourceType: 'Practitioner',
    id: 'prac-user-1',
    name: [{ family: 'Jones', given: ['Dr'] }],
  },
  orderLevelNote: undefined,
  clinicalInfoNoteByUser: '',
});

// ---------------------------------------------------------------------------
// externalLabOrderUsesFriendlyPatientId
// ---------------------------------------------------------------------------

describe('externalLabOrderUsesFriendlyPatientId', () => {
  it('returns true when SR has external-lab code AND friendly-ID orderDetail', () => {
    expect(externalLabOrderUsesFriendlyPatientId(makeExternalLabSRWithFriendlyDetail())).toBe(true);
  });

  it('returns false when SR has external-lab code but no orderDetail at all', () => {
    expect(externalLabOrderUsesFriendlyPatientId(makeExternalLabSR())).toBe(false);
  });

  it('returns false when SR has external-lab code but orderDetail lacks the friendly-ID coding', () => {
    const sr = makeExternalLabSR({
      orderDetail: [
        {
          coding: [{ system: PSC_HOLD_CONFIG.system, code: PSC_HOLD_CONFIG.code }],
          text: PSC_HOLD_CONFIG.display,
        },
      ],
    });
    expect(externalLabOrderUsesFriendlyPatientId(sr)).toBe(false);
  });

  it('returns false for an in-house-lab SR even when orderDetail has the friendly-ID coding', () => {
    const sr: ServiceRequest = {
      ...makeInHouseLabSR(),
      orderDetail: [
        {
          coding: [
            {
              system: LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.system,
              code: LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.code,
            },
          ],
        },
      ],
    };
    // In-house lab SRs don't have OYSTEHR_LAB_OI_CODE_SYSTEM → isExternalLabServiceRequest is false
    expect(externalLabOrderUsesFriendlyPatientId(sr)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPatientIdForLabOrder
// ---------------------------------------------------------------------------

describe('getPatientIdForLabOrder', () => {
  describe('external lab ServiceRequest', () => {
    it('returns the friendly patient ID when SR has the detail coding and patient has a friendly ID', () => {
      const patient = makePatientWithFriendlyId('XYZ987');
      const sr = makeExternalLabSRWithFriendlyDetail();
      expect(getPatientIdForLabOrder(sr, patient)).toBe('XYZ987');
    });

    it('throws when SR has the friendly-ID detail but patient has no friendly ID', () => {
      const patient = makePatient(); // no friendly ID identifier
      const sr = makeExternalLabSRWithFriendlyDetail();
      expect(() => getPatientIdForLabOrder(sr, patient)).toThrow();
    });

    it('returns patient.id when SR has external-lab code but no friendly-ID orderDetail', () => {
      const patient = makePatientWithFriendlyId('XYZ987');
      const sr = makeExternalLabSR(); // no orderDetail
      expect(getPatientIdForLabOrder(sr, patient)).toBe('pat-uuid-1');
    });

    it('returns patient.id when patient has neither friendly ID nor the orderDetail', () => {
      const patient = makePatient();
      const sr = makeExternalLabSR();
      expect(getPatientIdForLabOrder(sr, patient)).toBe('pat-uuid-1');
    });
  });

  describe('in-house lab ServiceRequest', () => {
    it('returns the friendly patient ID when patient has one', () => {
      const patient = makePatientWithFriendlyId('ABC123');
      expect(getPatientIdForLabOrder(makeInHouseLabSR(), patient)).toBe('ABC123');
    });

    it('falls back to patient.id when patient has no friendly ID', () => {
      const patient = makePatient();
      expect(getPatientIdForLabOrder(makeInHouseLabSR(), patient)).toBe('pat-uuid-1');
    });
  });

  describe('non-lab ServiceRequest', () => {
    it('returns patient.id regardless of whether patient has a friendly ID', () => {
      const patient = makePatientWithFriendlyId('ABC123');
      expect(getPatientIdForLabOrder(makeGenericSR(), patient)).toBe('pat-uuid-1');
    });
  });

  describe('missing patient.id', () => {
    it('throws when patient has no id', () => {
      const patient: Patient = { resourceType: 'Patient' }; // no id
      expect(() => getPatientIdForLabOrder(makeExternalLabSR(), patient)).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// formatServiceRequestConfig — friendly patient ID orderDetail
// ---------------------------------------------------------------------------

describe('formatServiceRequestConfig — friendly patient ID orderDetail', () => {
  const orderableItem = makeOrderableItem();
  const contained: any[] = [];
  const activityDefinitionId = 'ad-1';
  const specimenUrls: string[] = [];
  const provenanceUrl = 'urn:uuid:prov-1';

  it('adds the friendly-ID orderDetail when the patient has a friendly ID', () => {
    const patient = makePatientWithFriendlyId('FPT001');
    const sr = formatServiceRequestConfig(
      orderableItem,
      makeResources(patient),
      contained,
      activityDefinitionId,
      specimenUrls,
      provenanceUrl
    );

    const hasFriendlyDetail = sr.orderDetail?.some((d) =>
      d.coding?.some(
        (c) =>
          c.system === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.system &&
          c.code === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.code
      )
    );
    expect(hasFriendlyDetail).toBe(true);
  });

  it('does NOT add the friendly-ID orderDetail when the patient has no friendly ID', () => {
    const patient = makePatient(); // no friendly ID
    const sr = formatServiceRequestConfig(
      orderableItem,
      makeResources(patient),
      contained,
      activityDefinitionId,
      specimenUrls,
      provenanceUrl
    );

    const hasFriendlyDetail = sr.orderDetail?.some((d) =>
      d.coding?.some(
        (c) =>
          c.system === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.system &&
          c.code === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.code
      )
    );
    expect(hasFriendlyDetail).toBeFalsy();
  });

  it('includes both PSC and friendly-ID orderDetail entries when patient has a friendly ID and psc is true', () => {
    const patient = makePatientWithFriendlyId('FPT002');
    const sr = formatServiceRequestConfig(
      orderableItem,
      makeResources(patient, /* psc= */ true),
      contained,
      activityDefinitionId,
      specimenUrls,
      provenanceUrl
    );

    const hasPsc = sr.orderDetail?.some((d) =>
      d.coding?.some((c) => c.system === PSC_HOLD_CONFIG.system && c.code === PSC_HOLD_CONFIG.code)
    );
    const hasFriendlyDetail = sr.orderDetail?.some((d) =>
      d.coding?.some(
        (c) =>
          c.system === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.system &&
          c.code === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.code
      )
    );
    expect(hasPsc).toBe(true);
    expect(hasFriendlyDetail).toBe(true);
  });

  it('does NOT add any orderDetail when patient has no friendly ID and psc is false', () => {
    const patient = makePatient();
    const sr = formatServiceRequestConfig(
      orderableItem,
      makeResources(patient, /* psc= */ false),
      contained,
      activityDefinitionId,
      specimenUrls,
      provenanceUrl
    );

    expect(sr.orderDetail).toBeUndefined();
  });

  it('adds only PSC detail (no friendly-ID detail) when patient has no friendly ID but psc is true', () => {
    const patient = makePatient();
    const sr = formatServiceRequestConfig(
      orderableItem,
      makeResources(patient, /* psc= */ true),
      contained,
      activityDefinitionId,
      specimenUrls,
      provenanceUrl
    );

    const hasPsc = sr.orderDetail?.some((d) =>
      d.coding?.some((c) => c.system === PSC_HOLD_CONFIG.system && c.code === PSC_HOLD_CONFIG.code)
    );
    const hasFriendlyDetail = sr.orderDetail?.some((d) =>
      d.coding?.some(
        (c) =>
          c.system === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.system &&
          c.code === LAB_ORDER_WITH_FRIENDLY_PATIENT_ID_DETAIL.code
      )
    );
    expect(hasPsc).toBe(true);
    expect(hasFriendlyDetail).toBeFalsy();
  });
});
