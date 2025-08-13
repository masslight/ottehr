import { useMemo } from 'react';
import { useApiClients } from '../../hooks/useAppClients';
import { getOystehr_RCM_API } from '../data';

export const useOystehrAPIClient = (): ReturnType<typeof getOystehr_RCM_API> | null => {
  const { oystehrZambda } = useApiClients();

  const apiClient = useMemo(() => {
    if (oystehrZambda)
      return getOystehr_RCM_API(
        {
          getClaimsZambdaID: 'get-claims',
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
        },
        oystehrZambda
      );
    return null;
  }, [oystehrZambda]);

  return apiClient;
};
