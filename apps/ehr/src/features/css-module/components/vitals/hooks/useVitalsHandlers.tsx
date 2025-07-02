import { useMemo } from 'react';
import { VitalsObservationDTO } from 'utils';
import { useChartData } from '../../../hooks/useChartData';
import { UseVitalsHandlers } from '../types';
import { useDeleteVitals } from './useDeleteVitals';
import { useSaveVitals } from './useSaveVitals';

export const useVitalsHandlers: UseVitalsHandlers = ({ encounterId, searchConfig }) => {
  const { chartData, isLoading } = useChartData({
    encounterId,
    requestedFields: { [searchConfig.fieldName]: searchConfig.searchParams },
  });

  const resultVitalsDTOs: VitalsObservationDTO[] = useMemo(() => {
    const chartDataVitalsDTOs: VitalsObservationDTO[] = (chartData?.[searchConfig.fieldName] ??
      []) as VitalsObservationDTO[];
    const practitioners = chartData?.practitioners ?? [];

    return chartDataVitalsDTOs.map((vitalDTO) => {
      const practitionerId = vitalDTO.authorId;
      const practitioner = practitioners.find((practitioner) => practitioner.id === practitionerId);

      const practitionerNameComponents = practitioner?.name?.at(0);
      const givenName = practitionerNameComponents?.given?.at(0) ?? '';
      const familyName = practitionerNameComponents?.family ?? '';
      const practitionerFullName = `${familyName} ${givenName}`.trim();

      return { ...vitalDTO, authorName: practitionerFullName };
    });
  }, [chartData, searchConfig.fieldName]);

  const handleSave = useSaveVitals({ encounterId, searchConfig });
  const handleDelete = useDeleteVitals({ encounterId, searchConfig });

  return {
    vitalsEntities: resultVitalsDTOs,
    isLoading,
    handleSave,
    handleDelete,
  };
};
