/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyResult } from 'aws-lambda';
import fetch from 'node-fetch'; // Make sure to install this package if not already installed
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { getAuth0Token } from '../shared';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, postProviderProfile);
};

interface PostProviderProfileInput {
  checkboxes: boolean;
  email: string;
  firstName: string;
  lastName: string;
  slug: string;
  title: 'Mr' | 'Ms' | 'Mrs' | 'Dr' | 'Nurse' | 'Assistant';
}

const postProviderProfile = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  const { checkboxes, email, firstName, lastName, slug, title } = body as PostProviderProfileInput;

  const authToken = await getAuth0Token(secrets);

  const patientResource = {
    // active: true,
    // extension: [
    //   {
    //     url: 'https://fhir-api.zapehr.com/r4/Patient/identifier',
    //     valueBoolean: checkboxes,
    //   },
    // ],
    // id: slug,
    // identifier: [
    //   {
    //     use: 'official',
    //     value: slug,
    //   },
    // ],
    name: [
      {
        family: lastName,
        given: firstName,
        prefix: title,
        use: 'official',
      },
    ],
    resourceType: 'Patient',
    // telecom: [
    //   {
    //     system: 'email',
    //     value: email,
    //   },
    // ],
  };

  try {
    const response = await fetch(`https://fhir-api.zapehr.com/r4/Patient/242b0d4c-908b-4bc2-b08b-7e88ac2c3fcf`, {
      body: JSON.stringify([
        {
          op: 'replace',
          path: '/',
          value: patientResource,
        },
      ]),
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    });

    console.log('response', response);
    if (response.status === 201) {
      const responseData = await response.json();
      return {
        error: undefined,
        response: responseData,
      };
    } else {
      const errorData = await response.json();
      return {
        error: errorData,
        response: undefined,
      };
    }
  } catch (error: any) {
    return {
      error: error.message,
      response: undefined,
    };
  }
};
