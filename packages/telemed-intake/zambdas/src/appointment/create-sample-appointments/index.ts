import { APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { CreateAppointmentUCTelemedParams, SecretsKeys, ZambdaInput, createFhirClient, getSecret } from 'ottehr-utils';
import { index as createAppointment } from '../create-appointment';
import { checkOrCreateToken } from '../lib/utils';
import { FhirClient, SearchParam } from '@zapehr/sdk';

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    zapehrToken = await checkOrCreateToken(zapehrToken, input.secrets);
    const fhirClient = createFhirClient(zapehrToken);

    const responses = [];

    for (let i = 0; i < 5; i++) {
      const randomPatientInfo = await generateRandomPatientInfo(fhirClient);
      const inputBody = JSON.stringify(randomPatientInfo);
      const TELEMED_CREATE_APPOINTMENT_ZAMBDA_ID = getSecret(
        SecretsKeys.TELEMED_CREATE_APPOINTMENT_ZAMBDA_ID,
        input.secrets,
      );

      const response = await fetch(
        `https://project-api.zapehr.com/v1/zambda/${TELEMED_CREATE_APPOINTMENT_ZAMBDA_ID}/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlRRc2xGbWlRX01ZTzg4Z3BRUnlvRCJ9.eyJodHRwczovL2FwaS56YXBlaHIuY29tL3Byb2plY3RfaWQiOiI4OTFhZTQwYi04Y2E1LTRkZTgtYTEzMS0zZTU5ZjI4NDZhMTciLCJpc3MiOiJodHRwczovL2F1dGguemFwZWhyLmNvbS8iLCJzdWIiOiJzbXN8NjU3MGFiN2RiMTZkMjYyOWE3MDI2OTgwIiwiYXVkIjpbImh0dHBzOi8vYXBpLnphcGVoci5jb20iLCJodHRwczovL3phcGVoci51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzE5NjA2NDg1LCJleHAiOjE3MTk2OTI4ODUsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJhenAiOiI1a0ZrM3NoN0hEZENaMFF4ejA5a1dSMGFmSzBQRTQxZSJ9.DIJmJ-C7n19tWkO4A7u3zjMyFfNbBo5i_aNxRlDeaah4Jre5IIGOnlAGN5g09zqctZGZNqJJFrTXOCMy9svVgOSdb5LQr0sAlQGn_gqVeE16UH-ACpSbkNOeJZLt408JtVPltXrfZ4_Rf3jmxyWn3Kj4AxlILFztrS6b8j5Bvaww44qMn2o0eVK-jrKVgBDTAVH5dth7RiKcGS89h6arNsd5IvPAfpzFESkKvkblfnsZbOPiWMHtd0F-wsexALjfNf9yV1zPQNvZff-svCEFHqD-IzRJQFu9dBDDAlgyNAIlkvFJKuXLl9TTevP-mp1LfZ5jJZNASU7rZ2agzKz8Aw`,
          },
          body: inputBody,
        },
      );

      const responseData = await response.json();
      responses.push(responseData);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(responses),
    };
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

const generateRandomPatientInfo = async (fhirClient: FhirClient): Promise<CreateAppointmentUCTelemedParams> => {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown'];
  const sexes: ('male' | 'female' | 'other' | 'unknown')[] = ['male', 'female', 'other', 'unknown'];
  const visitTypes: ('prebook' | 'now')[] = ['prebook', 'now'];
  const visitServices: ('in-person' | 'telemedicine')[] = ['in-person', 'telemedicine'];

  const searchParams: SearchParam[] = [{ name: 'status', value: 'active' }];
  const availableLocations: any[] = await fhirClient?.searchResources({
    resourceType: 'Location',
    searchParams: searchParams,
  });

  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomEmail = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@example.com`;
  const randomDateOfBirth = DateTime.now()
    .minus({ years: Math.floor(Math.random() * 26) })
    .toISODate();
  const randomSex = sexes[Math.floor(Math.random() * sexes.length)];
  const randomLocationIndex = Math.floor(Math.random() * availableLocations.length);
  const randomLocationId = availableLocations[randomLocationIndex].id;

  return {
    patient: {
      newPatient: true,
      firstName: randomFirstName,
      lastName: randomLastName,
      dateOfBirth: randomDateOfBirth,
      sex: randomSex,
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
  };
};
