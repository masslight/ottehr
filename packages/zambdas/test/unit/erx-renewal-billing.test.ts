import { MedicationRequest } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { MedicationDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM } from 'utils/lib/types/constants';
import { describe, expect, it } from 'vitest';
import {
  formatCurrentMedicationsForBillingPrompt,
  formatPrescribedMedicationsForBillingPrompt,
} from '../../src/ehr/recommend-billing-suggestions';
import { makeMedicationDTO, makePrescribedMedicationDTO } from '../../src/shared/chart-data';
import { makeMedicationStatementFromErxMedicationRequest } from '../../src/subscriptions/medication-request/process-erx-resources';

const renewalExtension = { url: FHIR_EXTENSION.MedicationRequest.isRenewal.url, valueBoolean: true };

const makeMedicationRequest = (overrides: Partial<MedicationRequest> = {}): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id: 'med-request-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  requester: { reference: 'Practitioner/practitioner-1' },
  identifier: [{ system: 'https://identifiers.fhir.oystehr.com/erx-prescription-id', value: 'rx-1' }],
  medicationCodeableConcept: {
    coding: [
      {
        system: MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM,
        code: '12345',
        display: 'Amoxicillin 500 MG Oral Capsule',
      },
    ],
  },
  dosageInstruction: [{ patientInstruction: 'Take one capsule twice daily.' }],
  dispenseRequest: { quantity: { value: 20, unit: 'capsule' } },
  ...overrides,
});

describe('eRx renewal mapping', () => {
  it('copies MedicationRequest renewal status onto the derived MedicationStatement DTO', () => {
    const medicationRequest = makeMedicationRequest({ extension: [renewalExtension] });

    const medicationStatement = makeMedicationStatementFromErxMedicationRequest(
      medicationRequest,
      'encounter-1',
      'patient-1',
      'practitioner-1'
    );

    expect(
      medicationStatement.extension?.find(
        (extension) => extension.url === FHIR_EXTENSION.MedicationRequest.isRenewal.url
      )?.valueBoolean
    ).toBe(true);
    expect(makeMedicationDTO(medicationStatement).isRenewal).toBe(true);
  });

  it('maps MedicationRequest renewal status onto prescribed medication DTOs', () => {
    const medicationRequest = makeMedicationRequest({ extension: [renewalExtension] });

    expect(makePrescribedMedicationDTO(medicationRequest).isRenewal).toBe(true);
  });
});

describe('billing prescription context formatting', () => {
  it('distinguishes new prescriptions from refills and skips cancelled orders', () => {
    const prompt = formatPrescribedMedicationsForBillingPrompt([
      {
        name: 'Amoxicillin',
        status: 'active',
        instructions: 'Take twice daily.',
        isRenewal: false,
      },
      {
        name: 'Lisinopril',
        status: 'active',
        instructions: 'Take daily.',
        isRenewal: true,
      },
      {
        name: 'Cancelled Medication',
        status: 'cancelled',
        isRenewal: false,
      },
    ] as PrescribedMedicationDTO[]);

    expect(prompt).toContain('Medication: Amoxicillin');
    expect(prompt).toContain('Order type: new prescription');
    expect(prompt).toContain('Medication: Lisinopril');
    expect(prompt).toContain('Order type: refill/renewal');
    expect(prompt).not.toContain('Cancelled Medication');
  });

  it('formats the confirmed current medication list as complexity context', () => {
    const prompt = formatCurrentMedicationsForBillingPrompt([
      {
        name: 'Metformin (500 mg)',
        status: 'active',
        type: 'scheduled',
        intakeInfo: { dose: '500 mg', date: '2026-02-01T14:30:00.000Z' },
      },
      {
        name: 'Albuterol',
        status: 'active',
        type: 'as-needed',
        intakeInfo: { patientCouldNotConfirmDosage: true },
      },
      {
        name: 'Discontinued Medication',
        status: 'completed',
        type: 'scheduled',
        intakeInfo: {},
      },
      {
        // this visit's eRx orders are already described by the prescription context above
        name: 'Amoxicillin',
        status: 'active',
        type: 'prescribed-medication',
        intakeInfo: {},
      },
    ] as MedicationDTO[]);

    expect(prompt).toContain('Confirmed current medication count: 2');
    expect(prompt).toContain(
      'Medication: Metformin (500 mg) | Type: scheduled | Dose: 500 mg | Last taken: 2026-02-01'
    );
    expect(prompt).toContain('Medication: Albuterol | Type: as needed | Patient could not confirm dosage');
    expect(prompt).not.toContain('Discontinued Medication');
    expect(prompt).not.toContain('Amoxicillin');
  });

  it('lists the most recently taken medications first, undated ones last', () => {
    const prompt = formatCurrentMedicationsForBillingPrompt([
      { name: 'Older', status: 'active', type: 'scheduled', intakeInfo: { date: '2026-01-01T12:00:00.000Z' } },
      { name: 'Undated', status: 'active', type: 'scheduled', intakeInfo: {} },
      { name: 'Newer', status: 'active', type: 'scheduled', intakeInfo: { date: '2026-03-01T12:00:00.000Z' } },
    ] as MedicationDTO[]);

    // The chart-data search behind this list is unsorted, so the formatter owns the ordering.
    expect(prompt.indexOf('Newer')).toBeLessThan(prompt.indexOf('Older'));
    expect(prompt.indexOf('Older')).toBeLessThan(prompt.indexOf('Undated'));
  });

  it('keeps the most recently taken medications when the list exceeds the prompt limit', () => {
    // 22 confirmed meds, oldest first: an unsorted slice would keep exactly the wrong ones.
    const medications = Array.from({ length: 22 }, (_, index) => ({
      name: `Medication ${index}`,
      status: 'active',
      type: 'scheduled',
      intakeInfo: { date: `2026-01-${String(index + 1).padStart(2, '0')}T12:00:00.000Z` },
    })) as MedicationDTO[];

    const prompt = formatCurrentMedicationsForBillingPrompt(medications);

    // The count reports everything confirmed, not just what fit in the prompt.
    expect(prompt).toContain('Confirmed current medication count: 22');
    expect(prompt).toContain('Additional confirmed medications omitted: 2');
    expect(prompt).toContain('Medication: Medication 21 |');
    expect(prompt).toContain('Medication: Medication 2 |');
    // The two stalest entries are the ones dropped.
    expect(prompt).not.toContain('Medication: Medication 0 |');
    expect(prompt).not.toContain('Medication: Medication 1 |');
  });

  it('keeps the offset the chart recorded when formatting the last-taken date', () => {
    const prompt = formatCurrentMedicationsForBillingPrompt([
      {
        name: 'Evening dose',
        status: 'active',
        type: 'scheduled',
        intakeInfo: { date: '2026-02-01T22:30:00.000-05:00' },
      },
    ] as MedicationDTO[]);

    // The lambda clock is UTC, where this instant is already 2026-02-02T03:30Z. The chart recorded a
    // dose taken the evening of Feb 1, and that is the date the coding prompt must see.
    expect(prompt).toContain('Last taken: 2026-02-01');
  });

  it('omits the medication section entirely when nothing has been confirmed', () => {
    expect(formatCurrentMedicationsForBillingPrompt(undefined)).toBe('');
    expect(formatCurrentMedicationsForBillingPrompt([])).toBe('');
  });
});
