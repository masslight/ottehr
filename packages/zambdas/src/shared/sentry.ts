import {
  captureMessage,
  continueTrace,
  flush,
  init,
  isInitialized,
  setContext,
  setTag,
  setTags,
  startSpan,
  withIsolationScope,
  withScope,
} from '@sentry/node-core/light';
import { APIGatewayProxyResult, Context, Handler } from 'aws-lambda';
import { parseCommaSeparatedTags } from 'utils/lib/helpers/parseCommaSeparatedTags';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { topLevelCatch } from './lambda';
import { truncateForLog } from './logging';
import { ZambdaInput } from './types/common';

// How long an invocation waits for Sentry to send its events before returning. Lambda freezes the
// process once the handler returns, so anything still queued would be lost.
export const SENTRY_FLUSH_TIMEOUT_MS = 2000;

// How long before the Lambda deadline to report a possible timeout. A timed-out invocation is
// killed without ever reaching the handler's catch block, so this warning is the only trace of it.
export const TIMEOUT_WARNING_LEAD_MS = 500;

export function configSentry(zambdaName: string, secrets: Secrets | null): void {
  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  if (!isInitialized()) {
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

/** The Lambda runtime's context, as opposed to the empty object the local server passes. */
function isLambdaContext(context: Context | undefined): context is Context {
  return typeof context?.getRemainingTimeInMillis === 'function';
}

/** Attaches the invocation's Lambda details to every event it reports. */
function setLambdaContext(context: Context): void {
  setContext('aws.lambda', {
    aws_request_id: context.awsRequestId,
    function_name: context.functionName,
    function_version: context.functionVersion,
    invoked_function_arn: context.invokedFunctionArn,
    remaining_time_in_millis: context.getRemainingTimeInMillis(),
  });
  setContext('aws.cloudwatch.logs', {
    log_group: context.logGroupName,
    log_stream: context.logStreamName,
  });
}

function scheduleTimeoutWarning(context: Context): ReturnType<typeof setTimeout> {
  const remainingMs = context.getRemainingTimeInMillis();
  const seconds = Math.ceil(remainingMs / 1000);
  const timeout = seconds >= 60 ? `${Math.floor(seconds / 60)}m${seconds % 60}s` : `${seconds}s`;
  return setTimeout(() => {
    withScope((scope) => {
      scope.setTag('timeout', timeout);
      captureMessage(`Possible function timeout: ${context.functionName}`, 'warning');
    });
  }, remainingMs - TIMEOUT_WARNING_LEAD_MS);
}

/**
 * Wraps a zambda's handler with its logging, error handling and Sentry reporting.
 *
 * Each invocation gets its own Sentry isolation scope, so a warm container doesn't carry one
 * request's context or breadcrumbs into the next, and is recorded as a transaction that continues
 * the caller's trace. Queued events are flushed before the invocation returns.
 */
export function wrapHandler(
  zambdaName: string,
  handler: (input: ZambdaInput) => Promise<APIGatewayProxyResult>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return async (input: ZambdaInput, context?: Context): Promise<APIGatewayProxyResult> => {
    // Respond as soon as the handler settles instead of waiting for open sockets and timers to drain.
    if (context) context.callbackWaitsForEmptyEventLoop = false;
    configSentry(zambdaName, input.secrets);
    logInputBody(input.body);

    return withIsolationScope(async () => {
      let timeoutWarning: ReturnType<typeof setTimeout> | undefined;
      if (isLambdaContext(context)) {
        setLambdaContext(context);
        timeoutWarning = scheduleTimeoutWarning(context);
      }

      try {
        const traceHeaders = { sentryTrace: input.headers?.['sentry-trace'], baggage: input.headers?.baggage };
        return await continueTrace(traceHeaders, () =>
          startSpan(
            {
              name: isLambdaContext(context) ? context.functionName : zambdaName,
              op: 'function.aws.lambda',
            },
            async () => {
              try {
                return await handler(input);
              } catch (error) {
                console.error(`Error in handler for ${zambdaName}:`, error);
                return topLevelCatch(zambdaName, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
              }
            }
          )
        );
      } finally {
        clearTimeout(timeoutWarning);
        await flush(SENTRY_FLUSH_TIMEOUT_MS).catch((error) => console.warn('Could not flush Sentry events:', error));
      }
    });
  };
}
