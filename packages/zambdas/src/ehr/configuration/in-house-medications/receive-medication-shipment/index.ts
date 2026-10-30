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
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { findInventoryLot, writeInventoryStockEntry } from '../../../../shared/medication-inventory';
import { getMyPractitionerId } from '../../../../shared/practitioners';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-receive-medication-shipment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { userToken, secrets, ...params } = validateRequestParameters(input);
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
  const existingLot = await findInventoryLot(oystehr, { catalogMedicationId: catalog.id, locationId, lotNumber });
  if (existingLot?.batch?.expirationDate && existingLot.batch.expirationDate !== expirationDate) {
    throw INVALID_INPUT_ERROR(
      `Lot ${lotNumber} at this clinic already has expiration date ${existingLot.batch.expirationDate}`
    );
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
  });

  const parsedLot = parseInventoryLot(written.lot);
  const parsedEntry = parseInventoryStockEntry(written.entry);
  if (!parsedLot || !parsedEntry) throw new Error('Stock entry was written but could not be read back');
  return { lot: parsedLot, entry: parsedEntry };
};
