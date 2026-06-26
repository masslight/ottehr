import { MedicationRequest } from 'fhir/r4b';
import { FHIR_EXTENSION, MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM, PrescribedMedicationDTO } from 'utils';
import { describe, expect, it } from 'vitest';
import {
  formatErxMedicationHistoryForBillingPrompt,
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

  it('formats unexpired eRx medication history as complexity context', () => {
    const prompt = formatErxMedicationHistoryForBillingPrompt([
      {
        id: 1,
        medicationId: 1001,
        ndc: null,
        rxcui: null,
        name: 'Metformin',
        route: 'Oral',
        doseForm: 'Tablet',
        strength: '500 MG',
        dispenseUnit: 'Tablet',
        isBrandName: false,
        genericName: 'metformin',
        isOtc: false,
        refills: '3',
        daysSupply: 30,
        quantity: 60,
        classification: 'Antidiabetic',
        schedule: null,
        directions: 'Take twice daily.',
        substitutionsAllowed: true,
        writtenDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        lastFillDate: '2026-02-01',
        expirationDate: '2099-01-01',
      },
      {
        id: 2,
        medicationId: 1002,
        ndc: null,
        rxcui: null,
        name: 'Expired Medication',
        route: null,
        doseForm: null,
        strength: null,
        dispenseUnit: null,
        isBrandName: false,
        genericName: null,
        isOtc: false,
        refills: '0',
        daysSupply: null,
        quantity: 1,
        classification: null,
        schedule: null,
        directions: null,
        substitutionsAllowed: true,
        writtenDate: '2020-01-01',
        effectiveDate: '2020-01-01',
        lastFillDate: null,
        expirationDate: '2020-02-01',
      },
    ]);

    expect(prompt).toContain('Available eRx medication history count: 1');
    expect(prompt).toContain('Medication: Metformin 500 MG Tablet');
    expect(prompt).toContain('Refills allowed: 3');
    expect(prompt).not.toContain('Expired Medication');
  });
});
