import Oystehr from '@oystehr/sdk';
import { Appointment } from 'fhir/r4b';
import { getAuth0Token } from '../src/shared';
import { contact, healthcareContacts, patient } from './appointment-validation.test';
import { vi } from 'vitest';
export const DEFAULT_TEST_TIMEOUT = 100000;
export const location = '71bc5925-65d6-471f-abd0-be357043172a';
import { SECRETS } from './data/secrets';

describe.skip('appointments tests', () => {
  let oystehr: Oystehr | null = null;
  let token = null;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  beforeAll(async () => {
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({ accessToken: token, fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API });
  });

  function createAppointment(body?: any): Promise<any> {
    if (!oystehr) {
      throw new Error('zambdaClient is not defined');
    }
    return oystehr.zambda.execute({ id: 'create-appointment', ...body });
  }

  function getAllAvailableSlots(body?: any): Promise<any> {
    if (!oystehr) {
      throw new Error('zambdaClient is not defined');
    }
    return oystehr.zambda.execute({ id: 'get-slots-availability', ...body });
  }

  function updateAppointment(body?: any): Promise<any> {
    if (!oystehr) {
      throw new Error('zambdaClient is not defined');
    }
    return oystehr.zambda.execute({ id: 'update-appointment', ...body });
  }

  test('Create an appointment successfully with available slot, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const res = await getAllAvailableSlots({
      locationId: location,
    });
    const allAvailableSlots = res?.available;

    if (!allAvailableSlots) {
      throw new Error('No available slots!');
    }

    // Create an appointment for the selected slot
    const response = await createAppointment({
      // slot with an earlier time
      slot: allAvailableSlots?.[0],
      patient: patient,
      healthcareContacts: healthcareContacts,
      contact: contact,
      timezone: 'America/New_York',
      location: location,
    });
    console.log('TEST RESPONSE', response);
    expect(response.message).toEqual('Successfully created an appointment and encounter');
    const appointmentID = response.appointment;

    const appointment: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentID,
    });

    // Check the booking has expected values
    if (!appointment) {
      throw new Error('appointment is not defined');
    }

    expect(appointment.description).toEqual(patient.reasonForVisit.join(','));
    expect(appointment.status).toEqual('booked');
  });

  test('Create consecutive appointments successfully with available slots for same user, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const res = await getAllAvailableSlots({
      locationId: location,
    });
    const allAvailableSlots = res?.available;

    if (!allAvailableSlots) {
      throw new Error('No available slots!');
    }

    // Create an appointment for the selected slot
    const response = await createAppointment({
      // slot with an earlier time
      slot: allAvailableSlots?.[0],
      patient: patient,
      healthcareContacts: healthcareContacts,
      contact: contact,
      timezone: 'America/New_York',
      location: location,
    });
    console.log('TEST RESPONSE', response);
    expect(response.message).toEqual('Successfully created an appointment and encounter');
    const appointmentID = response.appointment;

    const appointment: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentID,
    });

    // Check the booking has expected values
    if (!appointment) {
      throw new Error('appointment is not defined');
    }

    expect(appointment.description).toEqual(patient.reasonForVisit.join(','));
    expect(appointment.status).toEqual('booked');

    const responseTwo = await createAppointment({
      // slot with an later time
      slot: allAvailableSlots?.[1],
      patient: patient,
      healthcareContacts: healthcareContacts,
      contact: contact,
      timezone: 'America/New_York',
      location: location,
    });
    console.log('TEST RESPONSE', responseTwo);
    expect(responseTwo.message).toEqual('Successfully created an appointment and encounter');
    const appointmentTwoId = responseTwo.appointment;

    const appointmentTwo: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentTwoId,
    });

    // Check the booking has expected values
    if (!appointmentTwo) {
      throw new Error('second appointment is not defined');
    }
    expect(appointmentTwoId).not.toMatch(appointmentID);
    expect(appointmentTwo.description).toEqual(patient.reasonForVisit.join(','));
    expect(appointmentTwo.status).toEqual('booked');
  });

  test('Create and Update an appointment successfully with another available slot, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const res = await getAllAvailableSlots({
      locationId: location,
    });
    const allAvailableSlots = res?.available;

    if (!allAvailableSlots) {
      throw new Error('No available slots!');
    }

    // Create an appointment for the selected slot
    const response = await createAppointment({
      // slot with an earlier time
      slot: allAvailableSlots?.[0],
      patient: patient,
      healthcareContacts: healthcareContacts,
      contact: contact,
      timezone: 'America/New_York',
      location: location,
    });
    console.log('TEST RESPONSE', response);
    expect(response.message).toEqual('Successfully created an appointment and encounter');
    const appointmentID = response.appointment;

    const appointment: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentID,
    });

    // Check the booking has expected values
    if (!appointment) {
      throw new Error('appointment is not defined');
    }

    expect(appointment.description).toEqual(patient.reasonForVisit.join(','));
    expect(appointment.status).toEqual('booked');

    const updatedAppointmentResponse = await updateAppointment({
      // slot with an later time
      slot: allAvailableSlots?.[1],
      appointmentID: appointmentID,
    });
    console.log('UPDATE RESPONSE', updatedAppointmentResponse);
    expect(updatedAppointmentResponse.message).toEqual('Successfully updated an appointment');
    const updatedappointmentID = updatedAppointmentResponse.appointment;

    const updatedAppointment: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: updatedappointmentID,
    });

    // Check the booking has expected values
    if (!updatedAppointment) {
      throw new Error('updated appointment is not defined');
    }
    expect(updatedAppointment.description).toEqual(patient.reasonForVisit.join(','));
    expect(updatedAppointment.status).toEqual('booked');
  });

  test('Create and Update an appointment unsuccessfully by passing in empty request body for update, fail', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const res = await getAllAvailableSlots({
      locationId: location,
    });
    const allAvailableSlots = res?.available;

    if (!allAvailableSlots) {
      throw new Error('No available slots!');
    }

    // Create an appointment for the selected slot
    const response = await createAppointment({
      // slot with an earlier time
      slot: allAvailableSlots?.[0],
      patient: patient,
      healthcareContacts: healthcareContacts,
      contact: contact,
      timezone: 'America/New_York',
      location: location,
    });
    console.log('TEST RESPONSE', response);
    expect(response.message).toEqual('Successfully created an appointment and encounter');
    const appointmentID = response.appointment;

    const appointment: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentID,
    });

    // Check the booking has expected values
    if (!appointment) {
      throw new Error('appointment is not defined');
    }

    expect(appointment.description).toEqual(patient.reasonForVisit.join(','));
    expect(appointment.status).toEqual('booked');

    await expect(updateAppointment()).rejects.toEqual({
      error: 'No request body provided',
    });
  });

  test('Create and Update an appointment unsuccessfully by passing in a slot timing in the past, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const res = await getAllAvailableSlots({
      locationId: location,
    });
    const allAvailableSlots = res?.available;

    if (!allAvailableSlots) {
      throw new Error('No available slots!');
    }

    // Create an appointment for the selected slot
    const response = await createAppointment({
      // slot with an earlier time
      slot: allAvailableSlots?.[0],
      patient: patient,
      healthcareContacts: healthcareContacts,
      contact: contact,
      timezone: 'America/New_York',
      location: location,
    });
    console.log('TEST RESPONSE', response);
    expect(response.message).toEqual('Successfully created an appointment and encounter');
    const appointmentID = response.appointment;

    const appointment: Appointment = await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentID,
    });

    // Check the booking has expected values
    if (!appointment) {
      throw new Error('appointment is not defined');
    }

    expect(appointment.description).toEqual(patient.reasonForVisit.join(','));
    expect(appointment.status).toEqual('booked');

    await expect(
      updateAppointment({
        slot: '2023-08-26T04:00:00Z',
        appointmentID: appointmentID,
      })
    ).rejects.toEqual({
      error: 'Unable to update appointment in the past!',
    });
  });
});
