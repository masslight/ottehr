import { Location, Organization, ServiceRequest } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  externalLabOrderIsManual,
  getAccountNumberFromLocationAndOrganization,
  getColumnHeader,
  getColumnWidth,
  getOrderNumber,
  isPSCOrder,
  nameLabTest,
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
      expect(getColumnWidth('unknown' as any)).toBe('10%');
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
});
