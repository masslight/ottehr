import { removePrefix } from 'utils/lib/helpers/helpers';
import { AllChartValuesKeys, MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useChartSection } from '../../shared/hooks/useChartSection';

export type MedicationHistoryField = Extract<AllChartValuesKeys, 'medications' | 'inhouseMedications'>;

export const MEDICATION_HISTORY_FIELDS: MedicationHistoryField[] = ['medications', 'inhouseMedications'];
export const COLLAPSED_MEDS_COUNT = 3;

export interface MedicationWithTypeDTO extends MedicationDTO {
  chartDataField: MedicationHistoryField;
}

/**
 * The patient's medication history: current, prescribed and in-house medication statements across all of
 * their encounters, newest first. All of it is the history section, whose cache entry the other medication
 * screens share.
 */
export const useMedicationHistory = ({
  chartDataFields = MEDICATION_HISTORY_FIELDS,
}: {
  chartDataFields?: MedicationHistoryField[];
} = {}): {
  isLoading: boolean;
  medicationHistory: MedicationWithTypeDTO[];
  refetchHistory: () => Promise<unknown>;
} => {
  const { isLoading, data: history, refetch: refetchHistory } = useChartSection('history');

  // The section resolves MedicationStatement.informationSource to the Practitioners it references; the
  // history shows who recorded each medication, so swap the reference for the resolved Practitioner.
  const practitioners = history?.practitioners ?? [];
  const withPractitioner = (medication: MedicationDTO): MedicationDTO => {
    const reference =
      medication.practitioner && 'reference' in medication.practitioner ? medication.practitioner.reference : undefined;
    if (!reference) return medication;
    const practitioner = practitioners.find((candidate) => candidate.id === removePrefix('Practitioner/', reference));
    return practitioner ? { ...medication, practitioner } : medication;
  };

  const combinedMedicationHistory: MedicationWithTypeDTO[] = chartDataFields
    .flatMap((field) =>
      (history?.[field] ?? []).map((medication) => ({ ...withPractitioner(medication), chartDataField: field }))
    )
    .sort((a, b) => {
      const FALLBACK_DATE = 0; // move elements without date to the end of the list
      const dateA = a?.intakeInfo.date ? new Date(a.intakeInfo.date) : FALLBACK_DATE;
      const dateB = b?.intakeInfo.date ? new Date(b.intakeInfo.date) : FALLBACK_DATE;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  return {
    isLoading,
    medicationHistory: combinedMedicationHistory,
    refetchHistory,
  };
};
