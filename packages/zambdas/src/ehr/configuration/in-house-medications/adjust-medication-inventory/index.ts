import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseInventoryLot, parseInventoryStockEntry } from 'utils/lib/fhir/medication-inventory';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  AdjustMedicationInventoryInput,
  AdjustMedicationInventoryInputSchema,
  AdjustMedicationInventoryResponse,
  InventoryLot,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { StockEntryWrite, writeInventoryStockEntry } from '../../../../shared/medication-inventory';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateWithSchema } from '../../../../shared/validation';

let m2mToken: string;

export const index = wrapHandler(
  'admin-adjust-medication-inventory',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, ...params } = validateWithSchema(AdjustMedicationInventoryInputSchema, input);

    const user = await requireUserWithRole(getUserToken(input), secrets, INVENTORY_STAFF_ROLES);
    const practitionerId = getIdFromReference(user.profile, 'Practitioner');
    if (!practitionerId) throw new Error("Can't receive practitioner resource id attached to current user");

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const response = await performEffect(oystehr, params, `Practitioner/${practitionerId}`);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

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

  const written = await writeInventoryStockEntry(oystehr, lotResource, (onHand) =>
    stockEntryForAction(params, { ...lot, onHand }, performerReference, DateTime.now().toUTC().toISO())
  );

  const parsedLot = parseInventoryLot(written.lot);
  const parsedEntry = written.entry && parseInventoryStockEntry(written.entry);
  if (!parsedLot || !parsedEntry) throw new Error('Stock entry was written but could not be read back');
  return { lot: parsedLot, entry: parsedEntry };
};
