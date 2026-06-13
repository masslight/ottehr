import Oystehr from '@oystehr/sdk';
import { Patient, Practitioner } from 'fhir/r4b';
import { Server } from 'http';
import type { AddressInfo } from 'net';
import { M2MClientMockType, RoleType } from 'utils';
import type { TestProject } from 'vitest/node';
import app from '../../src/local-server/index';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';

let server: Server | undefined;

// Fixed names for the two shared integration-test M2M clients. The suite uses
// exactly one provider-profile client and one patient-profile client across all
// test files (a single M2M client can only carry one profile), instead of one
// client per test file. They are provisioned once here and deleted in teardown.
const SHARED_M2M_NAME: Record<M2MClientMockType, string> = {
  [M2MClientMockType.provider]: 'integration-tests-shared-provider',
  [M2MClientMockType.patient]: 'integration-tests-shared-patient',
};

interface ProvisionedClient {
  m2mId: string;
  profile: string;
  profileResourceType: 'Practitioner' | 'Patient';
  profileId: string;
  token: string;
}

/**
 * Finds (by fixed name) or creates the shared M2M client for a given mock type,
 * rotates its secret once, and exchanges it for an Auth0 token. Returns the
 * token + profile so tests can act as that machine user without each test file
 * minting its own client.
 */
async function provisionSharedClient(oystehrAdmin: Oystehr, mockType: M2MClientMockType): Promise<ProvisionedClient> {
  const { AUTH0_ENDPOINT, AUTH0_AUDIENCE } = SECRETS;
  const name = SHARED_M2M_NAME[mockType];

  const existing = (await oystehrAdmin.m2m.listV2({ name })).data;
  let m2mId: string;
  let profile: string;

  if (existing.length > 0) {
    const found = await oystehrAdmin.m2m.get({ id: existing[0].id });
    m2mId = found.id;
    profile = found.profile;
  } else {
    const roles = await oystehrAdmin.role.list();
    if (mockType === M2MClientMockType.patient) {
      const patientRoleId = roles.find((r) => r.name === 'Patient')?.id;
      if (!patientRoleId) throw new Error('Patient role not found for shared M2M client');
      const patient = await oystehrAdmin.fhir.create<Patient>({
        resourceType: 'Patient',
        name: [{ given: ['Integration'], family: 'TestsPatient' }],
        birthDate: '1990-01-01',
        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
      });
      const created = await oystehrAdmin.m2m.create({
        name,
        description: M2MClientMockType.patient,
        profile: `Patient/${patient.id}`,
        roles: [patientRoleId],
      });
      m2mId = created.id;
      profile = created.profile;
    } else {
      // The shared provider client stands in for a fully-privileged staff user
      // so it can exercise both provider endpoints and the admin/manager/
      // customer-support-gated ones (several admin-* zambdas call
      // requireUserWithRole). Grant every staff role the project defines
      // (excluding Patient and Inactive).
      const providerRoleNames = [
        RoleType.Provider,
        RoleType.Administrator,
        RoleType.Manager,
        RoleType.CustomerSupport,
        'CustomerSupport',
        RoleType.FrontDesk,
        RoleType.Staff,
        RoleType.Billing,
      ] as string[];
      const providerRoleIds = roles.filter((r) => providerRoleNames.includes(r.name)).map((r) => r.id);
      if (providerRoleIds.length === 0) throw new Error('No provider/staff roles found for shared M2M client');
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ given: ['Integration'], family: 'TestsProvider' }],
        birthDate: '1990-01-01',
        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
      });
      const created = await oystehrAdmin.m2m.create({
        name,
        description: M2MClientMockType.provider,
        profile: `Practitioner/${practitioner.id}`,
        roles: providerRoleIds,
      });
      m2mId = created.id;
      profile = created.profile;
    }
  }

  const { secret } = await oystehrAdmin.m2m.rotateSecret({ id: m2mId });
  const clientId = (await oystehrAdmin.m2m.get({ id: m2mId })).clientId;
  const token = await getAuth0Token({
    AUTH0_ENDPOINT,
    AUTH0_CLIENT: clientId,
    AUTH0_SECRET: secret,
    AUTH0_AUDIENCE,
  });

  const [profileResourceType, profileId] = profile.split('/') as ['Practitioner' | 'Patient', string];
  return { m2mId, profile, profileResourceType, profileId, token };
}

/**
 * Starts a fresh integration-test zambda server on an OS-assigned free port so
 * the suite never depends on (or conflicts with) whatever the developer might
 * have running on port 3000, and provisions the shared auth tokens used by all
 * integration tests. Published to tests via vitest `inject`.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const port = await new Promise<number>((resolve, reject) => {
    const listener = app.listen(0, () => {
      const address = listener.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to determine bound port for test server'));
        return;
      }
      server = listener;
      const boundPort = (address as AddressInfo).port;
      console.log(`Test zambda server started on port ${boundPort}`);
      resolve(boundPort);
    });
    listener.on('error', (error) => {
      console.error('Server failed to start:', error);
      reject(error);
    });
  });

  project.provide('EXECUTE_ZAMBDA_URL', `http://localhost:${port}/local`);

  // Provision shared auth once for the whole suite.
  const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
  const adminToken = await getAuth0Token({
    AUTH0_ENDPOINT,
    AUTH0_CLIENT: SECRETS.AUTH0_CLIENT_TESTS,
    AUTH0_SECRET: SECRETS.AUTH0_SECRET_TESTS,
    AUTH0_AUDIENCE,
  });
  const oystehrAdmin = new Oystehr({ accessToken: adminToken, fhirApiUrl: FHIR_API, projectId: PROJECT_ID });

  const provider = await provisionSharedClient(oystehrAdmin, M2MClientMockType.provider);
  const patient = await provisionSharedClient(oystehrAdmin, M2MClientMockType.patient);

  project.provide('ADMIN_TOKEN', adminToken);
  project.provide('M2M_PROVIDER_TOKEN', provider.token);
  project.provide('M2M_PROVIDER_PROFILE', provider.profile);
  project.provide('M2M_PATIENT_TOKEN', patient.token);
  project.provide('M2M_PATIENT_PROFILE', patient.profile);

  console.log('Provisioned shared integration-test M2M clients (provider + patient)');

  // Teardown: delete the two shared M2M clients and their profile resources,
  // then stop the server.
  return async () => {
    for (const c of [provider, patient]) {
      try {
        await oystehrAdmin.m2m.delete({ id: c.m2mId });
      } catch {
        // best-effort
      }
      try {
        await oystehrAdmin.fhir.delete({ resourceType: c.profileResourceType, id: c.profileId });
      } catch {
        // best-effort
      }
    }
    console.log('Deleted shared integration-test M2M clients');

    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          console.log('Test zambda server stopped');
          resolve();
        });
      });
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
declare namespace vitest {
  export interface ProvidedContext {
    EXECUTE_ZAMBDA_URL: string;
    ADMIN_TOKEN: string;
    M2M_PROVIDER_TOKEN: string;
    M2M_PROVIDER_PROFILE: string;
    M2M_PATIENT_TOKEN: string;
    M2M_PATIENT_PROFILE: string;
  }
}
