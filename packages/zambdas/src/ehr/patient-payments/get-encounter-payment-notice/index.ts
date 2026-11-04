import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import {
  GetEncounterPaymentNoticeInputSchema,
  GetEncounterPaymentNoticeResponse,
} from 'utils/lib/types/api/encounter-payment-notice.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../../shared/validation';

const ZAMBDA_NAME = 'get-encounter-payment-notice';

let m2mToken: string;

type GetEncounterPaymentNoticeParams = ValidatedZambdaInput<typeof GetEncounterPaymentNoticeInputSchema>;

// The EHR's door to the patient payments it recorded before payments moved to the billing app. The
// billing zambdas invoke it over the wire to adopt those notices instead of reading clinical FHIR.
// Lookups are scoped to the encounter, so a caller only ever sees notices of the encounter it names.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(GetEncounterPaymentNoticeInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  return lambdaResponse(200, await performEffect(oystehr, params));
});

export const performEffect = async (
  oystehr: Oystehr,
  params: GetEncounterPaymentNoticeParams
): Promise<GetEncounterPaymentNoticeResponse> => {
  const { encounterId, includeStripeAccount } = params;
  const [paymentNotice, stripeAccount] = await Promise.all([
    findPaymentNotice(oystehr, params),
    includeStripeAccount ? getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehr) : undefined,
  ]);
  return {
    ...(paymentNotice ? { paymentNotice } : {}),
    ...(stripeAccount ? { stripeAccount } : {}),
  };
};

const findPaymentNotice = async (
  oystehr: Oystehr,
  { encounterId, paymentNoticeId, stripePaymentIds }: GetEncounterPaymentNoticeParams
): Promise<PaymentNotice | undefined> => {
  const lookup = paymentNoticeId
    ? { name: '_id', value: paymentNoticeId }
    : stripePaymentIds
    ? { name: 'identifier', value: stripePaymentIds.map((id) => `${STRIPE_PAYMENT_ID_SYSTEM}|${id}`).join(',') }
    : undefined;
  if (!lookup) return undefined;

  return (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'request', value: `Encounter/${encounterId}` }, lookup],
    })
  ).unbundle()[0];
};
