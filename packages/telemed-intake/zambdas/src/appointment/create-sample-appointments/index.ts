import { APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { CreateAppointmentUCTelemedParams, ZambdaInput, createFhirClient } from 'ottehr-utils';
import { index as createAppointment } from '../create-appointment';
import { checkOrCreateToken } from '../lib/utils';
import { FhirClient, SearchParam } from '@zapehr/sdk';

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    zapehrToken = await checkOrCreateToken(zapehrToken, input.secrets);
    const fhirClient = createFhirClient(zapehrToken);
    const randomPatientInfo = await generateRandomPatientInfo(fhirClient);

    input.body = JSON.stringify(randomPatientInfo);

    const response = await createAppointment(input);
    return response;
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

const generateRandomPatientInfo = async (fhirClient: FhirClient): Promise<CreateAppointmentUCTelemedParams> => {
  const randomFirstName = `TestFirstName${uuidv4().slice(0, 5)}`;
  const randomLastName = `TestLastName${uuidv4().slice(0, 5)}`;
  const randomEmail = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@example.com`;
  const randomDateOfBirth = DateTime.now()
    .minus({ years: Math.floor(Math.random() * 26) })
    .toISODate();

  const visitTypes: ('prebook' | 'now')[] = ['prebook', 'now'];
  const visitServices: ('in-person' | 'telemedicine')[] = ['in-person', 'telemedicine'];

  const searchParams: SearchParam[] = [{ name: 'status', value: 'active' }];

  const availableLocations: any[] = await fhirClient?.searchResources({
    resourceType: 'Location',
    searchParams: searchParams,
  });

  const randomLocationIndex = Math.floor(Math.random() * availableLocations.length);
  const randomLocationId = availableLocations[randomLocationIndex].id;

  return {
    patient: {
      newPatient: true,
      firstName: randomFirstName,
      lastName: randomLastName,
      dateOfBirth: randomDateOfBirth,
      sex: 'male',
      email: randomEmail,
      emailUser: 'Patient',
    },
    slot: DateTime.now()
      .plus({ days: Math.floor(Math.random() * 30) })
      .toISO(),
    scheduleType: 'location',
    visitType: visitTypes[Math.floor(Math.random() * visitTypes.length)],
    visitService: visitServices[Math.floor(Math.random() * visitServices.length)],
    locationID: randomLocationId,
    timezone: 'UTC',
    unconfirmedDateOfBirth: randomDateOfBirth,
  };
};
