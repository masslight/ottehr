import Oystehr, { FhirDeleteParams } from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import { getAuth0Token } from '../auth/getAuth0Token';

export abstract class ResourceHandlerAbstract {
  protected apiClient!: Oystehr;
  protected accessToken!: string;
  private createdResourcesDeleteParams: FhirDeleteParams<FhirResource>[] = [];

  protected async initApi(): Promise<void> {
    const accessToken = await getAuth0Token();
    this.accessToken = accessToken;
    this.apiClient = new Oystehr({
      accessToken: accessToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
  }

  protected async createResource(resource: FhirResource): Promise<FhirResource | undefined> {
    try {
      const created = await this.apiClient.fhir.create(resource);
      if (created.id) {
        console.log(`👏 ${resource['resourceType']} created`, created.id);
        this.createdResourcesDeleteParams.push({ id: created.id, resourceType: created['resourceType'] });
        return created;
      }
    } catch (error) {
      console.error(`❌ ${resource['resourceType']} not created`, error);
    }
    return undefined;
  }

  protected async deleteResource(fhirDeleteParams: FhirDeleteParams<FhirResource>): Promise<void> {
    try {
      await this.apiClient.fhir.delete(fhirDeleteParams);
      console.log(`✅ ${fhirDeleteParams.resourceType} deleted ${fhirDeleteParams.id}`);
    } catch (e) {
      console.error(`❌ ${fhirDeleteParams.resourceType} not deleted: ${e}`);
    }
  }

  abstract setResources(): Promise<void>;

  async cleanupResources(): Promise<void> {
    // todo rewrite this as batch request
    for (const argsToDelete of this.createdResourcesDeleteParams) {
      await this.deleteResource(argsToDelete);
    }
  }
}
