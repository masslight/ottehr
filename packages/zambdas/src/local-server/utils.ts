import { APIGatewayProxyEventHeaders, APIGatewayProxyResult, Callback, Context, Handler } from 'aws-lambda';
import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { IncomingHttpHeaders } from 'http2';
import _ from 'lodash';
import { resolve } from 'path';
import { ZambdaInput } from 'zambda-utils';

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
    } catch (_) {
      body = handlerResponse.body;
    }
    res.send(body);
  } else {
    throw 'Unexpectedly have no response from handler';
  }
};

// Setup env vars for express
const configString = readFileSync(resolve(__dirname, '../../.env/local.json'), {
  encoding: 'utf8',
});
const secrets = configString.length > 2 ? JSON.parse(configString) : null;

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
