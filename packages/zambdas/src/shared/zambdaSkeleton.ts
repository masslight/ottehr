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

    const output = {
      error,
      response,
    };
    console.log(`Output: ${JSON.stringify(output)}`);

    return {
      body: JSON.stringify(output),
      statusCode: 200,
    };
  } catch (e: any) {
    console.groupEnd();
    console.error(`\n${functionName.name} failure!\n`);
    console.error(JSON.stringify(e));
    return {
      body: JSON.stringify({
        error: 'Internal Service Error',
      }),
      statusCode: 500,
    };
  }
};
