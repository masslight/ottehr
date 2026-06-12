import { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, FhirResource, Patient } from 'fhir/r4b';
import {
  ChartDataResources,
  chunkThings,
  DispositionDTO,
  FHIR_APPOINTMENT_PREPROCESSED_TAG,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  isInPersonAppointment,
  Secrets,
} from 'utils';
import { organizeAccounts } from '../../../ehr/shared/harvest';
import { makeEncounterAccountPatchOp } from '../../../ehr/shared/harvest';
import {
  checkOrCreateM2MClientToken,
  getProgressNoteConfigPayload,
  saveResourceRequest,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import {
  createDispositionServiceRequest,
  makeClinicalImpressionResource,
  updateEncounterDischargeDisposition,
  updateEncounterPatientInfoConfirmed,
} from '../../../shared/chart-data';
import { createOystehrClient, getVideoRoomResourceExtension } from '../../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const CHUNK_SIZE = 50;

export interface AppointmentSubscriptionInput {
  appointment: Appointment;
  secrets: Secrets | null;
}

let oystehrToken: string;

const ZAMBDA_NAME = 'appointment-chart-data-prefilling';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);

  const updateAppointmentRequests: BatchInputRequest<Appointment>[] = [];
  const encounterUpdateRequests: BatchInputRequest<Encounter>[] = [];
  const saveOrUpdateRequests: (
    | BatchInputPostRequest<ChartDataResources>
    | BatchInputPutRequest<ChartDataResources>
    | BatchInputRequest<ChartDataResources>
  )[] = [];

  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { appointment, secrets } = validatedParameters;
  console.log('appointment ID', appointment.id);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!appointment.id) throw new Error("Appointment FHIR resource doesn't exist.");

  oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);
  const oystehr = createOystehrClient(oystehrToken, secrets);
  console.log('Created zapToken and fhir client');

  const resourceBundle = (
    await oystehr.fhir.search<Appointment | Encounter | Patient | Account>({
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
          value: 'Account:patient',
        },
      ],
    })
  ).unbundle();

  console.log('Got Appointment related resources');

  const isInPerson = isInPersonAppointment(appointment);

  const patient = resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Patient') as
    | Patient
    | undefined;
  if (!patient?.id) throw new Error('Patient is missing from resource bundle.');

  const encounter = resourceBundle?.find(
    (resource: FhirResource) =>
      resource.resourceType === 'Encounter' && (isInPerson || Boolean(getVideoRoomResourceExtension(resource)))
  ) as Encounter | undefined;

  const accountResources = resourceBundle?.filter(
    (resource) => resource.resourceType === 'Account' && resource.status === 'active'
  ) as Account[];

  console.log('accounts found: ', accountResources.map((res) => `Account/${res.id}`).join(', '));

  const { existingAccount, workersCompAccount } = organizeAccounts(accountResources);

  if (!encounter?.id) throw new Error('Encounter is missing from resource bundle.');
  // When in forEach, TS forgets this is no longer undefined.
  const encounterId = encounter.id;
  const progressNoteConfig = await getProgressNoteConfigPayload(oystehr);

  const disposition: DispositionDTO = {
    type: 'pcp-no-type',
    note: progressNoteConfig.pcpNoTypeDispositionDefaultText,
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
      makeClinicalImpressionResource(
        encounterId,
        patient.id,
        { text: progressNoteConfig.medicalDecisionDefaultText },
        'medical-decision'
      )
    )
  );

  // accounts should be on the encounter, needed for ordering labs for workers comp visits
  // if no paperwork is updated, harvest does not run and the account is never added
  // so doing it initially via this subscription
  const encounterAccountPatch = makeEncounterAccountPatchOp(encounter, existingAccount, workersCompAccount);

  encounterUpdateRequests.push(
    getPatchBinary({
      resourceId: encounter.id,
      resourceType: 'Encounter',
      patchOperations: [
        ...updateEncounterPatientInfoConfirmed(encounter, { value: false }),
        updateEncounterDischargeDisposition(encounter, disposition),
        ...encounterAccountPatch,
      ],
    })
  );

  // Add appointment PREPROCESSED tag LAST so it's in the final chunk
  // This ensures all resources are created before the tag is set
  updateAppointmentRequests.push(
    getPatchBinary({
      resourceId: appointment.id,
      resourceType: 'Appointment',
      patchOperations: [getPatchOperationForNewMetaTag(appointment, FHIR_APPOINTMENT_PREPROCESSED_TAG)],
    })
  );

  const allRequests = [...encounterUpdateRequests, ...saveOrUpdateRequests, ...updateAppointmentRequests];
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
});
