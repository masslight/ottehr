import { APIGatewayProxyResult } from 'aws-lambda';
import { GetPatientPaymentTerminalConfigResponse, getSecret, NOT_AUTHORIZED, Secrets, SecretsKeys } from 'utils';
import { getStripeClient, lambdaResponse, topLevelCatch, wrapHandler, ZambdaInput } from '../../../../shared';

const ZAMBDA_NAME = 'patient-payments-terminal-get-config';

const PLACEHOLDER_TERMINAL_LOCATION_ID = 'tml_GZ1T1Q7SPEoqPO';
const PLACEHOLDER_TERMINAL_READER_ID = undefined; //'tmr_GZ1UVgwkUoGBre';
const PLACEHOLDER_SIMULATOR_MODE = undefined; //true;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      throw NOT_AUTHORIZED;
    }

    // const stripeTerminalSdkInitialized =
    initializeStripeTerminalSdk(input.secrets);

    const response: GetPatientPaymentTerminalConfigResponse = {
      terminalConfigured: true, // = stripeTerminalSdkInitialized; TODO: figure out how to configure
      terminalLocationId: PLACEHOLDER_TERMINAL_LOCATION_ID,
      terminalReaderId: PLACEHOLDER_TERMINAL_READER_ID,
      terminalSimulatorMode: PLACEHOLDER_SIMULATOR_MODE,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

function initializeStripeTerminalSdk(secrets: Secrets | null): boolean {
  try {
    const stripeClient = getStripeClient(secrets);
    return Boolean(stripeClient?.terminal?.locations && stripeClient?.terminal?.readers);
  } catch (error) {
    console.warn('Unable to initialize Stripe Terminal SDK client', error);
    return false;
  }
}
