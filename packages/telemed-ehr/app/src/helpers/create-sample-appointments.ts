import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import { FhirClient, SearchParam } from '@zapehr/sdk';
import { PersonSex } from '../../../app/src/types/types';
import { Patient, Practitioner } from 'fhir/r4';

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
  isDemo?: boolean;
}

export const createSampleAppointments = async (
  fhirClient: FhirClient | undefined,
  visitService: 'in-person' | 'telemedicine',
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Creating sample appointments');

    if (!fhirClient) {
      throw new Error('FHIR client not initialized');
    }

    const responses: any[] = [];

    console.log('FHIR client created');

    for (let i = 0; i < 5; i++) {
      const randomPatientInfo = await generateRandomPatientInfo(fhirClient, visitService);
      const inputBody = JSON.stringify(randomPatientInfo);

      const response = await fetch(
        `https://project-api.zapehr.com/v1/zambda/5213a4d7-aea0-4f14-ac9a-e7dc9aa58702/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlRRc2xGbWlRX01ZTzg4Z3BRUnlvRCJ9.eyJodHRwczovL2FwaS56YXBlaHIuY29tL3Byb2plY3RfaWQiOiI4OTFhZTQwYi04Y2E1LTRkZTgtYTEzMS0zZTU5ZjI4NDZhMTciLCJpc3MiOiJodHRwczovL2F1dGguemFwZWhyLmNvbS8iLCJzdWIiOiJzbXN8NjU3MGFiN2RiMTZkMjYyOWE3MDI2OTgwIiwiYXVkIjpbImh0dHBzOi8vYXBpLnphcGVoci5jb20iLCJodHRwczovL3phcGVoci51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzIzNjc1NTUzLCJleHAiOjE3MjM3NjE5NTMsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJhenAiOiJFVFZXamxldGhEbktyZkVOYU9WaDBtUW5iYjlhWkhqYSJ9.WD_tcjYV5lsSF485SmE36m2Sd4hOgFbJ7dr6oj3lrc02ypXJTT0lsGuDCroofjjdU5vcGdWCXJUvbD_QRb3djVIAZ-MLwZnEanqYzmaPsyGpS59yTN_oIDPop4ZxxXheLidZ_1sFwZOTuDNj8t-ROZW_LnyEJAiJmsqGZ_SL09Q5My95UBXswIt-OX1oHWK9Df10-A4WxNnKaYaKgj8RTGKhd4uj8PKLS57o-RnxQL0h4-rcXibmhYG3Scw8Ckcb7rLis6wVdd7nRN48_qTjSf5YswyCMnN2fgEBUVqqb48eNhMqsO1HKG2vw28G8Ui5PE9rheB02gNIy-bxLs7l1w`,
          },
          body: inputBody,
        },
      );
      console.log('response', response);
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

const generateRandomPatientInfo = async (
  fhirClient: FhirClient,
  visitService: 'in-person' | 'telemedicine',
): Promise<CreateAppointmentUCTelemedParams> => {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fatima', 'Gabriel', 'Hannah', 'Ibrahim', 'Jake'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Clark', 'Davis', 'Elliott', 'Foster', 'Garcia'];
  const sexes: PersonSex[] = [PersonSex.Male, PersonSex.Female, PersonSex.Intersex];

  const searchParams: SearchParam[] = [{ name: 'status', value: 'active' }];
  const availableLocations: any[] = await fhirClient?.searchResources({
    resourceType: 'Location',
    searchParams: searchParams,
  });

  const practitionersTemp: Practitioner[] = await fhirClient.searchResources({
    resourceType: 'Practitioner',
    searchParams: [
      { name: '_count', value: '1000' },
      { name: 'active', value: 'true' },
    ],
  });

  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomEmail = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@example.com`;
  const randomDateOfBirth = DateTime.now()
    .minus({ years: 7 + Math.floor(Math.random() * 16) })
    .toISODate();
  const randomSex = sexes[Math.floor(Math.random() * sexes.length)];
  const randomLocationIndex = Math.floor(Math.random() * availableLocations.length);
  console.log('randomLoc', availableLocations);
  const randomLocationId = availableLocations[randomLocationIndex].id;
  const randomProviderId = practitionersTemp[Math.floor(Math.random() * practitionersTemp.length)].id;

  if (visitService === 'telemedicine') {
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
      scheduleType: 'provider',
      visitType: 'now',
      visitService: visitService,
      providerID: randomProviderId,
      timezone: 'UTC',
      isDemo: true,
    };
  }

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
    visitType: 'prebook',
    visitService: visitService,
    locationID: randomLocationId,
    timezone: 'UTC',
    isDemo: true,
  };
};
