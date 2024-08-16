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
  authToken: string,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!fhirClient) {
      throw new Error('FHIR client not initialized');
    }
    const responses: any[] = [];

    const createAppointmentZambdaId = import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID;

    const intakeZambdaUrl = import.meta.env.VITE_APP_INTAKE_ZAMBDAS_URL;

    for (let i = 0; i < 1; i++) {
      const randomPatientInfo = await generateRandomPatientInfo(fhirClient, visitService);
      const inputBody = JSON.stringify(randomPatientInfo);

      const response = await fetch(`${intakeZambdaUrl}/zambda/${createAppointmentZambdaId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: inputBody,
      });
      responses.push(response);
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
