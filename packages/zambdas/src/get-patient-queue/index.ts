/* eslint-disable @typescript-eslint/no-unused-vars */

import { APIGatewayProxyResult } from 'aws-lambda';
import {
  createRoomEncounter,
  SecretsKeys,
  getAuth0Token,
  getM2MUserProfile,
  getSecret,
  createFhirClient,
} from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import fetch from 'node-fetch';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getPatientQueue);
};

interface getPatientQueueInput {
  providerProfile?: string;
}

const getPatientQueue = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const PROVIDER_PROFILE = 'Practitioner/dad0ff7e-1c5b-40d5-845b-3ae679de95cd';
  const { body, secrets } = input;
  console.log('body', body);
  const { providerProfile } = body as getPatientQueueInput;

  const fhirClient = await createFhirClient(secrets);

  // TODO: add time range to search params like, check if need timezone
  // {
  //   name: 'date',
  //   value: `ge${searchDateWithTimezone.startOf('day')}`,
  // },
  // {
  //   name: 'date',
  //   value: `le${searchDateWithTimezone.endOf('day')}`,
  // },
  const encountersSearchResults = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'practitioner',
        value: PROVIDER_PROFILE,
      },
      {
        name: 'status',
        value: 'arrived',
      },
    ],
  });

  console.log('responseData', encountersSearchResults);
  return {
    response: {
      // encounter: encounterData,
      encountersSearchResults,
    },
  };
};
