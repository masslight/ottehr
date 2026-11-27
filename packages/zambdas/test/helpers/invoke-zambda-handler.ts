import { APIGatewayProxyResult, Callback, Context, Handler } from 'aws-lambda';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { LOCAL_ZAMBDA_API_URL_ENV } from 'utils/lib/helpers/zambda-api-url-override';
import { Secrets } from 'utils/lib/secrets';
import { inject } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';

export interface InvokedZambdaResponse<TOutput> {
  statusCode: number;
  output: TOutput;
}

export const loadZambdaSecrets = (): Secrets =>
  JSON.parse(
    readFileSync(resolve(__dirname, `../../.env/zambda-secrets-${process.env.ENV || 'local'}.json`), 'utf8')
  ) as Secrets;

const parseBody = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

export const invokeZambdaHandler = async <TOutput = unknown>(
  handler: Handler<ZambdaInput, APIGatewayProxyResult>,
  body: unknown,
  { token, secrets = loadZambdaSecrets() }: { token?: string; secrets?: Secrets } = {}
): Promise<InvokedZambdaResponse<TOutput>> => {
  process.env[LOCAL_ZAMBDA_API_URL_ENV] ??= inject('EXECUTE_ZAMBDA_URL');
  const response = await handler(
    {
      body: body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      secrets,
    },
    {} as Context,
    undefined as unknown as Callback<APIGatewayProxyResult>
  );
  if (!response) throw new Error('Zambda handler returned no response');
  return { statusCode: response.statusCode, output: parseBody(response.body) as TOutput };
};
