import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseInventoryLot, parseInventoryStockEntry } from 'utils/lib/fhir/medication-inventory';
import {
  AdjustMedicationInventoryInput,
  AdjustMedicationInventoryResponse,
  InventoryLot,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { StockEntryWrite, writeInventoryStockEntry } from '../../../../shared/medication-inventory';
import { getMyPractitionerId } from '../../../../shared/practitioners';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

/** Adjusts a lot up or down with a reason, or records a shelf count (requirement 6). */
export const index = wrapHandler(
  'admin-adjust-medication-inventory',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { userToken, secrets, ...params } = validateRequestParameters(input);

    await requireUserWithRole(userToken, secrets, INVENTORY_STAFF_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    const practitionerId = await getMyPractitionerId(userToken, secrets);

    const response = await performEffect(oystehr, params, `Practitioner/${practitionerId}`);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

/**
 * The ledger entry for an adjustment or a count. A count records the difference from the lot's on hand
 * (signed, "Count adjustment"), or 0 with "no difference" when the shelf matches, and keeps the counted
 * number as a component.
 */
export const stockEntryForAction = (
  params: AdjustMedicationInventoryInput,
  lot: InventoryLot,
  performerReference: string,
  effectiveDateTime: string
): StockEntryWrite => {
  const base = { locationId: lot.locationId, unit: lot.unit, performerReference, effectiveDateTime };
  if (params.action === 'adjust') {
    return {
      ...base,
      type: 'adjustment',
      reason: params.reason,
      quantity: params.direction === 'remove' ? -params.quantity : params.quantity,
      ...(params.note ? { note: params.note } : {}),
    };
  }
  const difference = params.counted - lot.onHand;
  return {
    ...base,
    type: 'count',
    reason: difference === 0 ? 'no-difference' : 'count-adjustment',
    quantity: difference,
    components: [{ code: 'counted', value: params.counted, unit: lot.unit }],
  };
};

export const performEffect = async (
  oystehr: Oystehr,
  params: AdjustMedicationInventoryInput,
  performerReference: string
): Promise<AdjustMedicationInventoryResponse> => {
  const lotResource = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: params.lotId });
  const lot = parseInventoryLot(lotResource);
  if (!lot) throw FHIR_RESOURCE_NOT_FOUND('Medication');

  const written = await writeInventoryStockEntry(
    oystehr,
    lotResource,
    stockEntryForAction(params, lot, performerReference, DateTime.now().toUTC().toISO())
  );

  const parsedLot = parseInventoryLot(written.lot);
  const parsedEntry = parseInventoryStockEntry(written.entry);
  if (!parsedLot || !parsedEntry) throw new Error('Stock entry was written but could not be read back');
  return { lot: parsedLot, entry: parsedEntry };
};
