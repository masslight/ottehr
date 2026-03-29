import { Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { PractitionerLicense, ProviderTypeCode } from '../types';
import {
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getSuffixFromProviderTypeExtension,
  makeProviderTypeExtension,
  makeQualificationForPractitioner,
} from './practitioners';

const PARTICIPANT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType';

describe('practitioners', () => {
  describe('getAttendingPractitionerId', () => {
    it('should extract attending practitioner ID from encounter', () => {
      const encounter = {
        participant: [
          {
            type: [
              {
                coding: [
                  {
                    system: PARTICIPANT_TYPE_SYSTEM,
                    code: 'ATND',
                    display: 'attender',
                  },
                ],
              },
            ],
            individual: { reference: 'Practitioner/prac-123' },
          },
        ],
      } as unknown as Encounter;
      expect(getAttendingPractitionerId(encounter)).toBe('prac-123');
    });

    it('should return undefined when no attender participant', () => {
      const encounter = {
        participant: [
          {
            type: [{ coding: [{ system: PARTICIPANT_TYPE_SYSTEM, code: 'ADM' }] }],
            individual: { reference: 'Practitioner/prac-123' },
          },
        ],
      } as unknown as Encounter;
      expect(getAttendingPractitionerId(encounter)).toBeUndefined();
    });

    it('should return undefined when no participants', () => {
      const encounter = {} as Encounter;
      expect(getAttendingPractitionerId(encounter)).toBeUndefined();
    });
  });

  describe('getAdmitterPractitionerId', () => {
    it('should extract admitter practitioner ID from encounter', () => {
      const encounter = {
        participant: [
          {
            type: [
              {
                coding: [
                  {
                    system: PARTICIPANT_TYPE_SYSTEM,
                    code: 'ADM',
                    display: 'admitter',
                  },
                ],
              },
            ],
            individual: { reference: 'Practitioner/prac-456' },
          },
        ],
      } as unknown as Encounter;
      expect(getAdmitterPractitionerId(encounter)).toBe('prac-456');
    });

    it('should return undefined when no admitter', () => {
      const encounter = {} as Encounter;
      expect(getAdmitterPractitionerId(encounter)).toBeUndefined();
    });
  });

  describe('makeProviderTypeExtension', () => {
    it('should create provider type extension', () => {
      const result = makeProviderTypeExtension('MD' as ProviderTypeCode, 'Doctor of Medicine');
      expect(result).toHaveLength(1);
      expect(result?.[0].valueCodeableConcept?.coding?.[0].code).toBe('MD');
      expect(result?.[0].valueCodeableConcept?.text).toBe('Doctor of Medicine');
    });

    it('should use providerType as text fallback', () => {
      const result = makeProviderTypeExtension('NP' as ProviderTypeCode);
      expect(result?.[0].valueCodeableConcept?.text).toBe('NP');
    });

    it('should return undefined when providerType is undefined', () => {
      expect(makeProviderTypeExtension(undefined)).toBeUndefined();
    });
  });

  describe('makeQualificationForPractitioner', () => {
    it('should create qualification with all fields', () => {
      const license: PractitionerLicense = {
        state: 'NY' as PractitionerLicense['state'],
        code: 'MD',
        number: 'LIC-12345',
        date: '2026-12-31',
        active: true,
      };
      const result = makeQualificationForPractitioner(license);
      expect(result.code.coding?.[0].code).toBe('MD');
      expect(result.code.coding?.[0].system).toBe('http://terminology.hl7.org/CodeSystem/v2-0360|2.7');
      expect(result.code.text).toBe('Qualification code');

      const outerExt = result.extension?.[0];
      expect(outerExt?.url).toBe(
        'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification'
      );
      const innerExts = outerExt?.extension;
      expect(innerExts?.find((e) => e.url === 'status')?.valueCode).toBe('active');
      expect(innerExts?.find((e) => e.url === 'whereValid')?.valueCodeableConcept?.coding?.[0].code).toBe('NY');
      expect(innerExts?.find((e) => e.url === 'whereValid')?.valueCodeableConcept?.coding?.[0].system).toBe(
        'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state'
      );
      expect(innerExts?.find((e) => e.url === 'number')?.valueString).toBe('LIC-12345');
      expect(innerExts?.find((e) => e.url === 'expDate')?.valueDate).toBe('2026-12-31');
    });

    it('should set status to inactive when license is not active', () => {
      const license: PractitionerLicense = {
        state: 'CA' as PractitionerLicense['state'],
        code: 'NP',
        active: false,
      };
      const result = makeQualificationForPractitioner(license);
      const innerExts = result.extension?.[0]?.extension;
      expect(innerExts?.find((e) => e.url === 'status')?.valueCode).toBe('inactive');
    });

    it('should omit number and date extensions when not provided', () => {
      const license: PractitionerLicense = {
        state: 'TX' as PractitionerLicense['state'],
        code: 'PA',
        active: true,
      };
      const result = makeQualificationForPractitioner(license);
      const innerExts = result.extension?.[0]?.extension;
      expect(innerExts?.find((e) => e.url === 'number')).toBeUndefined();
      expect(innerExts?.find((e) => e.url === 'expDate')).toBeUndefined();
      // Should only have status and whereValid
      expect(innerExts).toHaveLength(2);
    });
  });

  describe('getSuffixFromProviderTypeExtension', () => {
    it('should extract text from provider type extension', () => {
      const ext = makeProviderTypeExtension('MD' as ProviderTypeCode, 'Doctor of Medicine');
      const result = getSuffixFromProviderTypeExtension(ext);
      expect(result).toEqual(['Doctor of Medicine']);
    });

    it('should return undefined for empty array', () => {
      expect(getSuffixFromProviderTypeExtension([])).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      expect(getSuffixFromProviderTypeExtension(undefined)).toBeUndefined();
    });
  });
});
