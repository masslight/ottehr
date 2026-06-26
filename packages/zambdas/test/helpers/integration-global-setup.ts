import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Patient, Practitioner } from 'fhir/r4b';
import { Server } from 'http';
import type { AddressInfo } from 'net';
import { M2MClientMockType, RoleType } from 'utils';
import type { TestProject } from 'vitest/node';
import app from '../../src/local-server/index';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { assertNoLeakedResourcesForRun } from './integration-leak-gate';
import { addRunTagToResource } from './integration-test-seed-data-setup';

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
async function provisionSharedClient(
  oystehrAdmin: Oystehr,
  mockType: M2MClientMockType,
  runId: string
): Promise<ProvisionedClient> {
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
      const patient = await oystehrAdmin.fhir.create<Patient>(
        addRunTagToResource(
          {
            resourceType: 'Patient',
            name: [{ given: ['Integration'], family: 'TestsPatient' }],
            birthDate: '1990-01-01',
            telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
          },
          runId
        ) as Patient
      );
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
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>(
        addRunTagToResource(
          {
            resourceType: 'Practitioner',
            name: [{ given: ['Integration'], family: 'TestsProvider' }],
            birthDate: '1990-01-01',
            telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
          },
          runId
        ) as Practitioner
      );
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
 * Intercepts outbound calls to AdvaPACS (the radiology PACS vendor) and returns
 * a successful empty transaction-response Bundle, so integration tests never hit
 * the real third-party service. The zambda handlers run in THIS (global-setup)
 * process — the in-process express server lives here — so patching the global
 * `fetch` here covers their AdvaPACS calls. All non-AdvaPACS requests (real
 * Oystehr/FHIR traffic) pass straight through to the original fetch.
 *
 * Returns a function that restores the original fetch.
 */
function installAdvaPacsFetchMock(): () => void {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url && url.includes('advapacs')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      console.log(`[advapacs-mock] intercepted ${method} ${url}`);
      // A GET search for a ServiceRequest must resolve to exactly one entry with
      // an id (callers fetch it, then PUT a status update back). Everything else
      // (the create-order transaction POST, the revoke PUT, etc.) just needs a 2xx.
      let body: unknown;
      if (url.includes('/viewer/launch')) {
        // launch-viewer expects the response to carry a viewer `url`.
        body = { url: 'https://advapacs-mock.example/viewer/launch/session' };
      } else if (method === 'GET' && url.includes('/ServiceRequest')) {
        // Callers fetch the AdvaPACS ServiceRequest then PUT a status update; the
        // search must resolve to exactly one entry with an id.
        body = {
          resourceType: 'Bundle',
          type: 'searchset',
          entry: [
            { resource: { resourceType: 'ServiceRequest', id: 'advapacs-mock-service-request', status: 'active' } },
          ],
        };
      } else if (url.includes('/DiagnosticReport')) {
        // save-preliminary-report POSTs a DiagnosticReport and builds our local
        // copy from the response — it must carry a status and id. The id is
        // unique per invocation so concurrent radiology tests never share one
        // AdvaPACS-resource identifier (which the pacs-webhook handler matches
        // on); each test's local DiagnosticReport gets a distinct identifier.
        body = {
          resourceType: 'DiagnosticReport',
          id: `advapacs-mock-diagnostic-report-${randomUUID()}`,
          status: 'preliminary',
          code: { coding: [{ system: 'http://loinc.org', code: '18748-4', display: 'Diagnostic imaging study' }] },
        };
      } else {
        body = { resourceType: 'Bundle', type: 'transaction-response', entry: [] };
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
}

/**
 * Starts a fresh integration-test zambda server on an OS-assigned free port so
 * the suite never depends on (or conflicts with) whatever the developer might
 * have running on port 3000, and provisions the shared auth tokens used by all
 * integration tests. Published to tests via vitest `inject`.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const restoreFetch = installAdvaPacsFetchMock();
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

  // One id for the whole run, stamped on every resource the suite creates so the leak gate in
  // teardown can verify they were all cleaned up — isolated from any concurrent run on this backend.
  const runId = randomUUID();

  const provider = await provisionSharedClient(oystehrAdmin, M2MClientMockType.provider, runId);
  const patient = await provisionSharedClient(oystehrAdmin, M2MClientMockType.patient, runId);

  project.provide('ADMIN_TOKEN', adminToken);
  project.provide('INTEGRATION_TEST_RUN_ID', runId);
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

    restoreFetch();

    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          console.log('Test zambda server stopped');
          resolve();
        });
      });
    }

    // Suite-wide leak gate: by now every test file's cleanup has run and the shared M2M profiles
    // are deleted, so anything still tagged with this runId escaped cleanup. This throws (failing
    // the run) if so. Runs last so it doesn't skip the teardown above.
    await assertNoLeakedResourcesForRun(oystehrAdmin, runId);
  };
}
