import { Medication } from 'fhir/r4b';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils';
import { describe, expect, test } from 'vitest';
import {
  fieldsConfig,
  fieldsConfigForCompletedEdit,
  fieldsConfigForDispense,
  fieldsConfigForOrder,
  getFieldLabel,
} from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/fieldsConfig';
import { formatMedicationAdministrationReason } from '../../src/features/visits/in-person/components/medication-administration/util';

// ─── Completed Edit Form Config ──────────────────────────────────────────────

describe('fieldsConfig - completed-edit', () => {
  test('fieldsConfig map should include completed-edit entry', () => {
    expect(fieldsConfig['completed-edit']).toBeDefined();
    expect(fieldsConfig['completed-edit']).toBe(fieldsConfigForCompletedEdit);
  });

  test('completed-edit should include all order fields', () => {
    const orderFields = Object.keys(fieldsConfigForOrder);
    for (const field of orderFields) {
      expect(fieldsConfigForCompletedEdit).toHaveProperty(field);
    }
  });

  test('completed-edit should include administration fields (lotNumber, expDate, effectiveDateTime)', () => {
    expect(fieldsConfigForCompletedEdit).toHaveProperty('lotNumber');
    expect(fieldsConfigForCompletedEdit).toHaveProperty('expDate');
    expect(fieldsConfigForCompletedEdit).toHaveProperty('effectiveDateTime');
  });

  test('completed-edit should have medicationId, dose, units, route as required', () => {
    expect(fieldsConfigForCompletedEdit.medicationId.isRequired).toBe(true);
    expect(fieldsConfigForCompletedEdit.dose.isRequired).toBe(true);
    expect(fieldsConfigForCompletedEdit.units.isRequired).toBe(true);
    expect(fieldsConfigForCompletedEdit.route.isRequired).toBe(true);
  });

  test('completed-edit should have lotNumber, expDate, effectiveDateTime as not required', () => {
    expect(fieldsConfigForCompletedEdit.lotNumber.isRequired).toBe(false);
    expect(fieldsConfigForCompletedEdit.expDate.isRequired).toBe(false);
    expect(fieldsConfigForCompletedEdit.effectiveDateTime.isRequired).toBe(false);
  });

  test('completed-edit should have same fields as dispense config', () => {
    const dispenseFields = Object.keys(fieldsConfigForDispense);
    const completedEditFields = Object.keys(fieldsConfigForCompletedEdit);
    expect(completedEditFields.sort()).toEqual(dispenseFields.sort());
  });

  test('completed-edit has fewer required fields than dispense', () => {
    const dispenseRequired = Object.entries(fieldsConfigForDispense).filter(([, v]) => v.isRequired).length;
    const completedRequired = Object.entries(fieldsConfigForCompletedEdit).filter(([, v]) => v.isRequired).length;
    expect(completedRequired).toBeLessThan(dispenseRequired);
  });
});

// ─── Field Labels ────────────────────────────────────────────────────────────

describe('getFieldLabel', () => {
  test('should return form-independent labels for standard fields', () => {
    expect(getFieldLabel('medicationId')).toBe('Medication');
    expect(getFieldLabel('dose')).toBe('Dose');
    expect(getFieldLabel('lotNumber')).toBe('Lot Number');
    expect(getFieldLabel('expDate')).toBe('Expiration Date');
    expect(getFieldLabel('effectiveDateTime')).toBe('Date/Time Given');
  });

  test('should return "Comments" for instructions field in dispense form', () => {
    expect(getFieldLabel('instructions', 'dispense')).toBe('Comments');
    expect(getFieldLabel('instructions', 'dispense-not-administered')).toBe('Comments');
  });

  test('should return "Instructions" for instructions field in other forms', () => {
    expect(getFieldLabel('instructions', 'order-new')).toBe('Instructions');
    expect(getFieldLabel('instructions', 'completed-edit')).toBe('Instructions');
  });
});

// ─── Medications Configuration Sorting ───────────────────────────────────────

describe('Medications configuration - sorting logic', () => {
  const makeMed = (id: string, name: string, status?: Medication['status']): Medication => ({
    resourceType: 'Medication',
    id,
    ...(status != null && { status }),
    identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }],
  });

  // This mirrors the sorting logic in MedicationsConfiguration.tsx
  const sortMedications = (medications: Medication[]): Medication[] => {
    return [...medications].sort((a, b) => {
      const statusA = a.status ?? 'active';
      const statusB = b.status ?? 'active';
      if (statusA === 'active' && statusB !== 'active') return -1;
      if (statusA !== 'active' && statusB === 'active') return 1;
      const nameA =
        a.identifier?.find((i) => i.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value?.toLowerCase() ?? '';
      const nameB =
        b.identifier?.find((i) => i.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value?.toLowerCase() ?? '';
      return nameA.localeCompare(nameB);
    });
  };

  test('should sort active medications before inactive', () => {
    const meds = [makeMed('1', 'Zoloft', 'inactive'), makeMed('2', 'Acetaminophen', 'active')];
    const sorted = sortMedications(meds);
    expect(sorted[0].id).toBe('2'); // active first
    expect(sorted[1].id).toBe('1');
  });

  test('should sort alphabetically within same status group', () => {
    const meds = [
      makeMed('1', 'Zoloft', 'active'),
      makeMed('2', 'Acetaminophen', 'active'),
      makeMed('3', 'Ibuprofen', 'active'),
    ];
    const sorted = sortMedications(meds);
    expect(sorted[0].id).toBe('2'); // Acetaminophen
    expect(sorted[1].id).toBe('3'); // Ibuprofen
    expect(sorted[2].id).toBe('1'); // Zoloft
  });

  test('should treat medications without status as active', () => {
    const meds = [makeMed('1', 'Inactive Med', 'inactive'), makeMed('2', 'No Status Med', undefined)];
    const sorted = sortMedications(meds);
    expect(sorted[0].id).toBe('2'); // no status = active, comes first
    expect(sorted[1].id).toBe('1');
  });

  test('should handle mixed active, inactive, and no-status correctly', () => {
    const meds = [
      makeMed('1', 'Zoloft', 'inactive'),
      makeMed('2', 'Aspirin', undefined), // treated as active
      makeMed('3', 'Ibuprofen', 'active'),
      makeMed('4', 'Tylenol', 'inactive'),
      makeMed('5', 'Acetaminophen', 'active'),
    ];
    const sorted = sortMedications(meds);
    // Active group (alphabetical): Acetaminophen, Aspirin, Ibuprofen
    expect(sorted[0].id).toBe('5');
    expect(sorted[1].id).toBe('2');
    expect(sorted[2].id).toBe('3');
    // Inactive group (alphabetical): Tylenol, Zoloft
    expect(sorted[3].id).toBe('4');
    expect(sorted[4].id).toBe('1');
  });
});

// ─── MAR Reason Formatting ──────────────────────────────────────────────────

describe('formatMedicationAdministrationReason', () => {
  test('should include specified reason when main reason is Other', () => {
    expect(formatMedicationAdministrationReason('other', 'My other reason')).toBe('Other: My other reason');
  });

  test('should trim specified reason for Other', () => {
    expect(formatMedicationAdministrationReason('other', '  My other reason  ')).toBe('Other: My other reason');
  });

  test('should keep non-Other reasons as labels', () => {
    expect(formatMedicationAdministrationReason('patient-refused', 'Ignored custom reason')).toBe('Patient refused');
  });
});
