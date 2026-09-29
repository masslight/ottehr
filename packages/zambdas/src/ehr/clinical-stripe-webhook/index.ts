import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice, Task } from 'fhir/r4b';
import { RCM_TASK_SYSTEM, RcmTaskCode, RcmTaskCodings } from 'utils/lib/fhir/constants';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getInvoiceTaskOutputs } from 'utils/lib/helpers/tasks/invoices-tasks';
import { SecretsKeys } from 'utils/lib/secrets';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import {
  applyRefundsToPaymentNotice,
  encounterIdFromStripeMetadata,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
  stripeRefundToDTO,
} from '../../shared/stripeIntegration';
import { validateStripeWebhook } from '../../shared/stripeWebhook';
import { ZambdaInput } from '../../shared/types/common';

const ZAMBDA_NAME = 'clinical-stripe-webhook';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { event, stripeAccount, secrets } = validateStripeWebhook(
    input,
    [SecretsKeys.STRIPE_CLINICAL_WEBHOOK_SECRET],
    '"STRIPE_CLINICAL_WEBHOOK_SECRET" was not set. Please configure it in project secrets.'
  );

  console.log('Verified Stripe event:', event.id, event.type, 'connected account:', stripeAccount ?? 'none');

  switch (event.type) {
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      const refund = event.data.object;
      const paymentIntentId =
        typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
      if (!paymentIntentId) break;

      const stripe = getStripeClient(secrets);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createClinicalOystehrClient(m2mToken, secrets);
      const notices = (
        await oystehr.fhir.search<PaymentNotice>({
          resourceType: 'PaymentNotice',
          params: [{ name: 'identifier', value: `${STRIPE_PAYMENT_ID_SYSTEM}|${paymentIntentId}` }],
        })
      ).unbundle();
      if (notices.length === 0) break;

      const refunds: PaymentRefundDTO[] = [];
      for await (const currentRefund of stripe.refunds.list(
        { payment_intent: paymentIntentId, limit: 100 },
        { stripeAccount }
      )) {
        refunds.push(stripeRefundToDTO(currentRefund));
      }
      for (const notice of notices) {
        await applyRefundsToPaymentNotice(oystehr, notice, refunds);
      }
      break;
    }
    case 'invoice.paid':
    case 'invoice.voided':
    case 'invoice.marked_uncollectible': {
      const invoice = event.data.object;
      const encounterId = encounterIdFromStripeMetadata(invoice.metadata);
      if (!encounterId) break;

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createClinicalOystehrClient(m2mToken, secrets);
      const tasks = (
        await oystehr.fhir.search<Task>({
          resourceType: 'Task',
          params: [
            { name: 'encounter', value: `Encounter/${encounterId}` },
            { name: 'code', value: `${RCM_TASK_SYSTEM}|${RcmTaskCode.sendInvoiceToPatient}` },
          ],
        })
      ).unbundle();
      const task = tasks.find(
        (t) =>
          t.output?.some(
            (o) =>
              o.type?.coding?.find((c) => c.code === RcmTaskCode.sendInvoiceOutputInvoiceId) &&
              o.valueString === invoice.id
          )
      );
      if (!task?.id) {
        console.warn(`No invoice task found for Stripe invoice ${invoice.id} / encounter ${encounterId}`);
        break;
      }

      const stripeStatus = {
        'invoice.paid': 'paid',
        'invoice.voided': 'void',
        'invoice.marked_uncollectible': 'uncollectible',
      }[event.type];
      await patchWithOptimisticLock(oystehr, { ...task, id: task.id }, (currentTask) => {
        if (getInvoiceTaskOutputs(currentTask).stripeInvoiceStatus === stripeStatus) return [];
        return [
          {
            op: currentTask.output ? 'replace' : 'add',
            path: '/output',
            value: [
              ...(currentTask.output ?? []),
              { type: RcmTaskCodings.stripeInvoiceStatus, valueString: stripeStatus },
            ],
          },
        ];
      });
      break;
    }
    default:
      console.log('Ignoring unhandled event type:', event.type);
  }

  return { statusCode: 200, body: JSON.stringify({}) };
});
