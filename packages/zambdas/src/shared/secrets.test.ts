import { Secrets } from '../types';
import { SecretsKeys, getSecret } from './secrets';

describe('secrets tests', () => {
  const mockSecret = 'Test Audience';
  const mockSecrets: Secrets = {
    [SecretsKeys.AUTH0_AUDIENCE]: mockSecret,
  };

  test('getSecret parses secret successfully', () => {
    expect(getSecret(SecretsKeys.AUTH0_AUDIENCE, mockSecrets)).toBe(mockSecret);
  });
});
