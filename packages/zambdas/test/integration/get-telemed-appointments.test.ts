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

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-telemed-appointments.test.ts');
    oystehrLocalZambdas = setup.oystehrLocalZambdas;
    oystehr = setup.oystehr;
    cleanupAppointmentGraph = setup.cleanup;
    userToken = setup.token;
    processId = setup.processId;

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

    endOfTomorrowSlotStart = DateTime.now()
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
    expect(slot.start).toEqual(DateTime.fromISO(endOfTomorrowSlotStart).toISO());

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
    console.log('appointment start time, ', createAppointmentResponse.resources.appointment.start);
    expect(createAppointmentResponse.resources.appointment.start).toEqual(
      DateTime.fromISO(endOfTomorrowSlotStart).setZone('UTC').toISO()
    );

    await oystehr.fhir.update({
      ...addProcessIdMetaTagToResource(createAppointmentResponse.resources.appointment, processId),
    });

    expect(createAppointmentResponse).toBeDefined();
    expect(createAppointmentResponse.appointmentId).toBeDefined();
  });

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
        dateFilter: DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd'), // "Today" in New York time
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
      const getTelemedAppointmentsInput: Omit<GetTelemedAppointmentsInput, 'userToken'> = {
        patientFilter: 'all-patients',
        statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
        locationsIdsFilter: [virtualLocation.id!],
        dateFilter: DateTime.now().plus({ days: 1 }).setZone('America/New_York').toFormat('yyyy-MM-dd'),
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
      const getTelemedAppointmentsInput: Omit<GetTelemedAppointmentsInput, 'userToken'> = {
        patientFilter: 'all-patients',
        statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
        locationsIdsFilter: [virtualLocation.id!],
        dateFilter: DateTime.now().setZone('America/New_York').startOf('day').plus({ days: 1 }).toFormat('yyyy-MM-dd'),
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

    //   it('should filter appointments by specific status -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
    //     expect(typedOutput.appointments).toBeInstanceOf(Array);

    //     // All returned appointments should have the 'ready' status
    //     typedOutput.appointments.forEach((appointment: TelemedAppointmentInformation) => {
    //       expect(appointment.telemedStatus).toBe('ready');
    //     });
    //   });

    //   it('should filter appointments by location -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       locationsIdsFilter: [virtualLocation.id!],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
    //     expect(typedOutput.appointments).toBeInstanceOf(Array);

    //     // All returned appointments should be for the specified location
    //     typedOutput.appointments.forEach((appointment: TelemedAppointmentInformation) => {
    //       expect(appointment.locationVirtual.id).toBe(virtualLocation.id);
    //     });
    //   });

    //   it('should filter appointments by US state -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       usStatesFilter: ['NY'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
    //     expect(typedOutput.appointments).toBeInstanceOf(Array);

    //     // All returned appointments should be for NY state
    //     typedOutput.appointments.forEach((appointment: TelemedAppointmentInformation) => {
    //       expect(appointment.locationVirtual.state).toBe('NY');
    //     });
    //   });

    //   it('should return empty array when no appointments match filters -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['cancelled'],
    //       dateFilter: '2020-01-01', // Date in the past with no appointments
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
    //     expect(typedOutput.appointments).toBeInstanceOf(Array);
    //     expect(typedOutput.appointments.length).toBe(0);
    //   });

    //   it('should validate patient information in appointment -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     if (typedOutput.appointments.length > 0) {
    //       const appointment = typedOutput.appointments[0];

    //       // Validate patient structure
    //       expect(appointment.patient).toBeDefined();
    //       expect(appointment.patient.id).toBe(baseResources.patient.id);
    //       expect(appointment.patient.firstName).toBe(baseResources.patient.name?.[0].given?.[0]);
    //       expect(appointment.patient.lastName).toBe(baseResources.patient.name?.[0].family);
    //       expect(appointment.patient.dateOfBirth).toBe(baseResources.patient.birthDate);
    //     }
    //   });

    //   it('should validate smsModel structure -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     if (typedOutput.appointments.length > 0) {
    //       const appointment = typedOutput.appointments[0];

    //       // Validate smsModel structure
    //       expect(appointment.smsModel).toBeDefined();
    //       expect(appointment.smsModel).toHaveProperty('hasUnreadMessages');
    //       expect(appointment.smsModel).toHaveProperty('hasCommunication');
    //       expect(typeof appointment.smsModel.hasUnreadMessages).toBe('boolean');
    //       expect(typeof appointment.smsModel.hasCommunication).toBe('boolean');
    //     }
    //   });

    //   it('should validate visitStatusHistory is present -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     if (typedOutput.appointments.length > 0) {
    //       const appointment = typedOutput.appointments[0];

    //       // Validate visitStatusHistory
    //       expect(appointment.visitStatusHistory).toBeDefined();
    //       expect(appointment.visitStatusHistory).toBeInstanceOf(Array);
    //     }
    //   });
    // });

    // describe('get-telemed-appointments edge cases', () => {
    //   it('should handle multiple status filters -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
    //     expect(typedOutput.appointments).toBeInstanceOf(Array);

    //     // All returned appointments should have one of the specified statuses
    //     const allowedStatuses: TelemedCallStatuses[] = ['ready', 'pre-video', 'on-video'];
    //     typedOutput.appointments.forEach((appointment: TelemedAppointmentInformation) => {
    //       expect(allowedStatuses).toContain(appointment.telemedStatus);
    //     });
    //   });

    //   it('should handle my-patients filter -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'my-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;
    //     expect(typedOutput.appointments).toBeInstanceOf(Array);
    //     // Note: Actual filtering by practitioner would require setting up practitioner data
    //   });

    //   it('should validate telemedStatusHistory structure -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     if (typedOutput.appointments.length > 0) {
    //       const appointment = typedOutput.appointments[0];

    //       // Validate telemedStatusHistory
    //       expect(appointment.telemedStatusHistory).toBeDefined();
    //       expect(appointment.telemedStatusHistory).toBeInstanceOf(Array);

    //       if (appointment.telemedStatusHistory.length > 0) {
    //         const historyItem = appointment.telemedStatusHistory[0];
    //         expect(historyItem).toHaveProperty('status');
    //         expect(historyItem).toHaveProperty('label');
    //         expect(historyItem).toHaveProperty('period');
    //       }
    //     }
    //   });
    // });

    // describe('get-telemed-appointments with optional fields', () => {
    //   it('should handle appointments with practitioner information -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     if (typedOutput.appointments.length > 0) {
    //       const appointment = typedOutput.appointments[0];

    //       // Practitioner might be undefined, but if present should have expected structure
    //       if (appointment.practitioner) {
    //         expect(appointment.practitioner).toMatchObject({
    //           id: expect.any(String),
    //           resourceType: 'Practitioner',
    //         });
    //       }
    //     }
    //   });

    //   it('should handle appointments with cancellation reason -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['cancelled'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     // If cancelled appointments exist, they should have cancellation reason
    //     typedOutput.appointments.forEach((appointment: TelemedAppointmentInformation) => {
    //       if (appointment.telemedStatus === 'cancelled') {
    //         // cancellationReason might be undefined or a string
    //         if (appointment.cancellationReason) {
    //           expect(typeof appointment.cancellationReason).toBe('string');
    //         }
    //       }
    //     });
    //   });

    //   it('should validate appointmentType field -- success', async () => {
    //     const getTelemedAppointmentsInput: GetTelemedAppointmentsInput = {
    //       patientFilter: 'all-patients',
    //       statusesFilter: ['ready', 'pre-video', 'on-video', 'unsigned', 'complete'],
    //       dateFilter: DateTime.now().toFormat('yyyy-MM-dd'),
    //     };

    //     let getTelemedAppointmentsOutput: any;
    //     try {
    //       getTelemedAppointmentsOutput = (
    //         await oystehrLocalZambdas.zambda.execute({
    //           id: 'GET-TELEMED-APPOINTMENTS',
    //           ...getTelemedAppointmentsInput,
    //         })
    //       ).output as GetTelemedAppointmentsResponseEhr;
    //     } catch (error) {
    //       console.error('Error executing zambda:', error);
    //       getTelemedAppointmentsOutput = error as Error;
    //     }

    //     expect(getTelemedAppointmentsOutput instanceof Error).toBe(false);
    //     const typedOutput = getTelemedAppointmentsOutput as GetTelemedAppointmentsResponseEhr;

    //     if (typedOutput.appointments.length > 0) {
    //       const appointment = typedOutput.appointments[0];

    //       // appointmentType should be present
    //       expect(appointment.appointmentType).toBeDefined();
    //       expect(typeof appointment.appointmentType).toBe('string');
    //     }
    //   });
  });
});
