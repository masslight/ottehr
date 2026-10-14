import Oystehr from '@oystehr/sdk';
import { Extension, Location, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PUBLIC_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { LOCATION_IN_PERSON_CODE, LOCATION_PHYSICAL_TYPE_SYSTEM, LOCATION_VIRTUAL_CODE } from 'utils/lib/fhir/location';
import { WalkinAvailabilityCheckResult } from 'utils/lib/types/api/appointment.types';
import { ServiceMode } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule, tagForProcessId } from '../helpers/testScheduleUtils';

const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;

const modeCoding = (code: string): Extension => ({
  url: LOCATION_FORM_EXTENSION_URL,
  valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code },
});

// Happy path for walkin-check-availability: given a schedule id, returns whether
// walk-in is currently available plus the schedule's open/close window.
describe('walkin-check-availability integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let scheduleId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('walkin-check-availability.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const locationRef = base.appointment.participant
      ?.map((p) => p.actor?.reference)
      .find((ref) => ref?.startsWith('Location/'));
    // 24/7 open schedule so walk-in availability resolves deterministically.
    const schedule = await oystehrAdmin.fhir.create<Schedule>({
      ...makeSchedule({ scheduleObject: buildSimpleScheduleExt(), processId: setup.processId, locationRef }),
      id: undefined,
    });
    scheduleId = schedule.id;
  }, 60_000);

  afterAll(async () => {
    if (scheduleId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('returns walk-in availability for a schedule', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'walkin-check-availability',
      scheduleId,
    });
    expect(response.output).toBeDefined();
  });
});

// Service mode resolution: links may pin `serviceMode`; without it a Location that supports
// in-person resolves to in-person (incl. dual-mode), and a virtual-only Location to virtual.
describe('walkin-check-availability integration — service mode', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let cleanup: () => Promise<void>;
  const createdLocationIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const scheduleIdByKind: Record<'dual' | 'virtualOnly' | 'inPersonOnly', string> = {
    dual: '',
    virtualOnly: '',
    inPersonOnly: '',
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'walkin-check-availability.test.ts:service-mode',
      M2MClientMockType.patient
    );
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    const createLocationWithSchedule = async (codes: string[]): Promise<string> => {
      const location = await oystehrAdmin.fhir.create<Location>({
        resourceType: 'Location',
        status: 'active',
        name: `Walk-in mode test ${codes.join('+')} ${setup.processId}`,
        extension: codes.map(modeCoding),
        meta: {
          tag: [{ system: 'OTTEHR_AUTOMATED_TEST', code: tagForProcessId(setup.processId) }],
        },
      });
      createdLocationIds.push(location.id!);
      // 24/7 open schedule so walk-in availability resolves deterministically.
      const schedule = await oystehrAdmin.fhir.create<Schedule>({
        ...makeSchedule({
          scheduleObject: buildSimpleScheduleExt(),
          processId: setup.processId,
          locationRef: `Location/${location.id}`,
        }),
        id: undefined,
      });
      createdScheduleIds.push(schedule.id!);
      return schedule.id!;
    };

    scheduleIdByKind.dual = await createLocationWithSchedule([LOCATION_VIRTUAL_CODE, LOCATION_IN_PERSON_CODE]);
    scheduleIdByKind.virtualOnly = await createLocationWithSchedule([LOCATION_VIRTUAL_CODE]);
    scheduleIdByKind.inPersonOnly = await createLocationWithSchedule([LOCATION_IN_PERSON_CODE]);
  }, 60_000);

  afterAll(async () => {
    const requests = [
      ...createdScheduleIds.map((id) => ({ method: 'DELETE' as const, url: `Schedule/${id}` })),
      ...createdLocationIds.map((id) => ({ method: 'DELETE' as const, url: `Location/${id}` })),
    ];
    if (requests.length > 0) {
      await oystehrAdmin.fhir.batch({ requests }).catch((error) => console.error('Error cleaning up', error));
    }
    await cleanup();
  });

  const checkAvailability = async (input: Record<string, unknown>): Promise<WalkinAvailabilityCheckResult> => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'walkin-check-availability', ...input });
    return response.output as WalkinAvailabilityCheckResult;
  };

  // OystehrSdkError isn't guaranteed to be an Error subclass, so read `.message` off the caught object.
  const checkAvailabilityExpectingRejection = async (input: Record<string, unknown>): Promise<string> => {
    let caught: unknown;
    try {
      await oystehrPatient.zambda.executePublic({ id: 'walkin-check-availability', ...input });
    } catch (e) {
      caught = e;
    }
    if (!caught) throw new Error('expected walkin-check-availability to reject but it succeeded');
    return (caught as { message?: string }).message ?? '';
  };

  it('without serviceMode resolves a dual-mode location to in-person', async () => {
    const result = await checkAvailability({ scheduleId: scheduleIdByKind.dual });
    expect(result.serviceMode).toBe(ServiceMode['in-person']);
  });

  it('without serviceMode resolves a virtual-only location to virtual', async () => {
    const result = await checkAvailability({ scheduleId: scheduleIdByKind.virtualOnly });
    expect(result.serviceMode).toBe(ServiceMode.virtual);
  });

  it('returns the requested mode when the location supports it', async () => {
    expect((await checkAvailability({ scheduleId: scheduleIdByKind.dual, serviceMode: 'virtual' })).serviceMode).toBe(
      ServiceMode.virtual
    );
    expect((await checkAvailability({ scheduleId: scheduleIdByKind.dual, serviceMode: 'in-person' })).serviceMode).toBe(
      ServiceMode['in-person']
    );
  });

  it('rejects a requested mode the location does not support', async () => {
    expect(
      await checkAvailabilityExpectingRejection({ scheduleId: scheduleIdByKind.inPersonOnly, serviceMode: 'virtual' })
    ).toMatch(/Virtual walk-in visits are not available/);
    expect(
      await checkAvailabilityExpectingRejection({ scheduleId: scheduleIdByKind.virtualOnly, serviceMode: 'in-person' })
    ).toMatch(/In-person walk-in visits are not available/);
  });

  it('rejects an unknown serviceMode', async () => {
    expect(
      await checkAvailabilityExpectingRejection({ scheduleId: scheduleIdByKind.dual, serviceMode: 'bogus' })
    ).toMatch(/"serviceMode" must be one of/);
  });
});
