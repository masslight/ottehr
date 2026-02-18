import Oystehr from '@oystehr/sdk';
import { DomainResource } from 'fhir/r4b';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput, M2MClientMockType } from 'utils';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('radiology integration tests', () => {
  let oystehrTestUserM2M: Oystehr;
  let oystehrAdmin: Oystehr;
  const resourcesToCleanup: DomainResource[] = [];

  let baseResources: InsertFullAppointmentDataBaseResult;
  let appointmentBaseCleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/radiology.test.ts', M2MClientMockType.provider);
    appointmentBaseCleanup = setup.cleanup;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (!oystehrAdmin) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehrAdmin);
    await appointmentBaseCleanup();
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
    it('should create a radiology order -- success', async () => {
      const createOrderInput: CreateRadiologyZambdaOrderInput = {
        encounterId: baseResources.encounter.id!,
        diagnosisCode: 'W21.89XA',
        cptCode: '73562',
        stat: true,
        clinicalHistory: 'Took an arrow to the knee',
      };
      let orderOutput: any;
      try {
        orderOutput = (
          await oystehrTestUserM2M.zambda.execute({
            id: 'RADIOLOGY-CREATE-ORDER',
            ...createOrderInput,
          })
        ).output as CreateRadiologyZambdaOrderOutput;
      } catch (error) {
        console.error('Error executing zambda:', error);
        orderOutput = error as Error;
      }
      expect(orderOutput).toBeDefined();
      expect(orderOutput).toHaveProperty('output');
      expect(orderOutput.output).toHaveProperty('serviceRequestId');
    });
  });
});
