import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Encounter,
  FhirResource,
  Observation,
  Patient,
  QuestionnaireResponse,
  ServiceRequest,
} from 'fhir/r4b';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  chunkThings,
  DispositionDTO,
  examCardsMap,
  ExamCardsNames,
  examFieldsMap,
  ExamFieldsNames,
  getDefaultNote,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  inPersonExamCardsMap,
  InPersonExamCardsNames,
  inPersonExamFieldsMap,
  InPersonExamFieldsNames,
  OTTEHR_MODULE,
  SNOMEDCodeConceptInterface,
} from 'utils';
import { Secrets } from 'zambda-utils';
import { saveResourceRequest } from '../shared';
import {
  createDispositionServiceRequest,
  makeExamObservationResource,
  makeObservationResource,
  updateEncounterDischargeDisposition,
  updateEncounterPatientInfoConfirmed,
} from '../shared/chart-data/chart-data-helpers';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createOystehrClient, getVideoRoomResourceExtension } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { createAdditionalQuestions, createExamObservations } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const CHUNK_SIZE = 50;

export interface AppointmentSubscriptionInput {
  appointment: Appointment;
  secrets: Secrets | null;
}

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);

  const updateAppointmentRequests: BatchInputRequest<Appointment>[] = [];
  const createAdditionalQuestionsRequests: BatchInputRequest<Observation>[] = [];
  const createExamRequests: BatchInputRequest<Observation>[] = [];
  const encounterUpdateRequests: BatchInputRequest<Encounter>[] = [];
  const dispositionServiceRequestRequest: BatchInputRequest<ServiceRequest>[] = [];

  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointment, secrets } = validatedParameters;
    console.log('appointment ID', appointment.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!['arrived', 'booked'].includes(appointment.status)) {
      console.log(`appointment has inappropriate status ${appointment.status}`);
      return {
        statusCode: 400,
        body: `Appointment has status ${appointment.status}. To initialize it should have status 'arrived' or 'booked'`,
      };
    }
    if (!appointment.id) throw new Error("Appointment FHIR resource doesn't exist.");

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, secrets);
    const oystehr = createOystehrClient(zapehrToken, secrets);
    console.log('Created zapToken and fhir client');

    const resourceBundle = (
      await oystehr.fhir.search<Appointment | Encounter | Patient | QuestionnaireResponse>({
        resourceType: 'Appointment',
        params: [
          { name: '_id', value: appointment.id },
          {
            name: '_include',
            value: 'Appointment:patient',
          },
          {
            name: '_revinclude:iterate',
            value: 'Encounter:appointment',
          },
          {
            name: '_revinclude:iterate',
            value: 'QuestionnaireResponse:encounter',
          },
        ],
      })
    ).unbundle();
    console.log('Got Appointment related resources');

    const isInPersonAppointment = !!appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

    const patient = resourceBundle?.find(
      (resource: FhirResource) => resource.resourceType === 'Patient'
    ) as unknown as Patient;
    if (!patient.id) throw new Error('Patient is missing from resource bundle.');
    // When in forEach, TS forgets this is no longer undefined.
    const patientId = patient.id;

    const encounter = resourceBundle?.find(
      (resource: FhirResource) =>
        resource.resourceType === 'Encounter' &&
        (isInPersonAppointment || Boolean(getVideoRoomResourceExtension(resource)))
    ) as unknown as Encounter;
    if (!encounter.id) throw new Error('Encounter is missing from resource bundle.');
    // When in forEach, TS forgets this is no longer undefined.
    const encounterId = encounter.id;

    if (!isInPersonAppointment) {
      const questionnaireResponse = resourceBundle?.find(
        (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse'
      ) as unknown as QuestionnaireResponse;

      // Additional questions
      const additionalQuestions = createAdditionalQuestions(questionnaireResponse);

      additionalQuestions.forEach((observation) => {
        createAdditionalQuestionsRequests.push(
          saveResourceRequest(
            makeObservationResource(encounterId, patientId, '', observation, ADDITIONAL_QUESTIONS_META_SYSTEM)
          )
        );
      });

      console.log(`Create additional questions requests: ${JSON.stringify(createAdditionalQuestionsRequests)}`);
    }

    // Exam observations
    const examObservations = createExamObservations(isInPersonAppointment);

    examObservations?.forEach((element) => {
      const mappedSnomedField = isInPersonAppointment
        ? inPersonExamFieldsMap[element.field as InPersonExamFieldsNames]
        : examFieldsMap[element.field as ExamFieldsNames];
      const mappedSnomedCard = isInPersonAppointment
        ? inPersonExamCardsMap[element.field as InPersonExamCardsNames]
        : examCardsMap[element.field as ExamCardsNames];
      let snomedCode: SNOMEDCodeConceptInterface;

      if (!mappedSnomedField && !mappedSnomedCard)
        throw new Error('Provided "element.field" property is not recognized.');
      if (mappedSnomedField && typeof element.value === 'boolean') {
        snomedCode = mappedSnomedField;
      } else if (mappedSnomedCard && element.note) {
        element.value = undefined;
        snomedCode = mappedSnomedCard;
      } else {
        throw new Error(
          `Exam observation resource must contain string field: 'note', or boolean: 'value', depends on this resource type is exam-field or exam-card. Resource type determines by 'field' prop.`
        );
      }

      createExamRequests.push(
        saveResourceRequest(makeExamObservationResource(encounterId, patientId, element, snomedCode))
      );
    });

    console.log(`Create exam observations requests: ${JSON.stringify(createExamRequests)}`);

    // Appointment
    updateAppointmentRequests.push(
      getPatchBinary({
        resourceId: appointment.id,
        resourceType: 'Appointment',
        patchOperations: [
          getPatchOperationForNewMetaTag(appointment, {
            system: 'appointment-preprocessed',
            code: 'APPOINTMENT_PREPROCESSED',
          }),
        ],
      })
    );

    console.log(`Update appointment requests: ${JSON.stringify(updateAppointmentRequests)}`);

    const dispositionType = 'pcp-no-type';

    const disposition: DispositionDTO = {
      type: dispositionType,
      note: getDefaultNote(dispositionType),
    };

    encounterUpdateRequests.push(
      getPatchBinary({
        resourceId: encounter.id,
        resourceType: 'Encounter',
        patchOperations: [
          ...updateEncounterPatientInfoConfirmed(encounter, { value: true }),
          updateEncounterDischargeDisposition(encounter, disposition),
        ],
      })
    );

    console.log(`Encounter update request: ${JSON.stringify(encounterUpdateRequests)}`);

    dispositionServiceRequestRequest.push(
      createDispositionServiceRequest({
        disposition,
        encounterId: encounter.id,
        patientId: patient.id,
      })
    );

    console.log(`Disposition ServiceRequest request: ${JSON.stringify(dispositionServiceRequestRequest)}`);

    const allRequests = [
      ...updateAppointmentRequests,
      ...createAdditionalQuestionsRequests,
      ...createExamRequests,
      ...encounterUpdateRequests,
      ...dispositionServiceRequestRequest,
    ];
    if (allRequests.length > CHUNK_SIZE) {
      console.log('chunking batches...');
      const requestChunks = chunkThings(allRequests, CHUNK_SIZE);
      console.log('chunks', requestChunks.length, ', chunk size', requestChunks[0].length);
      console.time('Batch requests');
      try {
        await Promise.all(
          requestChunks.map((chunk) => {
            return oystehr.fhir.transaction<Appointment | Encounter | Observation | ServiceRequest>({
              requests: chunk,
            });
          })
        );
      } catch (error) {
        console.error('Error during parallel chunk processing:', JSON.stringify(error));
        throw new Error('Error during parallel chunk processing');
      }
      console.timeEnd('Batch requests');
    } else {
      try {
        await oystehr.fhir.transaction<Appointment | Encounter | Observation | ServiceRequest>({
          requests: allRequests,
        });
      } catch (error) {
        console.log('Error from transaction: ', error, JSON.stringify(error));
        throw new Error('error from transaction');
      }
    }

    return {
      statusCode: 200,
      body: 'Successfully pre-processed appointment',
    };
  } catch (error: any) {
    await topLevelCatch('admin-telemed-appointment-subscription', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
};
