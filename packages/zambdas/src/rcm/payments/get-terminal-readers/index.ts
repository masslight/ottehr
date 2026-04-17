import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler, ZambdaInput } from '../../../shared';
import { getStripeClient } from '../../../shared/stripeIntegration';
import { validateRequestParameters } from './validateRequestParameters';

export interface TerminalReaderInfo {
  id: string;
  label: string | null;
  deviceType: string;
  status: string | null;
  serialNumber: string | null;
  ipAddress: string | null;
  deviceSwVersion: string | null;
}

export interface GetTerminalReadersResponse {
  readers: TerminalReaderInfo[];
  error: string | null;
}

const ZAMBDA_NAME = 'get-terminal-readers';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { stripeAccountId, terminalLocationId, secrets } = validateRequestParameters(input);

    const stripeClient = getStripeClient(secrets);

    const readersResponse = await stripeClient.terminal.readers.list(
      { location: terminalLocationId, limit: 100 },
      { stripeAccount: stripeAccountId }
    );

    const readers: TerminalReaderInfo[] = readersResponse.data.map((reader) => ({
      id: reader.id,
      label: reader.label ?? null,
      deviceType: reader.device_type,
      status: reader.status ?? null,
      serialNumber: reader.serial_number ?? null,
      ipAddress: ((reader as unknown as Record<string, unknown>).ip_address as string | null) ?? null,
      deviceSwVersion: reader.device_sw_version ?? null,
    }));

    const response: GetTerminalReadersResponse = {
      readers,
      error: null,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'type' in error &&
      (error as Record<string, unknown>).type === 'StripeInvalidRequestError'
    ) {
      const response: GetTerminalReadersResponse = {
        readers: [],
        error: error.message,
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    throw error;
  }
});
