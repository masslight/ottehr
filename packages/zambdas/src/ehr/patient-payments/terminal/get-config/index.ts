import { APIGatewayProxyResult } from 'aws-lambda';
import {
  GetPatientPaymentTerminalConfigInput,
  GetPatientPaymentTerminalConfigResponse,
  getSecret,
  getStripeTerminalLocationIdForAppointmentOrEncounter,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  SecretsKeys,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';

const ZAMBDA_NAME = 'patient-payments-terminal-get-config';

let oystehrM2MClientToken: string;

const SIMULATION_TERMINAL_LOCATION_VALUES = new Set(['sim', 'simulated', 'simulation']);

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      throw NOT_AUTHORIZED;
    }

    const validatedParameters = validateRequestParameters(input);

    if (!oystehrM2MClientToken) {
      oystehrM2MClientToken = await getAuth0Token(input.secrets);
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, input.secrets);
    const terminalLocationId = await getStripeTerminalLocationIdForAppointmentOrEncounter(
      {
        encounterId: validatedParameters.encounterId,
      },
      oystehrClient
    );

    const normalizedTerminalLocationId = terminalLocationId?.trim();
    const isSimulationConfig = normalizedTerminalLocationId
      ? SIMULATION_TERMINAL_LOCATION_VALUES.has(normalizedTerminalLocationId.toLowerCase())
      : false;

    const response: GetPatientPaymentTerminalConfigResponse = {
      terminalConfigured: Boolean(normalizedTerminalLocationId),
      terminalLocationId: isSimulationConfig ? undefined : normalizedTerminalLocationId,
      terminalSimulatorMode: isSimulationConfig,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

const validateRequestParameters = (input: ZambdaInput): GetPatientPaymentTerminalConfigInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { encounterId } = JSON.parse(input.body);

  const missingParams: string[] = [];
  if (!encounterId) {
    missingParams.push('encounterId');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  if (!isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }

  return {
    encounterId,
  };
};
