import { APIGatewayProxyEventHeaders, APIGatewayProxyResult, Callback, Context, Handler } from 'aws-lambda';
import { Options } from 'execa';
import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { IncomingHttpHeaders } from 'http2';
import _ from 'lodash';
import { resolve } from 'path';
import ottehrSpec from '../../../../config/oystehr/ottehr-spec.json';
import { Schema } from '../../../spec/src/schema';
import { REF_REGEX, Schema20250925 } from '../../../spec/src/schema-20250925';
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

const secrets: Record<string, string> = {};

async function populateSecrets(): Promise<void> {
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

  const schema = new Schema20250925(
    [{ path: '../../../../config/oystehr/ottehr-spec.json', spec: ottehrSpec }],
    envFileContents,
    '',
    ''
  );

  const takenFromSpec = new Set<string>();
  await Promise.all(
    Object.entries(ottehrSpec.secrets).map(async ([_key, secret]): Promise<void> => {
      secrets[secret.name] = await replaceSecretValue(secret, schema, useIac);
      takenFromSpec.add(secret.name);
    })
  );

  // TODO: improve the injection of these secrets.
  // This adds any additional secrets that are in the env file but not in the oystehr spec, as long
  // as they are among the known sendgrid secrets generated via terraform.
  // this is a fast and dirty solution that is good enough for right now. it requires the sg secret keys and values
  // to be manually copied into the secrets repo (what a pain!). A better solution would be to fetch all the secrets written to Oystehr dynamically
  // and inject them here, which would more closely resemble the behavior of a deployed system and provider one source of truth for
  // all secrets implied by the source code at any given time.
  const sgSecretKeys = new Set([
    'SENDGRID_ERROR_REPORT_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_RECEIPT_TEMPLATE_ID',
    'SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID',
    'SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID',
    'SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID',
    'SENDGRID_TELEMED_INVITATION_TEMPLATE_ID',
    'SENDGRID_SEND_EMAIL_API_KEY',
  ]);
  Object.entries(envFileContents).forEach(([key, value]) => {
    if (!takenFromSpec.has(key) && sgSecretKeys.has(key) && typeof value === 'string') {
      secrets[key] = value;
    }
  });
}

export async function replaceSecretValue<T>(
  secret: { name: string; value: string; legacyValue?: string },
  schema: Schema<T>,
  useIac?: string
): Promise<string> {
  const { $ } = await import('execa');
  let result = schema.replaceVariableWithValue(secret.value);
  const refMatches = [...result.matchAll(REF_REGEX)];
  if (refMatches.length) {
    console.log(`Found ${refMatches.length} terraform references in secret ${secret.name}`);
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
        ottehrSpec as T,
        resourceType as keyof T,
        resourceName,
        fieldName
      );
      if (tfRef) {
        console.log(`Resolving terraform reference for ${fullMatch}: ${tfRef}`);
        const tfOutputName = schema.getTerraformResourceOutputName(fullMatch, 'oystehr');
        const opts: Options = {
          cwd: resolve(__dirname, '../../../../deploy'),
          input: `nonsensitive(${tfOutputName})`,
        };
        const tfConsoleRead = await $(opts)`terraform console`;
        console.log(`Terraform console read for ${fullMatch}: ${tfConsoleRead.stdout}`);
        const tfValue = tfConsoleRead.stdout;
        // console value will either be the actual value or 'tostring(null)'
        if (tfValue && typeof tfValue === 'string' && tfValue !== 'tostring(null)') {
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
    console.log('Populating secrets');
    await populateSecrets();
    console.log('Populated secrets' /*, JSON.stringify(secrets)*/);
  }
  return {
    body: !_.isEmpty(req.body) ? req.body : null,
    headers: singleValueHeaders(req.headers),
    secrets,
  };
}
