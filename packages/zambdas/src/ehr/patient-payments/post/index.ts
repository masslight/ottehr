import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Identifier, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getStripeCustomerIdFromAccount,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISCONFIGURED_ENVIRONMENT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  PAYMENT_METHOD_EXTENSION_URL,
  PostPatientPaymentInput,
  Secrets,
  SecretsKeys,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
  TIMEZONES,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  getUser,
  lambdaResponse,
  makeBusinessIdentifierForCandidPayment,
  makeBusinessIdentifierForStripePayment,
  topLevelCatch,
  ZambdaInput,
} from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    const secrets = input.secrets;
    if (!authorization) {
      console.log('authorization header not found');
      throw NOT_AUTHORIZED;
    }
    const user = await getUser(authorization.replace('Bearer ', ''), secrets);

    const userProfile = user.profile;

    if (!userProfile) {
      throw NOT_AUTHORIZED;
    }

    console.group('validateRequestParameters');
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
      console.log(JSON.stringify(validatedParameters, null, 4));
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const requiredSecrets = validateEnvironmentParameters(
      input,
      validatedParameters.paymentDetails.paymentMethod === 'card'
    );
    const { patientId, encounterId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      oystehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, secrets);

    const effectInput: ComplexValidationOutput = await complexValidation(
      {
        ...validatedParameters,
        ...requiredSecrets,
        userProfile,
      },
      oystehrClient
    );

    const notice = await performEffect(effectInput, oystehrClient);

    return lambdaResponse(200, { notice, patientId, encounterId });
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('patient-payments-post', error, ENVIRONMENT);
  }
};

const performEffect = async (input: ComplexValidationOutput, oystehrClient: Oystehr): Promise<PaymentNotice> => {
  const { encounterId, paymentDetails, organizationId, userProfile, secrets } = input;
  const { paymentMethod, amountInCents, description } = paymentDetails;
  const dateTimeIso = DateTime.now().toISO() || '';
  console.log('dateTimeIso', dateTimeIso);
  const paymentNoticeInput: PaymentNoticeInput = {
    encounterId,
    paymentDetails,
    submitterRef: { reference: userProfile },
    dateTimeIso,
    recipientId: organizationId,
  };
  if (input.cardInput && paymentMethod === 'card') {
    const stripeClient = getStripeClient(secrets);
    const customerId = input.cardInput.stripeCustomerId;
    const paymentMethodId = paymentDetails.paymentMethodId;
    const paymentIntentInput: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      description: description || `Payment for encounter ${encounterId}`,
      confirm: true,
      metadata: {
        encounterId,
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    };
    const paymentIntent = await stripeClient.paymentIntents.create(paymentIntentInput);

    paymentNoticeInput.stripePaymentIntentId = paymentIntent.id;

    console.log('Payment Intent created:', JSON.stringify(paymentIntent, null, 2));
  } else {
    console.log('handling non card payment:', paymentMethod, amountInCents, description);
    // here's we might set a candidPayment id once candid stuff has been added
  }
  const noticeToWrite = makePaymentNotice(paymentNoticeInput);

  return await oystehrClient.fhir.create<PaymentNotice>(noticeToWrite);
};

const validateRequestParameters = (input: ZambdaInput): PostPatientPaymentInput => {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId, paymentDetails } = JSON.parse(input.body);

  const missingParams: string[] = [];

  if (!patientId) {
    missingParams.push('patientId');
  }
  if (!encounterId) {
    missingParams.push('encounterId');
  }
  if (!paymentDetails) {
    missingParams.push('paymentDetails');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  if (typeof paymentDetails !== 'object' || !paymentDetails.paymentMethod || !paymentDetails.amountInCents) {
    throw INVALID_INPUT_ERROR(
      '"paymentDetails" must be an object with a "paymentMethod" property and an "amountInCents" property that is a valid non-zero integer.'
    );
  }

  if (!isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('"patientId" must be a valid UUID.');
  }
  if (!isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }

  const { paymentMethod, amountInCents, paymentMethodId, description } = paymentDetails;
  if (paymentMethod !== 'card' && paymentMethod !== 'cash' && paymentMethod !== 'check') {
    throw INVALID_INPUT_ERROR('"paymentDetails.paymentMethod" must be "card", "cash", or "check".');
  }
  if (paymentMethod === 'card' && !paymentMethodId) {
    throw INVALID_INPUT_ERROR('"paymentDetails.paymentMethodId" is required for card payments.');
  }
  const verifiedAmount = parseInt(amountInCents);
  if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
    throw INVALID_INPUT_ERROR('"paymentDetails.amountInCents" must be a valid non-zero integer.');
  }
  if (description && typeof description !== 'string') {
    throw INVALID_INPUT_ERROR('"paymentDetails.description" must be a string if provided.');
  }

  return {
    patientId,
    encounterId,
    paymentDetails: {
      ...paymentDetails,
      amountInCents: verifiedAmount,
    },
  };
};

