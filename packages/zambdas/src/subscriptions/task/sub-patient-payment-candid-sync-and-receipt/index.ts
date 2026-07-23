import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, PaymentNotice, PaymentReconciliation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  getOrCreateCandidApiClient,
  getStripeAccountForAppointmentOrEncounter,
  PAYMENT_METHOD_EXTENSION_URL,
  TIMEZONES,
} from 'utils';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, recordBillingPatientPayment } from '../../../billing/payments';
import { createBillingClient } from '../../../billing/shared';
import {
  createClinicalOystehrClient,
  createPatientPaymentReceiptPdf,
  getAuth0Token,
  getStripeClient,
  performCandidPreEncounterSync,
  shouldUseCandid,
  shouldUseOttehrBilling,
  STRIPE_PAYMENT_ID_SYSTEM,
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
  try {
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

    oystehr = createClinicalOystehrClient(oystehrToken, secrets);

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

      // Make sure the payment belongs to the encounter on this task.
      const encounterRef = paymentNotice.request?.reference;
      if (encounterRef !== `Encounter/${encounterId}`) {
        throw new Error(
          `PaymentNotice ${paymentNoticeId} references ${encounterRef}, expected Encounter/${encounterId}`
        );
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
      const stripeClient = getStripeClient(secrets);
      const stripeAccountId = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehr);

      if (stripePaymentIntentId) {
        try {
          paymentIntent = await stripeClient.paymentIntents.retrieve(stripePaymentIntentId, {
            stripeAccount: stripeAccountId,
          });
        } catch (error) {
          console.error('Error fetching Stripe payment intent:', error);
          captureException(error);
          // Continue without payment intent - the PDF creation can handle missing Stripe data
        }
      }

      let billingRecordFailed = false;
      let candidSyncFailed = false;
      let receiptPdfFailed = false;
      const errors: string[] = [];

      // Stripe payments are handled separately and should not be recorded here.
      const shouldRecordPaymentInBillingPlatform = !stripePaymentIntentId;

      // Record the payment in Ottehr billing first.
      // If it fails, do not send it to Candid because a retry could record it twice there.
      if (shouldUseOttehrBilling(secrets) && shouldRecordPaymentInBillingPlatform && amountInCents > 0) {
        try {
          if (paymentNotice.status !== 'active') {
            throw new Error(`PaymentNotice ${paymentNoticeId} has status ${paymentNotice.status}, expected active`);
          }
          const currency = paymentNotice.amount?.currency;
          if (currency && currency !== 'USD') {
            throw new Error(`PaymentNotice ${paymentNoticeId} has unexpected currency ${currency}`);
          }
          const reconciliation = paymentNotice.contained?.find(
            (resource): resource is PaymentReconciliation => resource.resourceType === 'PaymentReconciliation'
          );
          const paymentMethod =
            paymentNotice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString ?? '';
          const createdDateTime = DateTime.fromISO(paymentNotice.created);
          if (!createdDateTime.isValid) {
            throw new Error(
              `PaymentNotice ${paymentNoticeId} has an invalid created timestamp "${paymentNotice.created}"`
            );
          }
          const paymentDate =
            reconciliation?.paymentDate ?? createdDateTime.setZone(TIMEZONES[0]).toFormat('yyyy-MM-dd');
          const billingOystehr = createBillingClient(oystehrToken, secrets);
          console.time('Ottehr billing payment record');
          await recordBillingPatientPayment(billingOystehr, {
            encounterId,
            amountInCents,
            paymentMethod,
            dedupIdentifier: { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: paymentNoticeId },
            secrets,
            paymentDate,
            createdISO: paymentNotice.created,
            description: reconciliation?.disposition,
            submitterRef: reconciliation?.detail?.[0]?.submitter,
          });
          console.timeEnd('Ottehr billing payment record');
        } catch (error) {
          // APIError values are plain objects, so template interpolation would print [object Object]
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          console.error(`Error recording payment in Ottehr billing: ${errorMessage}`);
          captureException(error);
          billingRecordFailed = true;
          errors.push(`Ottehr billing payment record failed: ${errorMessage}`);
        }
      }

      if (shouldUseCandid(secrets)) {
        if (billingRecordFailed) {
          console.log('skipping Candid sync because the billing record failed');
          errors.push('Candid sync skipped because the billing record failed');
        } else {
          try {
            const candidApiClient = await getOrCreateCandidApiClient(oystehr, secrets);
            console.time('Candid pre-encounter sync');
            await performCandidPreEncounterSync({
              encounterId,
              oystehr,
              candidApiClient,
              amountCents: shouldRecordPaymentInBillingPlatform ? amountInCents : undefined,
            });
            console.timeEnd('Candid pre-encounter sync');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            console.error(`Error during Candid pre-encounter sync: ${errorMessage}`);
            captureException(error);
            candidSyncFailed = true;
            errors.push(`Candid sync failed: ${errorMessage}`);
          }
        }
      }

      // Create patient payment receipt PDF
      try {
        console.time('receipt pdf creation');
        const receiptPdfInfo = await createPatientPaymentReceiptPdf({
          oystehr,
          stripeClient,
          encounterId,
          patientId,
          secrets,
          oystehrToken,
          stripeAccountId,
          lastOperationPaymentIntent: paymentIntent,
        });
        console.timeEnd('receipt pdf creation');
        console.log('Receipt PDF created:', receiptPdfInfo);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Error creating receipt PDF: ${errorMessage}`);
        captureException(error);
        receiptPdfFailed = true;
        errors.push(`Receipt PDF creation failed: ${errorMessage}`);
      }

      // Update task status based on whether any step failed
      console.log('making patch request to update task status');
      const anyStepFailed = billingRecordFailed || candidSyncFailed || receiptPdfFailed;
      const taskStatus = anyStepFailed ? 'failed' : 'completed';
      let statusMessage: string;

      if (anyStepFailed) {
        statusMessage = errors.join('; ');
      } else {
        statusMessage = 'Payment sync and receipt PDF completed successfully';
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
      try {
        if (oystehr && taskId)
          await patchTaskStatus(
            { task: { id: taskId }, taskStatusToUpdate: 'failed', statusReasonToUpdate: JSON.stringify(error) },
            oystehr
          );
      } catch (patchError) {
        console.error('Error patching task status in top level catch:', patchError);
      }
      throw error;
    }
  } catch (error: unknown) {
    try {
      if (oystehr && taskId)
        await patchTaskStatus(
          { task: { id: taskId }, taskStatusToUpdate: 'failed', statusReasonToUpdate: JSON.stringify(error) },
          oystehr
        );
    } catch (patchError) {
      console.error('Error patching task status in top level catch:', patchError);
    }
    throw error;
  }
});
