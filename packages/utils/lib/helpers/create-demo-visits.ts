import Oystehr from '@oystehr/sdk';
import { Address, Appointment, Location, Patient, QuestionnaireResponseItem, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isLocationVirtual } from '../fhir';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateSlotParams,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  PatchPaperworkParameters,
  PatientInfo,
  PersonSex,
  ServiceMode,
  SubmitPaperworkParameters,
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
  getPrimaryCarePhysicianStepAnswers,
  getResponsiblePartyStepAnswers,
  getSchoolWorkNoteStepAnswers,
  getSurgicalHistoryStepAnswers,
  isoToDateObject,
} from './helpers';
import { chooseJson } from './oystehrApi';

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

export type GetPaperworkAnswers = ({
  patientInfo,
  zambdaUrl,
  authToken,
  projectId,
  appointmentId,
}: {
  patientInfo: PatientInfo;
  zambdaUrl: string;
  authToken: string;
  projectId: string;
  appointmentId: string;
}) => Promise<QuestionnaireResponseItem[]>;

export const createSampleAppointments = async ({
  oystehr,
  authToken,
  phoneNumber,
  createAppointmentZambdaId,
  zambdaUrl,
  selectedLocationId,
  locationState,
  demoData,
  projectId,
  paperworkAnswers,
  serviceMode,
  appointmentMetadata,
}: {
  oystehr: Oystehr | undefined;
  authToken: string;
  phoneNumber: string;
  createAppointmentZambdaId: string;
  zambdaUrl: string;
  selectedLocationId?: string;
  locationState?: string;
  demoData?: DemoAppointmentData;
  projectId: string;
  paperworkAnswers?: GetPaperworkAnswers;
  serviceMode?: ServiceMode;
  appointmentMetadata?: Appointment['meta'];
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
    const appointmentPromises: Promise<CreateAppointmentResponse | null>[] = Array.from(
      { length: numberOfAppointments },
      async (_, i) => {
        try {
          const serviceModeToUse = serviceMode || (i % 2 === 0 ? ServiceMode['in-person'] : ServiceMode.virtual);

          const randomPatientInfo = await generateRandomPatientInfo(
            oystehr,
            zambdaUrl,
            authToken,
            projectId,
            serviceModeToUse,
            phoneNumber,
            {
              firstNames: DEFAULT_FIRST_NAMES,
              lastNames: DEFAULT_LAST_NAMES,
              reasonsForVisit: DEFAULT_REASONS_FOR_VISIT,
              ...demoData,
            },
            selectedLocationId,
            locationState
          );

          if (appointmentMetadata) {
            randomPatientInfo.appointmentMetadata = appointmentMetadata;
          } else {
            const sampleAppointmentMeta = {
              tag: [
                {
                  system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
                  code: `sample-appointments-from-outside-E2E-${DateTime.now().toISO()}`,
                },
              ],
            };
            randomPatientInfo.appointmentMetadata = sampleAppointmentMeta;
          }

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

          const appointmentData = await createAppointmentResponse.json();

          if (!appointmentData.output) {
            console.error('Error: appointment data output is missing');
            throw new Error('Error: appointment data output is missing');
          }

          if (appointmentData.status !== 200) {
            console.error(`Error creating appointment: ${JSON.stringify(appointmentData)}`);
            return null;
          }

          const typedAppointment = appointmentData.output as CreateAppointmentResponse;

          if (!typedAppointment) {
            console.error('Error: appointment data is null');
            throw new Error('Error: appointment data is null');
          }

          await processPaperwork(
            typedAppointment,
            randomPatientInfo.patient,
            zambdaUrl,
            authToken,
            projectId,
            serviceModeToUse,
            paperworkAnswers
          );

          // If it's a virtual appointment, mark it as 'arrived'
          if (serviceModeToUse === ServiceMode.virtual) {
            await oystehr.fhir.patch<Appointment>({
              id: typedAppointment.appointmentId,
              resourceType: 'Appointment',
              operations: [{ op: 'replace', path: '/status', value: 'arrived' }],
            });
          }

          return typedAppointment;
        } catch (error) {
          console.error(`Error processing appointment ${i + 1}:`, JSON.stringify(error));
          throw error;
        }
      }
    );

    // Wait for all appointments to complete
    const results = await Promise.all(appointmentPromises);

    // Filter out failed attempts
    const successfulAppointments = results.filter((data) => data != null);

    if (successfulAppointments.length > 0) {
      return successfulAppointments[0] as CreateAppointmentResponse; // Return the first successful appointment
    }

    throw new Error(`All appointment creation attempts failed.`);
  } catch (error) {
    console.error('Error creating appointments:', error);
    throw error;
  }
};

