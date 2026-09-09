import { Stack } from '@mui/material';
import { FC, useCallback } from 'react';
import { MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { CurrentMedicationsPatientColumn } from '../../../shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsPatientColumn';
import { CurrentMedicationsProviderColumn } from '../../../shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsProviderColumn';
import { ExternalMedicationSelection } from '../../../shared/components/medical-history-tab/CurrentMedications/ExternalRxSuggestions';
import { MedicalHistoryDoubleCard } from '../../../shared/components/medical-history-tab/MedicalHistoryDoubleCard';
import { useChartDataArrayValue } from '../../../shared/hooks/useChartDataArrayValue';
import { useMedicationHistory } from '../../hooks/useMedicationHistory';
import { MedicationHistoryList } from '../medication-administration/medication-history/MedicationHistoryList';
import { AskMedicationsAlert } from './AskMedicationsAlert';
import { MedicationsNotes } from './MedicationsNotes';

export const MedicationsBody: FC = () => {
  const { refetchHistory } = useMedicationHistory();

  const {
    isLoading: isMedicationsLoading,
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

  const addMedicationToChart = useCallback(
    async (selection: ExternalMedicationSelection): Promise<boolean> => {
      const medName = selection.medication.name;
      const strength = selection.medication.strength;
      const nameAlreadyHasStrength = strength && medName.toLowerCase().includes(strength.toLowerCase());
      const displayName = nameAlreadyHasStrength || !strength ? medName : `${medName} (${strength})`;
      const trimmedDose = selection.dose?.trim() || undefined;
      const doseIsRedundantWithStrength =
        trimmedDose && strength && strength.toLowerCase() === trimmedDose.toLowerCase();
      try {
        const success = await onSubmit({
          name: displayName,
          id: selection.medication.id?.toString(),
          type: selection.type ?? 'scheduled',
          intakeInfo: {
            dose: doseIsRedundantWithStrength ? undefined : trimmedDose,
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

  const medicationData = {
    medications,
    isLoading: isMedicationsLoading,
    onRemove,
  };

  return (
    <Stack spacing={1}>
      <AskMedicationsAlert />
      <MedicalHistoryDoubleCard
        patientSide={
          <CurrentMedicationsPatientColumn chartedMedications={medications} onSelectMedication={addMedicationToChart} />
        }
        providerSide={
          <CurrentMedicationsProviderColumn medicationData={medicationData} onAddMedication={addMedicationToChart} />
        }
      />
      <MedicationHistoryList />
      <MedicationsNotes />
    </Stack>
  );
};
