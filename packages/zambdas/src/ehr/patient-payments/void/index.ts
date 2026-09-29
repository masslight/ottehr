import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  parsePaymentRefundsFromNotice,
  parsePaymentVoidFromNotice,
  PaymentVoidInfo,
  settledRefundTotalInCents,
} from 'utils/lib/fhir/paymentRefunds';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  PAYMENT_REFUND_VOID_REASONS,
  VoidPatientPaymentInput,
  VoidPatientPaymentResponse,
} from 'utils/lib/types/api/patient-payment-types';
import { RecordBillingVoidResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { getUserToken, requireUserWithRole } from '../../../shared/auth';
import { getAuth0Token } from '../../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { practitionerRefForUser } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { STRIPE_PAYMENT_ID_SYSTEM, voidPaymentNotice } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';
import { PAYMENT_MANAGEMENT_ROLES } from '../refund';

const ZAMBDA_NAME = 'patient-payments-void';

const VOIDABLE_PAYMENT_METHODS = ['cash', 'check', 'external-card-reader'];

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters: VoidPatientPaymentInput;
  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    console.log(error);
    return lambdaResponse(400, { message: error.message });
  }
  const secrets = input.secrets;

  const user = await requireUserWithRole(getUserToken(input), secrets, PAYMENT_MANAGEMENT_ROLES);

  if (!oystehrM2MClientToken) {
    oystehrM2MClientToken = await getAuth0Token(secrets);
  }
  const oystehrClient = createClinicalOystehrClient(oystehrM2MClientToken, secrets);

  const effectInput = await complexValidation(validatedParameters, oystehrClient);

  const voidedBy = (await practitionerRefForUser(user, oystehrClient)).display;

  const response = await performEffect({ ...effectInput, voidedBy }, oystehrClient);
  return lambdaResponse(200, response);
});

interface VoidEffectInput {
  notice: PaymentNotice;
  paymentNoticeId: string;
  reason: VoidPatientPaymentInput['reason'];
  notes?: string;
  voidedBy?: string;
  // set when the clinical notice is already voided; effects re-run billing-side voiding idempotently
  resumeVoidInfo?: PaymentVoidInfo;
}

const complexValidation = async (params: VoidPatientPaymentInput, oystehrClient: Oystehr): Promise<VoidEffectInput> => {
  const { encounterId, paymentNoticeId, reason, notes } = params;

  const notice = await oystehrClient.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: paymentNoticeId });

  if (notice.request?.reference !== `Encounter/${encounterId}`) {
    throw INVALID_INPUT_ERROR('PaymentNotice does not belong to the specified encounter.');
  }

  const stripePaymentId = notice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
  const paymentMethod = notice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString;
  if (stripePaymentId || !paymentMethod || !VOIDABLE_PAYMENT_METHODS.includes(paymentMethod)) {
    throw INVALID_INPUT_ERROR('Only cash, check, and external card reader payments can be voided.');
  }
  if (notice.status === 'cancelled') {
    // A retry after the billing-side call failed finds the notice already voided: finish voiding
    // the billing copies with the originally recorded info instead of rejecting.
    const storedVoidInfo = parsePaymentVoidFromNotice(notice);
    if (!storedVoidInfo) {
      throw INVALID_INPUT_ERROR('This payment has already been voided.');
    }
    return { notice, paymentNoticeId, reason, notes, resumeVoidInfo: storedVoidInfo };
  }
  if (settledRefundTotalInCents(parsePaymentRefundsFromNotice(notice)) > 0) {
    throw INVALID_INPUT_ERROR('This payment has refunds recorded and can no longer be voided.');
  }

  return { notice, paymentNoticeId, reason, notes };
};

const performEffect = async (input: VoidEffectInput, oystehrClient: Oystehr): Promise<VoidPatientPaymentResponse> => {
  const { notice, paymentNoticeId, reason, notes, voidedBy, resumeVoidInfo } = input;

  // on resume, keep the originally recorded void info so clinical and billing audit records match
  const voidInfo: PaymentVoidInfo = resumeVoidInfo ?? {
    reason,
    notes,
    voidedAtISO: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    voidedBy,
  };

  // no-op when the notice is already cancelled (resume)
  await voidPaymentNotice(oystehrClient, notice, voidInfo);

  // Billing FHIR resources are owned by the billing app; EHR zambdas must not write them directly,
  // so billing copies are voided by the record-billing-void zambda.
  const { billingNoticesVoided } = chooseJson<RecordBillingVoidResponse>(
    await oystehrClient.zambda.execute({
      id: 'record-billing-void',
      clinicalPaymentNoticeId: paymentNoticeId,
      voidInfo,
    })
  );

  return {
    paymentNoticeId,
    voidedBillingNoticeCount: billingNoticesVoided,
  };
};

const validateRequestParameters = (input: ZambdaInput): VoidPatientPaymentInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { encounterId, paymentNoticeId, reason, notes } = safeJsonParse(input.body);

  const missing = [!encounterId && 'encounterId', !paymentNoticeId && 'paymentNoticeId', !reason && 'reason'].filter(
    Boolean
  ) as string[];
  if (missing.length) {
    throw MISSING_REQUIRED_PARAMETERS(missing);
  }
  if (!isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }
  if (typeof paymentNoticeId !== 'string' || !isValidUUID(paymentNoticeId)) {
    throw INVALID_INPUT_ERROR('"paymentNoticeId" must be a valid UUID.');
  }
  if (!PAYMENT_REFUND_VOID_REASONS.includes(reason)) {
    throw INVALID_INPUT_ERROR(`"reason" must be one of: ${PAYMENT_REFUND_VOID_REASONS.join(', ')}`);
  }
  if (notes !== undefined && typeof notes !== 'string') {
    throw INVALID_INPUT_ERROR('"notes" must be a string.');
  }

  return { encounterId, paymentNoticeId, reason, notes: notes || undefined };
};
