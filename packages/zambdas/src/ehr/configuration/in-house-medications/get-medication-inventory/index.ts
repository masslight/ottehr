import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { getMedicationInventoryConfig, parseInventoryLot } from 'utils/lib/fhir/medication-inventory';
import {
  GetMedicationInventoryInput,
  GetMedicationInventoryResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { getInventoryLotsOnHand, getLastReceivedLot } from '../../../../shared/medication-inventory';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

/**
 * What a screen needs to know about a drug's stock: with a location, the lots on hand there (the MAR Lot
 * field); without one, the last lot received (the receive dialog's prefill).
 */
export const index = wrapHandler(
  'admin-get-medication-inventory',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, ...params } = validateRequestParameters(input);

    await requireUserWithRole(getUserToken(input), secrets, INVENTORY_STAFF_ROLES);

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
  { medicationId, locationId }: GetMedicationInventoryInput
): Promise<GetMedicationInventoryResponse> => {
  if (locationId) {
    const catalog = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: medicationId });
    if (!getMedicationInventoryConfig(catalog)) return {};
    return {
      lots: await getInventoryLotsOnHand(oystehr, { catalogMedicationId: medicationId, locationId }),
    };
  }
  const lastLot = await getLastReceivedLot(oystehr, medicationId);
  const parsed = lastLot ? parseInventoryLot(lastLot) : undefined;
  if (!parsed) return {};
  const { id, lotNumber, ndc, manufacturer, vendor } = parsed;
  return { lastReceivedLot: { id, locationId: parsed.locationId, lotNumber, ndc, manufacturer, vendor } };
};
