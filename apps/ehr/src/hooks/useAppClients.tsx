import Oystehr from '@oystehr/sdk';
import { useEffect } from 'react';
import { getSelectors } from 'utils';
import { create } from 'zustand';
import { useAuthToken } from './useAuthToken';

interface ApiClientsState {
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
    if (!oystehr || oystehr.config.accessToken !== token) {
      useApiClientsStore.setState({
        oystehr: new Oystehr({
          accessToken: token,
          fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
          projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
          projectId: import.meta.env.VITE_APP_PROJECT_ID,
        }),
      });
    }
  }, [oystehr, token]);

  useEffect(() => {
    if (!oystehrZambda || oystehrZambda.config.accessToken !== token) {
      const zambdaConfig: ConstructorParameters<typeof Oystehr>[0] = {
        accessToken: token,
        fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
        projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
        projectId: import.meta.env.VITE_APP_PROJECT_ID,
        retry: {
          retries: 0,
        },
      };
      if (import.meta.env.VITE_APP_IS_LOCAL === 'true') {
        zambdaConfig.services = {
          zambdaApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
        } as typeof zambdaConfig.services;
      }
      useApiClientsStore.setState({
        oystehrZambda: new Oystehr(zambdaConfig),
      });
    }
  }, [oystehrZambda, token]);

  return { oystehr, oystehrZambda };
}
