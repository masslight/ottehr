import { APIGatewayProxyResult } from 'aws-lambda';
import { DefaultErrorMessages, ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, version);
};

const version = (_: ZambdaFunctionInput): ZambdaFunctionResponse => {
  if (version == null || typeof version !== 'string') {
    return {
      error: `${DefaultErrorMessages.validation}: "version" must be a string.`,
    };
  }
  return {
    response: {
      version: process.env.version,
    },
  };
};
