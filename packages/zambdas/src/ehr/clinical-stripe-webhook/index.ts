import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { SecretsKeys } from 'utils/lib/secrets';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import {
  applyRefundsToPaymentNotice,
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

  switch (event.type) {
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      const refund = event.data.object;
      const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id;
      if (!chargeId) break;

      const stripe = getStripeClient(secrets);
      const charge = await stripe.charges.retrieve(chargeId, undefined, { stripeAccount });
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (!paymentIntentId) break;

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
      for await (const currentRefund of stripe.refunds.list({ charge: charge.id, limit: 100 }, { stripeAccount })) {
        refunds.push(stripeRefundToDTO(currentRefund));
      }
      for (const notice of notices) {
        await applyRefundsToPaymentNotice(oystehr, notice, refunds);
      }
      break;
    }
    default:
      console.log('Ignoring unhandled event type:', event.type);
  }

  return { statusCode: 200, body: JSON.stringify({}) };
});
