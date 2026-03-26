import { ActivityDefinition } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import {
  ALLERGY_QUICK_PICK_CATEGORY,
  MEDICAL_CONDITION_QUICK_PICK_CATEGORY,
  MEDICATION_HISTORY_QUICK_PICK_CATEGORY,
  PROCEDURE_QUICK_PICK_CATEGORY,
} from '../../src/ehr/shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QUICK_PICK_CONFIG_EXTENSION_URL,
  QUICK_PICK_TAG_SYSTEM,
  quickPickToActivityDefinition,
} from '../../src/ehr/shared/quick-pick-helpers';

function createMockActivityDefinition(
  tagCode: string,
  title: string,
  config: Record<string, unknown>
): ActivityDefinition {
  return {
    resourceType: 'ActivityDefinition',
    status: 'active',
    name: title.replace(/[^a-zA-Z0-9]/g, '_'),
    title,
    meta: {
      tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: tagCode }],
    },
    extension: [{ url: QUICK_PICK_CONFIG_EXTENSION_URL, valueString: JSON.stringify(config) }],
    id: 'test-id-123',
  };
}

describe('activityDefinitionToQuickPick', () => {
  describe('Allergy', () => {
    test('should parse a valid allergy ActivityDefinition with name and allergyId', () => {
      const ad = createMockActivityDefinition('allergy-quick-pick', 'Penicillin', { allergyId: 42 });

      const result = activityDefinitionToQuickPick(ad, ALLERGY_QUICK_PICK_CATEGORY);

      expect(result.id).toBe('test-id-123');
      expect(result.name).toBe('Penicillin');
      expect(result.allergyId).toBe(42);
    });

    test('should parse when config extension has minimal data (just name in title)', () => {
      const ad = createMockActivityDefinition('allergy-quick-pick', 'Peanuts', {});

      const result = activityDefinitionToQuickPick(ad, ALLERGY_QUICK_PICK_CATEGORY);

      expect(result.name).toBe('Peanuts');
      expect(result.allergyId).toBeUndefined();
    });

    test('should throw when config extension is missing', () => {
      const ad: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        status: 'active',
        title: 'Penicillin',
        meta: {
          tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: 'allergy-quick-pick' }],
        },
        // no extension
      };

      // Without extension, configString defaults to '{}', so it should still parse successfully
      // with just the title as the name
      const result = activityDefinitionToQuickPick(ad, ALLERGY_QUICK_PICK_CATEGORY);
      expect(result.name).toBe('Penicillin');
    });
  });

  describe('Medical Condition', () => {
    test('should parse with display name and ICD code', () => {
      const ad = createMockActivityDefinition('medical-condition-quick-pick', 'Asthma', { code: 'J45.909' });

      const result = activityDefinitionToQuickPick(ad, MEDICAL_CONDITION_QUICK_PICK_CATEGORY);

      expect(result.id).toBe('test-id-123');
      expect(result.display).toBe('Asthma');
      expect(result.code).toBe('J45.909');
    });

    test('should throw when config extension is missing', () => {
      const ad: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        status: 'active',
        title: 'Asthma',
        meta: {
          tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: 'medical-condition-quick-pick' }],
        },
      };

      const result = activityDefinitionToQuickPick(ad, MEDICAL_CONDITION_QUICK_PICK_CATEGORY);
      expect(result.display).toBe('Asthma');
      expect(result.code).toBeUndefined();
    });
  });

  describe('Medication History', () => {
    test('should parse with name, strength, and medicationId', () => {
      const ad = createMockActivityDefinition('medication-history-quick-pick', 'Ibuprofen', {
        strength: '200mg',
        medicationId: 99,
      });

      const result = activityDefinitionToQuickPick(ad, MEDICATION_HISTORY_QUICK_PICK_CATEGORY);

      expect(result.id).toBe('test-id-123');
      expect(result.name).toBe('Ibuprofen');
      expect(result.strength).toBe('200mg');
      expect(result.medicationId).toBe(99);
    });

    test('should throw when config extension is missing', () => {
      const ad: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        status: 'active',
        title: 'Ibuprofen',
        meta: {
          tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: 'medication-history-quick-pick' }],
        },
      };

      const result = activityDefinitionToQuickPick(ad, MEDICATION_HISTORY_QUICK_PICK_CATEGORY);
      expect(result.name).toBe('Ibuprofen');
      expect(result.strength).toBeUndefined();
      expect(result.medicationId).toBeUndefined();
    });
  });

  describe('Procedure', () => {
    test('should parse with all fields populated', () => {
      const config = {
        procedureType: 'Laceration Repair',
        cptCodes: [{ code: '12001', display: 'Simple repair' }],
        bodySite: 'Left arm',
        technique: 'Sutures',
        consentObtained: true,
      };
      const ad = createMockActivityDefinition('procedure-quick-pick', 'Lac Repair - Arm', config);

      const result = activityDefinitionToQuickPick(ad, PROCEDURE_QUICK_PICK_CATEGORY);

      expect(result.id).toBe('test-id-123');
      expect(result.name).toBe('Lac Repair - Arm');
      expect(result.procedureType).toBe('Laceration Repair');
      expect(result.cptCodes).toEqual([{ code: '12001', display: 'Simple repair' }]);
      expect(result.bodySite).toBe('Left arm');
      expect(result.technique).toBe('Sutures');
      expect(result.consentObtained).toBe(true);
    });

    test('should parse with minimal fields (just name)', () => {
      const ad = createMockActivityDefinition('procedure-quick-pick', 'Simple Procedure', {});

      const result = activityDefinitionToQuickPick(ad, PROCEDURE_QUICK_PICK_CATEGORY);

      expect(result.id).toBe('test-id-123');
      expect(result.name).toBe('Simple Procedure');
      expect(result.procedureType).toBeUndefined();
      expect(result.cptCodes).toBeUndefined();
    });

    test('should throw when config extension is missing', () => {
      const ad: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        status: 'active',
        title: 'Some Procedure',
        meta: {
          tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: 'procedure-quick-pick' }],
        },
      };

      const result = activityDefinitionToQuickPick(ad, PROCEDURE_QUICK_PICK_CATEGORY);
      expect(result.name).toBe('Some Procedure');
    });
  });
});

