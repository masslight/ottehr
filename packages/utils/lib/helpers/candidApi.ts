import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

export function createCandidApiClient(secrets: Secrets | null): CandidApiClient {
  const candidApiClient: CandidApiClient = new CandidApiClient({
    clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
    clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
    environment:
      getSecret(SecretsKeys.CANDID_ENV, secrets) === 'PROD'
        ? CandidApiEnvironment.Production
        : CandidApiEnvironment.Staging,
  });
  return candidApiClient;
}
