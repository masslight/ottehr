import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  INVALID_INPUT_ERROR,
  isValidUUID,
  ListPatientPaymentInput,
  ListPatientPaymentResponse,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';
import { getPaymentsForPatient } from '../helpers';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;

const ZAMBDA_NAME = 'patient-payments-list';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
      console.log(JSON.stringify(validatedParameters, null, 4));
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const secrets = input.secrets;
    const { patientId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      oystehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, secrets);

    const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehrClient);
    const account: Account | undefined = accountResources.account;

    if (!account?.id) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }

    const effectInput = await complexValidation(
      {
        ...validatedParameters,
        secrets: input.secrets,
      },
      oystehrClient
    );

    const response = await performEffect(effectInput);

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('patient-payments-list', error, ENVIRONMENT);
  }
});
interface EffectInput extends ListPatientPaymentInput {
  oystehrClient: Oystehr;
  stripeClient: Stripe;
  patientAccount: Account;
}
const performEffect = async (input: EffectInput): Promise<ListPatientPaymentResponse> => {
  const { patientAccount: account, patientId, encounterId, oystehrClient, stripeClient } = input;

  const payments = await getPaymentsForPatient({
    oystehrClient,
    stripeClient,
    account,
    patientId,
    encounterId,
  });

  return {
    patientId,
    payments,
    encounterId,
  };
};

const complexValidation = async (
  input: ListPatientPaymentInput & { secrets: Secrets | null },
  oystehrClient: Oystehr
): Promise<EffectInput> => {
  const { patientId, encounterId, secrets } = input;
  const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehrClient);
  const account: Account | undefined = accountResources.account;

  if (!account?.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }

  const stripeClient = getStripeClient(secrets);

  const params: SearchParam[] = [];

  if (encounterId) {
    params.push({
      name: 'request',
      value: `Encounter/${encounterId}`,
    });
  } else {
    params.push({
      name: 'request.patient._id',
      value: patientId,
    });
  }

  return {
    patientId,
    encounterId,
    stripeClient,
    patientAccount: account,
    oystehrClient,
  };
};

const validateRequestParameters = (input: ZambdaInput): ListPatientPaymentInput => {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId } = JSON.parse(input.body);

  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  if (!isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('"patientId" must be a valid UUID.');
  }
  if (encounterId && !isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }

  return {
    patientId,
    encounterId,
  };
};