describe('quickPickToActivityDefinition', () => {
  test('should create ActivityDefinition with correct title and name', () => {
    const quickPick = { name: 'Penicillin', allergyId: 42 };

    const ad = quickPickToActivityDefinition(quickPick, ALLERGY_QUICK_PICK_CATEGORY);

    expect(ad.title).toBe('Penicillin');
    expect(ad.name).toBe('Penicillin');
  });

  test('should sanitize name to remove non-alphanumeric characters', () => {
    const quickPick = { name: 'Lac Repair - Left Arm' };

    const ad = quickPickToActivityDefinition(quickPick, PROCEDURE_QUICK_PICK_CATEGORY);

    expect(ad.name).toBe('Lac_Repair___Left_Arm');
    expect(ad.title).toBe('Lac Repair - Left Arm');
  });

  test('should set correct meta tag system and code for allergy category', () => {
    const quickPick = { name: 'Peanuts' };

    const ad = quickPickToActivityDefinition(quickPick, ALLERGY_QUICK_PICK_CATEGORY);

    expect(ad.meta?.tag).toEqual([{ system: QUICK_PICK_TAG_SYSTEM, code: 'allergy-quick-pick' }]);
  });

  test('should set correct meta tag system and code for medical condition category', () => {
    const quickPick = { display: 'Asthma', code: 'J45.909' };

    const ad = quickPickToActivityDefinition(quickPick, MEDICAL_CONDITION_QUICK_PICK_CATEGORY);

    expect(ad.meta?.tag).toEqual([{ system: QUICK_PICK_TAG_SYSTEM, code: 'medical-condition-quick-pick' }]);
  });

  test('should set correct meta tag system and code for medication history category', () => {
    const quickPick = { name: 'Ibuprofen', strength: '200mg' };

    const ad = quickPickToActivityDefinition(quickPick, MEDICATION_HISTORY_QUICK_PICK_CATEGORY);

    expect(ad.meta?.tag).toEqual([{ system: QUICK_PICK_TAG_SYSTEM, code: 'medication-history-quick-pick' }]);
  });

  test('should set correct meta tag system and code for procedure category', () => {
    const quickPick = { name: 'Lac Repair' };

    const ad = quickPickToActivityDefinition(quickPick, PROCEDURE_QUICK_PICK_CATEGORY);

    expect(ad.meta?.tag).toEqual([{ system: QUICK_PICK_TAG_SYSTEM, code: 'procedure-quick-pick' }]);
  });

  test('should serialize config data in extension excluding display name field', () => {
    const quickPick = { name: 'Ibuprofen', strength: '200mg', medicationId: 99 };

    const ad = quickPickToActivityDefinition(quickPick, MEDICATION_HISTORY_QUICK_PICK_CATEGORY);

    const configExt = ad.extension?.find((e) => e.url === QUICK_PICK_CONFIG_EXTENSION_URL);
    expect(configExt).toBeDefined();
    const parsed = JSON.parse(configExt!.valueString!);
    // name (displayNameKey) should be excluded from config
    expect(parsed.name).toBeUndefined();
    // other fields should be present
    expect(parsed.strength).toBe('200mg');
    expect(parsed.medicationId).toBe(99);
  });

  test('should serialize config for medical condition excluding display field', () => {
    const quickPick = { display: 'Asthma', code: 'J45.909' };

    const ad = quickPickToActivityDefinition(quickPick, MEDICAL_CONDITION_QUICK_PICK_CATEGORY);

    const configExt = ad.extension?.find((e) => e.url === QUICK_PICK_CONFIG_EXTENSION_URL);
    const parsed = JSON.parse(configExt!.valueString!);
    // display (displayNameKey) should be excluded
    expect(parsed.display).toBeUndefined();
    expect(parsed.code).toBe('J45.909');
  });

  test('should set id when existingId is provided', () => {
    const quickPick = { name: 'Penicillin' };

    const ad = quickPickToActivityDefinition(quickPick, ALLERGY_QUICK_PICK_CATEGORY, 'existing-id-456');

    expect(ad.id).toBe('existing-id-456');
  });

  test('should not set id when existingId is omitted', () => {
    const quickPick = { name: 'Penicillin' };

    const ad = quickPickToActivityDefinition(quickPick, ALLERGY_QUICK_PICK_CATEGORY);

    expect(ad.id).toBeUndefined();
  });

  test('should set status to active', () => {
    const quickPick = { name: 'Penicillin' };

    const ad = quickPickToActivityDefinition(quickPick, ALLERGY_QUICK_PICK_CATEGORY);

    expect(ad.status).toBe('active');
  });
});

