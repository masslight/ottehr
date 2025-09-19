import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { useAppointmentData } from 'src/telemed';
import { getAbnormalVitals, GetVitalsResponseData } from 'utils';

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

export function useGetAbnormalVitals(): {
  values: GetVitalsResponseData;
  hasAny: boolean;
} {
  const {
    resources: { encounter },
  } = useAppointmentData();

  const { data: encounterVitals } = useGetVitals(encounter?.id);

  const values = useMemo(() => getAbnormalVitals(encounterVitals), [encounterVitals]);

  const hasAny = useMemo(() => {
    if (!values) return false;
    return Object.values(values).some((list) => Array.isArray(list) && list.length > 0);
  }, [values]);

  return {
    values: (values ?? {}) as GetVitalsResponseData,
    hasAny,
  };
}
