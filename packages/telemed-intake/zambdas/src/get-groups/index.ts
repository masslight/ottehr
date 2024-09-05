import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, ZambdaInput, createFhirClient } from 'ottehr-utils';
import { getM2MClientToken } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { HealthcareService } from 'fhir/r4';
import { SearchParam } from '@zapehr/sdk';

export interface GetGroupsInput {
  secrets: Secrets | null;
}

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getM2MClientToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken);

    console.log('getting active locations');

    const getGroups = async (): Promise<HealthcareService[]> => {
      console.log('getting groups');
      try {
        const searchParams: SearchParam[] = [{ name: 'active', value: 'true' }];
        const availableGroups: any[] = await fhirClient?.searchResources({
          resourceType: 'HealthcareService',
          searchParams: searchParams,
        });
        return availableGroups;
      } catch (error) {
        console.error('Failed to fetch groups:', error);
        return [];
      }
    };

    const groups = await getGroups();

    console.log('groups', groups);

    return {
      statusCode: 200,
      body: JSON.stringify(groups),
    };
  } catch (error: any) {
    console.log(error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
