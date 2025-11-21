import Oystehr, { M2mListItem } from '@oystehr/sdk';
import { DomainResource, Encounter, Patient, Practitioner } from 'fhir/r4b';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput, M2MClientMockType, RoleType } from 'utils';
import { inject } from 'vitest';
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';

const testPretendUserM2MName = 'radiology-integration-tests-m2m-client';

describe('radiology integration tests', () => {
  let oystehrLocalZambdas: Oystehr;
  let oystehrAdmin: Oystehr;
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
    oystehrAdmin = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectId: PROJECT_ID,
    });

    // We need to find or create the M2M client who will pretend to be a real EHR user.
    const m2mListSearchResultData = (
      await oystehrAdmin.m2m.listV2({
        name: testPretendUserM2MName,
      })
    ).data;

    let testUserM2M: M2mListItem;

    if (m2mListSearchResultData.length > 0) {
      console.log('found existing M2M client for tests');
      testUserM2M = await oystehrAdmin.m2m.get({
        id: m2mListSearchResultData[0].id,
      });
    } else {
      console.log('creating new M2M client for tests');
      const projectRoles = await oystehrAdmin.role.list();
      const providerRoleId = projectRoles.find((role) => role.name === RoleType.Provider)?.id;
      expect(providerRoleId).toBeDefined();

      const practitionerForM2M = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ given: ['M2M'], family: 'Client' }],
        birthDate: '1978-01-01',
        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
      });

      testUserM2M = await oystehrAdmin.m2m.create({
        name: testPretendUserM2MName,
        description: M2MClientMockType.mockProvider,
        profile: `Practitioner/${practitionerForM2M.id}`,
        roles: [providerRoleId!],
      });
    }

    const testUserM2MClientId = testUserM2M.clientId;
    const testUserM2MClientSecret = (
      await oystehrAdmin.m2m.rotateSecret({
        id: testUserM2M.id,
      })
    ).secret;

    console.log('client id ', testUserM2MClientId);
    console.log('rotated: ', testUserM2MClientSecret);

    const testUserM2MToken = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: testUserM2MClientId,
      AUTH0_SECRET: testUserM2MClientSecret,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehrLocalZambdas = new Oystehr({
      accessToken: testUserM2MToken,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

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
