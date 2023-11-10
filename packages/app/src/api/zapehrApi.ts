export interface ZapehrSearchParameter {
  key: string;
  value: string;
}
import { Encounter } from 'fhir/r4';
// TODO: add env
const TELEMED_API_URL = import.meta.env.VITE_LOCAL_TELEMED_API_URL;
// const TELEMED_API_URL = 'http://localhost:3301/local/zambda';

class API {
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
      console.log('responseBody', responseBody);
      const encounter: Encounter | undefined = responseBody.response.encounter;

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
        body: JSON.stringify({ encounterId }),
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
