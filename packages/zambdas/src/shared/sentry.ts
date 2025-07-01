import { init, isInitialized, setTag, wrapHandler as sentryWrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';
import { getSecret, Secrets, SecretsKeys } from 'utils';
import { ZambdaInput } from './types';

export function configSentry(zambdaName: string, secrets: Secrets | null): void {
  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  if (isInitialized()) {
    console.log('Sentry is all ready initialized');
  } else {
    console.log('Initializing sentry now');
    init({
      environment: environment,
      dsn: secrets?.SENTRY_DSN,
      tracesSampleRate: 1.0,
      beforeSend(event) {
        const environment = event.tags?.environment?.toString();
        // https://github.com/getsentry/sentry-javascript/issues/13391#issuecomment-2359832269
        // filter out events from local
        if (!environment || ['local'].includes(environment)) {
          return null;
        }
        // update transaction name
        event.transaction = `[${environment}]-${event.tags?.zambda?.toString()}`;
        return event;
      },
    });
  }

  setTag('zambda', zambdaName);
  setTag('environment', environment);
}

export function wrapHandler(
  zambdaName: string,
  handler: (input: ZambdaInput) => Promise<APIGatewayProxyResult>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return sentryWrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    configSentry(zambdaName, input.secrets);
    return handler(input);
  });
}
