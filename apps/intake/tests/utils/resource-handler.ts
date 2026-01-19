import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { getAuth0Token } from './auth/getAuth0Token';

export const PATIENT_REASON_FOR_VISIT = 'Fever';

export class ResourceHandler {
  #apiClient!: Oystehr;
  private authToken!: string;

  public get apiClient(): Oystehr {
    return this.#apiClient;
  }

  async initApi(): Promise<Oystehr> {
    this.authToken = await getAuth0Token();
    this.#apiClient = new Oystehr({
      accessToken: this.authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
    return this.#apiClient;
  }

  async findTestPatientResource(): Promise<Patient | null> {
    const oystehr = await this.apiClient;
    const patientSearchResults = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        {
          name: 'given',
          value: 'Katie',
        },
        {
          name: 'family',
          value: 'Patient',
        },
      ],
    });
    const patient = patientSearchResults.unbundle()[0] as Patient;
    return patient;
  }
}
