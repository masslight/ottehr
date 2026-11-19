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

  describe('new vs established patient', () => {
    const build = (
      chartData: Record<string, unknown>,
      appointment: Record<string, unknown> = {}
    ): boolean | undefined =>
      buildBillingSuggestionInput({
        chartData: { observations: [], ...chartData } as any,
        chartDataFields: {},
        radiologyOrders: undefined,
        appointment,
        patient: {},
      })?.newPatient;

    const staffSaid = (value: string): { field: string; value: string } => ({
      field: 'seen-in-last-three-years',
      value,
    });
    const patientSaid = (value: boolean): { field: string; value: boolean } => ({
      field: 'seen-in-last-3-years',
      value,
    });

    it('an earlier attended visit makes the patient established, whatever the answers', () => {
      expect(build({ patientHasPreviousVisits: true, observations: [staffSaid('no'), patientSaid(false)] })).toBe(
        false
      );
    });

    it("the intake staff answer wins over the patient's, whichever is listed first", () => {
      expect(build({ observations: [patientSaid(false), staffSaid('yes')] })).toBe(false);
      expect(build({ observations: [patientSaid(true), staffSaid('no')] })).toBe(true);
    });

    it("falls back to the patient's answer, including the booking form's returning-patient tag", () => {
      expect(build({ observations: [staffSaid('na'), patientSaid(true)] })).toBe(false);
      expect(
        build(
          {},
          {
            meta: {
              tag: [
                {
                  system: 'https://fhir.zapehr.com/r4/StructureDefinitions/patient-info-meta-data',
                  code: 'returning-patient',
                },
              ],
            },
          }
        )
      ).toBe(false);
      expect(build({})).toBe(true);
    });
  });
});
