import { init, isInitialized, setTag, setTags, wrapHandler as sentryWrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';
import { parseCommaSeparatedTags } from 'utils/lib/helpers/parseCommaSeparatedTags';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { topLevelCatch } from './lambda';
import { truncateForLog } from './logging';
import { ZambdaInput } from './types/common';

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
  setTags(parseCommaSeparatedTags(secrets?.SENTRY_TAGS));
}

/**
 * The single, central log of an endpoint's input. Individual zambdas must not log the input again.
 *
 * Only the request body is logged: headers carry caller credentials and `input.secrets` is the
 * secrets bag, neither of which belongs in CloudWatch.
 */
function logInputBody(body: string | null): void {
  console.log(`Input body: ${body ? truncateForLog(body) : '<empty>'}`);
}

export function wrapHandler(
  zambdaName: string,
  handler: (input: ZambdaInput) => Promise<APIGatewayProxyResult>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return sentryWrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    configSentry(zambdaName, input.secrets);
    logInputBody(input.body);
    try {
      return await handler(input);
    } catch (error) {
      console.error(`Error in handler for ${zambdaName}:`, error);
      return topLevelCatch(zambdaName, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
    }
  });
}
