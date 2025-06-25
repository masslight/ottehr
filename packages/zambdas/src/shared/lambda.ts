import { APIGatewayProxyResult } from 'aws-lambda';
import { APIError, getSecret, isApiError, Secrets, SecretsKeys } from 'utils';
import { sendErrors } from './errors';

export const lambdaResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
  const response = {
    statusCode,
    body: body ? JSON.stringify(body) : '',
  };
  console.log('Response:', response);
  return response;
};

const handleErrorResult = (errorResult: unknown): APIGatewayProxyResult => {
  if (isApiError(errorResult)) {
    const { code, message } = errorResult as APIError;

    return {
      statusCode: 400, // we have 1 case currently so this is good enough for now
      body: JSON.stringify({ message, code }),
    };
  } else {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

export async function topLevelCatch(
  zambda: string,
  error: any,
  ENVIRONMENT: string,
  shouldCaptureException?: boolean
): Promise<APIGatewayProxyResult> {
  console.error(`Top level catch block in ${zambda}: \n ${error} \n Error stringified: ${JSON.stringify(error)}`);
  if (isApiError(error)) {
    console.error('Top level catch block returning silently');
  } else {
    await sendErrors(error, ENVIRONMENT, shouldCaptureException);
  }
  return handleErrorResult(error);
}

export const triggerSlackAlarm = async (message: string, secrets: Secrets | null): Promise<void> => {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  console.log('Sending error message to Slack');
  const url =
    ENVIRONMENT === 'production'
      ? 'https://hooks.slack.com/services/your_slack_webhook_url'
      : 'https://hooks.slack.com/services/your_slack_webhook_url';
  await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      text: message,
      link_names: true,
    }),
  });
};
