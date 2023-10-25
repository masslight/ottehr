import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const createZambdaFromSkeleton = async (
  input: ZambdaInput,
  functionName: (functionInput: ZambdaFunctionInput) => ZambdaFunctionResponse | Promise<ZambdaFunctionResponse>
): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);

  try {
    console.group(`Starting function ${functionName.name}`);
    const { error, response } = await functionName({
      body: JSON.parse(input.body ?? '{}'),
      secrets: input.secrets ?? {},
    });
    console.groupEnd();
    console.debug(`${functionName.name} success`);

    const body = {
      error,
      response,
    };
    return {
      body: JSON.stringify(body),
      statusCode: 200,
    };
  } catch (e: any) {
    console.groupEnd();
    console.error(`${functionName.name} failure`);
    console.error(JSON.stringify(e));
    return {
      body: JSON.stringify('Internal Service Error'),
      statusCode: 500,
    };
  }
};
