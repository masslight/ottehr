import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Medication, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseInventoryLot, parseInventoryStockEntry } from 'utils/lib/fhir/medication-inventory';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { makeVfcBorrowingReplacedExtension, parseVfcBorrowingObservation } from 'utils/lib/fhir/vfc';
import {
  AdjustMedicationInventoryInput,
  AdjustMedicationInventoryInputSchema,
  AdjustMedicationInventoryResponse,
  InventoryLot,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { StockEntryWrite, writeInventoryStockEntry } from '../../../../shared/medication-inventory';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateWithSchema } from '../../../../shared/validation';
import { toBorrowingRow } from '../../../../shared/vfc';

let m2mToken: string;

/** Adjusts a lot up or down with a reason, records a shelf count (requirement 6), or marks a VFC borrowing paid back. */
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

/**
 * The ledger entry for an adjustment or a count. A count records the difference from the lot's on hand
 * (signed, "Count adjustment"), or 0 with "no difference" when the shelf matches, and keeps the counted
 * number as a component.
 */
export const stockEntryForAction = (
  params: Exclude<AdjustMedicationInventoryInput, { action: 'borrowing-replaced' }>,
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
  if (params.action === 'borrowing-replaced') return markBorrowingReplaced(oystehr, params.borrowingId, performerReference);
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

/** The borrowing row keeps its history; "replaced" is added as an extension with who and when. */
const markBorrowingReplaced = async (
  oystehr: Oystehr,
  borrowingId: string,
  performerReference: string
): Promise<AdjustMedicationInventoryResponse> => {
  const observation = await oystehr.fhir.get<Observation>({ resourceType: 'Observation', id: borrowingId });
  const borrowing = parseVfcBorrowingObservation(observation);
  if (!borrowing) throw FHIR_RESOURCE_NOT_FOUND('Observation');
  if (borrowing.replaced) throw INVALID_INPUT_ERROR('This borrowing is already marked replaced.');
  const extensions = [
    ...(observation.extension ?? []),
    makeVfcBorrowingReplacedExtension(DateTime.now().toUTC().toISO(), performerReference),
  ];
  const updated = await oystehr.fhir.patch<Observation>({
    resourceType: 'Observation',
    id: borrowingId,
    operations: [{ op: observation.extension ? 'replace' : 'add', path: '/extension', value: extensions }],
  });
  const parsed = parseVfcBorrowingObservation(updated);
  if (!parsed) throw new Error('Borrowing was updated but could not be read back');
  const resources: FhirResource[] = [updated];
  return { borrowing: toBorrowingRow(parsed, resources, new Map()) };
};
