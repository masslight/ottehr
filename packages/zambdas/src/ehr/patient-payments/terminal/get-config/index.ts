import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import {
  GetPatientPaymentTerminalConfigInput,
  GetPatientPaymentTerminalConfigResponse,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  getStripeTerminalLocationIdForAppointmentOrEncounter,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SecretsKeys,
  TerminalReaderDTO,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
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
    const isLocationSimulationHint = normalizedTerminalLocationId
      ? SIMULATION_TERMINAL_LOCATION_VALUES.has(normalizedTerminalLocationId.toLowerCase())
      : false;

    const isConfigured = Boolean(normalizedTerminalLocationId);

    let readers: TerminalReaderDTO[] = [];

    if (isConfigured) {
      const stripeClient = getStripeClient(input.secrets);
      const stripeAccount = await getStripeAccountForEncounter(validatedParameters.encounterId, oystehrClient);

      if (isLocationSimulationHint) {
        // Location value is a simulation hint — list all readers and filter to simulated ones
        const readersResponse = await stripeClient.terminal.readers.list(
          { limit: 100, status: 'online' },
          { stripeAccount }
        );
        readers = readersResponse.data.filter((r) => isSimulatedDeviceType(r.device_type)).map(mapStripeReaderToDTO);
      } else if (normalizedTerminalLocationId) {
        const readersResponse = await stripeClient.terminal.readers.list(
          { location: normalizedTerminalLocationId, limit: 100, status: 'online' },
          { stripeAccount }
        );
        readers = readersResponse.data.map(mapStripeReaderToDTO);
      }
    }

    // Detect simulation mode from the actual readers rather than only the location hint
    const hasSimulatedReaders = readers.some((r) => r.simulated);

    const response: GetPatientPaymentTerminalConfigResponse = {
      terminalConfigured: isConfigured,
      terminalLocationId: isLocationSimulationHint ? undefined : normalizedTerminalLocationId,
      terminalSimulatorMode: hasSimulatedReaders,
      readers,
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

const getStripeAccountForEncounter = async (
  encounterId: string,
  oystehrClient: Oystehr
): Promise<string | undefined> => {
  return getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehrClient);
};

const isSimulatedDeviceType = (deviceType: string): boolean => deviceType.startsWith('simulated_');

const mapStripeReaderToDTO = (reader: Stripe.Terminal.Reader): TerminalReaderDTO => ({
  id: reader.id,
  label: reader.label ?? null,
  deviceType: reader.device_type,
  status: reader.status ?? null,
  simulated: isSimulatedDeviceType(reader.device_type),
});
