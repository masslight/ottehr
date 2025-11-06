import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  getAbnormalVitals,
  GetVitalsForListOfEncountersRequestPayload,
  GetVitalsForListOfEncountersResponseData,
  GetVitalsResponseData,
} from 'utils';
import { useAppointmentData } from '../../../stores/appointment/appointment.store';

export const useGetVitals = (encounterId: string | undefined): UseQueryResult<GetVitalsResponseData, Error> => {
  const { oystehrZambda } = useApiClients();
  const queryKey = encounterId ? [`current-encounter-vitals-${encounterId}`] : [];
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (oystehrZambda && encounterId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-vitals',
          encounterId,
          mode: 'current',
        });
        // todo: make this strictly typed once there is a common api file defining endpoints available
        return result.output as GetVitalsResponseData;
      }

      throw new Error('api client not defined or encounter id is not provided');
    },
    enabled: Boolean(encounterId) && Boolean(oystehrZambda),
  });
};

export const useGetHistoricalVitals = (
  encounterId: string | undefined
): UseQueryResult<GetVitalsResponseData, Error> => {
  const { oystehrZambda } = useApiClients();
  const queryKey = encounterId ? [`historical-encounter-vitals-${encounterId}`] : [];
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (oystehrZambda && encounterId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-vitals',
          encounterId,
          mode: 'historical',
        });
        // todo: make this strictly typed once there is a common api file defining endpoints available
        return result.output as GetVitalsResponseData;
      }

      throw new Error('api client not defined or encounter id is not provided');
    },
    enabled: Boolean(encounterId) && Boolean(oystehrZambda),
  });
};

export function useGetAbnormalVitals(): GetVitalsResponseData | undefined {
  const {
    resources: { encounter },
  } = useAppointmentData();

  const { data: encounterVitals } = useGetVitals(encounter?.id);

  return useMemo(() => {
    if (!encounterVitals) return undefined;
    return getAbnormalVitals(encounterVitals);
  }, [encounterVitals]);
}

export function useGetVitalsForEncounters(
  params: GetVitalsForListOfEncountersRequestPayload
): UseQueryResult<GetVitalsForListOfEncountersResponseData> {
  const { oystehrZambda } = useApiClients();
  const queryKey = params.encounterIds ? [`encounters-list-vitals-${params.encounterIds.join(',')}`] : [];
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (oystehrZambda && params.encounterIds) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-vitals-for-list-of-encounters',
          ...params,
        });
        // todo: make this strictly typed once there is a common api file defining endpoints available
        const vitalsForEncounters = result.output as GetVitalsForListOfEncountersResponseData;
        return Object.fromEntries(
          Object.entries(vitalsForEncounters).filter(([_, vitals]) => {
            const abnormalVitals = getAbnormalVitals(vitals);
            return abnormalVitals && Object.keys(abnormalVitals).length > 0;
          })
        );
      }

      throw new Error('api client not defined or encounter id is not provided');
    },
    enabled: Boolean(params.encounterIds && params.encounterIds.length > 0) && Boolean(oystehrZambda),
    staleTime: 0,
  });
}
