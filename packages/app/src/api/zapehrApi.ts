export interface ZapehrSearchParameter {
  key: string;
  value: string;
}
import { Encounter } from 'fhir/r4';
// TODO: add env
// const TELEMED_API_URL = import.meta.env.VITE_TELEMED_API_URL;
const TELEMED_API_URL = 'http://localhost:3301/local/zambda';
const PROJECT_API_URL = import.meta.env.VITE_PROJECT_API_URL;

class API {
  async getSlugAvailabilityError(slug: string): Promise<string> {
    try {
      const GET_SLUG_AVAILABILITY_ZAMBDA_ID = import.meta.env.VITE_GET_SLUG_AVAILABILITY_ZAMBDA_ID;
      const responseBody = await callZambda(GET_SLUG_AVAILABILITY_ZAMBDA_ID, 'open', { slug });
      if (responseBody.output.error) {
        return responseBody.output.error;
      }
      const available = responseBody.output.response?.available as boolean;
      if (available) {
        return '';
      } else {
        return 'This slug is already taken, please use another one.';
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      return 'An unexpected error occurred. Please try again.';
    }
  }

  async createTelemedRoom(): Promise<Encounter | null> {
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

  async getTelemedToken(encounterId: string): Promise<string | null> {
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

  async getTwilioToken(roomName: string): Promise<string | null> {
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
}

export const zapehrApi = new API();

export interface ZambdaFunctionResponse {
  output: {
    error?: string;
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
          Authorization: `Bearer ${'token'}`,
        }
      : headers,
    method: 'POST',
  });
  return await response.json();
}
