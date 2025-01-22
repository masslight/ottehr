import { DateTime } from 'luxon';
import { Practitioner, Location, Appointment, QuestionnaireResponse } from 'fhir/r4b';
import Oystehr from '@oystehr/sdk';
import { CreateAppointmentInputParams, PersonSex, ScheduleType, ServiceMode, VisitType } from '../types';
import { updateQuestionnaireResponse } from './helpers';
import { isLocationVirtual } from '../fhir';

interface DemoAppointmentData {
  firstNames?: string[];
  lastNames?: string[];
  reasonsForVisit?: string[];
  numberOfAppointments?: number;
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

export const createSampleAppointments = async (
  oystehr: Oystehr | undefined,
  authToken: string,
  phoneNumber: string,
  createAppointmentZambdaId: string,
  // submitPaperworkZambdaId: string,
  islocal: boolean,
  intakeZambdaUrl: string,
  selectedLocationId?: string,
  demoData?: DemoAppointmentData
): Promise<void> => {
  if (!oystehr) {
    console.log('oystehr client is not defined');
    return;
  }

  const {
    firstNames = DEFAULT_FIRST_NAMES,
    lastNames = DEFAULT_LAST_NAMES,
    reasonsForVisit = DEFAULT_REASONS_FOR_VISIT,
    numberOfAppointments = 10,
  } = demoData || {};

  try {
    const responses: any[] = [];

    for (let i = 0; i < numberOfAppointments; i++) {
      const serviceMode = i % 2 === 0 ? ServiceMode.virtual : ServiceMode['in-person'];
      const randomPatientInfo = await generateRandomPatientInfo(
        oystehr,
        serviceMode,
        phoneNumber,
        {
          firstNames,
          lastNames,
          reasonsForVisit,
        },
        selectedLocationId
      );
      const inputBody = JSON.stringify(randomPatientInfo);

      const createAppointmentResponse = await fetch(`${intakeZambdaUrl}/zambda/${createAppointmentZambdaId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: inputBody,
      });

      const appointmentData = islocal
        ? await createAppointmentResponse.json()
        : (await createAppointmentResponse.json()).output;
      const appointmentId = appointmentData.appointment;
      const patientId = appointmentData.fhirPatientId;
      const questionnaireResponseId = appointmentData.questionnaireResponseId;
      const encounterId = appointmentData.encounterId;

      const updatedQuestionnaireResponse = await oystehr.fhir.update<QuestionnaireResponse>({
        ...updateQuestionnaireResponse({
          questionnaireResponseId: questionnaireResponseId,
          patientId: patientId,
          encounterId: encounterId,
          firstName: randomPatientInfo?.patient?.firstName || '',
          lastName: randomPatientInfo?.patient?.lastName || '',
          birthDate: {
            year: randomPatientInfo?.patient?.dateOfBirth?.split('-')[0] || '',
            month: randomPatientInfo?.patient?.dateOfBirth?.split('-')[1] || '',
            day: randomPatientInfo?.patient?.dateOfBirth?.split('-')[2] || '',
          },
          patientEmail: randomPatientInfo?.patient?.email || '',
          patientNumber: randomPatientInfo?.patient?.phoneNumber || '',
          fullName: randomPatientInfo?.patient?.firstName + ' ' + randomPatientInfo?.patient?.lastName || '',
        }),
      });

      // TODO: uncomment this when we resolve https://github.com/masslight/ottehr-private/issues/397
      // const submitPaperworkResponse = await fetch(
      //   `${intakeZambdaUrl}/zambda/${submitPaperworkZambdaId}/execute-public`,
      //   {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       Authorization: `Bearer ${authToken}`,
      //     },
      //     body: JSON.stringify({
      //       questionnaireResponseId,
      //       appointmentId,
      //       answers: updateQuestionnaireResponse({
      //         TODO: add answers[] here after un-commenting
      //       }).item,
      //     }),
      //   }
      // );

      if (serviceMode === ServiceMode.virtual) {
        const updatedAppointmentResponse = await oystehr.fhir.patch<Appointment>({
          id: appointmentId,
          resourceType: 'Appointment',
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'arrived',
            },
          ],
        });
        responses.push(updatedAppointmentResponse);
      }

      responses.push(updatedQuestionnaireResponse, createAppointmentResponse);
    }
  } catch (error: any) {
    console.error('Error creating appointments:', error);
  }
};

const generateRandomPatientInfo = async (
  oystehr: Oystehr,
  serviceMode: ServiceMode,
  phoneNumber?: string,
  demoData?: Pick<DemoAppointmentData, 'firstNames' | 'lastNames' | 'reasonsForVisit'>,
  selectedLocationId?: string
): Promise<CreateAppointmentInputParams> => {
  const {
    firstNames = DEFAULT_FIRST_NAMES,
    lastNames = DEFAULT_LAST_NAMES,
    reasonsForVisit = DEFAULT_REASONS_FOR_VISIT,
  } = demoData || {};

  const sexes: PersonSex[] = [PersonSex.Male, PersonSex.Female, PersonSex.Intersex];
  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomEmail = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@example.com`;
  const randomDateOfBirth = DateTime.now()
    .minus({ years: 7 + Math.floor(Math.random() * 16) })
    .toISODate();
  const randomSex = sexes[Math.floor(Math.random() * sexes.length)];

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

  if (serviceMode === 'virtual') {
    return {
      patient: {
        newPatient: true,
        firstName: randomFirstName,
        lastName: randomLastName,
        dateOfBirth: randomDateOfBirth,
        sex: randomSex,
        email: randomEmail,
        phoneNumber: phoneNumber,
        reasonForVisit: randomReason,
      },
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
    patient: {
      newPatient: true,
      firstName: randomFirstName,
      lastName: randomLastName,
      dateOfBirth: randomDateOfBirth,
      sex: randomSex,
      email: randomEmail,
      phoneNumber: phoneNumber,
      reasonForVisit: randomReason,
    },
    scheduleType: ScheduleType.location,
    visitType: VisitType.PreBook,
    serviceType: ServiceMode['in-person'],
    providerID: randomProviderId,
    locationID: selectedLocationId || randomLocationId,
    slot: DateTime.now().plus({ hours: 2 }).toISO(),
    language: 'en',
  };
};
