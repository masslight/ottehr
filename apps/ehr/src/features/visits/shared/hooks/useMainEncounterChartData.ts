import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { legacyChartDataFromVisitNote } from './legacyChartData';
import { useVisitNote } from './useVisitNote';

/** The chart of the encounter a follow-up hangs off, in the whole-chart shape its readers use for the diagnoses. */
export const useMainEncounterChartData = (
  enabled: boolean
): {
  data: GetChartDataResponse | null | undefined;
  isLoading: boolean;
} => {
  const { followUpOriginEncounter: mainEncounter } = useAppointmentData();
  const { data, isLoading } = useVisitNote({
    encounterId: mainEncounter?.id,
    enabled: enabled && !!mainEncounter?.id,
  });

  return {
    data: data ? legacyChartDataFromVisitNote(data) : undefined,
    isLoading,
  };
};
