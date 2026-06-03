import { Stack, Typography } from '@mui/material';
import React, { useCallback } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { MedicationDTO } from 'utils';
import { Loader } from '../../shared/components/Loader';
import { MedicalHistoryDoubleCard } from '../../shared/components/medical-history-tab';
import { CurrentMedicationsPatientColumn } from '../../shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsPatientColumn';
import { CurrentMedicationsProviderColumn } from '../../shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsProviderColumn';
import { ExternalMedicationSelection } from '../../shared/components/medical-history-tab/CurrentMedications/ExternalRxSuggestions';
import { PageTitle } from '../../shared/components/PageTitle';
import { useChartDataArrayValue } from '../../shared/hooks/useChartDataArrayValue';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { AskMedicationsAlert } from '../components/medications/AskMedicationsAlert';
import { MedicationsNotes } from '../components/medications/MedicationsNotes';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';
import { useMedicationHistory } from '../hooks/useMedicationHistory';
interface MedicationsProps {
  appointmentID?: string;
}

export const Medications: React.FC<MedicationsProps> = () => {
  const {
    resources: { appointment },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const { interactionMode } = useInPersonNavigationContext();

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

  if (isLoading || isChartDataLoading) return <Loader />;
  if (error?.message) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        dataTestId={dataTestIds.medicationsPage.title}
        label="Medications"
        showIntakeNotesButton={interactionMode === 'main'}
      />

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
