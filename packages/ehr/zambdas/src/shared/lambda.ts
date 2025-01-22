import { APIGatewayProxyResult } from 'aws-lambda';

export const lambdaResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
  const response = {
    statusCode,
    body: body ? JSON.stringify(body) : '',
  };
  console.log('Response:', response);
  return response;
};
