import { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, FhirResource, Patient } from 'fhir/r4b';
import {
  ChartDataResources,
  chunkThings,
  DispositionDTO,
  examCardsMap,
  ExamCardsNames,
  examFieldsMap,
  ExamFieldsNames,
  FHIR_APPOINTMENT_PREPROCESSED_TAG,
  getDefaultNote,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getSecret,
  inPersonExamCardsMap,
  InPersonExamCardsNames,
  inPersonExamFieldsMap,
  InPersonExamFieldsNames,
  MDM_FIELD_DEFAULT_TEXT,
  OTTEHR_MODULE,
  Secrets,
  SecretsKeys,
  SNOMEDCodeConceptInterface,
} from 'utils';
import { checkOrCreateM2MClientToken, saveResourceRequest, topLevelCatch, ZambdaInput } from '../../../shared';
import {
  createDispositionServiceRequest,
  makeClinicalImpressionResource,
  makeExamObservationResource,
  updateEncounterDischargeDisposition,
  updateEncounterPatientInfoConfirmed,
} from '../../../shared/chart-data';
import { createOystehrClient, getVideoRoomResourceExtension } from '../../../shared/helpers';
import { createExamObservations } from './helpers';
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
  const encounterUpdateRequests: BatchInputRequest<Encounter>[] = [];
  const saveOrUpdateRequests: (
    | BatchInputPostRequest<ChartDataResources>
    | BatchInputPutRequest<ChartDataResources>
    | BatchInputRequest<ChartDataResources>
  )[] = [];

  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointment, secrets } = validatedParameters;
    console.log('appointment ID', appointment.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!appointment.id) throw new Error("Appointment FHIR resource doesn't exist.");

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, secrets);
    const oystehr = createOystehrClient(zapehrToken, secrets);
    console.log('Created zapToken and fhir client');

    const resourceBundle = (
      await oystehr.fhir.search<Appointment | Encounter | Patient>({
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
        ],
      })
    ).unbundle();
    console.log('Got Appointment related resources');

    const isInPersonAppointment = !!appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

    const patient = resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Patient') as
      | Patient
      | undefined;
    if (!patient?.id) throw new Error('Patient is missing from resource bundle.');
    // When in forEach, TS forgets this is no longer undefined.
    const patientId = patient.id;

    const encounter = resourceBundle?.find(
      (resource: FhirResource) =>
        resource.resourceType === 'Encounter' &&
        (isInPersonAppointment || Boolean(getVideoRoomResourceExtension(resource)))
    ) as Encounter | undefined;
    if (!encounter?.id) throw new Error('Encounter is missing from resource bundle.');
    // When in forEach, TS forgets this is no longer undefined.
    const encounterId = encounter.id;

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

      saveOrUpdateRequests.push(
        saveResourceRequest(makeExamObservationResource(encounterId, patientId, element, snomedCode))
      );
    });

    // Appointment
    updateAppointmentRequests.push(
      getPatchBinary({
        resourceId: appointment.id,
        resourceType: 'Appointment',
        patchOperations: [getPatchOperationForNewMetaTag(appointment, FHIR_APPOINTMENT_PREPROCESSED_TAG)],
      })
    );

    const disposition: DispositionDTO = {
      type: 'pcp-no-type',
      note: getDefaultNote('pcp-no-type'),
    };

    saveOrUpdateRequests.push(
      createDispositionServiceRequest({
        disposition,
        encounterId: encounter.id,
        patientId: patient.id,
      })
    );

    saveOrUpdateRequests.push(
      saveResourceRequest(
        makeClinicalImpressionResource(encounterId, patient.id, { text: MDM_FIELD_DEFAULT_TEXT }, 'medical-decision')
      )
    );

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

    const allRequests = [...updateAppointmentRequests, ...encounterUpdateRequests, ...saveOrUpdateRequests];
    if (allRequests.length > CHUNK_SIZE) {
      console.log('chunking batches...');
      const requestChunks = chunkThings(allRequests, CHUNK_SIZE);
      console.log('chunks', requestChunks.length, ', chunk size', requestChunks[0].length);
      console.time('Batch requests');
      try {
        await Promise.all(
          requestChunks.map((chunk) => {
            return oystehr.fhir.transaction<Appointment | Encounter | ChartDataResources>({
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
        await oystehr.fhir.transaction<Appointment | Encounter | ChartDataResources>({
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
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-telemedicine-appointment-subscription', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
};
