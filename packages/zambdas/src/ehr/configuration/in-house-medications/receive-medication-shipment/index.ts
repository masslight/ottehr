import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getCatalogMedicationType,
  getMedicationInventoryConfig,
  makeInventoryLot,
  parseInventoryLot,
  parseInventoryStockEntry,
  withLotDetails,
} from 'utils/lib/fhir/medication-inventory';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  ReceiveMedicationShipmentInput,
  ReceiveMedicationShipmentInputSchema,
  ReceiveMedicationShipmentResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { VACCINE_FUNDING_SOURCE_LABELS } from 'utils/lib/types/data/immunization/vaccine-funding-source';
import { getMvxManufacturer } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import {
  findInventoryLotsByNumber,
  StockEntryWrite,
  writeInventoryStockEntry,
} from '../../../../shared/medication-inventory';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateWithSchema } from '../../../../shared/validation';
import { performEffect as listActiveLocations } from '../../../locations/list-active-locations';

let m2mToken: string;

export const index = wrapHandler(
  'admin-receive-medication-shipment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, ...params } = validateWithSchema(ReceiveMedicationShipmentInputSchema, input);

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

export const performEffect = async (
  oystehr: Oystehr,
  params: ReceiveMedicationShipmentInput,
  performerReference: string
): Promise<ReceiveMedicationShipmentResponse> => {
  const { medicationId, locationId, lotNumber, expirationDate, quantity, ndc, vendor } = params;

  const catalog = await oystehr.fhir.get<Medication & { id: string }>({ resourceType: 'Medication', id: medicationId });
  const type = getCatalogMedicationType(catalog);
  if (!catalog.id || !type) throw FHIR_RESOURCE_NOT_FOUND('Medication');
  const inventory = getMedicationInventoryConfig(catalog);
  if (!inventory) {
    throw INVALID_INPUT_ERROR(`This ${type} is not set up for inventory. Save its inventory setup first.`);
  }
  // A vaccine lot is VFC, private or state stock; a medication lot has no funding source.
  const fundingSource = type === 'vaccine' ? params.fundingSource : undefined;
  if (type === 'vaccine' && !fundingSource) {
    throw INVALID_INPUT_ERROR('A vaccine lot needs its funding source: VFC, Private or State program.');
  }
  // A vaccine's manufacturer is picked from the manufacturers list, so the lot has its MVX code and the name the
  // list gives it, whatever name the request carries. A medication's manufacturer is saved as typed.
  const vaccineManufacturer = type === 'vaccine' ? getMvxManufacturer(params.mvx) : undefined;
  if (type === 'vaccine' && !vaccineManufacturer) {
    throw INVALID_INPUT_ERROR(
      params.mvx
        ? `MVX ${params.mvx} is not in the manufacturers list.`
        : 'A vaccine lot needs its manufacturer, picked from the manufacturers list.'
    );
  }
  const manufacturer = type === 'vaccine' ? vaccineManufacturer?.name : params.manufacturer;
  const { locations } = await listActiveLocations(oystehr, { inPersonOnly: true });
  if (!locations.some((location) => location.id === locationId)) {
    throw INVALID_INPUT_ERROR('This location is not an active in-person location.');
  }

  const sameNumber = await findInventoryLotsByNumber(oystehr, {
    catalogMedicationId: catalog.id,
    locationId,
    lotNumber,
  });
  // One lot number is one stock at a location. While any lot with this number holds doses there, whatever its
  // expiration date, the number cannot be received under another funding source. An empty lot takes the funding
  // source of the shipment received into it.
  for (const lot of sameNumber) {
    const held = parseInventoryLot(lot);
    if (!fundingSource || !held?.fundingSource || held.fundingSource === fundingSource || held.onHand === 0) continue;
    throw INVALID_INPUT_ERROR(
      `Lot ${lotNumber} at this location is ${VACCINE_FUNDING_SOURCE_LABELS[held.fundingSource]} stock with ${
        held.onHand
      } on hand, so it cannot be received as ${VACCINE_FUNDING_SOURCE_LABELS[fundingSource]}. Receive it as ${
        VACCINE_FUNDING_SOURCE_LABELS[held.fundingSource]
      }, or adjust the lot to zero first to change its funding source.`
    );
  }

  const existingLot = sameNumber.find((lot) => lot.batch?.expirationDate === expirationDate);
  const confirmedLot = sameNumber.find((lot) => lot.id === params.lotId);
  if (
    params.expirationConflict === 'correct-existing' &&
    (!confirmedLot || (existingLot && existingLot !== confirmedLot))
  ) {
    throw INVALID_INPUT_ERROR(
      `Lot ${lotNumber} changed after it was shown. Cancel and receive the shipment again to review it.`
    );
  }

  // Same number, different expiration: staff decide whether that is a second lot or a typo in the first one.
  const otherExpiration = existingLot ? undefined : sameNumber.find((lot) => lot.batch?.expirationDate);
  if (otherExpiration && !params.expirationConflict) {
    const parsed = parseInventoryLot(otherExpiration);
    if (!parsed) throw new Error(`Medication/${otherExpiration.id} could not be read as an inventory lot`);
    const { id: lotId, expirationDate: existingDate, onHand, unit } = parsed;
    return { expirationConflict: { lotId, expirationDate: existingDate, onHand, unit } };
  }

  const received: StockEntryWrite = {
    locationId,
    type: 'received',
    quantity,
    unit: inventory.countedAs,
    performerReference,
    effectiveDateTime: DateTime.now().toUTC().toISO(),
    vendor,
  };
  let written: { lot: Medication; entry: Observation | undefined };
  if (otherExpiration && confirmedLot && params.expirationConflict === 'correct-existing') {
    const previous = confirmedLot.batch?.expirationDate ?? '';
    const corrected: StockEntryWrite = {
      locationId,
      type: 'adjustment',
      reason: 'expiration-corrected',
      quantity: 0,
      unit: inventory.countedAs,
      performerReference,
      effectiveDateTime: received.effectiveDateTime,
      note: `Expiration changed from ${formatDateForDisplay(previous)} to ${formatDateForDisplay(expirationDate)}`,
    };
    written = await writeInventoryStockEntry(oystehr, confirmedLot, [corrected, received], (lot) =>
      withLotDetails({ ...lot, batch: { ...lot.batch, expirationDate } }, { vendor, fundingSource })
    );
  } else if (existingLot) {
    written = await writeInventoryStockEntry(oystehr, existingLot, received, (lot) =>
      withLotDetails(lot, { vendor, fundingSource })
    );
  } else {
    written = await writeInventoryStockEntry(
      oystehr,
      makeInventoryLot(catalog, {
        locationId,
        lotNumber,
        expirationDate,
        ndc,
        manufacturer,
        mvx: vaccineManufacturer?.mvx,
        vendor,
        fundingSource,
        unit: inventory.countedAs,
      }),
      received
    );
  }

  const parsedLot = parseInventoryLot(written.lot);
  const parsedEntry = written.entry && parseInventoryStockEntry(written.entry);
  if (!parsedLot || !parsedEntry) throw new Error('Stock entry was written but could not be read back');
  return { lot: parsedLot, entry: parsedEntry };
};
