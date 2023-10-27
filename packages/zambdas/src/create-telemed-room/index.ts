/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { CREATE_ROOM_VALID_ENCOUNTER, createEncounter, createFhirClient, getAuth0Token } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';
import fetch from 'node-fetch';
import { Encounter } from 'fhir/r4';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  // hardcoded for testing
  const PROJECT_ID = '4564eab4-c85f-48e6-97a9-1382c39f07c4';
  const M2M_ID = '92a80a55-0ceb-480b-8113-ca2a24627526';
  const PATIENT_ID = '12bf5b37-e0b8-42e0-8dcf-dc8c4aefc000';
  const PROVIDER_PROFILE = 'Practitioner/ded0ff7e-1c5b-40d5-845b-3ae679de95cd';

  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { body, secrets } = validatedParameters;
    console.log('body', body);
    console.groupEnd();

    const token = await getAuth0Token(secrets);
    console.log('token', token);

    const m2mUserProfile = await getM2MUserProfile(token, PROJECT_ID, M2M_ID);

    const encounter = CREATE_ROOM_VALID_ENCOUNTER(PROVIDER_PROFILE, m2mUserProfile);
    console.log('encounter', encounter);

    const response = await fetch('https://testing.project-api.zapehr.com/v1/telemed/room', {
      body: JSON.stringify(encounter),
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-zapehr-project-id': PROJECT_ID,
      },
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    const responseData = await response.json();

    return {
      body: JSON.stringify({
        version: responseData,
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log('error', error);
    return {
      body: JSON.stringify({
        error: error.message,
      }),
      statusCode: 500,
    };
  }
};

async function getM2MUserProfile(token: string, projectId: string, M2MId: string): Promise<any> {
  try {
    const url = `https://testing.project-api.zapehr.com/v1/m2m/${M2MId}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-zapehr-project-id': projectId,
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch M2M user details: ${response.statusText}`);
    }

    const data = await response.json();
    const profile = data.profile;

    if (!profile) {
      throw new Error('Profile value not found in the returned data');
    }

    return profile;
  } catch (error: any) {
    console.error('Error fetching M2M user details:', error);
    throw error;
  }
}
