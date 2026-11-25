import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { makeInventoryLot, makeMedicationInventoryExtension, withLotOnHand } from 'utils/lib/fhir/medication-inventory';
import { ListMedicationInventoryResponse } from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('list-medication-inventory integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let location: Location;
  let catalog: Medication & { id: string };
  let lot: Medication;
  const drugName = `IT Ketorolac ${randomUUID().slice(0, 8)}`;
  const lotNumber = `IT-LOT-${randomUUID().slice(0, 8)}`;
  const today = DateTime.now().toISODate();
  const expirationDate = DateTime.now().plus({ years: 1 }).toISODate();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('list-medication-inventory.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    location = await oystehr.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', status: 'active', name: `IT Inventory Clinic ${randomUUID().slice(0, 8)}` },
        setup.processId
      ) as Location
    );
    catalog = (await oystehr.fhir.create<Medication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Medication',
          identifier: [
            { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
            { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: drugName },
          ],
          status: 'active',
          extension: [
            makeMedicationInventoryExtension({
              countedAs: 'vial',
              eachContains: { amount: 30, unit: 'mg' },
              use: 'multi-use',
              reorderLevels: [{ locationId: location.id!, level: 20 }],
            }),
          ],
        },
        setup.processId
      ) as Medication
    )) as Medication & { id: string };
    lot = await oystehr.fhir.create<Medication>(
      addProcessIdMetaTagToResource(
        withLotOnHand(
          makeInventoryLot(catalog, {
            locationId: location.id!,
            lotNumber,
            expirationDate,
            ndc: '0409-3795-01',
            unit: 'vial',
          }),
          12
        ),
        setup.processId
      ) as Medication
    );
  }, 60_000);

  afterAll(async () => {
    for (const medication of [lot, catalog]) {
      if (medication?.id)
        await oystehr.fhir.delete({ resourceType: 'Medication', id: medication.id }).catch(() => undefined);
    }
    if (location?.id) await oystehr.fhir.delete({ resourceType: 'Location', id: location.id }).catch(() => undefined);
    await cleanup();
  });

  it('lists the tracked drug with its stock at every active location', async () => {
    const output = (
      await oystehrZambdas.zambda.execute({ id: 'list-medication-inventory', view: 'all-locations', today })
    ).output as ListMedicationInventoryResponse;

    expect(output.entries).toEqual([]);
    const row = output.drugs.find((drug) => drug.medicationId === catalog.id);
    expect(row).toMatchObject({
      name: drugName,
      countedAs: 'vial',
      use: 'multi-use',
      onHand: 12,
      earliestExpiration: expirationDate,
      locationsWithReorderLevel: 1,
      locationsBelowReorderLevel: 1,
      markers: ['low'],
      lots: [],
    });
    expect(row?.locations.find((line) => line.locationId === location.id)).toEqual({
      locationId: location.id,
      locationName: location.name,
      onHand: 12,
      reorderLevel: 20,
      earliestExpiration: expirationDate,
      markers: ['low'],
    });
  });

  it('lists the lots of the tracked drug at one location', async () => {
    const output = (
      await oystehrZambdas.zambda.execute({
        id: 'list-medication-inventory',
        view: 'location',
        locationId: location.id,
        today,
      })
    ).output as ListMedicationInventoryResponse;

    const row = output.drugs.find((drug) => drug.medicationId === catalog.id);
    expect(row).toMatchObject({ name: drugName, onHand: 12, reorderLevel: 20 });
    expect(row?.lots).toEqual([
      expect.objectContaining({
        id: lot.id,
        catalogMedicationId: catalog.id,
        locationId: location.id,
        lotNumber,
        expirationDate,
        onHand: 12,
        unit: 'vial',
        status: 'active',
      }),
    ]);
  });
});
