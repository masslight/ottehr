import { useChartData } from 'src/features/visits/shared/hooks/useChartData';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useMainEncounterChartData } from 'src/features/visits/shared/hooks/useMainEncounterChartData';
import { ImmunizationOrderDetails } from 'utils/lib/types/data/immunization/types';

export type ImmunizationDiagnosisOption = NonNullable<ImmunizationOrderDetails['associatedDx']>;

/** The visit's charted diagnoses an immunization can be associated with; on a follow-up, the main visit's. */
export const useImmunizationDiagnosisOptions = (): ImmunizationDiagnosisOption[] => {
  const { chartData } = useChartData();
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';
  const { data: mainEncounterChartData } = useMainEncounterChartData(isFollowup);
  const diagnosis = isFollowup ? mainEncounterChartData?.diagnosis : chartData?.diagnosis;
  return (diagnosis ?? [])
    .filter((dx) => dx.resourceId)
    .map((dx) => ({ resourceId: dx.resourceId!, display: `${dx.code} - ${dx.display}` }));
};
