import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Coding, Encounter, Location, Observation, Patient, Task } from 'fhir/r4b';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
  getPatchOperationsForNewMetaTags,
  getSecret,
  SecretsKeys,
  TaskIndicator,
} from 'utils';
import {
  flagPaperworkEdit,
  getAccountAndCoverageResourcesForPatient,
  updateStripeCustomer,
} from '../../../ehr/shared/harvest';
import { getStripeClient } from '../../../patient/payment-methods/helpers';
import {
  createOystehrClient,
  getAuth0Token,
  makeObservationResource,
  saveResourceRequest,
  topLevelCatch,
  triggerSlackAlarm,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createAdditionalQuestions } from '../../appointment/appointment-chart-data-prefilling/helpers';
import { QRSubscriptionInput, validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;

export const index = wrapHandler('sub-intake-harvest', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log('Intake Harvest Hath Been Invoked');
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { qr, secrets } = validatedParameters;
    console.log('questionnaire response id', qr.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
    const response = await performEffect(validatedParameters, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('qr-subscription', error, ENVIRONMENT);
  }
});

// this is exported to facilitate integration testing
export const performEffect = async (input: QRSubscriptionInput, oystehr: Oystehr): Promise<string> => {
  const { qr, secrets } = input;

  if (qr.status !== 'completed' && qr.status !== 'amended') {
    console.log(`Skipping harvest for QR ${qr.id} with status=${qr.status}`);
    return `skipped: status=${qr.status}`;
  }

  // Page-level harvesting (patient record, account/coverage, documents, consent)
  // is now handled incrementally by the sub-harvest-paperwork-page Task subscription.
  // This subscription handles finalization operations that run after the full QR
  // reaches completed/amended status.

  const tasksFailed: string[] = [];

  console.time('querying for resources to support qr harvest finalization');
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Appointment | Location>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: qr.encounter?.reference?.replace('Encounter/', '') ?? '',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:patient',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
      ],
    })
  ).unbundle();
  console.timeEnd('querying for resources to support qr harvest finalization');

  const encounterResource = resources.find((res) => res.resourceType === 'Encounter') as Encounter | undefined;
  const patientResource = resources.find((res) => res.resourceType === 'Patient') as Patient | undefined;
  const appointmentResource = resources.find((res) => res.resourceType === 'Appointment') as Appointment | undefined;

  if (patientResource === undefined || patientResource.id === undefined) {
    throw new Error('Patient resource not found');
  }

  if (encounterResource === undefined || encounterResource.id === undefined) {
    throw new Error('Encounter resource not found');
  }

  if (appointmentResource === undefined || appointmentResource.id === undefined) {
    throw new Error('Appointment resource not found');
  }

  // Wait for page-level harvest Tasks to finish before finalization
  await waitForPageHarvestTasks(qr.id!, oystehr);

  // ── Stripe customer sync ──────────────────────────────────────────────
  try {
    const { account: updatedAccount, guarantorResource: updatedGuarantorResource } =
      await getAccountAndCoverageResourcesForPatient(patientResource.id, oystehr);
    if (updatedAccount && updatedGuarantorResource) {
      console.time('updating stripe customer');
      const stripeClient = getStripeClient(secrets);
      await updateStripeCustomer({
        account: updatedAccount,
        guarantorResource: updatedGuarantorResource,
        stripeClient,
      });
      console.timeEnd('updating stripe customer');
    } else {
      console.log('Stripe customer id, account or guarantor resource missing, skipping stripe customer update');
    }
  } catch (error: unknown) {
    tasksFailed.push('update stripe customer');
    console.log(`Failed to update stripe customer: ${JSON.stringify(error)}`);
    captureException(error);
  }

  // ── Paperwork edit flagging ───────────────────────────────────────────
  if (qr.status === 'amended') {
    try {
      console.log('flagging paperwork edit');
      await flagPaperworkEdit(patientResource.id, encounterResource.id, oystehr);
    } catch (error: unknown) {
      tasksFailed.push('flag paperwork edit');
      console.log(`Failed to update flag paperwork edit: ${error}`);
      captureException(error);
    }
  }

  // ── Additional questions + HARVESTING_COMPLETED tag ───────────────────
  // todo: this should probably be moved to the page harvest Task subscription, but it is tightly
  // coupled to some "harvest completed" meta tag so leaving it here for now.
  // Some day it will be worth asking why we need a harvesting completed tag on the appointment at all
  // when we have the questionnaire response status, but again leaving that for another day.
  try {
    const additionalQuestions = createAdditionalQuestions(qr);
    const saveOrUpdateChartDataResourceRequests: (
      | BatchInputPostRequest<Observation>
      | BatchInputPatchRequest<Appointment>
    )[] = [];

    additionalQuestions.forEach((observation) => {
      console.log('additionalQuestion: ', JSON.stringify(observation));
      saveOrUpdateChartDataResourceRequests.push(
        saveResourceRequest(
          makeObservationResource(
            encounterResource.id!,
            patientResource.id!,
            '',
            undefined,
            observation,
            ADDITIONAL_QUESTIONS_META_SYSTEM
          )
        )
      );
    });

    // Add HARVESTING_COMPLETED tag in the same batch transaction
    // This ensures the tag is only set after all resources are created and indexed
    const newTags: Coding[] = [FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG];
    const patchOps = getPatchOperationsForNewMetaTags(appointmentResource, newTags);
    saveOrUpdateChartDataResourceRequests.push({
      method: 'PATCH',
      url: `Appointment/${appointmentResource.id}`,
      operations: patchOps,
    });

    await oystehr.fhir.batch<Observation | Appointment>({
      requests: saveOrUpdateChartDataResourceRequests,
    });
  } catch (error: unknown) {
    tasksFailed.push('create additional questions chart data resource or patch appointment tag', JSON.stringify(error));
    console.log(`Failed to create additional questions chart data resource or patch appointment tag: ${error}`);
    captureException(error);
  }

  const response = tasksFailed.length
    ? `${tasksFailed.length} failed: ${tasksFailed}`
    : 'all tasks executed successfully';
  console.log(response);

  // this alert will fire if tasks fail in testing env so having the env in the message is helpful
  // since it will come into the staging env slack channel
  // we should not send for local development
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  if (tasksFailed.length && ENVIRONMENT !== 'local') {
    await triggerSlackAlarm(
      `Alert in ${ENVIRONMENT} zambda qr-subscription.\n\nOne or more harvest finalization tasks failed for QR ${qr.id}:\n\n${tasksFailed}`,
      secrets
    );
  }

  return response;
};

async function waitForPageHarvestTasks(qrId: string, oystehr: Oystehr): Promise<void> {
  const maxAttempts = 30;
  const delayMs = 2_000;

  for (let i = 0; i < maxAttempts; i++) {
    const activeTasks = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'code', value: `${TaskIndicator.harvestPaperwork.system}|${TaskIndicator.harvestPaperwork.code}` },
          { name: 'focus', value: `QuestionnaireResponse/${qrId}` },
          { name: 'status', value: 'requested,in-progress' },
        ],
      })
    ).unbundle();

    if (activeTasks.length === 0) {
      console.log(`All page harvest tasks complete for QR ${qrId} (after ${i} polls)`);
      return;
    }

    console.log(`Waiting for ${activeTasks.length} page harvest task(s) for QR ${qrId}...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.warn(
    `Timed out waiting for page harvest tasks for QR ${qrId} after ${
      (maxAttempts * delayMs) / 1000
    }s — proceeding with finalization`
  );
}
