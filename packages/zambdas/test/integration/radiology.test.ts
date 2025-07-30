import Oystehr from '@oystehr/sdk';
import { DomainResource, Encounter } from 'fhir/r4b';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput } from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { inject } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';

describe('radiology integration tests', () => {
  let oystehr: Oystehr;
  let token = null;
  let encounter: Encounter;
  const resourcesToCleanup: DomainResource[] = [];

  beforeAll(async () => {
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

    encounter = await oystehr.fhir.create<Encounter>({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: `Patient/${uuidV4()}` },
    });
    resourcesToCleanup.push(encounter);
    expect(encounter).toBeDefined();
  });

  afterAll(async () => {
    if (!oystehr) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehr);
  });

  const cleanupResources = async (oystehr: Oystehr): Promise<void> => {
    // Implement cleanup logic here
    for (const resource of resourcesToCleanup) {
      await oystehr.fhir.delete({
        resourceType: resource.resourceType as any,
        id: resource.id!,
      });
    }
  };

  describe('create order', () => {
    it('should create a radiology order -- 500 cant because m2m cannot hit user/me ', async () => {
      const createOrderInput: CreateRadiologyZambdaOrderInput = {
        encounterId: encounter.id!,
        diagnosisCode: 'W21.89XA',
        cptCode: '73562',
        stat: true,
        clinicalHistory: 'Took an arrow to the knee',
      };
      let orderOutput: any;
      try {
        orderOutput = (
          await oystehr.zambda.execute({
            id: 'RADIOLOGY-CREATE-ORDER',
            body: createOrderInput,
          })
        ).output as CreateRadiologyZambdaOrderOutput;
      } catch (error) {
        console.error('Error executing zambda:', error);
        orderOutput = error as Error;
      }
      expect(orderOutput).toBeDefined();
      expect(orderOutput.code).toEqual(500);
    });
  });
});
