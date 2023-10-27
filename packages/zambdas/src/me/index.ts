import { ZambdaInput } from '../types';
import { APIGatewayProxyResult } from 'aws-lambda';
import jwt from 'jsonwebtoken';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const userDetails: string[] = [];
    const token = input.headers.Authorization.split(' ')[1];
    // Validate the Auth0 token and fetch user details

    const validateToken = (token: string): boolean => {
      try {
        const secretKey = 'secret-key'; //to do find the secret key
        jwt.verify(token, secretKey);
        return true;
      } catch (error) {
        console.error('Token validation failed:', error);
        return false;
      }
    };

    validateToken(token);

    if (!userDetails) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(userDetails),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
