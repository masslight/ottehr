import { describe, expect, it } from 'vitest';
import { buildBillingSuggestionInput } from '../../src/features/visits/shared/hooks/useBillingSuggestions';

describe('buildBillingSuggestionInput', () => {
  it('includes patient id and current-visit prescribed medications with renewal status', () => {
    const input = buildBillingSuggestionInput({
      chartData: {
        observations: [],
        diagnosis: [],
        cptCodes: [],
        procedures: [],
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

    expect(input?.patientId).toBe('patient-1');
    expect(input?.prescribedMedications).toEqual([
      expect.objectContaining({ name: 'Amoxicillin', isRenewal: false }),
      expect.objectContaining({ name: 'Lisinopril', isRenewal: true }),
    ]);
  });
});