interface RequiredSecrets {
  organizationId: string;
  stripeKey: string | null;
  secrets: Secrets | null;
}

const validateEnvironmentParameters = (input: ZambdaInput, isCardPayment: boolean): RequiredSecrets => {
  const secrets = input.secrets;
  if (!secrets) {
    throw new Error('Secrets are required for this operation.');
  }

  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
  if (!organizationId) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR(
      '"ORGANIZATION_ID" environment variable was not set. Please ensure it is configured in project secrets.'
    );
  }

  let stripeKey: string | null = null;

  if (isCardPayment) {
    try {
      stripeKey = getSecret(SecretsKeys.STRIPE_SECRET_KEY, secrets);
    } catch (error) {
      throw MISCONFIGURED_ENVIRONMENT_ERROR(
        '"STRIPE_SECRET_KEY" environment variable was not set. Please ensure it is configured in project secrets.'
      );
    }
  }

  return { organizationId, stripeKey, secrets };
};

type ComplexValidationInput = PostPatientPaymentInput & RequiredSecrets & { userProfile: string };
interface ComplexValidationOutput extends ComplexValidationInput {
  cardInput?: {
    stripeCustomerId: string;
  };
}
const complexValidation = async (input: ComplexValidationInput, oystehr: Oystehr): Promise<ComplexValidationOutput> => {
  if (input.paymentDetails.paymentMethod === 'card') {
    const patientAccount = await getAccountAndCoverageResourcesForPatient(input.patientId, oystehr);
    if (!patientAccount.account) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }
    const stripeCustomerId = getStripeCustomerIdFromAccount(patientAccount.account);
    if (!stripeCustomerId) {
      throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
    }
    return { cardInput: { stripeCustomerId }, ...input };
  }
  return { ...input };
};

interface PaymentNoticeInput extends Omit<PostPatientPaymentInput, 'patientId'> {
  submitterRef: Reference;
  stripePaymentIntentId?: string;
  candidPaymentId?: string;
  recipientId: string;
  dateTimeIso: string;
}

const makePaymentNotice = (input: PaymentNoticeInput): PaymentNotice => {
  const {
    encounterId,
    paymentDetails,
    submitterRef,
    stripePaymentIntentId,
    candidPaymentId,
    dateTimeIso,
    recipientId,
  } = input;

  const { paymentMethod, amountInCents } = paymentDetails;

  let identifier: Identifier | undefined;

  if (paymentMethod === 'card' && stripePaymentIntentId) {
    identifier = makeBusinessIdentifierForStripePayment(stripePaymentIntentId);
  } else if (candidPaymentId) {
    identifier = makeBusinessIdentifierForCandidPayment(candidPaymentId);
  }

  // the created timestamp is in UTC and the exact date in any timezone can always be derived from there
  // for now the payment date on the PaymentNotice is set to the default timezone (US Eastern)
  const paymentDate = DateTime.fromISO(dateTimeIso).setZone(TIMEZONES[0]).toFormat('yyyy-MM-dd');

  const created = DateTime.fromISO(dateTimeIso).toUTC().toISO();
  if (!created) {
    throw new Error('Invalid dateTimeIso provided for PaymentNotice creation');
  }

  console.log('payment date', paymentDate);

  const amountInDollars = amountInCents / 100.0;
  const paymentAmount: Money = {
    value: amountInDollars,
    currency: 'USD',
  };

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created,
    disposition:
      paymentMethod === 'card'
        ? 'card payment intent created and confirmed with Stripe'
        : `${paymentMethod} collected from patient`,
    outcome: 'complete',
    paymentDate,
    paymentAmount,
    detail: [
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payment-type', code: 'payment' }] },
        submitter: submitterRef,
      },
    ],
  };

  const notice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: { reference: `Encounter/${encounterId}`, type: 'Encounter' },
    created,
    amount: paymentAmount,
    contained: [reconciliation],
    extension: [
      {
        url: PAYMENT_METHOD_EXTENSION_URL,
        valueString: paymentMethod,
      },
    ],
    payment: {
      reference: `#${reconciliation.id}`,
    },
    recipient: { reference: `Organization/${recipientId}` },
  };
  if (identifier) {
    notice.identifier = [identifier];
  }
  return notice;
};
