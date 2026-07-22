import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { RecordBillingManualPaymentResponse, TIMEZONES } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, recordBillingPatientPayment } from '../payments';
import { createBillingClient, fetchById } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'record-billing-manual-payment';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  // TODO: Should every payment have a submitter?
  // For now we keep going if the caller has no profile or the lookup fails.
  let submitterRef: Reference | undefined;
  const authorization = input.headers.Authorization;
  if (authorization) {
    try {
      const user = await getUser(authorization.replace('Bearer ', ''), params.secrets);
      if (user.profile) submitterRef = { reference: user.profile };
    } catch (error) {
      console.log('could not resolve caller profile for submitter', error);
    }
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);

  // The billing client cannot see Encounters, so check the ID before recording the payment.
  // TODO: Is preventing a bad ID worth the extra lookup?
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);
  await fetchById<Encounter>(clinicalOystehr, 'Encounter', params.encounterId);

  // Keep the creation time separate from the payment date.
  // A backdated payment should only change the payment date fields.
  const now = DateTime.now();
  const createdISO = now.toUTC().toISO();
  if (!createdISO) {
    throw new Error('Failed to serialize the current time for PaymentNotice creation');
  }
  const paymentDate = (params.paymentDateISO ? DateTime.fromISO(params.paymentDateISO) : now)
    .setZone(TIMEZONES[0])
    .toFormat('yyyy-MM-dd');

  const oystehr = createBillingClient(m2mToken, params.secrets);
  const { notice, claimId } = await recordBillingPatientPayment(oystehr, {
    encounterId: params.encounterId,
    amountInCents: params.amountInCents,
    paymentMethod: params.paymentMethod,
    dedupIdentifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: params.idempotencyKey },
    secrets: params.secrets,
    paymentDate,
    createdISO,
    checkNumber: params.checkNumber,
    description: params.description,
    submitterRef,
  });

  if (!notice.id) {
    throw new Error('recordBillingPatientPayment returned a PaymentNotice without an id');
  }
  const response: RecordBillingManualPaymentResponse = { paymentNoticeId: notice.id, claimId };
  return { statusCode: 200, body: JSON.stringify(response) };
});
