import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getMedicationInventoryConfig,
  isCatalogMedication,
  isVaccineCatalogMedication,
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
import { findNdcVaccineProduct, getMvxManufacturer } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { findInventoryLotsByNumber, writeInventoryStockEntry } from '../../../../shared/medication-inventory';
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
  if (!catalog.id || !isCatalogMedication(catalog)) throw FHIR_RESOURCE_NOT_FOUND('Medication');
  const inventory = getMedicationInventoryConfig(catalog);
  if (!inventory) {
    throw INVALID_INPUT_ERROR('This medication is not set up for inventory. Save its inventory setup first.');
  }
  // A vaccine box names its manufacturer through the CDC NDC crosswalk (MVX); a typed manufacturer wins.
  const isVaccine = isVaccineCatalogMedication(catalog);
  const crosswalk = isVaccine ? findNdcVaccineProduct(ndc) : undefined;
  const manufacturer =
    params.manufacturer ?? (crosswalk ? getMvxManufacturer(crosswalk.mvx)?.name ?? crosswalk.labeler : undefined);
  const fundingSource = isVaccine ? params.fundingSource : undefined;
  const { locations } = await listActiveLocations(oystehr, { inPersonOnly: true });
  if (!locations.some((location) => location.id === locationId)) {
    throw INVALID_INPUT_ERROR('This location is not an active in-person location.');
  }

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
        note: `Expiration changed from ${formatDateForDisplay(previous)} to ${formatDateForDisplay(expirationDate)}`,
      },
      (lot) => ({ ...lot, batch: { ...lot.batch, expirationDate } })
    );
    existingLot = corrected.lot;
  }

  const lot = existingLot
    ? withLotDetails(existingLot, { vendor, fundingSource })
    : makeInventoryLot(catalog, {
        locationId,
        lotNumber,
        expirationDate,
        ndc,
        manufacturer,
        ...(crosswalk ? { mvx: crosswalk.mvx } : {}),
        vendor,
        fundingSource,
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
  });

  const parsedLot = parseInventoryLot(written.lot);
  const parsedEntry = parseInventoryStockEntry(written.entry);
  if (!parsedLot || !parsedEntry) throw new Error('Stock entry was written but could not be read back');
  return { lot: parsedLot, entry: parsedEntry };
};
