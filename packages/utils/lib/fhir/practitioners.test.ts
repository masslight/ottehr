import { Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getSuffixFromProviderTypeExtension,
  makeProviderTypeExtension,
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
      const result = makeProviderTypeExtension('MD' as any, 'Doctor of Medicine');
      expect(result).toHaveLength(1);
      expect(result?.[0].valueCodeableConcept?.coding?.[0].code).toBe('MD');
      expect(result?.[0].valueCodeableConcept?.text).toBe('Doctor of Medicine');
    });

    it('should use providerType as text fallback', () => {
      const result = makeProviderTypeExtension('NP' as any);
      expect(result?.[0].valueCodeableConcept?.text).toBe('NP');
    });

    it('should return undefined when providerType is undefined', () => {
      expect(makeProviderTypeExtension(undefined)).toBeUndefined();
    });
  });

  describe('getSuffixFromProviderTypeExtension', () => {
    it('should extract text from provider type extension', () => {
      const ext = makeProviderTypeExtension('MD' as any, 'Doctor of Medicine');
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
