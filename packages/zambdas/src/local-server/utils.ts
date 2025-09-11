import { APIGatewayProxyEventHeaders, APIGatewayProxyResult, Callback, Context, Handler } from 'aws-lambda';
import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { IncomingHttpHeaders } from 'http2';
import _ from 'lodash';
import { resolve } from 'path';
import ottehrSpec from '../../../../config/oystehr/ottehr-spec.json';
import { ZambdaInput } from '../shared';

export const expressLambda = async (
  handler: Handler<any, APIGatewayProxyResult>,
  req: Request,
  res: Response
): Promise<void> => {
  const lambdaInput = buildLambdaInput(req);
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

console.log('pathToEnvFile', pathToEnvFile);

// Setup env vars for express
// env file path to be specified from the root of the zambdas package.
const configString = readFileSync(resolve(__dirname, `../../${pathToEnvFile}`), {
  encoding: 'utf8',
});
const envFileContents = configString.length > 2 ? JSON.parse(configString) : null;

const secrets: Record<string, string> = {};
const takenFromSpec = new Set<string>();
// todo: this limits secrets to only those that are listed in the oystehr spec, but we'll need secrets generated via
// sg and potentially other cloud providers as well.
Object.entries(ottehrSpec.secrets).forEach(([_key, secret]) => {
  const secretMatch = secret.value.match(/#\{var\/([^}]*)\}/);
  if (secretMatch) {
    const varName = secretMatch[1];
    const secretValue = envFileContents[varName];
    if (secretValue == null) {
      throw new Error(`Secret ${secret.name} was not found in the env file.`);
    }
    secrets[secret.name] = envFileContents[varName];
    takenFromSpec.add(secret.name);
  } else {
    secrets[secret.name] = secret.value;
  }
});
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

const singleValueHeaders = (input: IncomingHttpHeaders): APIGatewayProxyEventHeaders => {
  const headers = _.flow([
    Object.entries,
    (arr) => arr.filter(([, value]: [string, any]) => !Array.isArray(value)),
    Object.fromEntries,
  ])(input);
  return headers;
};

export const buildLambdaInput = (req: Request): ZambdaInput => {
  console.log('build lambda body,', JSON.stringify(req.body));
  return {
    body: !_.isEmpty(req.body) ? req.body : null,
    headers: singleValueHeaders(req.headers),
    secrets,
  };
};