describe('round-trip conversion', () => {
  test('should preserve allergy data through round-trip', () => {
    const original = { name: 'Penicillin', allergyId: 42 };
    const ad = quickPickToActivityDefinition(original, ALLERGY_QUICK_PICK_CATEGORY, 'round-trip-id');
    const restored = activityDefinitionToQuickPick(ad, ALLERGY_QUICK_PICK_CATEGORY);

    expect(restored.name).toBe('Penicillin');
    expect(restored.allergyId).toBe(42);
    expect(restored.id).toBe('round-trip-id');
  });

  test('should preserve medical condition data through round-trip', () => {
    const original = { display: 'Asthma', code: 'J45.909' };
    const ad = quickPickToActivityDefinition(original, MEDICAL_CONDITION_QUICK_PICK_CATEGORY, 'mc-id');
    const restored = activityDefinitionToQuickPick(ad, MEDICAL_CONDITION_QUICK_PICK_CATEGORY);

    expect(restored.display).toBe('Asthma');
    expect(restored.code).toBe('J45.909');
  });

  test('should preserve medication history data through round-trip', () => {
    const original = { name: 'Ibuprofen', strength: '200mg', medicationId: 99 };
    const ad = quickPickToActivityDefinition(original, MEDICATION_HISTORY_QUICK_PICK_CATEGORY, 'med-id');
    const restored = activityDefinitionToQuickPick(ad, MEDICATION_HISTORY_QUICK_PICK_CATEGORY);

    expect(restored.name).toBe('Ibuprofen');
    expect(restored.strength).toBe('200mg');
    expect(restored.medicationId).toBe(99);
  });

  test('should preserve procedure data through round-trip', () => {
    const original = {
      name: 'Lac Repair',
      procedureType: 'Laceration Repair',
      cptCodes: [{ code: '12001', display: 'Simple repair' }],
      bodySite: 'Left arm',
      consentObtained: true,
    };
    const ad = quickPickToActivityDefinition(original, PROCEDURE_QUICK_PICK_CATEGORY, 'proc-id');
    const restored = activityDefinitionToQuickPick(ad, PROCEDURE_QUICK_PICK_CATEGORY);

    expect(restored.name).toBe('Lac Repair');
    expect(restored.procedureType).toBe('Laceration Repair');
    expect(restored.cptCodes).toEqual([{ code: '12001', display: 'Simple repair' }]);
    expect(restored.bodySite).toBe('Left arm');
    expect(restored.consentObtained).toBe(true);
  });
});
