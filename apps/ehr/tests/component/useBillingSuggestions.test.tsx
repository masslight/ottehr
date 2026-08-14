import { describe, expect, it } from 'vitest';
import { buildBillingSuggestionInput } from '../../src/features/visits/shared/hooks/useBillingSuggestions';

describe('buildBillingSuggestionInput', () => {
  it('includes the confirmed medication list and current-visit prescriptions with renewal status', () => {
    const input = buildBillingSuggestionInput({
      chartData: {
        observations: [],
        diagnosis: [],
        cptCodes: [],
        procedures: [],
        medications: [
          {
            resourceId: 'medication-statement-1',
            name: 'Metformin (500 mg)',
            status: 'active',
            type: 'scheduled',
            intakeInfo: { dose: '500 mg' },
          },
        ],
      } as any,
      chartDataFields: {
        chiefComplaint: { text: 'Cough' },
        medicalDecision: { text: 'Prescription sent.' },
        prescribedMedications: [
          {
            resourceId: 'med-request-1',
            name: 'Amoxicillin',
            status: 'active',
            instructions: 'Take twice daily.',
            isRenewal: false,
          },
          {
            resourceId: 'med-request-2',
            name: 'Lisinopril',
            status: 'active',
            instructions: 'Take daily.',
            isRenewal: true,
          },
        ],
      },
      radiologyOrders: undefined,
      appointment: {},
      patient: {
        id: 'patient-1',
        birthDate: '2000-01-01',
        gender: 'female',
      },
    });

    expect(input?.prescribedMedications).toEqual([
      expect.objectContaining({ name: 'Amoxicillin', isRenewal: false }),
      expect.objectContaining({ name: 'Lisinopril', isRenewal: true }),
    ]);
    // the confirmed medication list travels with the request so the zambda never has to query
    // DoseSpot medication history itself
    expect(input?.currentMedications).toEqual([expect.objectContaining({ name: 'Metformin (500 mg)' })]);
  });
});
