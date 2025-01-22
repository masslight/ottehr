import Oystehr from '@oystehr/sdk';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthToken } from './useAuthToken';

interface ApiClientsState {
  oystehr?: Oystehr;
  oystehrZambda?: Oystehr;
  oystehrZambdaIntake?: Oystehr;
}

const useApiClientsStore = create<ApiClientsState>()(() => ({
  oystehr: undefined,
  oystehrZambda: undefined,
  oystehrZambdaIntake: undefined,
}));

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useApiClients() {
  const token = useAuthToken();
  const { oystehr, oystehrZambda, oystehrZambdaIntake } = useApiClientsStore((state) => state);
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
      useApiClientsStore.setState({
        oystehrZambda: new Oystehr({
          accessToken: token,
          fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
          projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
          projectId: import.meta.env.VITE_APP_PROJECT_ID,
        }),
      });
    }
  }, [oystehrZambda, token]);

  useEffect(() => {
    if (!oystehrZambdaIntake || oystehrZambdaIntake.config.accessToken !== token) {
      useApiClientsStore.setState({
        oystehrZambdaIntake: new Oystehr({
          accessToken: token,
          fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
          projectApiUrl: import.meta.env.VITE_APP_INTAKE_ZAMBDAS_URL,
          projectId: import.meta.env.VITE_APP_PROJECT_ID,
        }),
      });
    }
  }, [oystehrZambdaIntake, token]);

  return { oystehr, oystehrZambda, oystehrZambdaIntake };
}
