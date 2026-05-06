import Oystehr from '@oystehr/sdk';
import { useEffect } from 'react';
import { getSelectors } from 'utils';
import { create } from 'zustand';
import { useAuthToken } from './useAuthToken';

interface ApiClientsState {
  oystehrZambda?: Oystehr;
}

const useApiClientsStore = create<ApiClientsState>()(() => ({
  oystehrZambda: undefined,
}));

export function useApiClients(): ApiClientsState {
  const token = useAuthToken();
  const { oystehrZambda } = getSelectors(useApiClientsStore, ['oystehrZambda']);

  useEffect(() => {
    if (!oystehrZambda || oystehrZambda.config.accessToken !== token) {
      const config: ConstructorParameters<typeof Oystehr>[0] = {
        accessToken: token,
        projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
        projectId: import.meta.env.VITE_APP_PROJECT_ID,
      };
      if (import.meta.env.VITE_APP_IS_LOCAL === 'true') {
        config.services = {
          zambdaApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
        };
      }
      useApiClientsStore.setState({ oystehrZambda: new Oystehr(config) });
    }
  }, [oystehrZambda, token]);

  return { oystehrZambda };
}
