import Oystehr from '@oystehr/sdk';
import { Address, Location, Patient, QuestionnaireResponseItem } from 'fhir/r4b';
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
  customLocationId?: string;
}

interface DemoConfig {
  numberOfAppointments?: number;
}

type DemoAppointmentData = AppointmentData & DemoConfig;

export interface CreateAppointmentInput {
  locationState: string;
  patient: PatientInfo;
  // user: User;
  unconfirmedDateOfBirth: string;
  // secrets: Secrets | null;
}

export type GetPaperworkAnswers = ({
  patientInfo,
  zambdaUrl,
  authToken,
  projectId,
  appointmentId,
}: {
  patientInfo: CreateAppointmentInput;
  zambdaUrl: string;
  authToken: string;
  projectId: string;
  appointmentId: string;
}) => Promise<QuestionnaireResponseItem[]>;

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
  locationState?: string
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
  const randomTelemedLocationState =
    telemedOffices[Math.floor(Math.random() * telemedOffices.length)].address?.state || '';
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
    locationState: locationState || randomTelemedLocationState, // ?
  };
};

export const createSampleTelemedAppointments = async ({
  oystehr,
  authToken,
  phoneNumber,
  createAppointmentZambdaId,
  zambdaUrl,
  locationState,
  demoData,
  projectId,
  paperworkAnswers,
}: {
  oystehr: Oystehr | undefined;
  authToken: string;
  phoneNumber: string;
  createAppointmentZambdaId: string;
  islocal: boolean;
  zambdaUrl: string;
  locationState?: string;
  demoData?: DemoAppointmentData;
  projectId: string;
  paperworkAnswers?: GetPaperworkAnswers;
}): Promise<CreateAppointmentUCTelemedResponse> => {
  if (!projectId) {
    throw new Error('PROJECT_ID is not set');
  }

  if (!oystehr) {
    console.log('oystehr client is not defined');
    throw new Error('oystehr client is not defined');
  }

  try {
    const numberOfAppointments = demoData?.numberOfAppointments || 10;

    // Run all appointment creations in parallel
    const appointmentPromises = Array.from({ length: numberOfAppointments }, async (_, i) => {
      try {
        const patientInfo = await generateRandomPatientInfo(oystehr, phoneNumber, demoData, locationState);

        const createAppointmentResponse = await fetch(`${zambdaUrl}/zambda/${createAppointmentZambdaId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(patientInfo),
        });

        if (!createAppointmentResponse.ok) {
          throw new Error(`Failed to create appointment. Status: ${createAppointmentResponse.status}`);
        }

        console.log(`Appointment ${i + 1} created successfully.`);

        let appointmentData = await createAppointmentResponse.json();

        if ((appointmentData as any)?.output) {
          appointmentData = (appointmentData as any).output as CreateAppointmentUCTelemedResponse;
        }

        console.log({ appointmentData });

        if (!appointmentData) {
          console.error('Error creating appointment:', appointmentData);
          return null;
        }

        await processPaperwork(appointmentData, patientInfo, zambdaUrl, authToken, projectId, paperworkAnswers);
        return appointmentData;
      } catch (error) {
        console.error(`Error processing appointment ${i + 1}:`, error);
        return null; // Return null for failed appointments
      }
    });

    // Wait for all appointments to complete
    const results = await Promise.all(appointmentPromises);

    // Filter out failed attempts (null values)
    const successfulAppointments = results.filter((data) => data !== null) as CreateAppointmentUCTelemedResponse[];

    if (successfulAppointments.length > 0) {
      return successfulAppointments[0]; // Return the first successful appointment
    }

    throw new Error('All appointment creation attempts failed.');
  } catch (error) {
    console.error('Error creating appointments:', error);
    throw error;
  }
};

// Separate function for processing paperwork
const processPaperwork = async (
  appointmentData: CreateAppointmentUCTelemedResponse,
  patientInfo: any,
  zambdaUrl: string,
  authToken: string,
  projectId: string,
  paperworkAnswers?: GetPaperworkAnswers
): Promise<void> => {
  try {
    const appointmentId = appointmentData.appointmentId;
    const questionnaireResponseId = appointmentData.questionnaireId;

    if (!questionnaireResponseId) return;

    const birthDate = isoToDateObject(patientInfo.patient.dateOfBirth || '') || undefined;

    await makeSequentialPaperworkPatches(
      questionnaireResponseId,
      paperworkAnswers
        ? await paperworkAnswers({ patientInfo, appointmentId, authToken, zambdaUrl, projectId })
        : [
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
      zambdaUrl,
      authToken,
      projectId
    );

    const response = await fetch(`${zambdaUrl}/zambda/submit-paperwork/execute-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-zapehr-project-id': projectId,
      },
      body: JSON.stringify(<SubmitPaperworkParameters>{
        answers: [],
        questionnaireResponseId,
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

    console.log(`Paperwork submitted for appointment: ${appointmentId}`);
  } catch (error) {
    console.error(`Error processing paperwork:`, error);
  }
};
