import { captureException, isInitialized, setTag } from '@sentry/aws-serverless';
import { getSecret, handleUnknownError, Secrets } from 'utils';

export function configSentry(zambdaName: string, secrets: Secrets | null): void {
  const environment = getSecret('ENVIRONMENT', secrets);
  console.log('Sentry initialized: ', isInitialized());
  setTag('zambda', zambdaName);
  setTag('environment', environment);
}

export function captureSentryException(error: any): void {
  const errorToThrow = handleUnknownError(error);
  captureException(errorToThrow);
}
