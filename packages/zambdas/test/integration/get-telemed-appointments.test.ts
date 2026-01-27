import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateSlotParams,
  GetTelemedAppointmentsInput,
  GetTelemedAppointmentsResponseEhr,
  M2MClientMockType,
  PatientInfo,
  SCHEDULE_EXTENSION_URL,
  ServiceMode,
  SLUG_SYSTEM,
  TelemedCallStatuses,
} from 'utils';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { DEFAULT_SCHEDULE_JSON, makeTestPatient, persistTestPatient } from '../helpers/testScheduleUtils';

describe('get-telemed-appointments integration tests', () => {
  let oystehrLocalZambdas: Oystehr;
  let oystehr: Oystehr;
  let cleanupAppointmentGraph: () => Promise<void>;
  let virtualLocation: Location;
  let schedule: Schedule;
  let userToken: string;
  let processId: string;
  let endOfTomorrowSlotStart: string;
  let testReferenceTime: DateTime; // Fixed time for all date calculations

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-telemed-appointments.test.ts', M2MClientMockType.provider);
    oystehrLocalZambdas = setup.oystehrTestUserM2M;
    oystehr = setup.oystehr;
    cleanupAppointmentGraph = setup.cleanup;
    userToken = setup.token;
    processId = setup.processId;

    // for debugging:
    // run in terminal from zambdas root directory:
    // for hour in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23; do result=$(TEST_TIME_GET_TELEMED_APPOINTMENTS=2026-1-23-$hour npm test -- get-telemed-appointments.test.ts 2>&1 | grep -E "(FAIL|PASS|✓.*get-telemed-appointments.test.ts)" | tail -1); echo "Hour $hour: $result"; done
    const testTimeOverride = process.env.TEST_TIME_GET_TELEMED_APPOINTMENTS;
    if (testTimeOverride) {
      const [year, month, day, hour] = testTimeOverride.split('-').map(Number);
      testReferenceTime = DateTime.fromObject({ year, month, day, hour, minute: 0, second: 0 }, { zone: 'UTC' });
    } else {
      testReferenceTime = DateTime.now();
    }

    // Create a virtual location for telemed appointments
    virtualLocation = (await oystehr.fhir.create({
      resourceType: 'Location',
      status: 'active',
      name: 'GetTelemedAppointmentsTestLocation',
      description: 'We only just met but I will be gone soon',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `busy-slots-slimy-slug-${randomUUID()}`,
        },
      ],
      address: {
        state: 'FL',
      },
      extension: [
        {
          url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
          valueCoding: {
            system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            code: 'vi',
            display: 'Virtual',
          },
        },
      ],
    })) as Location;

    // Create a Schedule

    schedule = (await oystehr.fhir.create(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Schedule',
          actor: [
            {
              reference: `Location/${virtualLocation.id}`,
            },
          ],
          extension: [
            {
              url: 'http://hl7.org/fhir/StructureDefinition/timezone',
              valueString: 'America/New_York',
            },
            {
              url: SCHEDULE_EXTENSION_URL,
              valueString: JSON.stringify(DEFAULT_SCHEDULE_JSON),
            },
          ],
        },
        processId
      )
    )) as Schedule;

    endOfTomorrowSlotStart = testReferenceTime
      .setZone('America/New_York')
      .startOf('day')
      .plus({ days: 1, hours: 23, minutes: 45 })
      .toISO()!;

    // Create a Slot that is right at the end of TOMORROW
    // We need this Slot to be in the future as it is required by the create-slot endpoint.
    const createSlotParams: CreateSlotParams = {
      scheduleId: schedule.id!,
      serviceModality: ServiceMode.virtual,
      startISO: endOfTomorrowSlotStart,
      lengthInHours: 0,
      lengthInMinutes: 15,
    };

    const slot = (
      await oystehrLocalZambdas.zambda.executePublic({
        id: 'create-slot',
        ...createSlotParams,
      })
    ).output as Slot;

    // Note that Slot stores start time in timezone specified by caller
    expect(slot.start).toEqual(endOfTomorrowSlotStart);

    // Create a Patient
    const patient = await persistTestPatient({ patient: makeTestPatient(), processId }, oystehr);

    const patientInfo: PatientInfo = {
      id: patient.id,
      firstName: patient.name![0]!.given![0],
      lastName: patient.name![0]!.family,
      sex: 'female',
      email: 'okovalenko+coolPatient@masslight.com',
      dateOfBirth: patient.birthDate,
      newPatient: false,
    };

    // Create an appointment with create-appointment endpoint
    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient: patientInfo,
      slotId: slot.id!,
    };

    const createAppointmentResponse: CreateAppointmentResponse | undefined = (
      await oystehrLocalZambdas.zambda.execute({
        id: 'create-appointment',
        ...createAppointmentInputParams,
      })
    ).output as CreateAppointmentResponse;

    // Note that appointment stores start time in UTC
    expect(createAppointmentResponse).toBeDefined();
    console.log('');
    console.log('  CREATED APPOINTMENT:');
    console.log('   ID:', createAppointmentResponse.resources.appointment.id);
    console.log('   Start time:', createAppointmentResponse.resources.appointment.start);
    console.log('   Status:', createAppointmentResponse.resources.appointment.status);
    console.log(
      '   Location:',
      createAppointmentResponse.resources.appointment.participant?.find(
        (p) => p.actor?.reference?.includes('Location/')
      )?.actor?.reference
    );
    console.log('   Expected start (UTC):', DateTime.fromISO(endOfTomorrowSlotStart).setZone('UTC').toISO());
    console.log('');

    expect(createAppointmentResponse.resources.appointment.start).toEqual(
      DateTime.fromISO(endOfTomorrowSlotStart).setZone('UTC').toISO()
    );

    const updatedAppt = await oystehr.fhir.update({
      ...addProcessIdMetaTagToResource(createAppointmentResponse.resources.appointment, processId),
    });

    console.log('  APPOINTMENT UPDATED with processId meta tag');
    console.log('   Meta tags:', JSON.stringify(updatedAppt.meta?.tag, null, 2));

    expect(createAppointmentResponse).toBeDefined();
    expect(createAppointmentResponse.appointmentId).toBeDefined();
  }, 60_000);

  afterAll(async () => {
    console.log('Cleaning up');

    if (virtualLocation && virtualLocation.id) {
      await oystehr.fhir.delete({
        resourceType: 'Location',
        id: virtualLocation.id,
      });
    }

    if (schedule && schedule.id) {
      await oystehr.fhir.delete({
        resourceType: 'Schedule',
        id: schedule.id!,
      });
    }

    await cleanupAppointmentGraph();

    console.log('Clean up complete');
  });

  describe('get-telemed-appointments happy paths', () => {
    it('should get all telemed appointments for today NY time with location and date filter and find zero appointments -- success', async () => {
      const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
        patientFilter: 'all-patients',
        statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
        locationsIdsFilter: [virtualLocation.id!], // We need the location filter for the location we just made so we don't get stuff from other tests
        dateFilter: testReferenceTime.setZone('America/New_York').toFormat('yyyy-MM-dd'), // "Today" in New York time
        timeZone: 'America/New_York',
        userToken,
      };

      let getTelemedAppointmentsOutput: any;
      try {
        getTelemedAppointmentsOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-TELEMED-APPOINTMENTS',
            ...getTelemedAppointmentsInput,
          })
        ).output as GetTelemedAppointmentsResponseEhr;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getTelemedAppointmentsOutput = error as Error;
      }

      expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
      const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
      expect(typedOutput).toBeDefined();
      expect(typedOutput).toHaveProperty('message');
      expect(typedOutput).toHaveProperty('appointments');
      expect(typedOutput.appointments).toBeInstanceOf(Array);
      expect(typedOutput.appointments.length).toEqual(0);
      expect(typedOutput.message).toBe('Successfully retrieved all appointments');
    });

    it('should get appointments for tomorrow NY time, find one, and validate shape of telemed appointment information -- success', async () => {
      console.log('');
      console.log('==================== TEST 2: TOMORROW NY TIME ====================');
      const dateFilterValue = testReferenceTime.plus({ days: 1 }).setZone('America/New_York').toFormat('yyyy-MM-dd');

      console.log('  Test will search for date:', dateFilterValue);
      console.log('  Timezone:', 'America/New_York');
      console.log('  That translates to UTC range:');
      const searchDate = DateTime.fromISO(dateFilterValue, { zone: 'America/New_York' });
      console.log('   ge:', searchDate.startOf('day').toUTC().toISO());
      console.log('   lt:', searchDate.plus({ days: 1 }).startOf('day').toUTC().toISO());

      const getTelemedAppointmentsInput: Omit<GetTelemedAppointmentsInput, 'userToken'> = {
        patientFilter: 'all-patients',
        statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
        locationsIdsFilter: [virtualLocation.id!],
        dateFilter: dateFilterValue,
        timeZone: 'America/New_York',
      };

      let getTelemedAppointmentsOutput: any;
      try {
        getTelemedAppointmentsOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-TELEMED-APPOINTMENTS',
            ...getTelemedAppointmentsInput,
          })
        ).output as GetTelemedAppointmentsResponseEhr;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getTelemedAppointmentsOutput = error as Error;
      }

      expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
      const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

      expect(typedOutput).toBeDefined();
      expect(typedOutput.appointments).toBeInstanceOf(Array);
      expect(typedOutput.appointments.length).toEqual(1);

      const appointment = typedOutput.appointments[0];
      expect(appointment).toMatchObject({
        id: expect.any(String),
        start: DateTime.fromISO(endOfTomorrowSlotStart).setZone('UTC').toISO(),
        patient: expect.objectContaining({
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          dateOfBirth: expect.any(String),
        }),
        telemedStatus: expect.any(String),
        telemedStatusHistory: expect.any(Array),
        appointmentStatus: expect.any(String),
        locationVirtual: expect.objectContaining({
          id: expect.any(String),
          resourceType: 'Location',
        }),
        encounterId: expect.any(String),
      });

      // Validate telemed status is a valid status
      const validStatuses: TelemedCallStatuses[] = [
        'ready',
        'pre-video',
        'on-video',
        'unsigned',
        'complete',
        'cancelled',
      ];
      expect(validStatuses).toContain(appointment.telemedStatus);
    });

    it('should get appointments for tomorrow in Bermuda time and not find any -- success', async () => {
      console.log('');
      console.log('==================== TEST 3: TOMORROW BERMUDA TIME ====================');
      const getTelemedAppointmentsInput: Omit<GetTelemedAppointmentsInput, 'userToken'> = {
        patientFilter: 'all-patients',
        statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
        locationsIdsFilter: [virtualLocation.id!],
        dateFilter: testReferenceTime
          .setZone('America/New_York')
          .startOf('day')
          .plus({ days: 1 })
          .toFormat('yyyy-MM-dd'),
        timeZone: 'Atlantic/Bermuda',
      };

      let getTelemedAppointmentsOutput: any;
      try {
        getTelemedAppointmentsOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-TELEMED-APPOINTMENTS',
            ...getTelemedAppointmentsInput,
          })
        ).output as GetTelemedAppointmentsResponseEhr;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getTelemedAppointmentsOutput = error as Error;
      }

      expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
      const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

      expect(typedOutput).toBeDefined();
      expect(typedOutput.appointments).toBeInstanceOf(Array);
      expect(typedOutput.appointments.length).toEqual(0);
    });
  });
});
