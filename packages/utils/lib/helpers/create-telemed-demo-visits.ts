import Oystehr from '@oystehr/sdk';
import { Address, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isLocationVirtual } from '../fhir';
import { CreateAppointmentUCTelemedResponse, PatientInfo, PersonSex, SubmitPaperworkParameters } from '../types';
import { makeSequentialPaperworkPatches } from './create-prebook-demo-visits';
import {
  getAdditionalQuestionsAnswers,
  getAllergiesStepAnswers,
  getConsentStepAnswers,
  getContactInformationAnswers,
  getInviteParticipantStepAnswers,
  getMedicalConditionsStepAnswers,
  getMedicationsStepAnswers,
  getPatientDetailsStepAnswers,
  getPaymentOptionSelfPayAnswers,
  getResponsiblePartyStepAnswers,
  getSchoolWorkNoteStepAnswers,
  getSurgicalHistoryStepAnswers,
  isoToDateObject,
} from './helpers';

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

export const createSampleTelemedAppointments = async ({
  oystehr,
  authToken,
  phoneNumber,
  createAppointmentZambdaId,
  islocal,
  intakeZambdaUrl,
  selectedLocationId,
  demoData,
}: {
  oystehr: Oystehr | undefined;
  authToken: string;
  phoneNumber: string;
  createAppointmentZambdaId: string;
  islocal: boolean;
  intakeZambdaUrl: string;
  selectedLocationId?: string;
  demoData?: DemoAppointmentData;
}): Promise<CreateAppointmentUCTelemedResponse | null> => {
  if (!oystehr) {
    console.log('oystehr client is not defined');
    return null;
  }

  try {
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

      console.log({ createAppointmentResponse });

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

      const birthDate = isoToDateObject(patientInfo.patient.dateOfBirth || '') || undefined;

      if (questionnaireResponseId) {
        await makeSequentialPaperworkPatches(
          questionnaireResponseId,
          [
            getContactInformationAnswers({
              firstName: patientInfo.patient.firstName,
              lastName: patientInfo.patient.lastName,
              birthDate,
              email: patientInfo.patient.email,
              phoneNumber: patientInfo.patient.phoneNumber,
              birthSex: patientInfo.patient.sex,
            }),
            getPatientDetailsStepAnswers({}),
            getMedicationsStepAnswers(),
            getAllergiesStepAnswers(),
            getMedicalConditionsStepAnswers(),
            getSurgicalHistoryStepAnswers(),
            getAdditionalQuestionsAnswers(),
            getPaymentOptionSelfPayAnswers(),
            getResponsiblePartyStepAnswers({}),
            getSchoolWorkNoteStepAnswers(),
            getConsentStepAnswers({}),
            getInviteParticipantStepAnswers(),
          ],
          intakeZambdaUrl,
          authToken
        );

        const response = await fetch(`${intakeZambdaUrl}/zambda/submit-paperwork/execute-public`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(<SubmitPaperworkParameters>{
            answers: [],
            questionnaireResponseId: questionnaireResponseId,
            appointmentId,
          }),
        });

        if (!response.ok) {
          // This may be an error if some paperwork required answers were not provided.
          // Check QuestionnaireResponse resource if it corresponds to all Questionnaire requirements
          throw new Error(
            `Error submitting paperwork, response: ${response}, body: ${JSON.stringify(await response.json())}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 5000)); // todo delete
      }
    }

    return appointmentData;
  } catch (error: any) {
    console.error('Error creating appointments:', error);
    return null;
  }
};
