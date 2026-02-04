import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useMedicationHistory } from '../../in-person/hooks/useMedicationHistory';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { useOystehrAPIClient } from './useOystehrAPIClient';

/**
 * For use printing individual sections of the progress note as needed
 * @param param0
 * @returns
 */
export const usePrintChartData = ({
  appointmentId,
}: {
  appointmentId?: string;
} = {}): {
  printMedicationHistory: () => Promise<string | undefined>;
} => {
  const apiClient = useOystehrAPIClient();
  const { id: appointmentIdFromUrl } = useParams();
  const { appointment, encounter, patient } = useAppointmentData(appointmentId || appointmentIdFromUrl);
  const { medicationHistory } = useMedicationHistory();

  const printMedicationHistory = useCallback(async (): Promise<string | undefined> => {
    if (!apiClient || !appointment || !encounter || !patient || !medicationHistory) return undefined;
    const { medicationHistoryPdfUrl } = await apiClient.makeMedicationHistoryPdf({
      appointment,
      encounter,
      patient,
      medicationHistory,
    });
    console.log('>>> this is medicationHistory from hook', medicationHistory);
    console.log('>>> this is patient from hook', patient);
    return medicationHistoryPdfUrl;
  }, [apiClient, medicationHistory, patient, appointment, encounter]);

  return {
    printMedicationHistory,
  };
};
