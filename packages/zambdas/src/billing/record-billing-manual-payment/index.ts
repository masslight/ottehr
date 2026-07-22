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
import { RecordBillingManualPaymentParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'record-billing-manual-payment';

let m2mToken: string;

interface ComplexValidationOutput extends RecordBillingManualPaymentParams {
  submitterRef?: Reference;
}

const complexValidation = async (
  input: ZambdaInput,
  params: RecordBillingManualPaymentParams,
  token: string
): Promise<ComplexValidationOutput> => {
  // TODO: Should every payment have a submitter?
  // For now we keep going if the caller has no profile or the lookup fails.
  let submitterRef: Reference | undefined;
  const authorization = input.headers?.Authorization;
  if (authorization) {
    try {
      const user = await getUser(authorization.replace('Bearer ', ''), params.secrets);
      if (user.profile) submitterRef = { reference: user.profile };
    } catch (error) {
      console.log('could not resolve caller profile for submitter', error);
    }
  }

  // The billing client cannot see Encounters, so check the ID before recording money against it.
  const clinicalOystehr = createClinicalOystehrClient(token, params.secrets);
  await fetchById<Encounter>(clinicalOystehr, 'Encounter', params.encounterId);

  return { ...params, submitterRef };
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const effectInput = await complexValidation(input, params, m2mToken);

  // Keep the creation time separate from the payment date.
  // A backdated payment should only change the payment date fields.
  const now = DateTime.now();
  const createdISO = now.toUTC().toISO();
  if (!createdISO) {
    throw new Error('Failed to serialize the current time for PaymentNotice creation');
  }
  const paymentDate = (effectInput.paymentDateISO ? DateTime.fromISO(effectInput.paymentDateISO) : now)
    .setZone(TIMEZONES[0])
    .toFormat('yyyy-MM-dd');

  const oystehr = createBillingClient(m2mToken, effectInput.secrets);
  const { notice, claimId } = await recordBillingPatientPayment(oystehr, {
    encounterId: effectInput.encounterId,
    amountInCents: effectInput.amountInCents,
    paymentMethod: effectInput.paymentMethod,
    dedupIdentifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: effectInput.idempotencyKey },
    secrets: effectInput.secrets,
    paymentDate,
    createdISO,
    checkNumber: effectInput.checkNumber,
    description: effectInput.description,
    submitterRef: effectInput.submitterRef,
  });

  if (!notice.id) {
    throw new Error('recordBillingPatientPayment returned a PaymentNotice without an id');
  }
  const response: RecordBillingManualPaymentResponse = { paymentNoticeId: notice.id, claimId };
  return { statusCode: 200, body: JSON.stringify(response) };
});
