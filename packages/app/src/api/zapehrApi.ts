import { apiErrorToThrow } from './apiErrorToThrow';
import { ZambdaClient } from '@zapehr/sdk';

export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

const CHECK_IN_ZAMBDA_ID = process.env.REACT_APP_CHECK_IN_ZAMBDA_ID;
const GET_PATIENTS_ZAMBDA_ID = process.env.REACT_APP_GET_PATIENTS_ZAMBDA_ID;
const GET_APPOINTMENTS_ZAMBDA_ID = process.env.REACT_APP_GET_APPOINTMENTS_ZAMBDA_ID;

class API {
  async checkIn(zambdaClient: ZambdaClient, appointmentId: string): Promise<any> {
    try {
      if (CHECK_IN_ZAMBDA_ID == null) {
        throw new Error('check in environment variable could not be loaded');
      }
      const response = await zambdaClient?.invokePublicZambda({
        zambdaId: CHECK_IN_ZAMBDA_ID,
        payload: { appointment: appointmentId },
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
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create object');
      }
      const json = await response.json();
      const presignedUrl = json.signedUrl;

      // Upload the file to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
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
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();
      const signedUrl = json.signedUrl;
      return signedUrl;
    } catch (error: unknown) {
      throw apiErrorToThrow(error);
    }
  }
}

const api = new API();

export default api;
