import { APIGatewayProxyResult } from 'aws-lambda';
import { availability, createFhirClient } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ErrorCodes, ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { Operation } from 'fast-json-patch';
import { FormData } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, performUpdate);
};

interface UpdatePractitionerInput {
  data: FormData;
  practitionerId: string;
}

const performUpdate = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  const { practitionerId, data } = body as UpdatePractitionerInput;

  if (!practitionerId || typeof practitionerId !== 'string') {
    console.error('Invalid practitionerId');
    return { error: ErrorCodes.missingRequired };
  }

  if (!data || typeof data !== 'object') {
    console.error('Invalid data');
    return { error: ErrorCodes.missingRequired };
  }

  const patchOperations: Operation[] = [
    {
      op: data.slug ? 'replace' : 'add',
      path: '/identifier/0/value',
      value: data.slug,
    },
    {
      op: data.firstName ? 'replace' : 'add',
      path: '/name/0/given/0',
      value: data.firstName,
    },
    {
      op: data.lastName ? 'replace' : 'add',
      path: '/name/0/family',
      value: data.lastName,
    },
    {
      op: data.title ? 'replace' : 'add',
      path: '/name/0/prefix/0',
      value: data.title,
    },
  ];

  const fhirClient = await createFhirClient(secrets);

  const available = await availability(data.slug, fhirClient);

  if (available) {
    try {
      const updatedPractitioner = await fhirClient.patchResource({
        operations: patchOperations,
        resourceId: practitionerId,
        resourceType: 'Practitioner',
      });

      return {
        response: {
          success: true,
          updatedPractitioner,
        },
      };
    } catch (error) {
      console.error('Error updating practitioner:', error);
      return {
        response: {
          success: false,
        },
      };
    }
  } else {
    return { error: ErrorCodes.duplicate };
  }
};
