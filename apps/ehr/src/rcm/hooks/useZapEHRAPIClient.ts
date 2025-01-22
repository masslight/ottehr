import { useMemo } from 'react';
import { useApiClients } from '../../hooks/useAppClients';
import { getZapEHR_RCM_API } from '../data';

export const useZapEHRAPIClient = (): ReturnType<typeof getZapEHR_RCM_API> | null => {
  const { oystehrZambda } = useApiClients();

  const apiClient = useMemo(() => {
    if (oystehrZambda)
      return getZapEHR_RCM_API(
        {
          getClaimsZambdaID: import.meta.env.VITE_APP_GET_CLAIMS_ZAMBDA_ID,
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
        },
        oystehrZambda
      );
    return null;
  }, [oystehrZambda]);

  return apiClient;
};
