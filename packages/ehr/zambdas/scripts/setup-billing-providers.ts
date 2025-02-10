import fs from 'fs';
import { getAuth0Token } from '../src/shared';
import { createOystehrClient } from '../src/shared/helpers';
import { Location, Organization, Practitioner } from 'fhir/r4b';
import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { FHIR_IDENTIFIER_NPI, getNPI, getTaxID } from 'utils';
const writeProviders = async (envConfig: any, env: string): Promise<void> => {
  const token = await getAuth0Token(envConfig);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehrClient = createOystehrClient(token, envConfig);
  try {
    const folder = fs.readdirSync('../../utils/lib/deployed-resources/billing-provider');
    const newSecrets: any = {};
    const allResources: { envVarName: string; resource: Location | Practitioner | Organization }[] = [];
    const requests = await Promise.all(
      folder.flatMap(async (file) => {
        const providerData = JSON.parse(
          fs.readFileSync(`../../utils/lib/deployed-resources/billing-provider/${file}`, 'utf8')
        );
        const { resource, envVarName } = providerData;
        allResources.push(providerData);

        const billingResource = resource as Practitioner | Organization | Location;
        const npi = getNPI(billingResource);
        const taxId = getTaxID(billingResource);

        const existingResources = (
          await oystehrClient.fhir.search<Practitioner | Organization | Location>({
            resourceType: billingResource.resourceType,
            params: [
              {
                name: 'identifier',
                value: `${FHIR_IDENTIFIER_NPI}|${npi}`,
              },
              {
                name: 'identifier', // todo: use type-of: to specify further once supported
                value: `${taxId}`,
              },
            ],
          })
        ).unbundle();

        if (existingResources.length > 1) {
          throw new Error(
            `Found multiple existing resources. Please clean your fhir data so that only one matching resource matches the search critera (NPI = ${npi} and tax id = ${taxId})`
          );
        }
        const existingResource = existingResources[0];
        if (!existingResource) {
          const createRequest: BatchInputPostRequest<Practitioner | Organization | Location> = {
            method: 'POST',
            url: `/${billingResource.resourceType}`,
            resource: billingResource,
          };
          return createRequest;
        } else {
          newSecrets[envVarName] = `${existingResource.resourceType}/${existingResource.id}`;
          const updateRequest: BatchInputPutRequest<Practitioner | Organization | Location> = {
            method: 'PUT',
            url: `/${existingResource.resourceType}/${existingResource.id}`,
            resource: {
              ...billingResource,
              id: existingResource.id,
            },
          };
          return updateRequest;
        }
      })
    );
    const outcomes = await oystehrClient.fhir.transaction({ requests: requests.flatMap((r) => r) });
    const newResources = (outcomes.entry ?? [])
      .filter((oc) => oc.response?.outcome?.id === 'created')
      .map((oc) => oc.resource);
    console.log('outcomes', JSON.stringify(outcomes, null, 2), JSON.stringify(newResources, null, 2));

    newResources.forEach((resource) => {
      if (!resource) {
        return;
      }
      const match = allResources.find((res) => {
        if (res.resource.resourceType === resource.resourceType) {
          return getTaxID(res.resource) === getTaxID(resource) && getNPI(res.resource) === getNPI(resource);
        }
        return false;
      });
      if (match) {
        newSecrets[match.envVarName] = `${resource.resourceType}/${resource.id}`;
      }
    });

    const newLocalEnv = { ...envConfig, ...newSecrets };
    const envString = JSON.stringify(newLocalEnv, null, 2);
    fs.writeFileSync(`.env/${env}.json`, envString);

    for await (const entry of Object.entries(newSecrets)) {
      const [key, value] = entry;
      if (typeof value !== 'string') {
        throw 'A secret value was unexpectedly not a string.';
      }
      console.log(`Updating secret ${key}...`);
      await oystehrClient.secret.set({
        name: key,
        value: value,
      });
      console.log(`Create/update secret ${key} succeeded`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (e) {
    console.log('billing provider set up failed: ', e);
  }
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await writeProviders(envConfig, env);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
