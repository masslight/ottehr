import { DateTime } from 'luxon';
import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { MedicationWithTypeDTO } from '../../in-person/hooks/useMedicationHistory';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { useOystehrAPIClient } from './useOystehrAPIClient';

interface UsePrintChartDataOutput {
  openPdf: (url: string) => Promise<void>;
  generateMedicationHistoryPdf: (medicationHistory: MedicationWithTypeDTO[]) => Promise<string | undefined>;
}

/**
 * For use printing individual sections of the progress note as needed
 * @param param0
 * @returns
 */
export const usePrintChartData = ({
  appointmentId,
}: {
  appointmentId?: string;
} = {}): UsePrintChartDataOutput => {
  const apiClient = useOystehrAPIClient();
  const { id: appointmentIdFromUrl } = useParams();
  const { appointment, encounter, patient, location } = useAppointmentData(appointmentId || appointmentIdFromUrl);

  const openPdf = React.useCallback(async (url: string): Promise<void> => {
    window.open(url, '_blank');
  }, []);

  const generateMedicationHistoryPdf = useCallback(
    async (medicationHistory: MedicationWithTypeDTO[]): Promise<string | undefined> => {
      if (!apiClient || !appointment || !encounter || !patient || !medicationHistory) return undefined;

      const userTimezone = DateTime.local().zoneName;

      const result = await apiClient.makeMedicationHistoryPdf({
        appointment,
        encounter,
        patient,
        medicationHistory,
        location,
        timezone: userTimezone,
      });

      if (!result) {
        console.warn('Pdf info for medication history was undefined');
        return undefined;
      }

      return result.presignedURL;
    },
    [apiClient, patient, appointment, encounter, location]
  );

  return {
    openPdf,
    generateMedicationHistoryPdf,
  };
};
