import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { vi } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import { SECRETS } from '../data/secrets';
import { Schedule } from 'fhir/r4b';
import { randomUUID } from 'crypto';
import { DEFAULT_SCHEDULE_JSON, makeSchedule, tagForProcessId } from '../helpers/testScheduleUtils';
import { ScheduleExtension } from 'utils';

describe('slot availability tests', () => {
  let oystehr: Oystehr | null = null;
  let token = null;
  let processId: string | null = null;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  const persistSchedule = async (scheduleExtension: ScheduleExtension, oystehr: Oystehr): Promise<Schedule> => {
    if (processId === null) {
      throw new Error('processId is null');
    }
    const resource = {
      ...makeSchedule({
        processId,
        scheduleObject: scheduleExtension,
      }),
      id: undefined,
    };

    const schedule = await oystehr.fhir.create<Schedule>(resource);
    console.log('schedule', JSON.stringify(schedule, null, 2));
    return schedule;
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({ accessToken: token, fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API });
  });
  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    const schedules = (
      await oystehr.fhir.search<Schedule>({
        resourceType: 'Schedule',
        params: [
          {
            name: '_tag',
            value: tagForProcessId(processId),
          },
        ],
      })
    ).unbundle();

    const deleteRequests: BatchInputDeleteRequest[] = schedules.map((schedule) => {
      return {
        method: 'DELETE',
        url: `Schedule/${schedule.id}`,
      };
    });
    try {
      await oystehr.fhir.batch({ requests: deleteRequests });
    } catch (error) {
      console.error('Error deleting schedules', error);
      console.log(`ProcessId ${processId} may need manual cleanup`);
    }
  });

  it('should create a schedule and persist it', async () => {
    if (!oystehr) {
      throw new Error('oystehr is null');
    }
    const schedule = await persistSchedule(DEFAULT_SCHEDULE_JSON, oystehr);
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();
  });
});
