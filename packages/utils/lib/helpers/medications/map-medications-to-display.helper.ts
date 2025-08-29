import { Medication, PrescribedMedication } from '../../../../zambdas/src/shared/pdf/types';
import { MedicationDTO, PrescribedMedicationDTO } from '../../types';
import { formatDateTimeToZone } from '../../utils';

export const mapMedicationsToDisplay = (medications: MedicationDTO[], timezone?: string): Medication[] => {
  return medications.map((med) => {
    const { name, intakeInfo } = med;
    const date = formatDateTimeToZone(intakeInfo?.date, timezone ?? 'America/New_York');
    const dose = intakeInfo?.dose;

    return {
      name,
      dose,
      date,
    };
  });
};

export const mapErxMedicationsToDisplay = (
  medications: PrescribedMedicationDTO[],
  timezone?: string
): PrescribedMedication[] => {
  return medications.map((med) => {
    const { name, added, instructions } = med;
    const date = formatDateTimeToZone(added, timezone ?? 'America/New_York');

    return {
      name,
      instructions,
      date,
    };
  });
};
