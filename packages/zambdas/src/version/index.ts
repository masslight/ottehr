import { APIGatewayProxyResult } from 'aws-lambda';
import { DefaultErrorMessages, ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getVersion);
};

const getVersion = (_: ZambdaFunctionInput): ZambdaFunctionResponse => {
  // Manual, should be either `process.env.npm_package_version` or `process.env.AWS_LAMBDA_FUNCTION_VERSION`
  const version = '0.0.1';
  if (version == null) {
    return {
      error: `${DefaultErrorMessages.validation}: "version" environment variable missing.`,
    };
  }
  return {
    response: {
      version,
    },
  };
};
