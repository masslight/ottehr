import Oystehr from '@oystehr/sdk';
import { useEffect } from 'react';
import { getSelectors } from 'utils/lib/store';
import { create } from 'zustand';
import { useAuthToken } from './useAuthToken';

interface ApiClientsState {
  // Client for the Oystehr project/FHIR APIs (e.g. rcm payer endpoints).
  oystehr?: Oystehr;
  oystehrZambda?: Oystehr;
}

const useApiClientsStore = create<ApiClientsState>()(() => ({
  oystehr: undefined,
  oystehrZambda: undefined,
}));

export function useApiClients(): ApiClientsState {
  const token = useAuthToken();
  const { oystehr, oystehrZambda } = getSelectors(useApiClientsStore, ['oystehr', 'oystehrZambda']);

  useEffect(() => {
    if (!token) return;
    if (!oystehr || oystehr.config.accessToken !== token) {
      useApiClientsStore.setState({
        oystehr: new Oystehr({
          accessToken: token,
          fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
          projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
          projectId: import.meta.env.VITE_APP_PROJECT_ID,
          retry: { retries: 0 },
        }),
      });
    }
  }, [oystehr, token]);

  useEffect(() => {
    if (!token) return;
    if (!oystehrZambda || oystehrZambda.config.accessToken !== token) {
      const config: ConstructorParameters<typeof Oystehr>[0] = {
        accessToken: token,
        projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
        projectId: import.meta.env.VITE_APP_PROJECT_ID,
        retry: { retries: 0 },
      };
      if (import.meta.env.VITE_APP_IS_LOCAL === 'true') {
        config.services = {
          zambdaApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
        };
      }
      useApiClientsStore.setState({ oystehrZambda: new Oystehr(config) });
    }
  }, [oystehrZambda, token]);

  return { oystehr, oystehrZambda };
}
