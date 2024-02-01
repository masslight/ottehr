import { AppClient, FhirClient, MessagingClient, ZambdaClient } from '@zapehr/sdk';
import { getAuth0Token, getSecret, SecretsKeys } from '.';
import { Secrets } from '../types';

export async function createAppClient(secrets: Secrets | null): Promise<AppClient> {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const accessToken = await getAuth0Token(secrets);
  try {
    console.group(`Fetch from ${PROJECT_API}`);
    const appClient = new AppClient({
      accessToken,
      apiUrl: PROJECT_API,
      projectId: PROJECT_ID,
    });
    console.groupEnd();
    console.debug(`Fetch from ${PROJECT_API} success`);
    return appClient;
  } catch (error) {
    console.groupEnd();
    console.error(`Fetch from ${PROJECT_API} failure`);
    throw new Error('Failed to create AppClient');
  }
}

export async function createFhirClient(secrets: Secrets | null): Promise<FhirClient> {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const accessToken = await getAuth0Token(secrets);
  try {
    console.group(`Fetch from ${FHIR_API}`);
    const fhirClient = new FhirClient({
      accessToken,
      apiUrl: FHIR_API,
      projectId: PROJECT_ID,
    });
    console.groupEnd();
    console.debug(`Fetch from ${FHIR_API} success`);
    return fhirClient;
  } catch (error) {
    console.groupEnd();
    console.error(`Fetch from ${FHIR_API} failure`);
    throw new Error('Failed to create FhirClient');
  }
}

export async function createMessagingClient(secrets: Secrets | null): Promise<MessagingClient> {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const accessToken = await getAuth0Token(secrets);
  try {
    console.group(`Fetch from ${PROJECT_API}`);
    const fhirClient = new MessagingClient({
      accessToken,
      apiUrl: PROJECT_API,
      projectId: PROJECT_ID,
    });
    console.groupEnd();
    console.debug(`Fetch from ${PROJECT_API} success`);
    return fhirClient;
  } catch (error) {
    console.groupEnd();
    console.error(`Fetch from ${PROJECT_API} failure`);
    throw new Error('Failed to create MessagingClient');
  }
}

export async function createZambdaClient(secrets: Secrets | null): Promise<ZambdaClient> {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const accessToken = await getAuth0Token(secrets);
  try {
    console.group(`Fetch from ${PROJECT_API}`);
    const fhirClient = new ZambdaClient({
      accessToken,
      apiUrl: PROJECT_API,
      projectId: PROJECT_ID,
    });
    console.groupEnd();
    console.debug(`Fetch from ${PROJECT_API} success`);
    return fhirClient;
  } catch (error) {
    console.groupEnd();
    console.error(`Fetch from ${PROJECT_API} failure`);
    throw new Error('Failed to create ZambdaClient');
  }
}
