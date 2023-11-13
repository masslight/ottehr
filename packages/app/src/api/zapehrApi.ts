export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

export interface zapEHRUser {
  email: string;
  name: string;
}
import { AppClient } from '@zapehr/sdk';
import { Encounter, Practitioner } from 'fhir/r4';
import { ProviderInfo } from '../store/types';

class API {
  async createTelemedRoom(): Promise<Encounter | null> {
    try {
      const response = await fetch(`${import.meta.env.VITE_PROJECT_API_URL}/telemed-room/execute-public`, {
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

  async getProviderTelemedToken(encounterId: string): Promise<string | null> {
    const token =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlRRc2xGbWlRX01ZTzg4Z3BRUnlvRCJ9.eyJodHRwczovL2FwaS56YXBlaHIuY29tL3Byb2plY3RfaWQiOiIyYmVhOWU5My1mZDY2LTQ1ZDUtOTA0YS01NjhmMWVlYmVmMzciLCJpc3MiOiJodHRwczovL2F1dGguemFwZWhyLmNvbS8iLCJzdWIiOiJhdXRoMHw2NTRkMzUxYTFlNjhmYTM3ZjhjZDQyN2MiLCJhdWQiOlsiaHR0cHM6Ly9hcGkuemFwZWhyLmNvbSIsImh0dHBzOi8vemFwZWhyLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE2OTk2MzM5MzAsImV4cCI6MTY5OTcyMDMzMCwiYXpwIjoiZFJXRklxR3cyTDJHOHRkTTZHdUJ0TnU5YXdzeFJWVjQiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIn0.Dbdld7YwQfyYPIrGmdPIkPQusmur1WVl1eqWupss8yYQk7jpvWH2_7CMatna6wsn1UIdHZiIDOL5WppBtPwL-KRSJouGA6pKrOOLESRsHWalJQ6itB4oquXxktw1QymBz5b18HIwhh9t8tdQKgVDPWCQKI78YdV0iNvj6cvCNyzQqEU3Ccs33sUYYZVkcdie-Z5RsEXde7mMlM5-UMUb3S_38vKH23V4k7i_tOipuik7qnCZ4xHIQBxDTEkkNvvNxDaQRJoOIg94WfAoOvWCQyzSonJwUNk93DB4HCAcXFvAyaKAOiHgPvDE1a04U6K2sZGnQ65CbSnoIWrGiC97kQ';
    try {
      const response = await fetch(`${import.meta.env.VITE_PROJECT_API_URL}/telemed/token?encounterId=${encounterId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
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

  async getTelemedToken(encounterId: string): Promise<string | null> {
    try {
      const response = await fetch(`${import.meta.env.VITE_PROJECT_API_URL}/telemed-token/execute-public`, {
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

  async getProvider(slug: string | undefined): Promise<ProviderInfo | null> {
    try {
      const response = await fetch(`${import.meta.env.VITE_PROJECT_API_URL}/get-provider/execute-public`, {
        body: JSON.stringify({ slug }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const responseBody = await response.json();
      console.log('responseBody', responseBody);
      const providerData = responseBody.response?.providerData;

      if (!providerData) {
        console.error('It appears that provider does not exist');
        return null;
      }

      return providerData;
    } catch (error) {
      console.error('Error fetching provider info:', error);
      return null;
    }
  }

  async getUser(token: string): Promise<zapEHRUser> {
    const appClient = new AppClient({
      accessToken: token,
      apiUrl: 'https://platform-api.zapehr.com/v1',
    });
    return appClient.getMe();
  }
}

export const zapehrApi = new API();