const processPaperwork = async (
  appointmentData: CreateAppointmentResponse,
  patientInfo: PatientInfo,
  zambdaUrl: string,
  authToken: string,
  projectId: string,
  serviceMode: ServiceMode,
  paperworkAnswers?: GetPaperworkAnswers
): Promise<void> => {
  try {
    const { appointmentId, questionnaireResponseId } = appointmentData;

    if (!questionnaireResponseId) return;

    const birthDate = isoToDateObject(patientInfo.dateOfBirth || '') || undefined;

    // Determine the paperwork patches based on service mode
    let paperworkPatches: QuestionnaireResponseItem[] = [];

    const telemedWalkinAnswers = [
      getContactInformationAnswers({
        firstName: patientInfo.firstName,
        lastName: patientInfo.lastName,
        birthDate,
        email: patientInfo.email,
        phoneNumber: patientInfo.phoneNumber,
        birthSex: patientInfo.sex,
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
    ];

    paperworkPatches = paperworkAnswers
      ? await paperworkAnswers({ patientInfo, appointmentId: appointmentId!, authToken, zambdaUrl, projectId })
      : serviceMode === ServiceMode.virtual
      ? telemedWalkinAnswers
      : [
          getContactInformationAnswers({
            firstName: patientInfo.firstName,
            lastName: patientInfo.lastName,
            ...(birthDate ? { birthDate } : {}),
            email: patientInfo.email,
            phoneNumber: patientInfo.phoneNumber,
            birthSex: patientInfo.sex,
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
  zambdaUrl: string,
  authToken: string,
  projectId: string,
  serviceMode: ServiceMode,
  phoneNumber?: string,
  demoData?: AppointmentData,
  selectedLocationId?: string,
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

  const activeOffices = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Location') as Location[];
  const allSchedules = allOfficesAndSchedules.filter((loc) => loc.resourceType === 'Schedule') as Schedule[];

  const telemedOffices = activeOffices.filter((loc) => isLocationVirtual(loc));

  let selectedLocation = activeOffices.find((loc) => selectedLocationId && loc.id === selectedLocationId);

  if (serviceMode === ServiceMode.virtual && locationState) {
    selectedLocation = telemedOffices.find(
      (loc) => locationState && loc.address?.state?.toLowerCase() === locationState.toLowerCase()
    );
  }

  let locationId: string | undefined = '';
  if (serviceMode === ServiceMode['in-person']) {
    if (!selectedLocation?.id) {
      console.log('Location not found in search results');
      throw new Error(`Location ${process.env.LOCATION} not found in search results`);
    }
    locationId = selectedLocation.id;
  } else if (serviceMode === ServiceMode.virtual) {
    if (!selectedLocation?.id) {
      locationId = telemedOffices[Math.floor(Math.random() * telemedOffices.length)].id;
      locationState = telemedOffices.find((loc) => loc.id === locationId)?.address?.state;
    } else {
      locationId = selectedLocation.id;
    }
    if (!locationId) {
      throw new Error('No telemed location found in search results');
    }
  }

  const randomReason = reasonsForVisit[Math.floor(Math.random() * reasonsForVisit.length)];

  const matchingSchedule = allSchedules.find((schedule) => {
    const scheduleOwner = schedule.actor?.[0]?.reference;
    if (scheduleOwner) {
      const [type, id] = scheduleOwner.split('/');
      return type === 'Location' && id === locationId;
    }
    return false;
  });

  if (!matchingSchedule?.id) {
    console.log('Schedule not found in search results');
    throw new Error(`No matching schedule found for location ID: ${locationId}`);
  }
  const now = DateTime.now();
  // note this whole setup is fragile because it is assuming that slots are available.
  // the busy slot logic looks like it was broken at some point, which makes this slightly safer to do right now;
  // only the schedule not offering any slots at the chosen time (which is also a possibility) will cause it to fail
  // create slot
  const createSlotInput: CreateSlotParams = {
    scheduleId: matchingSchedule.id,
    startISO: serviceMode === ServiceMode['in-person'] ? now.startOf('hour').plus({ hours: 2 }).toISO() : now.toISO(),
    lengthInMinutes: 15,
    serviceModality: serviceMode,
    walkin: serviceMode === ServiceMode.virtual ? true : false,
  };

  let persistedSlot: Slot;
  try {
    const persistedSlotResult = await fetch(`${zambdaUrl}/zambda/create-slot/execute-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'x-zapehr-project-id': projectId,
      },
      body: JSON.stringify(createSlotInput),
    }).then((res) => res.json());
    persistedSlot = await chooseJson(persistedSlotResult);
  } catch (error) {
    console.error('Error creating slot:', error);
    throw new Error('Failed to create slot');
  }

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
      locationState,
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
