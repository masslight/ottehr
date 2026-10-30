import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { parseInventoryLot } from 'utils/lib/fhir/medication-inventory';
import {
  GetMedicationInventoryInput,
  GetMedicationInventoryResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { getLastReceivedLot } from '../../../../shared/medication-inventory';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

/** What the drug admin page needs to know about a drug's stock. For now: the last lot received, for prefill. */
export const index = wrapHandler(
  'admin-get-medication-inventory',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, ...params } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const response = await performEffect(oystehr, params);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  { medicationId }: GetMedicationInventoryInput
): Promise<GetMedicationInventoryResponse> => {
  const lastLot = await getLastReceivedLot(oystehr, medicationId);
  const parsed = lastLot ? parseInventoryLot(lastLot) : undefined;
  if (!parsed) return {};
  const { id, locationId, lotNumber, ndc, manufacturer, vendor } = parsed;
  return { lastReceivedLot: { id, locationId, lotNumber, ndc, manufacturer, vendor } };
};
