import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Medication, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { makeMedicationInventoryExtension } from 'utils/lib/fhir/medication-inventory';
import { InventoryStockWriteResponse } from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('receive-medication-shipment integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let callerProfile: string;
  let location: Location;
  let catalog: Medication;
  const lotIds = new Set<string>();
  const lotNumber = `IT-LOT-${randomUUID().slice(0, 8)}`;
  const expirationDate = DateTime.now().plus({ years: 1 }).toISODate();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('receive-medication-shipment.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    callerProfile = setup.testUserM2MProfile;

    location = await oystehr.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', status: 'active', name: `IT Inventory Clinic ${randomUUID().slice(0, 8)}` },
        setup.processId
      ) as Location
    );
    catalog = await oystehr.fhir.create<Medication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Medication',
          identifier: [
            { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
            { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: `IT Ceftriaxone ${randomUUID().slice(0, 8)}` },
          ],
          status: 'active',
          extension: [
            makeMedicationInventoryExtension({
              countedAs: 'vial',
              eachContains: { amount: 500, unit: 'mg' },
              use: 'single-use',
              reorderLevels: [],
            }),
          ],
        },
        setup.processId
      ) as Medication
    );
  }, 60_000);

  afterAll(async () => {
    for (const lotId of lotIds) {
      const entries = (
        await oystehr.fhir.search<Observation>({
          resourceType: 'Observation',
          params: [{ name: 'subject', value: `Medication/${lotId}` }],
        })
      ).unbundle();
      for (const entry of entries) {
        await oystehr.fhir.delete({ resourceType: 'Observation', id: entry.id! }).catch(() => undefined);
      }
      await oystehr.fhir.delete({ resourceType: 'Medication', id: lotId }).catch(() => undefined);
    }
    if (catalog?.id) await oystehr.fhir.delete({ resourceType: 'Medication', id: catalog.id }).catch(() => undefined);
    if (location?.id) await oystehr.fhir.delete({ resourceType: 'Location', id: location.id }).catch(() => undefined);
    await cleanup();
  });

  const receive = async (quantity: number): Promise<InventoryStockWriteResponse> =>
    (
      await oystehrZambdas.zambda.execute({
        id: 'receive-medication-shipment',
        medicationId: catalog.id,
        locationId: location.id,
        lotNumber,
        expirationDate,
        quantity,
        ndc: '0409-7332-01',
        manufacturer: 'Hospira, Inc.',
        vendor: 'IT Vendor',
      })
    ).output as InventoryStockWriteResponse;

  it('creates a lot for a new lot number, then adds the next shipment of the same lot to it', async () => {
    const first = await receive(10);
    lotIds.add(first.lot.id);

    expect(first.lot).toMatchObject({
      catalogMedicationId: catalog.id,
      locationId: location.id,
      lotNumber,
      expirationDate,
      ndc: '0409-7332-01',
      manufacturer: 'Hospira, Inc.',
      vendor: 'IT Vendor',
      onHand: 10,
      unit: 'vial',
      status: 'active',
    });
    expect(first.entry).toMatchObject({
      lotId: first.lot.id,
      locationId: location.id,
      type: 'received',
      quantity: 10,
      unit: 'vial',
      performerReference: callerProfile,
      vendor: 'IT Vendor',
    });

    const second = await receive(5);
    lotIds.add(second.lot.id);

    expect(second.lot.id).toBe(first.lot.id);
    expect(second.lot.onHand).toBe(15);
    expect(second.entry).toMatchObject({ lotId: first.lot.id, type: 'received', quantity: 5 });

    const storedLot = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: first.lot.id });
    expect(storedLot.status).toBe('active');
    expect(storedLot.batch).toEqual({ lotNumber, expirationDate });
    const entries = (
      await oystehr.fhir.search<Observation>({
        resourceType: 'Observation',
        params: [{ name: 'subject', value: `Medication/${first.lot.id}` }],
      })
    ).unbundle();
    expect(entries.map((entry) => entry.id).sort()).toEqual([first.entry.id, second.entry.id].sort());
  });
});
