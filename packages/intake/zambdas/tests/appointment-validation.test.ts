import Oystehr from '@oystehr/sdk';
import { vi } from 'vitest';
import { SECRETS } from './data/secrets';

export const patient: any = {
  firstName: 'a',
  lastName: 'a',
  sex: 'male',
  dateOfBirth: '2010-01-01',
  ethnicity: 'Hispanic or Latino',
  race: 'American Indian or Alaska Native',
  reasonForVisit: ['a'],
};

export const location = '71bc5925-65d6-471f-abd0-be357043172a';

export const healthcareContacts: any = {
  physicianFirstName: 'a',
  physicianLastName: 'a',
  physicianPhoneNumber: '(123) 456-7890',
  pharmacyName: 'a',
  pharmacyAddress: 'a',
};

export const contact: any = {
  streetAddressLine1: 'a',
  streetAddressLine2: '',
  city: 'a',
  state: 'AL',
  zip: '12345',
  formUser: 'patient',
  patientEmail: 'a@a.com',
  patientNumber: '(123) 721-7372',
  parentEmail: 'test@test.com',
  parentNumber: '(123) 721-7372',
};

export const DEFAULT_TEST_TIMEOUT = 100000;

describe.skip('appointments validation tests', () => {
  let oystehr: Oystehr | null = null;

  const incompletePatientError =
    'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.ethnicity", "patient.race", "patient.reasonForVisit"';

  const incompleteHealthcareContactsError =
    'These fields are required and may not be empty: "healthcareContacts.physicianFirstName", "healthcareContacts.physicianLastName", "healthcareContacts.physicianPhoneNumber", "healthcareContacts.pharmacyName ",  "healthcareContacts.pharmacyAddress"';

  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  beforeAll(async () => {
    // token = await getAuth0Token({
    //   AUTH0_ENDPOINT: AUTH0_ENDPOINT,
    //   AUTH0_CLIENT: AUTH0_CLIENT,
    //   AUTH0_SECRET: AUTH0_SECRET,
    //   AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    // });

    const { PROJECT_API } = SECRETS;
    oystehr = new Oystehr({ projectApiUrl: PROJECT_API });
  });

  function createAppointment(body?: any): Promise<any> {
    if (!oystehr) {
      throw new Error('zambdaClient is not defined');
    }
    return oystehr.zambda.execute({ id: 'create-appointment', ...body });
  }

  test('Create an appointment without a body, fail', async () => {
    await expect(createAppointment()).rejects.toEqual({
      error: 'No request body provided',
    });
  });

  test('Create an appointment with an empty body, fail', async () => {
    await expect(createAppointment({})).rejects.toEqual({
      error: 'These fields are required: "slot", "patient", "healthcareContacts", "contact", "timezone", "location"',
    });
  });

  test('Create an appointment without full patient information, fail', async () => {
    let patientTemp = structuredClone(patient);
    delete patientTemp.firstName;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });

    patientTemp = structuredClone(patient);
    delete patientTemp.lastName;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });

    patientTemp = structuredClone(patient);
    delete patientTemp.sex;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });

    patientTemp = structuredClone(patient);
    delete patientTemp.dateOfBirth;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });

    patientTemp = structuredClone(patient);
    delete patientTemp.ethnicity;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });

    patientTemp = structuredClone(patient);
    delete patientTemp.race;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });

    patientTemp = structuredClone(patient);
    delete patientTemp.reasonForVisit;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: {},
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });
  });

  test('Create an appointment without full healthcare information, fail', async () => {
    let healthcareContactsTemp = structuredClone(healthcareContacts);
    delete healthcareContactsTemp.physicianFirstName;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContactsTemp,
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteHealthcareContactsError,
    });

    healthcareContactsTemp = structuredClone(healthcareContacts);
    delete healthcareContactsTemp.physicianLastName;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContactsTemp,
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteHealthcareContactsError,
    });

    healthcareContactsTemp = structuredClone(healthcareContacts);
    delete healthcareContactsTemp.physicianPhoneNumber;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContactsTemp,
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteHealthcareContactsError,
    });

    healthcareContactsTemp = structuredClone(healthcareContacts);
    delete healthcareContactsTemp.pharmacyName;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContactsTemp,
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteHealthcareContactsError,
    });

    healthcareContactsTemp = structuredClone(healthcareContacts);
    delete healthcareContactsTemp.pharmacyAddress;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContactsTemp,
        contact: {},
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteHealthcareContactsError,
    });
  });

  test('Create an appointment without full contact information, fail', async () => {
    const incompleteContactError =
      'These fields are required: "contact.streetAddressLine1", "contact.city", "contact.state", "contact.zip"';
    let contactTemp = structuredClone(contact);
    delete contactTemp.streetAddressLine1;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteContactError,
    });

    contactTemp = structuredClone(contact);
    delete contactTemp.city;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteContactError,
    });

    contactTemp = structuredClone(contact);
    delete contactTemp.state;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteContactError,
    });

    contactTemp = structuredClone(contact);
    delete contactTemp.zip;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteContactError,
    });

    contactTemp = structuredClone(contact);
    delete contactTemp.patientEmail;
    delete contactTemp.patientNumber;
    delete contactTemp.parentEmail;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: 'If patient email and number are undefined or empty, guardian email and number must be defined',
    });

    contactTemp = structuredClone(contact);
    delete contactTemp.parentEmail;
    delete contactTemp.parentNumber;
    delete contactTemp.patientNumber;
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: 'If guardian email and number are undefined or empty, patient email and number must be defined',
    });
  });

  test('Create an appointment with unaccepted patient sex, fail', async () => {
    const patientTemp = structuredClone(patient);
    patientTemp.sex = 'test';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: '"patient.sex" must be one of the following values: ["male","female","other"]',
    });
  });

  test('Create an appointment with unaccepted patient ethnicity, fail', async () => {
    const patientTemp = structuredClone(patient);
    patientTemp.ethnicity = 'test';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error:
        '"patient.ethnicity" must be one of the following values: ["Hispanic or Latino","Not Hispanic or Latino","Unknown"]',
    });
  });

  test('Create an appointment with unaccepted patient race, fail', async () => {
    const patientTemp = structuredClone(patient);
    patientTemp.race = 'test';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error:
        '"patient.race" must be one of the following values: ["American Indian or Alaska Native","Asian","Black or African American","Hawaiian or Pacific Islander","Other","Unknown","Decline to Specify","White"]',
    });
  });

  test('Create an appointment with unaccepted patient date of birth, fail', async () => {
    const patientTemp = structuredClone(patient);
    patientTemp.dateOfBirth = '01-01-1990';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: '"patient.dateOfBirth" was not read as a valid date',
    });
  });

  test('Create an appointment with unaccepted patient first name, fail', async () => {
    const patientTemp = structuredClone(patient);
    patientTemp.firstName = '';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patientTemp,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });
  });

  test('Create an appointment with unaccepted healthcareContacts physician first name, fail', async () => {
    const healthcareContactsTemp = structuredClone(healthcareContacts);
    healthcareContactsTemp.physicianFirstName = '';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContactsTemp,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: incompleteHealthcareContactsError,
    });
  });

  test('Create appointment with invalid zip code, fail', async () => {
    const contactTemp = structuredClone(contact);
    contactTemp.zip = 'hello';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: '"contact.zip" must be 5 digits',
    });
    contactTemp.zip = '1234';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: '"contact.zip" must be 5 digits',
    });
  });

  test('Create an appointment with unaccepted contact state, fail', async () => {
    const contactTemp = structuredClone(contact);
    contactTemp.state = 'A';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: '"contact.state" and "patient.state" must be 2 letters',
    });

    contactTemp.state = 'AB';
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contactTemp,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error:
        '"contact.state" must be one of the following values: ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VI","VT","WA","WV","WI","WY"]',
    });
  });

  test('Create an appointment with no timezone provided, fail', async () => {
    await expect(
      createAppointment({
        slot: '2023-08-26T04:00:00Z',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: undefined,
        location: location,
      })
    ).rejects.toEqual({
      error: 'These fields are required: "slot", "patient", "healthcareContacts", "contact", "timezone", "location"',
    });
  });

  test('Create an appointment with invalid slot provided, fail', async () => {
    await expect(
      createAppointment({
        slot: '2023-08-26T',
        patient: patient,
        healthcareContacts: healthcareContacts,
        contact: contact,
        timezone: 'America/New_York',
        location: location,
      })
    ).rejects.toEqual({
      error: '"slot" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS+zz:zz)',
    });
  });
});
