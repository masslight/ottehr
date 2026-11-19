import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TIMEZONES } from 'utils/lib/types/constants';
import { RecordBillingManualPaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { RecordBillingManualPaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken, getUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { practitionerRefForBillingUser } from '../clinical-practitioners';
import { ensurePaymentTaskForNotice } from '../patient-payments';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, recordBillingPatientPayment } from '../payments';
import { createBillingClient } from '../shared';

type RecordBillingManualPaymentParams = ValidatedZambdaInput<typeof RecordBillingManualPaymentInputSchema>;

const ZAMBDA_NAME = 'record-billing-manual-payment';

let m2mToken: string;

interface ComplexValidationOutput extends RecordBillingManualPaymentParams {
  submitterRef?: Reference;
}

const complexValidation = async (
  input: ZambdaInput,
  params: RecordBillingManualPaymentParams,
  oystehr: Oystehr
): Promise<ComplexValidationOutput> => {
  // TODO: Should every payment have a submitter?
  // For now we keep going if the caller has no profile or the lookup fails.
  // The name is stamped on the reference so payment lists show who took it without a Practitioner lookup.
  let submitterRef: Reference | undefined;
  const authorization = input.headers?.Authorization;
  if (authorization) {
    try {
      const user = await getUser(authorization.replace('Bearer ', ''), params.secrets);
      // The billing client cannot read Practitioners, so the name comes from the EHR's zambda.
      if (user.profile) submitterRef = await practitionerRefForBillingUser(user, oystehr);
    } catch (error) {
      console.log('could not resolve caller profile for submitter', error);
    }
  }

  return { ...params, submitterRef };
};

const performEffect = async (
  oystehr: Oystehr,
  clinicalOystehr: Oystehr,
  effectInput: ComplexValidationOutput
): Promise<RecordBillingManualPaymentResponse> => {
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

  // Scheduled here rather than in recordBillingPatientPayment, which the Task's own subscription calls
  // to copy older EHR notices into billing. Also scheduled on a replay, so a first attempt that wrote
  // the notice but died before this point still gets its receipt and Candid sync on retry.
  if (await hasAppointment(clinicalOystehr, effectInput.encounterId)) {
    await ensurePaymentTaskForNotice(clinicalOystehr, notice, effectInput.encounterId);
  }
  return { paymentNoticeId: notice.id, claimId };
};

// The Task looks up the visit's Stripe account through its appointment and fails without one, so a
// payment on a visit with no appointment (an appointment-less follow-up) is recorded without the Task.
const hasAppointment = async (clinicalOystehr: Oystehr, encounterId: string): Promise<boolean> => {
  const [encounter] = (
    await clinicalOystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: '_id', value: encounterId }],
    })
  ).unbundle();
  return Boolean(encounter?.appointment?.length);
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(RecordBillingManualPaymentInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  // eslint-disable-next-line ottehr/billing-fhir-client-only -- reads the visit's Encounter and schedules the payment Task, a clinical work item
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);
  const effectInput = await complexValidation(input, params, oystehr);
  const response = await performEffect(oystehr, clinicalOystehr, effectInput);
  return { statusCode: 200, body: JSON.stringify(response) };
});
