import { DateTime } from 'luxon';
import { Location, QuestionnaireResponse, Patient, Address } from 'fhir/r4b';
import Oystehr from '@oystehr/sdk';
import { PersonSex, PatientInfo, CreateAppointmentUCTelemedResponse } from '../types';
import { isLocationVirtual } from '../fhir';
import { updateQuestionnaireResponse } from './helpers';

interface AppointmentData {
  firstNames?: string[];
  lastNames?: string[];
  reasonsForVisit?: string[];
  phoneNumbers?: string[];
  emails?: string[];
  gender?: string;
  birthDate?: string;
  telecom?: {
    system: string;
    value: string;
  }[];
  address?: Address[];
}

interface DemoConfig {
  numberOfAppointments?: number;
}

type DemoAppointmentData = AppointmentData & DemoConfig;

interface CreateAppointmentInput {
  locationState: string;
  patient: PatientInfo;
  // user: User;
  unconfirmedDateOfBirth: string;
  // secrets: Secrets | null;
}

const DEFAULT_FIRST_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Ethan',
  'Gabriel',
  'Hannah',
  'Jake',
  'John',
  'Jane',
  'Katherine',
  'Liam',
  'Mia',
  'Noah',
  'Olivia',
  'William',
];
const DEFAULT_LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Jones',
  'Brown',
  'Clark',
  'Davis',
  'Elliott',
  'Foster',
  'Garcia',
  'Hernandez',
];
const DEFAULT_REASONS_FOR_VISIT = [
  'Cough and/or congestion',
  'Fever',
  'Throat pain',
  'Ear pain',
  'Vomiting and/or diarrhea',
  'Abdominal (belly) pain',
  'Rash or skin issue',
  'Urinary problem',
  'Breathing problem',
  'Injury to arms or legs',
  'Injury to head or fall on head',
  'Cut to arms or legs',
  'Cut to face or head',
  'Choked or swallowed something',
  'Allergic reaction',
  'Eye concern',
];

const generateRandomPatientInfo = async (
  oystehr: Oystehr,
  phoneNumber?: string,
  demoData?: DemoAppointmentData,
  selectedLocationId?: string
): Promise<CreateAppointmentInput> => {
  const {
    firstNames = DEFAULT_FIRST_NAMES,
    lastNames = DEFAULT_LAST_NAMES,
    reasonsForVisit = DEFAULT_REASONS_FOR_VISIT,
    emails = [],
    phoneNumbers = [],
    gender,
    birthDate,
    address,
    telecom,
  } = demoData || {};

  const sexes: PersonSex[] = [PersonSex.Male, PersonSex.Female, PersonSex.Intersex];
  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomEmail =
    emails.length > 0
      ? emails[Math.floor(Math.random() * emails.length)]
      : `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@example.com`;
  const randomPhoneNumber =
    phoneNumbers.length > 0 ? phoneNumbers[Math.floor(Math.random() * phoneNumbers.length)] : phoneNumber;
  const randomDateOfBirth =
    birthDate ||
    DateTime.now()
      .minus({ years: 7 + Math.floor(Math.random() * 16) })
      .toISODate();
  const randomSex = (gender as Patient['gender']) || sexes[Math.floor(Math.random() * sexes.length)];

  const allOffices = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: '_count', value: '1000' },
        { name: 'address-state:missing', value: 'false' },
      ],
    })
  ).unbundle();

  const telemedOffices = allOffices.filter((loc) => isLocationVirtual(loc));
  const randomTelemedLocationId = telemedOffices[Math.floor(Math.random() * telemedOffices.length)].id!;
  const randomReason = reasonsForVisit[Math.floor(Math.random() * reasonsForVisit.length)];

  const patientData = {
    newPatient: true,
    firstName: randomFirstName,
    lastName: randomLastName,
    dateOfBirth: randomDateOfBirth,
    sex: randomSex,
    email: randomEmail,
    phoneNumber: randomPhoneNumber,
    reasonForVisit: randomReason,
    ...(address ? { address } : {}),
    ...(telecom ? { telecom } : {}),
  };

  return {
    patient: patientData,
    unconfirmedDateOfBirth: randomDateOfBirth,
    locationState: selectedLocationId || randomTelemedLocationId, // ?
  };
};

export const createSampleTelemedAppointments = async (
  oystehr: Oystehr | undefined,
  authToken: string,
  phoneNumber: string,
  createAppointmentZambdaId: string,
  islocal: boolean,
  intakeZambdaUrl: string,
  selectedLocationId?: string,
  demoData?: DemoAppointmentData
): Promise<CreateAppointmentUCTelemedResponse | null> => {
  if (!oystehr) {
    console.log('oystehr client is not defined');
    return null;
  }

  try {
    const responses: any[] = [];
    let appointmentData: CreateAppointmentUCTelemedResponse | null = null;
    const numberOfAppointments = demoData?.numberOfAppointments || 10;

    for (let i = 0; i < numberOfAppointments; i++) {
      const patientInfo = await generateRandomPatientInfo(oystehr, phoneNumber, demoData, selectedLocationId);

      const createAppointmentResponse = await fetch(`${intakeZambdaUrl}/zambda/${createAppointmentZambdaId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(patientInfo),
      });

      appointmentData = islocal
        ? await createAppointmentResponse.json()
        : (await createAppointmentResponse.json()).output;

      console.log({ appointmentData });

      if (!appointmentData) {
        console.error('Error creating appointment:', appointmentData);
        return null;
      }

      const appointmentId = appointmentData.appointmentId;
      const questionnaireResponseId = appointmentData.questionnaireId;
      const encounterId = appointmentData.encounterId;

      if (questionnaireResponseId) {
        const questionnaireResponse = updateQuestionnaireResponse({
          questionnaire: appointmentData.resources.questionnaire.questionnaire!,
          questionnaireResponseId,
          encounterId: encounterId!,
          firstName: patientInfo.patient.firstName!,
          lastName: patientInfo.patient.lastName!,
          birthDate: patientInfo.patient.dateOfBirth!,
          email: patientInfo.patient.email!,
          phoneNumber: patientInfo.patient.phoneNumber!,
          fullName: `${patientInfo.patient.firstName} ${patientInfo.patient.lastName}`,
        });

        const updatedQuestionnaireResponse = await oystehr.fhir.update<QuestionnaireResponse>(questionnaireResponse);
        responses.push(updatedQuestionnaireResponse);

        await fetch(`${intakeZambdaUrl}/zambda/submit-paperwork/execute-public`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            answers: [],
            questionnaireResponseId: updatedQuestionnaireResponse.id,
            appointmentId,
          }),
        });

        await new Promise((resolve) => setTimeout(resolve, 5000)); // todo delete
      }

      responses.push(createAppointmentResponse);
    }

    return appointmentData;
  } catch (error: any) {
    console.error('Error creating appointments:', error);
    return null;
  }
};
