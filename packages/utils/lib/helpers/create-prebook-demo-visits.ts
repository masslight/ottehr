import { Address, Appointment, Location, Patient, Practitioner, QuestionnaireResponseItem } from 'fhir/r4b';
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
  getConsentStepAnswers,
  getContactInformationAnswers,
  getPatientDetailsStepAnswers,
  getPaymentOptionSelfPayAnswers,
  getResponsiblePartyStepAnswers,
  isoToDateObject,
} from './helpers';
import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';

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

const projectId = process.env.VITE_APP_PROJECT_ID || process.env.PROJECT_ID;

export const createSamplePrebookAppointments = async ({
  oystehr,
  authToken,
  phoneNumber,
  createAppointmentZambdaId,
  intakeZambdaUrl,
  selectedLocationId,
  demoData,
}: {
  oystehr: Oystehr | undefined;
  authToken: string;
  phoneNumber: string;
  createAppointmentZambdaId: string;
  intakeZambdaUrl: string;
  selectedLocationId?: string;
  demoData?: DemoAppointmentData;
}): Promise<CreateAppointmentResponse | null> => {
  if (!oystehr) {
    console.log('oystehr client is not defined');
    return null;
  }

  try {
    let appointmentData: CreateAppointmentResponse = {} as CreateAppointmentResponse;
    const numberOfAppointments = demoData?.numberOfAppointments || 10;

    for (let i = 0; i < numberOfAppointments; i++) {
      const serviceMode = i % 2 === 0 ? ServiceMode['in-person'] : ServiceMode.virtual;
      const randomPatientInfo = await generateRandomPatientInfo(
        oystehr,
        serviceMode,
        phoneNumber,
        {
          // default demoData values:
          firstNames: DEFAULT_FIRST_NAMES,
          lastNames: DEFAULT_LAST_NAMES,
          reasonsForVisit: DEFAULT_REASONS_FOR_VISIT,

          // demoData values:
          ...demoData,
        },
        selectedLocationId
      );

      if (!projectId) {
        throw new Error('PROJECT_ID is not set');
      }

      const createAppointmentResponse = await fetch(`${intakeZambdaUrl}/zambda/${createAppointmentZambdaId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-zapehr-project-id': projectId,
        },
        body: JSON.stringify(randomPatientInfo),
      });

      appointmentData = await createAppointmentResponse.json();

      if ((appointmentData as any)?.output) {
        appointmentData = (appointmentData as any).output as CreateAppointmentResponse;
      }

      const { appointment: appointmentId, questionnaireResponseId } = appointmentData;

      const birthDate = isoToDateObject(randomPatientInfo?.patient?.dateOfBirth || '');

      await makeSequentialPaperworkPatches(
        questionnaireResponseId!,
        [
          getContactInformationAnswers({
            firstName: randomPatientInfo.patient.firstName,
            lastName: randomPatientInfo.patient.lastName,
            ...(birthDate ? { birthDate } : {}),
            email: randomPatientInfo.patient.email,
            phoneNumber: randomPatientInfo.patient.phoneNumber,
            birthSex: randomPatientInfo.patient.sex,
          }),
          getPatientDetailsStepAnswers({}),
          getPaymentOptionSelfPayAnswers(),
          getResponsiblePartyStepAnswers({}),
          getConsentStepAnswers({}),
        ],
        intakeZambdaUrl,
        authToken
      );

      if (!projectId) {
        throw new Error('PROJECT_ID is not set');
      }

      const response = await fetch(`${intakeZambdaUrl}/zambda/submit-paperwork/execute-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'x-zapehr-project-id': projectId,
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

      if (serviceMode === ServiceMode.virtual) {
        await oystehr.fhir.patch<Appointment>({
          id: appointmentId!,
          resourceType: 'Appointment',
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'arrived',
            },
          ],
        });
      }
    }
    return appointmentData;
  } catch (error: any) {
    console.error('Error creating appointments:', error);
    return null;
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
      slot: DateTime.now().plus({ hours: 2 }).toISO(),
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
    slot: DateTime.now().plus({ hours: 2 }).toISO(),
    language: 'en',
  };
};

export async function makeSequentialPaperworkPatches(
  questionnaireResponseId: string,
  stepAnswers: QuestionnaireResponseItem[],
  intakeZambdaUrl: string,
  authToken: string
): Promise<void> {
  await stepAnswers.reduce(async (previousPromise, answer) => {
    await previousPromise;

    if (!projectId) {
      throw new Error('PROJECT_ID is not set');
    }

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
