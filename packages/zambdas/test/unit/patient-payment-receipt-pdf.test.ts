import { Location, Organization } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import { buildOrganizationReceiptBlock } from '../../src/shared/pdf/patient-payment-receipt-pdf';

const mockOrg: Organization = {
  resourceType: 'Organization',
  name: 'Test Clinic',
  address: [
    {
      line: ['123 Org Street', 'Suite 1'],
      city: 'OrgCity',
      state: 'OC',
      postalCode: '10001',
    },
  ],
  telecom: [{ system: 'phone', value: '555-ORG-PHONE' }],
};

const locationWithAddress: Location = {
  resourceType: 'Location',
  name: 'Downtown Branch',
  address: {
    line: ['456 Location Rd'],
    city: 'LocCity',
    state: 'LC',
    postalCode: '20002',
  },
  telecom: [{ system: 'phone', value: '555-LOC-PHONE' }],
};

describe('buildOrganizationReceiptBlock', () => {
  describe('when location has a complete address', () => {
    test('uses location address fields', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.street).toBe('456 Location Rd');
      expect(result.city).toBe('LocCity');
      expect(result.state).toBe('LC');
      expect(result.zip).toBe('20002');
    });

    test('uses organization name', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.name).toBe('Test Clinic');
    });

    test('prefers location phone over org phone', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.phone).toBe('555-LOC-PHONE');
    });

    test('falls back to org phone when location phone is undefined', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, locationWithAddress, '555-ORG-PHONE', undefined);

      expect(result.phone).toBe('555-ORG-PHONE');
    });
  });

  describe('when location has no address', () => {
    test('uses organization address fields when location is undefined', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, undefined, '555-ORG-PHONE', undefined);

      expect(result.street).toBe('123 Org Street');
      expect(result.city).toBe('OrgCity');
      expect(result.state).toBe('OC');
      expect(result.zip).toBe('10001');
    });

    test('uses organization address fields when location has no address property', () => {
      const locationWithoutAddress: Location = { resourceType: 'Location', name: 'No Address Branch' };

      const result = buildOrganizationReceiptBlock(mockOrg, locationWithoutAddress, '555-ORG-PHONE', undefined);

      expect(result.street).toBe('123 Org Street');
      expect(result.city).toBe('OrgCity');
      expect(result.state).toBe('OC');
      expect(result.zip).toBe('10001');
    });

    test('uses organization phone', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, undefined, '555-ORG-PHONE', undefined);

      expect(result.phone).toBe('555-ORG-PHONE');
    });

    test('includes street2 when organization address has a second line', () => {
      const result = buildOrganizationReceiptBlock(mockOrg, undefined, '555-ORG-PHONE', undefined);

      expect(result.street2).toBe('Suite 1');
    });
  });

  describe('when location address is incomplete', () => {
    test('falls back to org address when location is missing postalCode', () => {
      const partialLocation: Location = {
        resourceType: 'Location',
        address: {
          line: ['789 Partial Rd'],
          city: 'PartialCity',
          state: 'PC',
          // no postalCode
        },
      };

      const result = buildOrganizationReceiptBlock(mockOrg, partialLocation, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.street).toBe('123 Org Street');
      expect(result.city).toBe('OrgCity');
    });

    test('falls back to org address when location is missing city', () => {
      const partialLocation: Location = {
        resourceType: 'Location',
        address: {
          line: ['789 Partial Rd'],
          state: 'PC',
          postalCode: '30003',
        },
      };

      const result = buildOrganizationReceiptBlock(mockOrg, partialLocation, '555-ORG-PHONE', '555-LOC-PHONE');

      expect(result.street).toBe('123 Org Street');
    });
  });
});
