import { Encounter } from 'fhir/r4';

const PROJECT_API_URL = import.meta.env.VITE_PROJECT_API_URL;
const TELEMED_API_URL = import.meta.env.VITE_TELEMED_API_URL;

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

export async function createTelemedRoom(): Promise<Encounter | null> {
  try {
    const response = await fetch(`${TELEMED_API_URL}/telemed-room/execute-public`, {
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
    const responseBody = await callZambda(GET_SLUG_AVAILABILITY_ZAMBDA_ID, 'open', { oldSlug, slug });
    return responseBody.output;
  } catch (error) {
    console.error('Error checking availability:', error);
    return { error: 10_001 };
  }
}

export async function getTelemedToken(encounterId: string): Promise<string | null> {
  try {
    const response = await fetch(`${TELEMED_API_URL}/telemed-token/execute-public`, {
      body: JSON.stringify({ body: { encounterId } }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const responseBody = await response.json();
    const token = responseBody.version?.token;

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

// Zambda call wrapper

export interface ZambdaFunctionResponse {
  output: {
    error?: number;
    response?: Record<string, any>;
  };
}
async function callZambda(zambdaId: string, auth: 'auth' | 'open', body: object): Promise<ZambdaFunctionResponse> {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${PROJECT_API_URL}/zambda/${zambdaId}/execute${auth === 'open' ? '-public' : ''}`, {
    body: JSON.stringify(body),
    headers: auth
      ? {
          ...headers,
          // Putting the ternary here annoys TS
          // TODO get token
          Authorization: `Bearer ${'token'}`,
        }
      : headers,
    method: 'POST',
  });
  return await response.json();
}
