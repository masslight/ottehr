import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, Practitioner, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { makeQualificationForPractitioner } from 'utils/lib/fhir/practitioners';
import { GetUserResponse } from 'utils/lib/types/api/get-user.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('get-user integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let userId: string | undefined;
  let practitionerId: string | undefined;
  let schedule: Schedule | undefined;
  let encounter: Encounter | undefined;
  const email = `get-user-${randomUUID()}@example.com`;
  const familyName = `GetUser${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-user.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    const [applications, roles] = await Promise.all([oystehr.application.list(), oystehr.role.list()]);
    const providerRole = roles.find((role) => role.name === RoleType.Provider);
    if (!applications[0] || !providerRole) throw new Error('No application or Provider role to invite a user with');

    const invited = await oystehr.user.invite({
      email,
      applicationId: applications[0].id,
      roles: [providerRole.id],
      resource: addProcessIdMetaTagToResource(
        {
          resourceType: 'Practitioner',
          name: [{ given: ['Integration'], family: familyName }],
          qualification: [makeQualificationForPractitioner({ code: 'MD', state: 'NY', active: true })],
        },
        setup.processId
      ) as Practitioner,
    });
    userId = invited.id;
    practitionerId = invited.profile.replace('Practitioner/', '');

    [schedule, encounter] = await Promise.all([
      oystehr.fhir.create<Schedule>(
        addProcessIdMetaTagToResource(
          { resourceType: 'Schedule', active: true, actor: [{ reference: `Practitioner/${practitionerId}` }] },
          setup.processId
        ) as Schedule
      ),
      oystehr.fhir.create<Encounter>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Encounter',
            status: 'in-progress',
            class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
            period: { start: DateTime.now().toUTC().toISO()! },
            participant: [{ individual: { reference: `Practitioner/${practitionerId}` } }],
          },
          setup.processId
        ) as Encounter
      ),
    ]);
  }, 60_000);

  afterAll(async () => {
    if (encounter?.id) {
      await oystehr.fhir.delete({ resourceType: 'Encounter', id: encounter.id }).catch(() => undefined);
    }
    if (schedule?.id) {
      await oystehr.fhir.delete({ resourceType: 'Schedule', id: schedule.id }).catch(() => undefined);
    }
    if (userId) await oystehr.user.delete({ id: userId }).catch(() => undefined);
    if (practitionerId) {
      await oystehr.fhir.delete({ resourceType: 'Practitioner', id: practitionerId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('returns the user with its practitioner, schedule and recent-encounter flag', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'get-user', userId });
    const output = response.output as GetUserResponse;

    expect(output.user.id).toBe(userId);
    expect(output.user.email).toBe(email);
    expect(output.user.profile).toBe(`Practitioner/${practitionerId}`);
    expect(output.user.profileResource?.id).toBe(practitionerId);
    expect(output.user.profileResource?.name?.[0]?.family).toBe(familyName);
    expect(output.user.licenses).toEqual([{ state: 'NY', code: 'MD', active: true }]);
    expect(output.userScheduleId).toBe(schedule?.id);
    expect(output.seenPatientRecently).toBe(true);
  });
});
