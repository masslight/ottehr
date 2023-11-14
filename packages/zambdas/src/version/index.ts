import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorCodes, ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getVersion);
};

const getVersion = (_: ZambdaFunctionInput): ZambdaFunctionResponse => {
  // Manual, should be either `process.env.npm_package_version` or `process.env.AWS_LAMBDA_FUNCTION_VERSION`
  const version = '0.0.2';
  if (version == null) {
    console.error('"version" environment variable missing.');
    return {
      error: ErrorCodes.unexpected,
    };
  }
  return {
    response: {
      version,
    },
  };
};
