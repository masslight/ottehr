import { Address, Appointment, Location, Patient, QuestionnaireResponseItem, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isLocationVirtual } from '../fhir';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateSlotParams,
  PatchPaperworkParameters,
  PersonSex,
  ServiceMode,
  SubmitPaperworkParameters,
} from '../types';
import { GetPaperworkAnswers } from './create-telemed-demo-visits';
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
import Oystehr from '@oystehr/sdk';
import { chooseJson } from './zapEHRApi';

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

export const createSamplePrebookAppointments = async ({
  oystehr,
  authToken,
  phoneNumber,
  createAppointmentZambdaId,
  zambdaUrl,
  selectedLocationId,
  demoData,
  projectId,
  paperworkAnswers,
}: {
  oystehr: Oystehr | undefined;
  authToken: string;
  phoneNumber: string;
  createAppointmentZambdaId: string;
  zambdaUrl: string;
  selectedLocationId?: string;
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
        const serviceMode = i % 2 === 0 ? ServiceMode['in-person'] : ServiceMode.virtual;

        const randomPatientInfo = await generateRandomPatientInfo(
          oystehr,
          serviceMode,
          phoneNumber,
          {
            firstNames: DEFAULT_FIRST_NAMES,
            lastNames: DEFAULT_LAST_NAMES,
            reasonsForVisit: DEFAULT_REASONS_FOR_VISIT,
            ...demoData,
          },
          selectedLocationId
        );

        console.log('randomPatientInfo', randomPatientInfo);

        const createAppointmentResponse = await fetch(`${zambdaUrl}/zambda/${createAppointmentZambdaId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(randomPatientInfo),
        });

        if (!createAppointmentResponse.ok) {
          throw new Error(`Failed to create appointment. Status: ${createAppointmentResponse.status}`);
        }

        console.log(`Appointment ${i + 1} created successfully.`);

        let appointmentData = await createAppointmentResponse.json();

        if ((appointmentData as any)?.output) {
          appointmentData = (appointmentData as any).output as CreateAppointmentResponse;
        }

        if (!appointmentData) {
          console.error('Error: appointment data is null');
          throw new Error('Error: appointment data is null');
        }

        await processPrebookPaperwork(
          appointmentData,
          randomPatientInfo,
          zambdaUrl,
          authToken,
          projectId,
          serviceMode,
          paperworkAnswers
        );

        // If it's a virtual appointment, mark it as 'arrived'
        if (serviceMode === ServiceMode.virtual) {
          await oystehr.fhir.patch<Appointment>({
            id: appointmentData.appointment!,
            resourceType: 'Appointment',
            operations: [{ op: 'replace', path: '/status', value: 'arrived' }],
          });
        }

        return appointmentData;
      } catch (error) {
        console.error(`Error processing appointment ${i + 1}:`, error);
        throw error;
      }
    });

    // Wait for all appointments to complete
    const results = await Promise.all(appointmentPromises);

    // Filter out failed attempts
    const successfulAppointments = results.filter((data) => data.error === undefined) as CreateAppointmentResponse[];

    if (successfulAppointments.length > 0) {
      return successfulAppointments[0]; // Return the first successful appointment
    }

    throw new Error(
      `All appointment creation attempts failed. ${JSON.stringify(
        results.find((r) => r.error !== undefined),
        null,
        2
      )}`
    );
  } catch (error) {
    console.error('Error creating appointments:', error);
    throw error;
  }
};
const processPrebookPaperwork = async (
  appointmentData: CreateAppointmentResponse,
  patientInfo: any,
  zambdaUrl: string,
  authToken: string,
  projectId: string,
  serviceMode: ServiceMode,
  paperworkAnswers?: GetPaperworkAnswers
): Promise<void> => {
  try {
    const { appointment: appointmentId, questionnaireResponseId } = appointmentData;

    if (!questionnaireResponseId) return;

    const birthDate = isoToDateObject(patientInfo?.patient?.dateOfBirth || '');

    // Determine the paperwork patches based on service mode
    const paperworkPatches = paperworkAnswers
      ? await paperworkAnswers({ patientInfo, appointmentId: appointmentId!, authToken, zambdaUrl, projectId })
      : serviceMode === ServiceMode.virtual
      ? [
          getContactInformationAnswers({
            firstName: patientInfo.patient.firstName,
            lastName: patientInfo.patient.lastName,
            ...(birthDate ? { birthDate } : {}),
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
        ]
      : [
          getContactInformationAnswers({
            firstName: patientInfo.patient.firstName,
            lastName: patientInfo.patient.lastName,
            ...(birthDate ? { birthDate } : {}),
            email: patientInfo.patient.email,
            phoneNumber: patientInfo.patient.phoneNumber,
            birthSex: patientInfo.patient.sex,
          }),
          getPatientDetailsStepAnswers({}),
          getPrimaryCarePhysicianStepAnswers({}),
          getPaymentOptionSelfPayAnswers(),
          getResponsiblePartyStepAnswers({}),
          getConsentStepAnswers({}),
        ];

    // Execute the paperwork patches
    await makeSequentialPaperworkPatches(questionnaireResponseId, paperworkPatches, zambdaUrl, authToken, projectId);

    // Submit the paperwork
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

const generateRandomPatientInfo = async (
  oystehr: Oystehr,
  serviceMode: ServiceMode,
  phoneNumber?: string,
  demoData?: AppointmentData,
  _selectedLocationId?: string
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
        { name: '_revinclude', value: 'Schedule:actor:Location' },
      ],
    })
  ).unbundle();

  const allOffices = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Location') as Location[];
  const allSchedules = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Schedule') as Schedule[];

  const telemedOffices = allOffices.filter((loc) => isLocationVirtual(loc));
  const activeOffices = allOffices.filter((item) => item.status === 'active');

  const notSoRandomLocation = activeOffices.find((loc) => loc.name === process.env.LOCATION);

  let randomLocationId = '';
  if (serviceMode === ServiceMode['in-person']) {
    if (!notSoRandomLocation?.id) {
      throw new Error(`Location ${process.env.LOCATION} not found in search results`);
    }
    randomLocationId = notSoRandomLocation.id;
  }
  const randomTelemedLocationId = telemedOffices[Math.floor(Math.random() * telemedOffices.length)].id;
  // const randomProviderId = practitionersTemp[Math.floor(Math.random() * practitionersTemp.length)].id;
  const randomReason = reasonsForVisit[Math.floor(Math.random() * reasonsForVisit.length)];
  const matchingRandomSchedule = allSchedules.find((schedule) => {
    const scheduleOwner = schedule.actor?.[0]?.reference;
    if (scheduleOwner) {
      const [type, id] = scheduleOwner.split('/');
      if (serviceMode === 'virtual') {
        return type === 'Location' && id === randomTelemedLocationId;
      } else {
        return type === 'Location' && id === randomLocationId;
      }
    }
    return false;
  });

  if (!matchingRandomSchedule?.id) {
    throw new Error(`No matching schedule found for location ID: ${randomLocationId}`);
  }
  const now = DateTime.now();
  // note this whole setup is fragile because it is assuming that slots are available.
  // the busy slot logic looks like it was broken at some point, which makes this slightly safer to do right now;
  // only the schedule not offering any slots at the chosen time (which is also a possibility) will cause it to fail
  // create slot
  const createSlotInput: CreateSlotParams = {
    scheduleId: matchingRandomSchedule.id,
    startISO: now.startOf('hour').plus({ hours: 2 }).toISO(),
    lengthInMinutes: 15,
    serviceModality: serviceMode,
    walkin: false,
  };
  console.log('slot input: ', createSlotInput);
  const persistedSlotResult = await oystehr.zambda.executePublic({
    id: 'create-slot',
    ...createSlotInput,
  });

  const persistedSlot = await chooseJson(persistedSlotResult);

  console.log('persisted slot: ', persistedSlot);

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

  if (serviceMode === 'virtual') {
    return {
      patient: patientData,
      unconfirmedDateOfBirth: randomDateOfBirth,
      slotId: persistedSlot.id!,
      language: 'en',
    };
  }

  return {
    patient: patientData,
    slotId: persistedSlot.id!,
    language: 'en',
  };
};

export async function makeSequentialPaperworkPatches(
  questionnaireResponseId: string,
  stepAnswers: QuestionnaireResponseItem[],
  intakeZambdaUrl: string,
  authToken: string,
  projectId: string
): Promise<void> {
  await stepAnswers.reduce(async (previousPromise, answer) => {
    await previousPromise;
    const response = await fetch(`${intakeZambdaUrl}/zambda/patch-paperwork/execute-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-zapehr-project-id': projectId,
      },
      body: JSON.stringify(<PatchPaperworkParameters>{
        answers: answer,
        questionnaireResponseId: questionnaireResponseId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to patch paperwork with linkId: ${answer.linkId}`);
    }
  }, Promise.resolve() as Promise<void>);
}
