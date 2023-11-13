import { AppClient } from '@zapehr/sdk';
import { Encounter } from 'fhir/r4';

const PROJECT_API_URL = import.meta.env.VITE_PROJECT_API_URL;

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

export interface zapEHRUser {
  email: string;
  name: string;
}

export async function createTelemedRoom(): Promise<Encounter | null> {
  try {
    const response = await fetch(`${PROJECT_API_URL}/telemed-room/execute-public`, {
      body: JSON.stringify({ testBody: 'test' }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const responseBody = await response.json();
    const encounter: Encounter | undefined = responseBody.version?.encounter;

    if (!encounter) {
      console.error('Encounter is missing in the response');
      return null;
    }

    return encounter;
  } catch (error) {
    console.error('Error fetching encounter:', error);
    return null;
  }
}

export async function getSlugAvailability(slug: string, oldSlug?: string): Promise<ZambdaFunctionResponse['output']> {
  try {
    const GET_SLUG_AVAILABILITY_ZAMBDA_ID = import.meta.env.VITE_GET_SLUG_AVAILABILITY_ZAMBDA_ID;
    const responseBody = await callZambda({
      body: { oldSlug, slug },
      zambdaId: GET_SLUG_AVAILABILITY_ZAMBDA_ID,
    });
    return responseBody.output;
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
    const response = await fetch(`${PROJECT_API_URL}/telemed-token/execute-public`, {
      body: JSON.stringify({ body: { encounterId } }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const responseBody = await response.json();
    console.log('responseBody', responseBody);
    const token = responseBody.response.token;

    if (!token) {
      console.error('Token is missing in the response');
      return null;
    }
    return token;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
  }
}

export async function getTwilioToken(roomName: string): Promise<string | null> {
  try {
    // For development, we can use the local express server to generate a token
    const response = await fetch('http://localhost:5000/join-room', {
      body: JSON.stringify({ roomName }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const { token } = await response.json();
    return token;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
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

export interface ZambdaFunctionResponse {
  output: {
    error?: number;
    response?: Record<string, any>;
  };
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

  const response = await fetch(`${PROJECT_API_URL}/zambda/${zambdaId}/execute${accessToken == null ? '-public' : ''}`, {
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
  return await response.json();
}
