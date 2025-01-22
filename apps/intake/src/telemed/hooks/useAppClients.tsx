import Oystehr from '@oystehr/sdk';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthToken } from './useAuthToken';

interface ApiClientsState {
  oystehr?: Oystehr;
}

const useApiClientsStore = create<ApiClientsState>()(() => ({
  oystehr: undefined,
}));

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useApiClients() {
  const token = useAuthToken();
  const { oystehr } = useApiClientsStore((state) => state);

  useEffect(() => {
    if ((!oystehr || oystehr.config.accessToken !== token) && !!token) {
      useApiClientsStore.setState({
        oystehr: new Oystehr({
          accessToken: token,
          fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
        }),
      });
    }
  }, [oystehr, token]);

  return { oystehr };
}
