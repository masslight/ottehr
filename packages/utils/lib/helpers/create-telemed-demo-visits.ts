import Oystehr from '@oystehr/sdk';
import { Address, Location, Patient, QuestionnaireResponseItem, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isLocationVirtual } from '../fhir';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateSlotParams,
  PersonSex,
  ServiceMode,
  SubmitPaperworkParameters,
} from '../types';
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
  getPrimaryCarePhysicianStepAnswers,
  getResponsiblePartyStepAnswers,
  getSchoolWorkNoteStepAnswers,
  getSurgicalHistoryStepAnswers,
  isoToDateObject,
} from './helpers';
import { chooseJson } from '../main';

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
export type GetPaperworkAnswers = ({
  patientInfo,
  zambdaUrl,
  authToken,
  projectId,
  appointmentId,
}: {
  patientInfo: CreateAppointmentInputParams;
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
): Promise<CreateAppointmentInputParams> => {
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
  console.log('generating random patient info...');

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

  const allOfficesAndSchedules = (
    await oystehr.fhir.search<Location | Schedule>({
      resourceType: 'Location',
      params: [
        { name: '_count', value: '1000' },
        { name: 'address-state:missing', value: 'false' },
        { name: 'status', value: 'active' },
        { name: '_has:Schedule:actor:_id:missing', value: 'false' },
        { name: '_revinclude', value: 'Schedule:actor:Location' },
      ],
    })
  ).unbundle();
  console.log('all offices and schedules: ', allOfficesAndSchedules.length);
  const activeOffices = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Location') as Location[];
  const allSchedules = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Schedule') as Schedule[];

  const telemedOffices = activeOffices.filter((loc) => isLocationVirtual(loc));

  const notSoRandomLocation = activeOffices.find(
    (loc) => locationState && loc.address?.state?.toLowerCase() === locationState.toLowerCase()
  );

  let scheduleId = '';

  if (notSoRandomLocation?.id) {
    scheduleId =
      allSchedules.find((schedule) => {
        return schedule.actor?.[0]?.reference === `Location/${notSoRandomLocation.id}`;
      })?.id || '';
  }
  if (!scheduleId) {
    const randomLocation = telemedOffices[Math.floor(Math.random() * telemedOffices.length)];
    scheduleId =
      allSchedules.find((schedule) => {
        return schedule.actor?.[0]?.reference === `Location/${randomLocation.id}`;
      })?.id || '';
  }
  console.log('scheduleId: ', scheduleId);
  if (!scheduleId) {
    throw new Error('No schedule ID found for the selected location');
  }
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

  const now = DateTime.now();
  // note this whole setup is fragile because it is assuming that slots are available.
  // the busy slot logic looks like it was broken at some point, which makes this slightly safer to do right now;
  // only the schedule not offering any slots at the chosen time (which is also a possibility) will cause it to fail
  // create slot
  const createSlotInput: CreateSlotParams = {
    scheduleId,
    startISO: now.toISO(),
    lengthInMinutes: 15,
    serviceModality: ServiceMode.virtual,
    walkin: true,
  };
  console.log('slot input: ', createSlotInput);
  let persistedSlot: Slot;
  try {
    const persistedSlotResult = await oystehr.zambda.executePublic({
      id: 'create-slot',
      ...createSlotInput,
    });
    persistedSlot = await chooseJson(persistedSlotResult);
  } catch (error) {
    console.error('Error creating slot:', error);
    throw new Error('Failed to create slot');
  }

  console.log('persisted slot: ', persistedSlot);

  return {
    patient: patientData,
    unconfirmedDateOfBirth: randomDateOfBirth,
    slotId: persistedSlot.id!,
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
}): Promise<CreateAppointmentResponse> => {
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
        console.log('create appointment zambda id', createAppointmentZambdaId, JSON.stringify(patientInfo));
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
          appointmentData = (appointmentData as any).output as CreateAppointmentResponse;
        }

        console.log({ appointmentData });

        if (!appointmentData) {
          console.error('Error creating appointment:', appointmentData);
          return null;
        }

        await processPaperwork(appointmentData, patientInfo, zambdaUrl, authToken, projectId, paperworkAnswers);
        return appointmentData;
      } catch (error) {
        console.error(`Error processing appointment ${i + 1}:`, JSON.stringify(error));
        return null; // Return null for failed appointments
      }
    });

    // Wait for all appointments to complete
    const results = await Promise.all(appointmentPromises);

    // Filter out failed attempts (null values)
    const successfulAppointments = results.filter((data) => data !== null) as CreateAppointmentResponse[];

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
  appointmentData: CreateAppointmentResponse,
  patientInfo: any,
  zambdaUrl: string,
  authToken: string,
  projectId: string,
  paperworkAnswers?: GetPaperworkAnswers
): Promise<void> => {
  try {
    const appointmentId = appointmentData.appointment!;
    const questionnaireResponseId = appointmentData.questionnaireResponseId;

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
            getPrimaryCarePhysicianStepAnswers({}),
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
