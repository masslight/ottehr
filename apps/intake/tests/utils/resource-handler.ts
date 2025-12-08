import Oystehr from '@oystehr/sdk';
import { getAuth0Token } from './auth/getAuth0Token';

export class ResourceHandler {
  private apiClient!: Oystehr;
  private authToken!: string;

  public static async getOystehr(): Promise<Oystehr> {
    const authToken = await getAuth0Token();
    const oystehr = new Oystehr({
      accessToken: authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
    });
    return oystehr;
  }

  async initApi(): Promise<void> {
    this.authToken = await getAuth0Token();
    this.apiClient = new Oystehr({
      accessToken: this.authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
  }
}
