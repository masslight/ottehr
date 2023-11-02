import { ZambdaClient } from '@zapehr/sdk';
import { apiErrorToThrow } from './apiErrorToThrow';

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}
import { Encounter } from 'fhir/r4';
const CHECK_IN_ZAMBDA_ID = import.meta.env.VITE_CHECK_IN_ZAMBDA_ID;
const GET_APPOINTMENTS_ZAMBDA_ID = import.meta.env.VITE_GET_APPOINTMENTS_ZAMBDA_ID;
const GET_PATIENTS_ZAMBDA_ID = import.meta.env.VITE_GET_PATIENTS_ZAMBDA_ID;
// const TELEMED_API_URL = import.meta.env.VITE_TELEMED_API_URL;
const TELEMED_API_URL = 'http://localhost:3301/local/zambda';

class API {
  async checkIn(zambdaClient: ZambdaClient, appointmentId: string): Promise<any> {
    try {
      if (CHECK_IN_ZAMBDA_ID == null) {
        throw new Error('check in environment variable could not be loaded');
      }
      const response = await zambdaClient?.invokePublicZambda({
        payload: { appointment: appointmentId },
        zambdaId: CHECK_IN_ZAMBDA_ID,
      });
      return response;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async getPatients(zambdaClient: ZambdaClient): Promise<any> {
    try {
      if (GET_PATIENTS_ZAMBDA_ID == null) {
        throw new Error('get patients environment variable could not be loaded');
      }

      const response = await zambdaClient?.invokeZambda({
        zambdaId: GET_PATIENTS_ZAMBDA_ID,
      });
      return response;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async getAppointments(zambdaClient: ZambdaClient): Promise<any> {
    try {
      if (GET_APPOINTMENTS_ZAMBDA_ID == null) {
        throw new Error('get appointments environment variable could not be loaded');
      }

      const response = await zambdaClient?.invokeZambda({
        zambdaId: GET_APPOINTMENTS_ZAMBDA_ID,
      });
      return response;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async createZ3Object(url: string, file: File, token: string): Promise<any> {
    try {
      // Create the Z3 object
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to create object');
      }
      const json = await response.json();
      const presignedUrl = json.signedUrl;

      // Upload the file to S3
      const uploadResponse = await fetch(presignedUrl, {
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        method: 'PUT',
      });

      // console.log('res: ', uploadResponse);
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      return uploadResponse.ok;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }

  async getZ3Object(url: string, token: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'GET',
      });

      const json = await response.json();
      const signedUrl = json.signedUrl;
      return signedUrl;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
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
      // for development, we can use the local express server to generate a token
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
