import { Coverage, DiagnosticReport, DocumentReference, Location, Organization, ServiceRequest } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { LabsTableColumn } from '../../types';
import {
  docRefIsAbnAndCurrent,
  docRefIsLabelPDFAndCurrent,
  docRefIsLabGeneratedResult,
  docRefIsOgHl7Transmission,
  docRefIsOrderPDFAndCurrent,
  docRefIsOttehrGeneratedResultAndCurrent,
  externalLabOrderIsManual,
  getAccountNumberFromLocationAndOrganization,
  getAdditionalPlacerId,
  getColumnHeader,
  getColumnWidth,
  getOrderNumber,
  getOrderNumberFromDr,
  getTestItemCodeFromDr,
  getTestNameFromDr,
  getTestNameOrCodeFromDr,
  isPSCOrder,
  nameLabTest,
  paymentMethodFromCoverage,
} from './helpers';

describe('labs helpers', () => {
  describe('nameLabTest', () => {
    it('should format reflex test name', () => {
      expect(nameLabTest('CBC', 'LabCorp', true)).toBe('CBC (reflex)');
    });

    it('should format non-reflex test name with lab name', () => {
      expect(nameLabTest('CBC', 'LabCorp', false)).toBe('CBC / LabCorp');
    });

    it('should handle undefined values', () => {
      expect(nameLabTest(undefined, undefined, false)).toBe('undefined / undefined');
      expect(nameLabTest(undefined, undefined, true)).toBe('undefined (reflex)');
    });
  });

  describe('isPSCOrder', () => {
    it('should return true when service request has PSC hold coding', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
        orderDetail: [
          {
            coding: [{ system: 'psc-identifier', code: 'psc' }],
          },
        ],
      } as unknown as ServiceRequest;
      expect(isPSCOrder(sr)).toBe(true);
    });

    it('should return false when no PSC hold coding', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
        orderDetail: [{ coding: [{ system: 'other', code: 'other' }] }],
      } as unknown as ServiceRequest;
      expect(isPSCOrder(sr)).toBe(false);
    });

    it('should return false when no orderDetail', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
      } as ServiceRequest;
      expect(isPSCOrder(sr)).toBe(false);
    });
  });

  describe('externalLabOrderIsManual', () => {
    it('should return true for manual external lab order', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
        category: [
          {
            coding: [
              {
                system: 'https://fhir.ottehr.com/CodeSystem/manual-lab-order',
                code: 'manual-lab-order',
              },
            ],
          },
        ],
      } as unknown as ServiceRequest;
      expect(externalLabOrderIsManual(sr)).toBe(true);
    });

    it('should return false for non-manual order', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
        category: [],
      } as unknown as ServiceRequest;
      expect(externalLabOrderIsManual(sr)).toBe(false);
    });
  });

  describe('getOrderNumber', () => {
    it('should return order number from identifier', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
        identifier: [{ system: 'https://identifiers.fhir.oystehr.com/lab-order-placer-id', value: 'ORD-12345' }],
      } as unknown as ServiceRequest;
      expect(getOrderNumber(sr)).toBe('ORD-12345');
    });

    it('should return undefined when no matching identifier', () => {
      const sr = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/p1' },
        identifier: [],
      } as unknown as ServiceRequest;
      expect(getOrderNumber(sr)).toBeUndefined();
    });
  });

  describe('getAccountNumberFromLocationAndOrganization', () => {
    it('should return account number from location identifier', () => {
      const location: Location = {
        resourceType: 'Location',
        id: 'loc-1',
        identifier: [
          {
            system: 'https://identifiers.fhir.oystehr.com/lab-account-number',
            value: 'ACCT-001',
            assigner: { reference: 'Organization/org-1' },
          },
        ],
      };
      const org: Organization = { resourceType: 'Organization', id: 'org-1' };
      expect(getAccountNumberFromLocationAndOrganization(location, org)).toBe('ACCT-001');
    });

    it('should fall back to organization identifier', () => {
      const location: Location = {
        resourceType: 'Location',
        id: 'loc-1',
        identifier: [],
      };
      const org: Organization = {
        resourceType: 'Organization',
        id: 'org-1',
        identifier: [{ system: 'https://identifiers.fhir.oystehr.com/lab-account-number', value: 'ORG-ACCT-001' }],
      };
      expect(getAccountNumberFromLocationAndOrganization(location, org)).toBe('ORG-ACCT-001');
    });

    it('should return undefined when no account number found', () => {
      const location: Location = { resourceType: 'Location', id: 'loc-1' };
      const org: Organization = { resourceType: 'Organization', id: 'org-1' };
      expect(getAccountNumberFromLocationAndOrganization(location, org)).toBeUndefined();
    });
  });

  describe('getColumnWidth', () => {
    it('should return correct widths for known columns', () => {
      expect(getColumnWidth('testType')).toBe('15%');
      expect(getColumnWidth('visit')).toBe('10%');
      expect(getColumnWidth('status')).toBe('5%');
      expect(getColumnWidth('detail')).toBe('2%');
      expect(getColumnWidth('actions')).toBe('1%');
    });

    it('should return default width for unknown column', () => {
      expect(getColumnWidth('unknown' as LabsTableColumn)).toBe('10%');
    });
  });

  describe('getColumnHeader', () => {
    it('should return correct headers for known columns', () => {
      expect(getColumnHeader('testType')).toBe('Test type');
      expect(getColumnHeader('provider')).toBe('Provider');
      expect(getColumnHeader('dx')).toBe('Dx');
      expect(getColumnHeader('accessionNumber')).toBe('Accession Number');
      expect(getColumnHeader('requisitionNumber')).toBe('Requisition Number');
    });

    it('should return empty string for detail and actions columns', () => {
      expect(getColumnHeader('detail')).toBe('');
      expect(getColumnHeader('actions')).toBe('');
    });
  });

  describe('getAdditionalPlacerId', () => {
    it('should return additional placer ID from diagnostic report', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {},
        identifier: [
          {
            system: 'https://identifiers.fhir.oystehr.com/lab-result-additional-placer-id',
            value: 'ADD-123',
          },
        ],
      } as unknown as DiagnosticReport;
      expect(getAdditionalPlacerId(dr)).toBe('ADD-123');
    });

    it('should return undefined when no matching identifier', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {},
      } as DiagnosticReport;
      expect(getAdditionalPlacerId(dr)).toBeUndefined();
    });
  });

  describe('getOrderNumberFromDr', () => {
    it('should return order number from diagnostic report', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {},
        identifier: [
          {
            system: 'https://identifiers.fhir.oystehr.com/lab-order-placer-id',
            value: 'ORD-DR-456',
          },
        ],
      } as unknown as DiagnosticReport;
      expect(getOrderNumberFromDr(dr)).toBe('ORD-DR-456');
    });
  });

  describe('getTestNameFromDr', () => {
    it('should return display from oystehr lab OI code system', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
          coding: [
            {
              system: 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-lab-local-codes',
              display: 'Complete Blood Count',
              code: 'CBC',
            },
          ],
        },
      } as unknown as DiagnosticReport;
      expect(getTestNameFromDr(dr)).toBe('Complete Blood Count');
    });

    it('should fall back to LOINC display', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', display: 'CBC Panel', code: '58410-2' }],
        },
      } as unknown as DiagnosticReport;
      expect(getTestNameFromDr(dr)).toBe('CBC Panel');
    });

    it('should fall back to HL7 system display', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
          coding: [{ system: 'some-system(HL7_V2)', display: 'HL7 Test', code: 'HT' }],
        },
      } as unknown as DiagnosticReport;
      expect(getTestNameFromDr(dr)).toBe('HL7 Test');
    });

    it('should return undefined when no matching coding', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: { coding: [{ system: 'unknown-system', display: 'Nope' }] },
      } as unknown as DiagnosticReport;
      expect(getTestNameFromDr(dr)).toBeUndefined();
    });
  });

  describe('getTestItemCodeFromDr', () => {
    it('should return code from oystehr lab OI code system', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
          coding: [
            {
              system: 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-lab-local-codes',
              code: 'CBC',
              display: 'Complete Blood Count',
            },
          ],
        },
      } as unknown as DiagnosticReport;
      expect(getTestItemCodeFromDr(dr)).toBe('CBC');
    });
  });

  describe('getTestNameOrCodeFromDr', () => {
    it('should prefer test name over code', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
          coding: [
            {
              system: 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-lab-local-codes',
              code: 'CBC',
              display: 'Complete Blood Count',
            },
          ],
        },
      } as unknown as DiagnosticReport;
      expect(getTestNameOrCodeFromDr(dr)).toBe('Complete Blood Count');
    });

    it('should fall back to code when no display', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
          coding: [
            {
              system: 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-lab-local-codes',
              code: 'CBC',
            },
          ],
        },
      } as unknown as DiagnosticReport;
      expect(getTestNameOrCodeFromDr(dr)).toBe('CBC');
    });

    it('should return "missing test name" when no coding matches', () => {
      const dr = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: { coding: [] },
      } as unknown as DiagnosticReport;
      expect(getTestNameOrCodeFromDr(dr)).toBe('missing test name');
    });
  });

  describe('paymentMethodFromCoverage', () => {
    it('should return WorkersComp for WC coding', () => {
      const coverage = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {},
        payor: [],
        type: { coding: [{ code: 'WC' }] },
      } as unknown as Coverage;
      expect(paymentMethodFromCoverage(coverage)).toBe('workersComp');
    });

    it('should return SelfPay for pay coding', () => {
      const coverage = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {},
        payor: [],
        type: { coding: [{ code: 'pay' }] },
      } as unknown as Coverage;
      expect(paymentMethodFromCoverage(coverage)).toBe('selfPay');
    });

    it('should return ClientBill for client-bill coding', () => {
      const coverage = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {},
        payor: [],
        type: {
          coding: [
            {
              system: 'https://terminology.fhir.oystehr.com/CodeSystem/labs-financial-class',
              code: 'client-bill',
            },
          ],
        },
      } as unknown as Coverage;
      expect(paymentMethodFromCoverage(coverage)).toBe('clientBill');
    });

    it('should return Insurance as default', () => {
      const coverage = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {},
        payor: [],
        type: { coding: [{ code: 'other' }] },
      } as unknown as Coverage;
      expect(paymentMethodFromCoverage(coverage)).toBe('insurance');
    });

    it('should prioritize WorkersComp over other codes', () => {
      const coverage = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {},
        payor: [],
        type: { coding: [{ code: 'pay' }, { code: 'WC' }] },
      } as unknown as Coverage;
      expect(paymentMethodFromCoverage(coverage)).toBe('workersComp');
    });

    it('should return Insurance when no type coding exists', () => {
      const coverage = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {},
        payor: [],
      } as unknown as Coverage;
      expect(paymentMethodFromCoverage(coverage)).toBe('insurance');
    });
  });

  describe('docRefIsLabGeneratedResult', () => {
    const SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/lab-documents';

    it('should return true for lab generated result doc ref', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        category: [
          {
            coding: [{ system: SYSTEM, code: 'lab-generated-result-document' }],
          },
        ],
      } as unknown as DocumentReference;
      expect(docRefIsLabGeneratedResult(docRef)).toBe(true);
    });

    it('should return false when no matching category', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        category: [],
      } as unknown as DocumentReference;
      expect(docRefIsLabGeneratedResult(docRef)).toBe(false);
    });
  });

  describe('docRefIsOgHl7Transmission', () => {
    it('should return true when meta tag matches', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        meta: {
          tag: [{ system: 'lab-doc-type', code: 'original-hl7-transmission' }],
        },
      } as unknown as DocumentReference;
      expect(docRefIsOgHl7Transmission(docRef)).toBe(true);
    });

    it('should return false when no matching tag', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
      } as unknown as DocumentReference;
      expect(docRefIsOgHl7Transmission(docRef)).toBe(false);
    });
  });

  describe('docRefIsOrderPDFAndCurrent', () => {
    it('should return true for current order PDF', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        type: {
          coding: [{ system: 'http://loinc.org', code: '51991-8' }],
        },
      } as unknown as DocumentReference;
      expect(docRefIsOrderPDFAndCurrent(docRef)).toBe(true);
    });

    it('should return false when status is not current', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'superseded',
        content: [],
        type: {
          coding: [{ system: 'http://loinc.org', code: '51991-8' }],
        },
      } as unknown as DocumentReference;
      expect(docRefIsOrderPDFAndCurrent(docRef)).toBe(false);
    });

    it('should return false when coding does not match', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        type: {
          coding: [{ system: 'http://loinc.org', code: 'wrong-code' }],
        },
      } as unknown as DocumentReference;
      expect(docRefIsOrderPDFAndCurrent(docRef)).toBe(false);
    });
  });

  describe('docRefIsLabelPDFAndCurrent', () => {
    it('should return true for current label PDF', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        type: {
          coding: [
            {
              system: 'http://ottehr.org/fhir/StructureDefinition/specimen-collection-label',
              code: 'specimen-container-label',
            },
          ],
        },
      } as unknown as DocumentReference;
      expect(docRefIsLabelPDFAndCurrent(docRef)).toBe(true);
    });

    it('should return false when not current', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'entered-in-error',
        content: [],
        type: {
          coding: [
            {
              system: 'http://ottehr.org/fhir/StructureDefinition/specimen-collection-label',
              code: 'specimen-container-label',
            },
          ],
        },
      } as unknown as DocumentReference;
      expect(docRefIsLabelPDFAndCurrent(docRef)).toBe(false);
    });
  });

  describe('docRefIsAbnAndCurrent', () => {
    const SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/lab-documents';

    it('should return true for current ABN document', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        category: [
          {
            coding: [{ system: SYSTEM, code: 'abn-document' }],
          },
        ],
      } as unknown as DocumentReference;
      expect(docRefIsAbnAndCurrent(docRef)).toBe(true);
    });

    it('should return false when not current', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'superseded',
        content: [],
        category: [
          {
            coding: [{ system: SYSTEM, code: 'abn-document' }],
          },
        ],
      } as unknown as DocumentReference;
      expect(docRefIsAbnAndCurrent(docRef)).toBe(false);
    });
  });

  describe('docRefIsOttehrGeneratedResultAndCurrent', () => {
    it('should return true for current ottehr-generated result', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [],
        type: {
          coding: [{ system: 'http://loinc.org', code: '11502-2' }],
        },
      } as unknown as DocumentReference;
      expect(docRefIsOttehrGeneratedResultAndCurrent(docRef)).toBe(true);
    });

    it('should return false when not current', () => {
      const docRef = {
        resourceType: 'DocumentReference',
        status: 'superseded',
        content: [],
        type: {
          coding: [{ system: 'http://loinc.org', code: '11502-2' }],
        },
      } as unknown as DocumentReference;
      expect(docRefIsOttehrGeneratedResultAndCurrent(docRef)).toBe(false);
    });
  });
});
