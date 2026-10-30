import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location, Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  INVENTORY_LOT_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_VALUE,
  parseInventoryLot,
} from 'utils/lib/fhir/medication-inventory';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import {
  createInventoryTaskOnce,
  EXPIRING_WINDOW_DAYS,
  getResourcesByIds,
  inventoryDrugName,
  inventoryTaskIdentity,
  makeInventoryTask,
  selectExpirationEvents,
} from '../../shared/medication-inventory-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

let m2mToken: string;

const ZAMBDA_NAME = 'inventory-expiration-tasks';

/**
 * Daily: an Inventory task for every lot with stock that is within 30 days of expiring, and another once it
 * has expired with stock left (requirement 8). Each is created at most once per lot (see `createInventoryTaskOnce`).
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  if (!secrets) throw MISSING_REQUEST_SECRETS;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const summary = await performEffect(oystehr, DateTime.now().toUTC().toISODate());
  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  };
});

export async function performEffect(oystehr: Oystehr, today: string): Promise<{ expiring: number; expired: number }> {
  const windowEnd = DateTime.fromISO(today).plus({ days: EXPIRING_WINDOW_DAYS }).toISODate();
  const lots = (
    await getAllFhirSearchPages<Medication>(
      {
        resourceType: 'Medication',
        params: [
          { name: 'identifier', value: `${INVENTORY_LOT_IDENTIFIER_SYSTEM}|${INVENTORY_LOT_IDENTIFIER_VALUE}` },
          { name: 'status', value: 'active' },
          { name: 'expiration-date', value: `le${windowEnd}` },
        ],
      },
      oystehr
    )
  ).flatMap((lot) => parseInventoryLot(lot) ?? []);
  const events = selectExpirationEvents(lots, today);
  console.log(`${lots.length} active lots expire by ${windowEnd}; ${events.length} with stock need a task`);

  const [catalogs, locations] = await Promise.all([
    getResourcesByIds<Medication>(
      oystehr,
      'Medication',
      events.map((event) => event.lot.catalogMedicationId)
    ),
    getResourcesByIds<Location>(
      oystehr,
      'Location',
      events.map((event) => event.lot.locationId)
    ),
  ]);

  const summary = { expiring: 0, expired: 0 };
  for (const { lot, code } of events) {
    try {
      const catalog = catalogs.get(lot.catalogMedicationId);
      if (!catalog) throw new Error(`Catalog Medication/${lot.catalogMedicationId} of lot ${lot.id} not found`);
      const location = locations.get(lot.locationId);
      await createInventoryTaskOnce(
        oystehr,
        makeInventoryTask({
          code,
          identity: inventoryTaskIdentity(code, lot.id),
          event: {
            code,
            drugName: inventoryDrugName(catalog),
            clinicName: location?.name ?? '',
            lotNumber: lot.lotNumber,
            expirationDate: lot.expirationDate,
            onHand: lot.onHand,
            unit: lot.unit,
          },
          location: { id: lot.locationId, name: location?.name },
          medicationId: lot.catalogMedicationId,
          lotId: lot.id,
        }),
        false
      );
      summary[code] += 1;
    } catch (error) {
      // one lot's failure must not stop the rest of the scan
      console.error(`Failed to create ${code} task for lot Medication/${lot.id}:`, error);
      captureException(error, { tags: { lotId: lot.id } });
    }
  }
  return summary;
}
