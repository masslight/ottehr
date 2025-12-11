import Oystehr from '@oystehr/sdk';
import { getAuth0Token } from './auth/getAuth0Token';

export class ResourceHandler {
  #apiClient!: Oystehr;
  private authToken!: string;

  public get apiClient(): Oystehr {
    return this.#apiClient;
  }

  async initApi(): Promise<void> {
    this.authToken = await getAuth0Token();
    this.#apiClient = new Oystehr({
      accessToken: this.authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
  }
}
