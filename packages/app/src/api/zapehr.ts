import { AppClient } from '@zapehr/sdk';
import { Encounter } from 'fhir/r4';
import { FormData } from '../store/types';

const ZAMBDA_API_URL = import.meta.env.VITE_PROJECT_API_ZAMBDA_URL;
const PROJECT_API_URL = import.meta.env.VITE_PROJECT_API_URL;

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

export interface zapEHRUser {
  email: string;
  id: string;
  name: string;
  profile: any;
}

interface UpdatePractitionerInput {
  data: FormData;
  practitionerId: string | undefined;
}

export async function createTelemedRoom(
  patientName: string,
  practitionerId: string,
  practitionerName: string
): Promise<ZambdaFunctionResponse['response']> {
  try {
    const CREATE_TELEMED_ROOM_ZAMBDA_ID = import.meta.env.VITE_CREATE_TELEMED_ROOM_ZAMBDA_ID;
    const responseBody = await callZambda({
      body: { patientName, practitionerId, practitionerName },
      zambdaId: CREATE_TELEMED_ROOM_ZAMBDA_ID,
    });

    const encounter: Encounter | undefined = responseBody.response?.encounter;

    return encounter;
  } catch (error) {
    console.error('Error fetching encounter:', error);
    return { error: 10_001 };
  }
}

export async function getSlugAvailability(
  slug: string | undefined,
  email: string | undefined
): Promise<ZambdaFunctionResponse> {
  try {
    const GET_SLUG_AVAILABILITY_ZAMBDA_ID = import.meta.env.VITE_GET_SLUG_AVAILABILITY_ZAMBDA_ID;
    const responseBody = await callZambda({
      body: { email, slug },
      zambdaId: GET_SLUG_AVAILABILITY_ZAMBDA_ID,
    });
    return responseBody;
  } catch (error) {
    console.error('Error checking availability:', error);
    return { error: 10_001 };
  }
}

export async function getPatientQueue(
  providerId: string,
  accessToken: string
): Promise<ZambdaFunctionResponse['response']> {
  try {
    const GET_PATIENT_QUEUE_ZAMBDA_ID = import.meta.env.VITE_GET_PATIENT_QUEUE_ZAMBDA_ID;
    const responseBody = await callZambda({
      accessToken,
      body: { providerId },
      zambdaId: GET_PATIENT_QUEUE_ZAMBDA_ID,
    });
    console.log('responseBody', responseBody.response);
    return responseBody.response;
  } catch (error) {
    console.error('Error checking availability:', error);
    return { error: 10_001 };
  }
}

export async function getProviderTelemedToken(encounterId: string, accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${PROJECT_API_URL}/telemed/token?encounterId=${encounterId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-zapehr-project-id': import.meta.env.VITE_PROJECT_ID,
      },
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('responseData', responseData);
    const twilioToken = responseData.token;
    return twilioToken;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
  }
}

export async function getTelemedToken(encounterId: string): Promise<string | null> {
  try {
    const GET_TELEMED_TOKEN_ZAMBDA_ID = import.meta.env.VITE_GET_TELEMED_TOKEN_ZAMBDA_ID;

    const responseBody = await callZambda({
      body: { encounterId },
      zambdaId: GET_TELEMED_TOKEN_ZAMBDA_ID,
    });

    const token = responseBody.response?.token;
    return token;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
  }
}

export async function getProvider(slug: string | undefined): Promise<ZambdaFunctionResponse> {
  try {
    const GET_PROVIDER_ZAMBDA_ID = import.meta.env.VITE_GET_PROVIDER_ZAMBDA_ID;

    const responseBody = await callZambda({
      body: { slug },
      zambdaId: GET_PROVIDER_ZAMBDA_ID,
    });

    return responseBody;
  } catch (error) {
    console.error('Error fetching provider info:', error);
    return { error: 10_001 };
  }
}

export async function updateProvider(input: UpdatePractitionerInput): Promise<void> {
  try {
    const UPDATE_PRACTITIONER_ZAMBDA_ID = import.meta.env.VITE_UPDATE_PRACTITIONER_ZAMBDA_ID;
    const responseBody = await callZambda({
      body: input,
      zambdaId: UPDATE_PRACTITIONER_ZAMBDA_ID,
    });
    const success = responseBody.response?.success;

    // TO DO: Manage error handling better #UX-Improvements
    if (success) {
      console.log('Profile updated successuflly');
    } else {
      console.log('Could not update provider');
    }
  } catch (error) {
    console.error('Error updating practitioner:', error);
  }
}

export async function getUser(token: string): Promise<zapEHRUser> {
  const appClient = new AppClient({
    accessToken: token,
    apiUrl: PROJECT_API_URL,
  });
  return appClient.getMe();
}

// Zambda call wrapper
interface ZambdaFunctionResponse {
  error?: number;
  response?: Record<string, any>;
}
interface ZambdaResponseWithOutput {
  output: ZambdaFunctionResponse;
}
interface CallZambdaProps {
  accessToken?: string;
  body: object;
  zambdaId: string;
}
async function callZambda({ accessToken, body, zambdaId }: CallZambdaProps): Promise<ZambdaFunctionResponse> {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${ZAMBDA_API_URL}/zambda/${zambdaId}/execute${accessToken == null ? '-public' : ''}`, {
    body: JSON.stringify(body),
    headers:
      accessToken != null
        ? {
            ...headers,
            // Putting the ternary here annoys TS
            Authorization: `Bearer ${accessToken}`,
          }
        : headers,
    method: 'POST',
  });
  const json = await response.json();
  return chooseJson(json, import.meta.env.DEV);
}

function chooseJson(json: ZambdaFunctionResponse | ZambdaResponseWithOutput, isLocal: boolean): ZambdaFunctionResponse {
  if (isLocal) {
    return json as ZambdaFunctionResponse;
  } else {
    return (json as ZambdaResponseWithOutput).output;
  }
}
