import { FC, useCallback, useState } from 'react';
import { useMedicationHistory } from 'src/features/visits/in-person/hooks/useMedicationHistory';
import { MedicationDTO } from 'utils';
import { useChartDataArrayValue } from '../../../hooks/useChartDataArrayValue';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { CurrentMedicationsPatientColumn } from './CurrentMedicationsPatientColumn';
import { CurrentMedicationsProviderColumn } from './CurrentMedicationsProviderColumn';
import { ExternalMedicationSelection } from './ExternalRxSuggestions';

export const CurrentMedicationsCard: FC = () => {
  const [isMedicationsCollapsed, setIsMedicationsCollapsed] = useState(false);

  const { refetchHistory } = useMedicationHistory();

  const {
    isLoading,
    onSubmit,
    onRemove,
    values: medications,
  } = useChartDataArrayValue(
    'medications',
    undefined,
    {
      _sort: '-_lastUpdated',
      _include: 'MedicationStatement:source',
      status: { type: 'token', value: 'active' },
    },
    refetchHistory
  );

  const medicationData = { medications, isLoading, onRemove };

  const addMedicationToChart = useCallback(
    async (selection: ExternalMedicationSelection): Promise<boolean> => {
      const medName = selection.medication.name;
      const strength = selection.medication.strength;
      const nameAlreadyHasStrength = strength && medName.toLowerCase().includes(strength.toLowerCase());
      const displayName = nameAlreadyHasStrength || !strength ? medName : `${medName} (${strength})`;
      const doseIsRedundantWithStrength =
        selection.dose && strength && strength.toLowerCase() === selection.dose.toLowerCase();
      try {
        const success = await onSubmit({
          name: displayName,
          id: selection.medication.id?.toString(),
          type: selection.type ?? 'scheduled',
          intakeInfo: {
            dose: doseIsRedundantWithStrength ? undefined : (selection.dose ?? undefined),
            date: selection.date,
            patientCouldNotConfirmDosage: selection.patientCouldNotConfirmDosage || undefined,
          },
          status: 'active',
        } as MedicationDTO);
        if (success) {
          void refetchHistory();
        }
        return success;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [onSubmit, refetchHistory]
  );

  return (
    <MedicalHistoryDoubleCard
      label="Current medications"
      collapsed={isMedicationsCollapsed}
      onSwitch={() => setIsMedicationsCollapsed((state) => !state)}
      patientSide={<CurrentMedicationsPatientColumn />}
      providerSide={
        <CurrentMedicationsProviderColumn medicationData={medicationData} onAddMedication={addMedicationToChart} />
      }
    />
  );
};
