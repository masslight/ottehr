import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { getSecret, SecretsKeys } from 'utils';
import {
  createOystehrClient,
  createPatientPaymentReceiptPdf,
  getAuth0Token,
  getStripeClient,
  performCandidPreEncounterSync,
  STRIPE_PAYMENT_ID_SYSTEM,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { patchTaskStatus } from '../../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

let oystehrToken: string;
let oystehr: Oystehr;
let taskId: string | undefined;

const ZAMBDA_NAME = 'sub-patient-payment-candid-sync-and-receipt';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { task, secrets } = validatedParameters;
  console.log('task ID', task.id);
  if (!task.id) {
    throw new Error('Task ID is required');
  }
  taskId = task.id;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }

  oystehr = createOystehrClient(oystehrToken, secrets);

  try {
    console.log('getting payment notice Id from the task');
    const paymentNoticeId =
      task.focus?.type === 'PaymentNotice' ? task.focus?.reference?.replace('PaymentNotice/', '') : undefined;
    console.log('payment notice ID parsed: ', paymentNoticeId);

    if (!paymentNoticeId) {
      console.log('no payment notice ID found on task');
      throw new Error('no payment notice ID found on task focus');
    }

    const encounterId = task.encounter?.reference?.split('/')[1];
    if (!encounterId) {
      console.log('no encounter ID found on task');
      throw new Error('no encounter ID found on task encounter');
    }

    console.log('fetching payment notice');
    const paymentNoticeSearchResult = await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: '_id',
          value: paymentNoticeId,
        },
      ],
    });

    const paymentNotices = paymentNoticeSearchResult.unbundle();
    if (!paymentNotices || paymentNotices.length === 0) {
      throw new Error(`PaymentNotice ${paymentNoticeId} not found`);
    }

    const paymentNotice = paymentNotices[0];

    // Get patient ID from the encounter request
    const encounterRef = paymentNotice.request?.reference;
    if (!encounterRef) {
      throw new Error(`No encounter reference found on PaymentNotice ${paymentNoticeId}`);
    }

    const encounterSearchResult = await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
      ],
    });

    const encounters = encounterSearchResult.unbundle();
    if (!encounters || encounters.length === 0) {
      throw new Error(`Encounter ${encounterId} not found`);
    }

    const encounter = encounters[0] as Encounter;

    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) {
      throw new Error(`No patient reference found on Encounter ${encounterId}`);
    }

    // Get payment amount from PaymentNotice
    const amountInCents = Math.round((paymentNotice.amount?.value || 0) * 100);

    // Get Stripe payment intent if this was a card payment
    let paymentIntent: Stripe.PaymentIntent | undefined;
    const stripePaymentIntentId = paymentNotice.identifier?.find(
      (identifier: { system?: string }) => identifier.system === STRIPE_PAYMENT_ID_SYSTEM
    )?.value;

    if (stripePaymentIntentId) {
      const stripeClient = getStripeClient(secrets);
      try {
        paymentIntent = await stripeClient.paymentIntents.retrieve(stripePaymentIntentId);
      } catch (error) {
        console.error('Error fetching Stripe payment intent:', error);
        captureException(error);
        // Continue without payment intent - the PDF creation can handle missing Stripe data
      }
    }

    // Track failures for both steps
    let candidSyncFailed = false;
    let receiptPdfFailed = false;
    const errors: string[] = [];

    // Perform Candid pre-encounter sync
    try {
      console.time('Candid pre-encounter sync');
      await performCandidPreEncounterSync({
        encounterId,
        oystehr,
        secrets,
        amountCents: amountInCents,
      });
      console.timeEnd('Candid pre-encounter sync');
    } catch (error) {
      console.error(`Error during Candid pre-encounter sync: ${error}`);
      captureException(error);
      candidSyncFailed = true;
      errors.push(`Candid sync failed: ${error}`);
    }

    // Create patient payment receipt PDF
    try {
      console.time('receipt pdf creation');
      const receiptPdfInfo = await createPatientPaymentReceiptPdf(
        encounterId,
        patientId,
        secrets,
        oystehrToken,
        paymentIntent
      );
      console.timeEnd('receipt pdf creation');
      console.log('Receipt PDF created:', receiptPdfInfo);
    } catch (error) {
      console.error(`Error creating receipt PDF: ${error}`);
      captureException(error);
      receiptPdfFailed = true;
      errors.push(`Receipt PDF creation failed: ${error}`);
    }

    // Update task status based on whether any step failed
    console.log('making patch request to update task status');
    const anyStepFailed = candidSyncFailed || receiptPdfFailed;
    const taskStatus = anyStepFailed ? 'failed' : 'completed';
    let statusMessage: string;

    if (anyStepFailed) {
      statusMessage = errors.join('; ');
    } else {
      statusMessage = 'Candid sync and receipt PDF created successfully';
    }

    const patchedTask = await patchTaskStatus(
      { task: { id: task.id }, taskStatusToUpdate: taskStatus, statusReasonToUpdate: statusMessage },
      oystehr
    );

    const response = {
      taskStatus: patchedTask.status,
      statusReason: patchedTask.statusReason,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    try {
      if (oystehr && taskId)
        await patchTaskStatus(
          { task: { id: taskId }, taskStatusToUpdate: 'failed', statusReasonToUpdate: JSON.stringify(error) },
          oystehr
        );
    } catch (patchError) {
      console.error('Error patching task status in top level catch:', patchError);
    }
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
