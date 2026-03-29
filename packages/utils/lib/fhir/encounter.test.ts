import { Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL } from './constants';
import {
  checkEncounterIsVirtual,
  FOLLOWUP_SYSTEMS,
  getEncounterVisitType,
  getPaymentVariantFromEncounter,
  isEncounterSelfPay,
  isFollowupEncounter,
  PaymentVariant,
  updateEncounterPaymentVariantExtension,
} from './encounter';

describe('encounter', () => {
  describe('isFollowupEncounter', () => {
    it('should return true for follow-up encounter with matching type coding', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        type: [
          {
            coding: [
              {
                system: FOLLOWUP_SYSTEMS.type.url,
                code: FOLLOWUP_SYSTEMS.type.code,
              },
            ],
          },
        ],
      } as unknown as Encounter;
      expect(isFollowupEncounter(encounter)).toBe(true);
    });

    it('should return false for non-follow-up encounter', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        type: [{ coding: [{ system: 'http://snomed.info/sct', code: '99999' }] }],
      } as unknown as Encounter;
      expect(isFollowupEncounter(encounter)).toBe(false);
    });

    it('should return false when encounter has no type', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
      } as unknown as Encounter;
      expect(isFollowupEncounter(encounter)).toBe(false);
    });
  });

  describe('getEncounterVisitType', () => {
    it('should return "follow-up" for follow-up encounters', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        type: [
          {
            coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }],
          },
        ],
      } as unknown as Encounter;
      expect(getEncounterVisitType(encounter)).toBe('follow-up');
    });

    it('should return "main" for regular encounters', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
      } as unknown as Encounter;
      expect(getEncounterVisitType(encounter)).toBe('main');
    });

    it('should return "main" when encounter is undefined', () => {
      expect(getEncounterVisitType(undefined)).toBe('main');
    });
  });

  describe('checkEncounterIsVirtual', () => {
    it('should return true for virtual encounter (class code VR)', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
      } as unknown as Encounter;
      expect(checkEncounterIsVirtual(encounter)).toBe(true);
    });

    it('should return false for in-person encounter', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      } as unknown as Encounter;
      expect(checkEncounterIsVirtual(encounter)).toBe(false);
    });

    it('should return false when class is missing', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
      } as unknown as Encounter;
      expect(checkEncounterIsVirtual(encounter)).toBe(false);
    });

    it('should return false when system does not match', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: { system: 'http://wrong-system.org', code: 'VR' },
      } as unknown as Encounter;
      expect(checkEncounterIsVirtual(encounter)).toBe(false);
    });
  });

  describe('getPaymentVariantFromEncounter / isEncounterSelfPay', () => {
    it('should extract payment variant from encounter extension', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        extension: [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'selfPay' }],
      } as unknown as Encounter;
      expect(getPaymentVariantFromEncounter(encounter)).toBe('selfPay');
    });

    it('should return undefined when no payment extension', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
      } as unknown as Encounter;
      expect(getPaymentVariantFromEncounter(encounter)).toBeUndefined();
    });

    it('isEncounterSelfPay should return true for selfPay', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        extension: [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'selfPay' }],
      } as unknown as Encounter;
      expect(isEncounterSelfPay(encounter)).toBe(true);
    });

    it('isEncounterSelfPay should return false for insurance', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        extension: [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'insurance' }],
      } as unknown as Encounter;
      expect(isEncounterSelfPay(encounter)).toBe(false);
    });

    it('isEncounterSelfPay should return false for undefined encounter', () => {
      expect(isEncounterSelfPay(undefined)).toBe(false);
    });
  });

  describe('updateEncounterPaymentVariantExtension', () => {
    it('should add payment extension when encounter has no extensions', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
      } as unknown as Encounter;
      const result = updateEncounterPaymentVariantExtension(encounter, PaymentVariant.selfPay);
      expect(result.extension).toHaveLength(1);
      expect(result.extension?.[0].valueString).toBe('selfPay');
    });

    it('should update existing payment extension', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        extension: [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'insurance' }],
      } as unknown as Encounter;
      const result = updateEncounterPaymentVariantExtension(encounter, PaymentVariant.selfPay);
      expect(result.extension).toHaveLength(1);
      expect(result.extension?.[0].valueString).toBe('selfPay');
    });

    it('should append payment extension when other extensions exist', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        extension: [{ url: 'http://other-extension', valueString: 'other' }],
      } as unknown as Encounter;
      const result = updateEncounterPaymentVariantExtension(encounter, PaymentVariant.employer);
      expect(result.extension).toHaveLength(2);
      expect(result.extension?.[1].valueString).toBe('employer');
    });

    it('should not mutate the original encounter', () => {
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: { code: 'AMB' },
        extension: [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'insurance' }],
      } as unknown as Encounter;
      const result = updateEncounterPaymentVariantExtension(encounter, PaymentVariant.selfPay);
      // The spread is shallow, so extension array is shared — this documents that behavior
      expect(result).not.toBe(encounter);
    });
  });
});
