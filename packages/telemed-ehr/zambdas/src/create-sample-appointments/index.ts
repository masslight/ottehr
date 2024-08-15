import { APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
// import { CreateAppointmentUCTelemedParams, SecretsKeys, ZambdaInput, createFhirClient, getSecret } from 'ottehr-utils';
import { FhirClient, SearchParam } from '@zapehr/sdk';
import { getAuth0Token, getSecret, SecretsKeys } from '../shared';
import { createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { PersonSex } from '../../../app/src/types/types';
import { Patient } from 'fhir/r4';

let zapehrToken: string;

interface PatientBaseInfo {
  firstName?: string;
  id?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

type UserType = 'Patient' | 'Parent/Guardian';

type PatientInfo = PatientBaseInfo & {
  newPatient?: boolean;
  chosenName?: string;
  sex?: Patient['gender'];
  weight?: number;
  weightLastUpdated?: string;
  email?: string;
  emailUser?: UserType;
  reasonForVisit?: string[];
  phoneNumber?: string;
  pointOfDiscovery?: boolean;
};

interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  slot?: string;
  scheduleType?: 'location' | 'provider';
  visitType?: 'prebook' | 'now';
  visitService?: 'in-person' | 'telemedicine';
  locationID?: string;
  providerID?: string;
  groupID?: string;
  unconfirmedDateOfBirth?: string | undefined;
  timezone: string;
}

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Creating sample appointments');
    zapehrToken = await getAuth0Token(input.secrets);
    const fhirClient = createFhirClient(zapehrToken, input.secrets);

    const responses = [];

    for (let i = 0; i < 5; i++) {
      const randomPatientInfo = await generateRandomPatientInfo(fhirClient);
      const inputBody = JSON.stringify(randomPatientInfo);
      const CREATE_APPOINTMENT_ZAMBDA_ID = getSecret(SecretsKeys.CREATE_APPOINTMENT_ZAMBDA_ID, input.secrets);

      const response = await fetch(
        `https://project-api.zapehr.com/v1/zambda/5213a4d7-aea0-4f14-ac9a-e7dc9aa58702/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlRRc2xGbWlRX01ZTzg4Z3BRUnlvRCJ9.eyJodHRwczovL2FwaS56YXBlaHIuY29tL3Byb2plY3RfaWQiOiI4OTFhZTQwYi04Y2E1LTRkZTgtYTEzMS0zZTU5ZjI4NDZhMTciLCJpc3MiOiJodHRwczovL2F1dGguemFwZWhyLmNvbS8iLCJzdWIiOiJzbXN8NjU3MGFiN2RiMTZkMjYyOWE3MDI2OTgwIiwiYXVkIjpbImh0dHBzOi8vYXBpLnphcGVoci5jb20iLCJodHRwczovL3phcGVoci51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzIzNTY1MjIzLCJleHAiOjE3MjM2NTE2MjMsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJhenAiOiJFVFZXamxldGhEbktyZkVOYU9WaDBtUW5iYjlhWkhqYSJ9.mEFdmax0CUN9Be-YkYx5rM7luwkb6ju0lfh3LsnGy6J9FtkO9yJUnHeVFViAi0ippeICKCqknILyOAoqWSwADPVrD2NnkBjf0cSck09ZU24VkXOoHZJQpxS_0xUt0dz-R40vKG-QuQtFg5MIYJHzumcr2t0kE3yzVVt3s97JQuodAEV0T-MfJpv95ge7KwoPTb7sa2S-AYipytYQL3RbCK6Cfj--C6h65qq6gbzmwPj6hetwvBQXd6kjusEbo3IN0OqKd3Awa_FGruZ7uchzQWHuR9mKaxwHcP5mJfbo1-FQf4H-wWQ0YotiNPboTag9k36_g1urdRIxV_-QkcvPFw`,
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
  const sexes: PersonSex[] = [PersonSex.Male, PersonSex.Female, PersonSex.Intersex];
  const visitTypes: ('prebook' | 'now')[] = ['prebook', 'now'];
  const visitServices: 'telemedicine'[] = ['telemedicine'];

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
    scheduleType: 'provider',
    visitType: 'now',
    visitService: 'telemedicine',
    providerID: '9aaea86d-5d03-48dd-ada6-76d81d299119',
    timezone: 'UTC',
  };
};
