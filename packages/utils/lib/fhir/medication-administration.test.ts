import { Medication, MedicationAdministration } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { ExtendedMedicationDataForResponse, MedicationOrderStatusesType } from '../types';
import {
  createMedicationString,
  getAllCptCodesFromInHouseMedication,
  getAllHcpcsCodesFromInHouseMedication,
  getAllOrderedByProviderIds,
  getCptCodeFromMedication,
  getCreatedTheOrderProviderId,
  getCurrentOrderedByProviderId,
  getDosageFromMA,
  getDosageUnitsAndRouteOfMedication,
  getHcpcsCodeFromMedication,
  getLocationCodeFromMedicationAdministration,
  getMedicationFromMA,
  getMedicationName,
  getMedicationTypeCode,
  getNdcCodeFromMedication,
  getPractitionerIdThatOrderedMedication,
  getProviderIdAndDateMedicationWasAdministered,
  getReasonAndOtherReasonForNotAdministeredOrder,
  makeMedicationOrderUpdateRequestInput,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  medicationExtendedToMedicationData,
  medicationStatusDisplayLabelMap,
} from './medication-administration';

describe('medication-administration', () => {
  describe('mapFhirToOrderStatus', () => {
    it.each([
      ['completed', 'administered'],
      ['on-hold', 'administered-partly'],
      ['not-done', 'administered-not'],
      ['in-progress', 'pending'],
      ['stopped', 'cancelled'],
    ] as const)('should map FHIR status "%s" to order status "%s"', (fhirStatus, expected) => {
      const ma = { status: fhirStatus } as MedicationAdministration;
      expect(mapFhirToOrderStatus(ma)).toBe(expected);
    });

    it('should return undefined for unknown status', () => {
      const ma = { status: 'entered-in-error' } as MedicationAdministration;
      expect(mapFhirToOrderStatus(ma)).toBeUndefined();
    });
  });

  describe('mapOrderStatusToFhir', () => {
    it.each([
      ['pending', 'in-progress'],
      ['administered-partly', 'on-hold'],
      ['administered-not', 'not-done'],
      ['administered', 'completed'],
      ['cancelled', 'stopped'],
    ] as const)('should map order status "%s" to FHIR status "%s"', (orderStatus, expected) => {
      expect(mapOrderStatusToFhir(orderStatus)).toBe(expected);
    });
  });

  describe('getMedicationName', () => {
    it('should return name from identifier with correct system', () => {
      const med: Medication = {
        resourceType: 'Medication',
        identifier: [{ system: 'virtual-medication-identifier-name-system', value: 'Ibuprofen' }],
      };
      expect(getMedicationName(med)).toBe('Ibuprofen');
    });

    it('should return undefined when no matching identifier', () => {
      const med: Medication = { resourceType: 'Medication', identifier: [{ system: 'other', value: 'test' }] };
      expect(getMedicationName(med)).toBeUndefined();
    });

    it('should return undefined for undefined medication', () => {
      expect(getMedicationName(undefined)).toBeUndefined();
    });
  });

  describe('getMedicationTypeCode', () => {
    it('should return type code from identifier', () => {
      const med: Medication = {
        resourceType: 'Medication',
        identifier: [{ system: 'virtual-medication-type', value: 'injectable' }],
      };
      expect(getMedicationTypeCode(med)).toBe('injectable');
    });

    it('should return undefined when no matching identifier', () => {
      const med: Medication = { resourceType: 'Medication' };
      expect(getMedicationTypeCode(med)).toBeUndefined();
    });
  });

  describe('getDosageUnitsAndRouteOfMedication', () => {
    it('should extract dose, units, and route', () => {
      const ma = {
        status: 'completed',
        dosage: {
          dose: { value: 200, unit: 'mg' },
          route: {
            coding: [{ system: 'http://hl7.org/fhir/ValueSet/route-codes', code: 'oral' }],
          },
        },
      } as unknown as MedicationAdministration;
      expect(getDosageUnitsAndRouteOfMedication(ma)).toEqual({
        dose: 200,
        units: 'mg',
        route: 'oral',
      });
    });

    it('should return undefineds when no dosage', () => {
      const ma = { status: 'completed' } as unknown as MedicationAdministration;
      expect(getDosageUnitsAndRouteOfMedication(ma)).toEqual({
        dose: undefined,
        units: undefined,
        route: undefined,
      });
    });
  });

  describe('getPractitionerIdThatOrderedMedication', () => {
    it('should return practitioner id', () => {
      const ma = {
        status: 'completed',
        performer: [
          {
            function: { coding: [{ code: 'practitioner-ordered-medication' }] },
            actor: { reference: 'Practitioner/prac-123' },
          },
        ],
      } as unknown as MedicationAdministration;
      expect(getPractitionerIdThatOrderedMedication(ma)).toBe('prac-123');
    });

    it('should return undefined when no matching performer', () => {
      const ma = { status: 'completed', performer: [] } as unknown as MedicationAdministration;
      expect(getPractitionerIdThatOrderedMedication(ma)).toBeUndefined();
    });
  });

  describe('getReasonAndOtherReasonForNotAdministeredOrder', () => {
    it('should extract reason and otherReason from notes', () => {
      const ma = {
        status: 'not-done',
        note: [
          { authorString: 'mainReason', text: 'Patient refused' },
          { authorString: 'otherReason', text: 'Allergic reaction concern' },
        ],
      } as unknown as MedicationAdministration;
      const result = getReasonAndOtherReasonForNotAdministeredOrder(ma);
      expect(result.reason).toBe('Patient refused');
      expect(result.otherReason).toBe('Allergic reaction concern');
    });

    it('should return undefineds when no notes', () => {
      const ma = { status: 'not-done' } as unknown as MedicationAdministration;
      const result = getReasonAndOtherReasonForNotAdministeredOrder(ma);
      expect(result.reason).toBeUndefined();
      expect(result.otherReason).toBeUndefined();
    });
  });

  describe('getLocationCodeFromMedicationAdministration', () => {
    it('should return location code from dosage site', () => {
      const ma = {
        status: 'completed',
        dosage: {
          site: {
            coding: [{ system: 'http://snomed.info/sct', code: 'left-arm' }],
          },
        },
      } as unknown as MedicationAdministration;
      expect(getLocationCodeFromMedicationAdministration(ma)).toBe('left-arm');
    });
  });

  describe('getProviderIdAndDateMedicationWasAdministered', () => {
    it('should return provider id, date, and time', () => {
      const ma = {
        status: 'completed',
        performer: [
          {
            function: { coding: [{ code: 'practitioner-administered-medication' }] },
            actor: { reference: 'Practitioner/admin-1' },
            extension: [
              { url: 'medication-administered-date', valueDate: '2025-06-15' },
              { url: 'medication-administered-time', valueTime: '14:30:00' },
            ],
          },
        ],
      } as unknown as MedicationAdministration;
      const result = getProviderIdAndDateMedicationWasAdministered(ma);
      expect(result?.administeredProviderId).toBe('admin-1');
      expect(result?.dateAdministered).toBe('2025-06-15');
      expect(result?.timeAdministered).toBe('14:30:00');
    });

    it('should return undefined when no administered performer', () => {
      const ma = { status: 'completed', performer: [] } as unknown as MedicationAdministration;
      expect(getProviderIdAndDateMedicationWasAdministered(ma)).toBeUndefined();
    });
  });

  describe('getCreatedTheOrderProviderId', () => {
    it('should return creator practitioner id', () => {
      const ma = {
        status: 'completed',
        performer: [
          {
            function: { coding: [{ code: 'practitioner-ordered-medication' }] },
            actor: { reference: 'Practitioner/creator-1' },
          },
        ],
      } as unknown as MedicationAdministration;
      expect(getCreatedTheOrderProviderId(ma)).toBe('creator-1');
    });
  });

  describe('getAllOrderedByProviderIds', () => {
    it('should return all ordered-by provider ids', () => {
      const ma = {
        status: 'completed',
        performer: [
          {
            function: { coding: [{ code: 'practitioner-ordered-by-medication' }] },
            actor: { reference: 'Practitioner/p1' },
          },
          {
            function: { coding: [{ code: 'practitioner-ordered-by-medication' }] },
            actor: { reference: 'Practitioner/p2' },
          },
        ],
      } as unknown as MedicationAdministration;
      expect(getAllOrderedByProviderIds(ma)).toEqual(['p1', 'p2']);
    });

    it('should return empty array when no performers', () => {
      const ma = { status: 'completed' } as unknown as MedicationAdministration;
      expect(getAllOrderedByProviderIds(ma)).toEqual([]);
    });
  });

  describe('getCurrentOrderedByProviderId', () => {
    it('should return last ordered-by provider', () => {
      const ma = {
        status: 'completed',
        performer: [
          {
            function: { coding: [{ code: 'practitioner-ordered-by-medication' }] },
            actor: { reference: 'Practitioner/p1' },
          },
          {
            function: { coding: [{ code: 'practitioner-ordered-by-medication' }] },
            actor: { reference: 'Practitioner/p2' },
          },
        ],
      } as unknown as MedicationAdministration;
      expect(getCurrentOrderedByProviderId(ma)).toBe('p2');
    });

    it('should return undefined when no ordered-by performers', () => {
      const ma = { status: 'completed' } as unknown as MedicationAdministration;
      expect(getCurrentOrderedByProviderId(ma)).toBeUndefined();
    });
  });

  describe('getMedicationFromMA', () => {
    it('should extract contained Medication resource', () => {
      const ma = {
        status: 'completed',
        contained: [{ resourceType: 'Medication', id: 'med-1' }],
      } as unknown as MedicationAdministration;
      const result = getMedicationFromMA(ma);
      expect(result?.resourceType).toBe('Medication');
      expect(result?.id).toBe('med-1');
    });

    it('should return undefined when no contained Medication', () => {
      const ma = { status: 'completed', contained: [] } as unknown as MedicationAdministration;
      expect(getMedicationFromMA(ma)).toBeUndefined();
    });
  });

  describe('getNdcCodeFromMedication', () => {
    it('should return NDC code', () => {
      const med: Medication = {
        resourceType: 'Medication',
        code: { coding: [{ system: 'http://hl7.org/fhir/sid/ndc', code: '12345-678-90' }] },
      };
      expect(getNdcCodeFromMedication(med)).toBe('12345-678-90');
    });
  });

  describe('getCptCodeFromMedication', () => {
    it('should return CPT code', () => {
      const med: Medication = {
        resourceType: 'Medication',
        code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '90471' }] },
      };
      expect(getCptCodeFromMedication(med)).toBe('90471');
    });
  });

  describe('getHcpcsCodeFromMedication', () => {
    it('should return HCPCS code', () => {
      const med: Medication = {
        resourceType: 'Medication',
        code: {
          coding: [{ system: 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets', code: 'J0696' }],
        },
      };
      expect(getHcpcsCodeFromMedication(med)).toBe('J0696');
    });
  });

  describe('getAllHcpcsCodesFromInHouseMedication', () => {
    it('should return all HCPCS codes', () => {
      const med: Medication = {
        resourceType: 'Medication',
        code: {
          coding: [
            { system: 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets', code: 'J0696' },
            { system: 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets', code: 'J1234' },
            { system: 'http://www.ama-assn.org/go/cpt', code: '90471' },
          ],
        },
      };
      expect(getAllHcpcsCodesFromInHouseMedication(med)).toEqual(['J0696', 'J1234']);
    });
  });

  describe('getAllCptCodesFromInHouseMedication', () => {
    it('should return all CPT codes', () => {
      const med: Medication = {
        resourceType: 'Medication',
        code: {
          coding: [
            { system: 'http://www.ama-assn.org/go/cpt', code: '90471' },
            { system: 'http://www.ama-assn.org/go/cpt', code: '90472' },
            { system: 'http://hl7.org/fhir/sid/ndc', code: '12345' },
          ],
        },
      };
      expect(getAllCptCodesFromInHouseMedication(med)).toEqual(['90471', '90472']);
    });
  });

  describe('getDosageFromMA', () => {
    it('should return dose and units', () => {
      const ma = {
        status: 'completed',
        dosage: { dose: { value: 200, unit: 'mg' } },
      } as unknown as MedicationAdministration;
      expect(getDosageFromMA(ma)).toEqual({ dose: 200, units: 'mg' });
    });

    it('should return undefined when dose missing', () => {
      const ma = { status: 'completed', dosage: {} } as unknown as MedicationAdministration;
      expect(getDosageFromMA(ma)).toBeUndefined();
    });
  });

  describe('makeMedicationOrderUpdateRequestInput', () => {
    it('should build update request with all fields', () => {
      const result = makeMedicationOrderUpdateRequestInput({
        id: 'order-1',
        newStatus: 'administered',
        orderData: { dose: 200 },
      });
      expect(result.orderId).toBe('order-1');
      expect(result.newStatus).toBe('administered');
      expect(result.orderData).toBeDefined();
    });

    it('should omit undefined fields', () => {
      const result = makeMedicationOrderUpdateRequestInput({});
      expect(result.orderId).toBeUndefined();
      expect(result.newStatus).toBeUndefined();
      expect(result.orderData).toBeUndefined();
    });
  });

  describe('medicationStatusDisplayLabelMap', () => {
    it('should have labels for all statuses', () => {
      expect(medicationStatusDisplayLabelMap['pending']).toBe('Pending');
      expect(medicationStatusDisplayLabelMap['administered']).toBe('Administered');
      expect(medicationStatusDisplayLabelMap['administered-partly']).toBe('Partly Administered');
      expect(medicationStatusDisplayLabelMap['administered-not']).toBe('Not Administered');
      expect(medicationStatusDisplayLabelMap['cancelled']).toBe('Cancelled');
    });
  });

  describe('medicationExtendedToMedicationData', () => {
    it('should extract MedicationData fields from extended data', () => {
      const extended = {
        id: 'ext-1',
        status: 'administered' as MedicationOrderStatusesType,
        medicationName: 'Ibuprofen',
        providerCreatedTheOrder: 'Dr. Smith',
        providerCreatedTheOrderId: 'prac-1',
        dateTimeCreated: '2025-06-15T10:00:00Z',
        patient: 'Patient/p1',
        encounterId: 'enc-1',
        medicationId: 'med-1',
        dose: 200,
        route: 'oral',
        instructions: 'Take with food',
        reason: undefined,
        otherReason: undefined,
        associatedDx: 'J06.9',
        units: 'mg',
        manufacturer: 'Advil',
        location: 'left-arm',
        lotNumber: 'LOT-123',
        expDate: '2026-12-31',
        effectiveDateTime: '2025-06-15T10:30:00Z',
      } as ExtendedMedicationDataForResponse;
      const result = medicationExtendedToMedicationData(extended);
      expect(result.patient).toBe('Patient/p1');
      expect(result.encounterId).toBe('enc-1');
      expect(result.dose).toBe(200);
      expect(result.units).toBe('mg');
      expect(result.lotNumber).toBe('LOT-123');
      // Should not include extended-only fields
      expect('id' in result).toBe(false);
      expect('status' in result).toBe(false);
      expect('medicationName' in result).toBe(false);
    });
  });

  describe('createMedicationString', () => {
    it('should combine all available fields', () => {
      const medication = {
        medicationName: 'Ibuprofen',
        dose: 200,
        units: 'mg',
        status: 'administered' as MedicationOrderStatusesType,
        administeredProvider: 'Dr. Smith',
        instructions: 'Take with food',
        patient: 'p1',
        encounterId: 'e1',
      } as ExtendedMedicationDataForResponse;
      const result = createMedicationString(medication);
      expect(result).toContain('Ibuprofen');
      expect(result).toContain('200 mg');
      expect(result).toContain('given by Dr. Smith');
      expect(result).toContain('instructions: Take with food');
      expect(result).toContain('Administered');
    });

    it('should omit undefined fields', () => {
      const medication = {
        medicationName: 'Tylenol',
        status: 'pending' as MedicationOrderStatusesType,
        patient: 'p1',
        encounterId: 'e1',
        dose: 0,
      } as ExtendedMedicationDataForResponse;
      const result = createMedicationString(medication);
      expect(result).toContain('Tylenol');
      expect(result).toContain('Pending');
      expect(result).not.toContain('given by');
      expect(result).not.toContain('instructions');
    });
  });
});
