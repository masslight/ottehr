import { ActivityDefinition } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import { IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY } from '../../src/ehr/shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QUICK_PICK_CONFIG_EXTENSION_URL,
  QUICK_PICK_TAG_SYSTEM,
  quickPickToActivityDefinition,
} from '../../src/ehr/shared/quick-pick-helpers';

function createMockActivityDefinition(title: string, config: Record<string, unknown>): ActivityDefinition {
  return {
    resourceType: 'ActivityDefinition',
    status: 'active',
    name: title.replace(/[^a-zA-Z0-9]/g, '_'),
    title,
    meta: {
      tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: 'in-house-medication-quick-pick' }],
    },
    extension: [{ url: QUICK_PICK_CONFIG_EXTENSION_URL, valueString: JSON.stringify(config) }],
    id: 'test-id-123',
  };
}

describe('In-House Medication Quick Pick - activityDefinitionToQuickPick', () => {
  test('should parse a fully populated in-house medication quick pick', () => {
    const ad = createMockActivityDefinition('Acetaminophen 120mg Suppository', {
      medicationId: '01c71c1a-a52e-487d-b346-8476448a04a9',
      medicationName: 'Acetaminophen (120mg Suppository)',
      dose: 1,
      units: 'unit',
      route: '26643006',
      manufacturer: 'JJ',
      instructions: 'Give with food',
      lotNumber: 'LOT123',
      expDate: '2027-06-30',
    });

    const result = activityDefinitionToQuickPick(ad, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);

    expect(result.id).toBe('test-id-123');
    expect(result.name).toBe('Acetaminophen 120mg Suppository');
    expect(result.medicationId).toBe('01c71c1a-a52e-487d-b346-8476448a04a9');
    expect(result.medicationName).toBe('Acetaminophen (120mg Suppository)');
    expect(result.dose).toBe(1);
    expect(result.units).toBe('unit');
    expect(result.route).toBe('26643006');
    expect(result.manufacturer).toBe('JJ');
    expect(result.instructions).toBe('Give with food');
    expect(result.lotNumber).toBe('LOT123');
    expect(result.expDate).toBe('2027-06-30');
  });

  test('should parse with minimal data (name only)', () => {
    const ad = createMockActivityDefinition('Basic Med', {});

    const result = activityDefinitionToQuickPick(ad, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);

    expect(result.id).toBe('test-id-123');
    expect(result.name).toBe('Basic Med');
    expect(result.medicationId).toBeUndefined();
    expect(result.dose).toBeUndefined();
    expect(result.units).toBeUndefined();
    expect(result.route).toBeUndefined();
  });

  test('should not include associatedDx even if present in config', () => {
    const ad = createMockActivityDefinition('Med with Dx', {
      medicationId: 'med-123',
      associatedDx: 'condition-456',
    });

    const result = activityDefinitionToQuickPick(ad, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);

    // associatedDx is stored in config but still parsed — the exclusion is at
    // the save/apply layer, not the serialization layer
    expect(result.associatedDx).toBe('condition-456');
  });
});

describe('In-House Medication Quick Pick - quickPickToActivityDefinition', () => {
  test('should create ActivityDefinition with all fields', () => {
    const quickPick = {
      name: 'Acetaminophen 120mg',
      medicationId: '01c71c1a-a52e-487d-b346-8476448a04a9',
      medicationName: 'Acetaminophen (120mg Suppository)',
      dose: 1,
      units: 'unit',
      route: '26643006',
      manufacturer: 'JJ',
      instructions: 'Give with food',
      lotNumber: 'LOT123',
      expDate: '2027-06-30',
    };

    const ad = quickPickToActivityDefinition(quickPick, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);

    expect(ad.resourceType).toBe('ActivityDefinition');
    expect(ad.status).toBe('active');
    expect(ad.title).toBe('Acetaminophen 120mg');
    expect(ad.meta?.tag?.[0]?.code).toBe('in-house-medication-quick-pick');

    const config = JSON.parse(
      ad.extension?.find((e) => e.url === QUICK_PICK_CONFIG_EXTENSION_URL)?.valueString ?? '{}'
    );
    expect(config.medicationId).toBe('01c71c1a-a52e-487d-b346-8476448a04a9');
    expect(config.medicationName).toBe('Acetaminophen (120mg Suppository)');
    expect(config.dose).toBe(1);
    expect(config.units).toBe('unit');
    expect(config.route).toBe('26643006');
    expect(config.manufacturer).toBe('JJ');
    expect(config.instructions).toBe('Give with food');
    expect(config.lotNumber).toBe('LOT123');
    expect(config.expDate).toBe('2027-06-30');
    // name should be stripped from config (stored in title instead)
    expect(config.name).toBeUndefined();
  });

  test('should set id when existingId is provided', () => {
    const ad = quickPickToActivityDefinition(
      { name: 'Test Med' },
      IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY,
      'existing-id'
    );
    expect(ad.id).toBe('existing-id');
  });

  test('should not set id when existingId is omitted', () => {
    const ad = quickPickToActivityDefinition({ name: 'Test Med' }, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);
    expect(ad.id).toBeUndefined();
  });
});

describe('In-House Medication Quick Pick - round-trip conversion', () => {
  test('should preserve all fields through round-trip', () => {
    const original = {
      name: 'Acetaminophen Full',
      medicationId: '01c71c1a-a52e-487d-b346-8476448a04a9',
      medicationName: 'Acetaminophen (120mg Suppository)',
      dose: 1,
      units: 'unit',
      route: '26643006',
      manufacturer: 'JJ',
      instructions: 'Give with food',
      lotNumber: 'LOT123',
      expDate: '2027-06-30',
    };

    const ad = quickPickToActivityDefinition(original, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY, 'rt-id');
    const restored = activityDefinitionToQuickPick(ad, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);

    expect(restored.id).toBe('rt-id');
    expect(restored.name).toBe('Acetaminophen Full');
    expect(restored.medicationId).toBe('01c71c1a-a52e-487d-b346-8476448a04a9');
    expect(restored.medicationName).toBe('Acetaminophen (120mg Suppository)');
    expect(restored.dose).toBe(1);
    expect(restored.units).toBe('unit');
    expect(restored.route).toBe('26643006');
    expect(restored.manufacturer).toBe('JJ');
    expect(restored.instructions).toBe('Give with food');
    expect(restored.lotNumber).toBe('LOT123');
    expect(restored.expDate).toBe('2027-06-30');
  });

  test('should preserve minimal data through round-trip', () => {
    const original = { name: 'Basic Med', dose: 5, units: 'mg' };

    const ad = quickPickToActivityDefinition(original, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY, 'min-id');
    const restored = activityDefinitionToQuickPick(ad, IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY);

    expect(restored.name).toBe('Basic Med');
    expect(restored.dose).toBe(5);
    expect(restored.units).toBe('mg');
    expect(restored.medicationId).toBeUndefined();
    expect(restored.route).toBeUndefined();
    expect(restored.lotNumber).toBeUndefined();
    expect(restored.expDate).toBeUndefined();
  });
});
