import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getMedicationInventoryConfig,
  isCatalogMedication,
  makeInventoryLot,
  parseInventoryLot,
  parseInventoryStockEntry,
  withLotDetails,
} from 'utils/lib/fhir/medication-inventory';
import {
  ReceiveMedicationShipmentInput,
  ReceiveMedicationShipmentResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { APIErrorCode, FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { callerHasRole, checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { findInventoryLotsByNumber, writeInventoryStockEntry } from '../../../../shared/medication-inventory';
import { getMyPractitionerId } from '../../../../shared/practitioners';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-receive-medication-shipment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { userToken, secrets, ...params } = validateRequestParameters(input);

    if (!(await callerHasRole(input.headers?.Authorization, secrets, INVENTORY_STAFF_ROLES))) {
      throw { code: APIErrorCode.NOT_AUTHORIZED, message: 'You are not permitted to receive medication shipments.' };
    }

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

/** Cost per counted-as item from either way the invoice can be entered, to 4 decimals. */
export const unitCostFromInput = (cost: ReceiveMedicationShipmentInput['cost']): number | undefined => {
  if (!cost) return undefined;
  const perItem = 'perItem' in cost ? cost.perItem : cost.pricePerPackage / cost.itemsPerPackage;
  return Math.round(perItem * 10_000) / 10_000;
};

export const performEffect = async (
  oystehr: Oystehr,
  params: ReceiveMedicationShipmentInput,
  performerReference: string
): Promise<ReceiveMedicationShipmentResponse> => {
  const { medicationId, locationId, lotNumber, expirationDate, quantity, ndc, manufacturer, vendor, cost } = params;

  const catalog = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: medicationId });
  if (!catalog.id || !isCatalogMedication(catalog)) throw FHIR_RESOURCE_NOT_FOUND('Medication');
  const inventory = getMedicationInventoryConfig(catalog);
  if (!inventory) {
    throw INVALID_INPUT_ERROR('This medication is not set up for inventory. Save its inventory setup first.');
  }

  const unitCost = unitCostFromInput(cost);
  const sameNumber = await findInventoryLotsByNumber(oystehr, {
    catalogMedicationId: catalog.id,
    locationId,
    lotNumber,
  });
  let existingLot = sameNumber.find((lot) => lot.batch?.expirationDate === expirationDate);

  // Same number, different expiration: staff decide whether that is a second lot or a typo in the first one.
  const otherExpiration = existingLot ? undefined : sameNumber.find((lot) => lot.batch?.expirationDate);
  if (otherExpiration && !params.expirationConflict) {
    const parsed = parseInventoryLot(otherExpiration);
    if (!parsed) throw new Error(`Medication/${otherExpiration.id} could not be read as an inventory lot`);
    const { id: lotId, expirationDate: existingDate, onHand, unit } = parsed;
    return { expirationConflict: { lotId, expirationDate: existingDate, onHand, unit } };
  }
  if (otherExpiration && params.expirationConflict === 'correct-existing') {
    const previous = otherExpiration.batch?.expirationDate ?? '';
    const corrected = await writeInventoryStockEntry(
      oystehr,
      otherExpiration,
      {
        locationId,
        type: 'adjustment',
        reason: 'expiration-corrected',
        quantity: 0,
        unit: inventory.countedAs,
        performerReference,
        effectiveDateTime: DateTime.now().toUTC().toISO(),
        note: `Expiration changed from ${formatDate(previous)} to ${formatDate(expirationDate)}`,
      },
      (lot) => ({ ...lot, batch: { ...lot.batch, expirationDate } })
    );
    existingLot = corrected.lot;
  }

  const lot = existingLot
    ? withLotDetails(existingLot, { vendor, unitCost })
    : makeInventoryLot(catalog as Medication & { id: string }, {
        locationId,
        lotNumber,
        expirationDate,
        ndc,
        manufacturer,
        vendor,
        unitCost,
        unit: inventory.countedAs,
      });

  const written = await writeInventoryStockEntry(oystehr, lot, {
    locationId,
    type: 'received',
    quantity,
    unit: inventory.countedAs,
    performerReference,
    effectiveDateTime: DateTime.now().toUTC().toISO(),
    vendor,
    unitCost,
  });

  const parsedLot = parseInventoryLot(written.lot);
  const parsedEntry = parseInventoryStockEntry(written.entry);
  if (!parsedLot || !parsedEntry) throw new Error('Stock entry was written but could not be read back');
  return { lot: parsedLot, entry: parsedEntry };
};

// Expiration dates are calendar dates (no zone); shown the way the inventory screen shows them.
const formatDate = (isoDate: string): string => DateTime.fromISO(isoDate).toFormat('MM/dd/yyyy');
