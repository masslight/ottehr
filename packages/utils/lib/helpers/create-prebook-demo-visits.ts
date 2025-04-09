import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import {
  Address,
  Appointment,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponseItem,
  Schedule,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isLocationVirtual } from '../fhir';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  PatchPaperworkParameters,
  PersonSex,
  ScheduleType,
  ServiceMode,
  SubmitPaperworkParameters,
  VisitType,
} from '../types';
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
}: {
  oystehr: Oystehr | undefined;
  authToken: string;
  phoneNumber: string;
  createAppointmentZambdaId: string;
  zambdaUrl: string;
  selectedLocationId?: string;
  demoData?: DemoAppointmentData;
  projectId: string;
}): Promise<CreateAppointmentResponse | { error: string }> => {
  if (!projectId) {
    throw new Error('PROJECT_ID is not set');
  }

  if (!oystehr) {
    console.log('oystehr client is not defined');
    return { error: 'no oystehr client' };
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
          return { error: 'appointment data is null' };
        }

        await processPrebookPaperwork(appointmentData, randomPatientInfo, zambdaUrl, authToken, projectId, serviceMode);

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
        return { error: (error as any).message || JSON.stringify(error) };
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
  intakeZambdaUrl: string,
  authToken: string,
  projectId: string,
  serviceMode: ServiceMode
): Promise<void> => {
  try {
    const { appointment: appointmentId, questionnaireResponseId } = appointmentData;

    if (!questionnaireResponseId) return;

    const birthDate = isoToDateObject(patientInfo?.patient?.dateOfBirth || '');

    // Determine the paperwork patches based on service mode
    const paperworkPatches =
      serviceMode === ServiceMode.virtual
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
            getPaymentOptionSelfPayAnswers(),
            getResponsiblePartyStepAnswers({}),
            getConsentStepAnswers({}),
          ];

    // Execute the paperwork patches
    await makeSequentialPaperworkPatches(
      questionnaireResponseId,
      paperworkPatches,
      intakeZambdaUrl,
      authToken,
      projectId
    );

    // Submit the paperwork
    const response = await fetch(`${intakeZambdaUrl}/zambda/submit-paperwork/execute-public`, {
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
  selectedLocationId?: string
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
        { name: '_revinclude', value: 'Schedule:Actor:Location' },
      ],
    })
  ).unbundle();

  const allOffices = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Location') as Location[];
  const allSchedules = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Schedule') as Schedule[];

  const telemedOffices = allOffices.filter((loc) => isLocationVirtual(loc));
  const activeOffices = allOffices.filter((item) => item.status === 'active');
  const practitionersTemp = (
    await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [
        { name: '_count', value: '1000' },
        { name: 'active', value: 'true' },
      ],
    })
  ).unbundle();

  const randomLocationIndex = Math.floor(Math.random() * activeOffices.length);
  const randomLocationId = activeOffices[randomLocationIndex].id;
  const randomTelemedLocationId = telemedOffices[Math.floor(Math.random() * telemedOffices.length)].id;
  const randomProviderId = practitionersTemp[Math.floor(Math.random() * practitionersTemp.length)].id;
  const randomReason = reasonsForVisit[Math.floor(Math.random() * reasonsForVisit.length)];
  const matchingRandomSchedule = allSchedules.find((schedule) => {
    const scheduleOwner = schedule.actor?.[0]?.reference;
    if (scheduleOwner) {
      const [type, id] = scheduleOwner.split('/');
      return type === 'Location' && id === randomLocationId;
    }
    return false;
  });

  if (!matchingRandomSchedule) {
    throw new Error(`No matching schedule found for location ID: ${randomLocationId}`);
  }
  const now = DateTime.now();
  const startTime = now.plus({ hours: 2 }).toISO();
  const endTime = now.plus({ hours: 2, minutes: 15 }).toISO();
  const slot: Slot = {
    resourceType: 'Slot',
    id: `${matchingRandomSchedule}-${startTime}`,
    status: 'busy',
    start: startTime,
    end: endTime,
    schedule: {
      reference: `Schedule/${matchingRandomSchedule.id}`,
    },
  };

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
      scheduleType: ScheduleType.location,
      visitType: VisitType.PreBook,
      serviceType: ServiceMode.virtual,
      providerID: randomProviderId,
      locationID: randomTelemedLocationId,
      slot,
      language: 'en',
    };
  }

  return {
    patient: patientData,
    scheduleType: ScheduleType.location,
    visitType: VisitType.PreBook,
    serviceType: ServiceMode['in-person'],
    providerID: randomProviderId,
    locationID: selectedLocationId || randomLocationId,
    slot,
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
