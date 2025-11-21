import Oystehr from '@oystehr/sdk';
import { DomainResource, Encounter, Patient } from 'fhir/r4b';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput, M2MClientMockType } from 'utils';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('radiology integration tests', () => {
  let oystehrTestUserM2M: Oystehr;
  let oystehrAdmin: Oystehr;
  let encounter: Encounter;
  const resourcesToCleanup: DomainResource[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/radiology.test.ts', M2MClientMockType.provider);
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;

    const patient = await oystehrAdmin.fhir.create<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Test'], family: 'Patient' }],
      birthDate: '2000-01-01',
      gender: 'female',
    });
    resourcesToCleanup.push(patient);

    encounter = await oystehrAdmin.fhir.create<Encounter>({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: `Patient/${patient.id}` },
    });
    resourcesToCleanup.push(encounter);
    expect(encounter).toBeDefined();
  });

  afterAll(async () => {
    if (!oystehrAdmin) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehrAdmin);
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
        encounterId: encounter.id!,
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
