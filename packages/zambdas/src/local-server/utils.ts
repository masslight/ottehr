import { APIGatewayProxyEventHeaders, APIGatewayProxyResult, Callback, Context, Handler } from 'aws-lambda';
import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { IncomingHttpHeaders } from 'http2';
import _ from 'lodash';
import { resolve } from 'path';
import ottehrSpec from '../../../../config/ottehr-spec.json';
import { REF_REGEX, Schema20250319, Spec20250319 } from '../../../spec/src/schema-20250319';
import { ZambdaInput } from '../shared';

export const expressLambda = async (
  handler: Handler<any, APIGatewayProxyResult>,
  req: Request,
  res: Response
): Promise<void> => {
  const lambdaInput = await buildLambdaInput(req);
  const handlerResponse = await handler(
    lambdaInput,
    {} as unknown as Context, // Zambdas don't use it
    undefined as unknown as Callback<APIGatewayProxyResult> // Zambdas don't use it
  );
  if (handlerResponse != null) {
    _.forOwn(handlerResponse.headers, (value, key) => {
      res.setHeader(key, value);
    });
    res.status(handlerResponse.statusCode);
    let body;
    try {
      body = JSON.parse(handlerResponse.body);
    } catch {
      body = handlerResponse.body;
    }

    res.send({
      status: handlerResponse.statusCode,
      output: body,
    });
  } else {
    throw 'Unexpectedly have no response from handler';
  }
};

function parseArgs(args: string[]): Record<string, string> {
  return args.reduce(
    (acc, arg) => {
      const [key, value] = arg.split('=');
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );
}

const cliParams = parseArgs(process.argv.slice(2));
const pathToEnvFile = cliParams['env'];
const useIac = cliParams['iac'];

console.log('pathToEnvFile', pathToEnvFile);
console.log('useIac', useIac);

// Setup env vars for express
// env file path to be specified from the root of the zambdas package.
const configString = readFileSync(resolve(__dirname, `../../${pathToEnvFile}`), {
  encoding: 'utf8',
});
const envFileContents = configString.length > 2 ? JSON.parse(configString) : null;

const secrets: Record<string, string> = {};
const schema = new Schema20250319(
  [{ path: '../../../../config/ottehr-spec.json', spec: ottehrSpec }],
  envFileContents,
  '',
  ''
);

async function populateSecrets(): Promise<void> {
  await Promise.all(
    Object.entries(ottehrSpec.secrets).map(async ([_key, secret]): Promise<void> => {
      secrets[secret.name] = await replaceSecretValue(secret, schema, useIac);
    })
  );
}

export async function replaceSecretValue(
  secret: { name: string; value: string; legacyValue?: string },
  schema: Schema20250319,
  useIac?: string
): Promise<string> {
  const { $ } = await import('execa');
  let result = schema.replaceVariableWithValue(secret.value);
  const refMatches = [...result.matchAll(REF_REGEX)];
  if (refMatches.length) {
    if (useIac !== 'true') {
      console.log(`Warning: not using IaC but reference found in secret ${secret.name}`);
      if ('legacyValue' in secret && secret.legacyValue != null) {
        const legacyValue = secret.legacyValue as string;
        console.log(`Using legacy value for secret ${secret.name}: ${legacyValue}`);
        result = schema.replaceVariableWithValue(legacyValue);
      } else {
        console.log(`Warning: no legacy value found for secret ${secret.name}`);
      }
      return result;
    }
    for (const match of refMatches) {
      const [fullMatch, resourceType, resourceName, fieldName] = match;
      const tfRef = schema.getTerraformResourceReference(
        ottehrSpec,
        resourceType as keyof Spec20250319,
        resourceName,
        fieldName
      );
      if (tfRef) {
        const tfConsoleRead = await $`echo 'nonsensitive(${tfRef})' | terraform -chdir=${resolve(
          __dirname,
          '../../../../deploy'
        )} console`;
        const tfValue = tfConsoleRead.stdout;
        // console value will either be the actual value or 'tostring(null)'
        if (tfValue !== 'tostring(null)') {
          result = result.replace(fullMatch, tfValue.slice(1, -1));
        }
      }
    }
  }
  return result;
}

const singleValueHeaders = (input: IncomingHttpHeaders): APIGatewayProxyEventHeaders => {
  const headers = _.flow([
    Object.entries,
    (arr) => arr.filter(([, value]: [string, any]) => !Array.isArray(value)),
    Object.fromEntries,
  ])(input);
  return headers;
};

async function buildLambdaInput(req: Request): Promise<ZambdaInput> {
  console.log('build lambda body,', JSON.stringify(req.body));
  if (!Object.keys(secrets).length) {
    console.log('populating secrets');
    await populateSecrets();
    console.log('populated secrets', JSON.stringify(secrets));
  }
  return {
    body: !_.isEmpty(req.body) ? req.body : null,
    headers: singleValueHeaders(req.headers),
    secrets,
  };
}
