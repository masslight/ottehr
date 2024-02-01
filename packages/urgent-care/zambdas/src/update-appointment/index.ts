import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { PatientInfo } from '../types';
import { MAXIMUM_AGE, MAXIMUM_CHARACTER_LIMIT, MINIMUM_AGE, ageIsInRange } from '../shared/validation';
import { DateTime } from 'luxon';
import {
  // createAppClient,
  createFhirClient,
  getParticipantFromAppointment,
  checkValidBookingTime,
} from '../shared/helpers';
import { updateAppointmentTime } from '../shared/fhir';
import { getAccessToken, DATETIME_FULL_NO_YEAR } from '../shared';
import { Appointment, Location, Patient } from 'fhir/r4';
import { getConversationSIDForRelatedPersons, sendMessages } from '../create-appointment';
import { formatDate } from '../shared/dateUtils';
import { getRelatedPersonForPatient } from '../shared/auth';
import { AuditableZambdaEndpoints, createAuditEvent } from '../shared/userAuditLog';
import { Secrets, ZambdaInput, getPatientContactEmail, getPatientFirstName, topLevelCatch } from 'utils';

export interface UpdateAppointmentInput {
  appointmentID: string;
  slot: string;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    // Step 1: Validate input
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, slot, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);

    let startTime = slot;
    if (!checkValidBookingTime(startTime)) {
      throw new Error('Cannot update an appointment in the past!');
    }
    startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
    const originalDate = DateTime.fromISO(startTime).setZone('UTC');
    const endTime = originalDate.plus({ minutes: 15 }).toISO();
    console.log(`getting appointment with id ${appointmentID}`);
    const fhirAppointment: Appointment = await fhirClient.readResource({
      resourceType: 'Appointment',
      resourceId: appointmentID,
    });
    console.log(`checking appointment with id ${appointmentID} is not checked in`);
    if (fhirAppointment.status === 'arrived') {
      throw new Error('You cannot modify an appointment that is already checked in');
    }
    console.log(`checking appointment with id ${appointmentID} is not in the past`);
    const appointmentDateTime = DateTime.fromISO(fhirAppointment?.start ?? '');
    const formattedDate = appointmentDateTime.toISO();
    if (!checkValidBookingTime(formattedDate ?? '')) {
      throw new Error('Cannot update an appointment in the past ');
    }
    console.log(`updating appointment with id ${appointmentID}`);
    const updatedAppointment: Appointment = await updateAppointmentTime(
      fhirAppointment,
      startTime,
      endTime ?? '',
      fhirClient,
    );
    console.log('getting patient');
    const fhirPatient: Patient = await fhirClient.readResource({
      resourceType: 'Patient',
      resourceId: getParticipantFromAppointment(updatedAppointment, 'Patient'),
    });
    console.log('getting location');
    const fhirLocation: Location = await fhirClient.readResource({
      resourceType: 'Location',
      resourceId: getParticipantFromAppointment(updatedAppointment, 'Location'),
    });

    if (!fhirLocation.name) {
      throw new Error('fhirLocation does not have a name');
    }

    // const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    // const user = await appClient.getMe();
    const relatedPerson = await getRelatedPersonForPatient(fhirPatient.id || '', fhirClient);
    if (relatedPerson) {
      const conversationSID = await getConversationSIDForRelatedPersons([relatedPerson], fhirClient);
      const timezone = fhirLocation.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
      )?.valueString;
      await sendMessages(
        getPatientContactEmail(fhirPatient), // todo use the right email
        getPatientFirstName(fhirPatient),
        conversationSID || '',
        originalDate.setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
        secrets,
        fhirLocation,
        appointmentID,
        fhirAppointment.appointmentType?.text || '',
      );
    } else {
      console.log(`No RelatedPerson found for patient ${fhirPatient.id} not sending text message`);
    }

    const response = {
      message: 'Successfully updated an appointment',
      appointmentID: updatedAppointment.id ?? null,
    };

    await createAuditEvent(
      AuditableZambdaEndpoints.appointmentUpdate,
      fhirClient,
      input,
      fhirPatient.id || '',
      secrets,
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('update-appointment', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

export function validateInternalInformation(patient: PatientInfo): void {
  if (patient.dateOfBirth && !ageIsInRange(patient.dateOfBirth)) {
    throw new Error(`age not inside range of ${MINIMUM_AGE} to ${MAXIMUM_AGE}`);
  }

  if (patient.reasonForVisit && patient.reasonForVisit.join(', ').length > MAXIMUM_CHARACTER_LIMIT) {
    throw new Error(`all visit reasons must be less than ${MAXIMUM_CHARACTER_LIMIT} characters`);
  }
}

export function createMinimumAndMaximumTime(date: DateTime): string[] {
  const minimum = formatDate(date.plus({ days: 1 }));
  const maximum = formatDate(date.plus({ days: 30 }));
  return [minimum, maximum];
}
