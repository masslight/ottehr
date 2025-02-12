import { captureException, isInitialized, setTag } from '@sentry/aws-serverless';
import { handleUnknownError } from 'utils';
import { getSecret, Secrets } from 'zambda-utils';

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
