import Oystehr from '@oystehr/sdk';
import { DomainResource, Encounter, Patient, Practitioner } from 'fhir/r4b';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput, RoleType } from 'utils';
import { inject } from 'vitest';
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';

describe('radiology integration tests', () => {
  let oystehrLocalZambdas: Oystehr;
  let oystehr: Oystehr;
  let token = null;
  let encounter: Encounter;
  const resourcesToCleanup: DomainResource[] = [];

  beforeAll(async () => {
    const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectId: PROJECT_ID,
    });

    oystehrLocalZambdas = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

    const practitionerForM2M = await oystehr.fhir.create<Practitioner>({
      resourceType: 'Practitioner',
      name: [{ given: ['M2M'], family: 'Client' }],
      birthDate: '1978-01-01',
      telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
    });

    const projectRoles = await oystehr.role.list();
    const providerRoleId = projectRoles.find((role) => role.name === RoleType.Provider)?.id;
    expect(providerRoleId).toBeDefined();

    await oystehr.m2m.update({
      id: (await oystehr.m2m.me()).id,
      profile: `Practitioner/${practitionerForM2M.id}`,
      roles: [providerRoleId!],
    });

    const patient = await oystehr.fhir.create<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Test'], family: 'Patient' }],
      birthDate: '2000-01-01',
      gender: 'female',
    });
    resourcesToCleanup.push(patient);

    encounter = await oystehr.fhir.create<Encounter>({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: `Patient/${patient.id}` },
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
          await oystehrLocalZambdas.zambda.execute({
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
