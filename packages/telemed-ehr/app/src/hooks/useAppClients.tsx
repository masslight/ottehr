import { AppClient, ClientConfig, FhirClient, Z3Client, ZambdaClient } from '@zapehr/sdk';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthToken } from './useAuthToken';

interface ApiClientsState {
  appClient?: AppClient;
  zambdaClient?: ZambdaClient;
  zambdaIntakeClient?: ZambdaClient;
  fhirClient?: FhirClient;
  z3Client?: Z3Client;
}

const useApiClientsStore = create<ApiClientsState>()(() => ({
  appClient: undefined,
  zambdaClient: undefined,
  zambdaIntakeClient: undefined,
  fhirClient: undefined,
  z3Client: undefined,
}));

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useApiClients() {
  const token = useAuthToken();
  const { appClient, zambdaClient, zambdaIntakeClient, fhirClient, z3Client } = useApiClientsStore((state) => state);

  useEffect(() => {
    if (!appClient || (appClient as unknown as ClientConfig).accessToken !== token) {
      useApiClientsStore.setState({
        appClient: new AppClient({
          apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
          accessToken: token,
        }),
      });
    }
    if (!fhirClient || (fhirClient as unknown as ClientConfig).accessToken !== token) {
      useApiClientsStore.setState({
        fhirClient: new FhirClient({
          apiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
          accessToken: token,
        }),
      });
    }
    if (!zambdaClient || (zambdaClient as unknown as ClientConfig).accessToken !== token) {
      useApiClientsStore.setState({
        zambdaClient: new ZambdaClient({
          apiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
          accessToken: token,
        }),
      });
    }
    if (!zambdaIntakeClient || (zambdaIntakeClient as unknown as ClientConfig).accessToken !== token) {
      useApiClientsStore.setState({
        zambdaIntakeClient: new ZambdaClient({
          apiUrl: import.meta.env.VITE_APP_INTAKE_ZAMBDAS_URL,
          accessToken: token,
        }),
      });
    }
    if (!z3Client || (z3Client as unknown as ClientConfig).accessToken !== token) {
      useApiClientsStore.setState({
        z3Client: new Z3Client({
          apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
          accessToken: token,
        }),
      });
    }
  }, [appClient, fhirClient, token, z3Client, zambdaClient, zambdaIntakeClient]);

  return { appClient, zambdaClient, zambdaIntakeClient, fhirClient, z3Client };
}
