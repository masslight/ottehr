import Oystehr from '@oystehr/sdk';
import { Location, Medication, Observation } from 'fhir/r4b';
import {
  INVENTORY_LOT_IDENTIFIER_SYSTEM,
  InventoryLotInput,
  makeInventoryLot,
  makeInventoryStockEntry,
  makeMedicationInventoryExtension,
  parseInventoryLot,
  withLotDetails,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  InHouseMedicationInventory,
  InventoryStockWriteResponse,
  ReceiveMedicationShipmentInputSchema,
  ReceiveMedicationShipmentResponse,
  VACCINE_DEFAULT_INVENTORY,
} from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_MEDICATION_TYPE_CODE,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as adjustPerformEffect } from '../../src/ehr/configuration/in-house-medications/adjust-medication-inventory/index';
import { performEffect as listPerformEffect } from '../../src/ehr/configuration/in-house-medications/list-medication-inventory/index';
import { performEffect as receivePerformEffect } from '../../src/ehr/configuration/in-house-medications/receive-medication-shipment/index';

vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({
  getAllFhirSearchPages: vi.fn(async (params: any, oystehr: any) => oystehr.fhir.search(params).unbundle()),
}));

const today = '2026-11-20';
const performer = 'Practitioner/nurse-1';

const vaccine: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'mmr',
  status: 'active',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR' },
  ],
  code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: '03', display: 'measles, mumps and rubella virus vaccine' }] },
  extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)],
};

const medicationInventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg' },
  use: 'single-use',
  reorderLevels: [],
};
const medication: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'ondansetron',
  status: 'active',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ondansetron 4 MG/2ML' },
  ],
  extension: [makeMedicationInventoryExtension(medicationInventory)],
};

// A vaccine that used to be set up from a config file: the vaccine type and a name, no CVX code and no status.
const retiredConfigVaccine: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'old',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR (M-M-R II)' },
  ],
  extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)],
};

const vfcLotInput: InventoryLotInput = {
  locationId: 'loc-a',
  lotNumber: 'Y0112',
  expirationDate: '2027-07-11',
  ndc: '00006-4681-00',
  manufacturer: 'Merck',
  fundingSource: 'vfc',
  unit: 'dose',
};

const vaccineLot = (
  id: string,
  onHand: number,
  overrides: Partial<InventoryLotInput> = {}
): Medication & { id: string } => {
  const lot = withLotOnHand(makeInventoryLot(vaccine, { ...vfcLotInput, ...overrides }), onHand);
  return { ...lot, id, meta: { ...lot.meta, versionId: '3' } };
};

const medicationLot: Medication & { id: string } = {
  ...withLotOnHand(
    makeInventoryLot(medication, {
      locationId: 'loc-a',
      lotNumber: 'A123',
      expirationDate: '2027-03-31',
      ndc: '72572-0160-25',
      unit: 'vial',
    }),
    6
  ),
  id: 'med-lot',
};

const received = (lotId: string, quantity: number, unit = 'dose'): Observation => ({
  ...makeInventoryStockEntry({
    lotReference: `Medication/${lotId}`,
    locationId: 'loc-a',
    type: 'received',
    quantity,
    unit,
    effectiveDateTime: '2026-11-01T10:00:00Z',
  }),
  id: `received-${lotId}`,
});

describe('a lot and its funding source', () => {
  it('keeps the funding source in the lot extension, with the vaccine CVX code and the box NDC as codings', () => {
    const lot = makeInventoryLot(vaccine, vfcLotInput);
    expect(lot.code?.coding).toEqual([
      { system: CVX_CODE_SYSTEM_URL, code: '03', display: 'measles, mumps and rubella virus vaccine' },
      { system: CODE_SYSTEM_NDC, code: '00006-4681-00' },
    ]);
    expect(lot.extension?.[0].extension).toContainEqual({ url: 'funding-source', valueCode: 'vfc' });
    expect(parseInventoryLot({ ...lot, id: 'lot-1' })).toMatchObject({
      catalogMedicationId: 'mmr',
      lotNumber: 'Y0112',
      fundingSource: 'vfc',
      unit: 'dose',
      onHand: 0,
    });
  });

  it.each(['vfc', 'private', 'state'] as const)('reads %s back', (fundingSource) => {
    const lot = { ...makeInventoryLot(vaccine, { ...vfcLotInput, fundingSource }), id: 'lot-1' };
    expect(parseInventoryLot(lot)?.fundingSource).toBe(fundingSource);
  });

  it('a medication lot has no funding source, in FHIR or when read back', () => {
    const parsed = parseInventoryLot(medicationLot);
    expect(parsed).toBeDefined();
    expect(parsed).not.toHaveProperty('fundingSource');
    expect(JSON.stringify(medicationLot)).not.toContain('funding-source');
  });

  it('reads a funding source it does not know as none', () => {
    const lot = vaccineLot('lot-1', 5);
    const unknown: Medication = {
      ...lot,
      extension: lot.extension?.map((root) => ({
        ...root,
        extension: root.extension?.map((detail) =>
          detail.url === 'funding-source' ? { url: 'funding-source', valueCode: 'grant' } : detail
        ),
      })),
    };
    expect(parseInventoryLot(unknown)).not.toHaveProperty('fundingSource');
  });

  it('keeps the funding source when on hand changes, as a count or an adjustment does', () => {
    const lot = vaccineLot('lot-1', 8);
    expect(parseInventoryLot(withLotOnHand(lot, 3))).toMatchObject({ fundingSource: 'vfc', onHand: 3 });
    expect(parseInventoryLot(withLotOnHand(lot, 0))).toMatchObject({ fundingSource: 'vfc', status: 'inactive' });
  });

  it('withLotDetails replaces the funding source when given one and keeps it otherwise', () => {
    const lot = vaccineLot('lot-1', 8);
    expect(parseInventoryLot(withLotDetails(lot, { fundingSource: 'private' }))).toMatchObject({
      fundingSource: 'private',
      onHand: 8,
    });
    expect(parseInventoryLot(withLotDetails(lot, { vendor: 'McKesson' }))).toMatchObject({
      fundingSource: 'vfc',
      vendor: 'McKesson',
    });
  });
});

type MockOystehr = Oystehr & {
  fhir: { get: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
};

const activeLocations: Location[] = [{ resourceType: 'Location', id: 'loc-a', name: 'Main Street' }];

const makeMockOystehr = ({
  catalog = [] as Medication[],
  lots = [] as Medication[],
  ledger = [] as Observation[],
} = {}): MockOystehr => {
  const transaction = vi.fn().mockImplementation(({ requests }: { requests: { resource: any }[] }) => ({
    resourceType: 'Bundle',
    entry: requests.map((request, index) => ({
      resource: { ...request.resource, id: request.resource.id ?? `created-${index}` },
    })),
  }));
  const search = vi.fn().mockImplementation(({ resourceType, params }: { resourceType: string; params: any[] }) => ({
    unbundle: () => {
      if (resourceType === 'Location') return activeLocations;
      if (resourceType !== 'Medication') return ledger;
      const isLotSearch = params.some(
        (param) => param.name === 'identifier' && String(param.value).startsWith(INVENTORY_LOT_IDENTIFIER_SYSTEM)
      );
      return isLotSearch ? lots : catalog;
    },
  }));
  return { fhir: { get: vi.fn(), search, transaction } } as unknown as MockOystehr;
};

const receiveBody = {
  medicationId: 'mmr',
  locationId: 'loc-a',
  lotNumber: 'Y0112',
  expirationDate: '2027-07-11',
  quantity: 10,
  ndc: '00006-4681-00',
  manufacturer: 'Merck',
  fundingSource: 'vfc' as const,
};

describe('receive-medication-shipment for a vaccine', () => {
  const written = (result: ReceiveMedicationShipmentResponse): InventoryStockWriteResponse => {
    if ('expirationConflict' in result) throw new Error('expected a write, got an expiration conflict');
    return result;
  };

  it('accepts the three funding sources in the request and nothing else', () => {
    const body = {
      ...receiveBody,
      medicationId: '6f1c2a4e-1111-4b2a-9c3d-000000000001',
      locationId: '6f1c2a4e-2222-4b2a-9c3d-000000000002',
    };
    for (const fundingSource of ['vfc', 'private', 'state']) {
      expect(ReceiveMedicationShipmentInputSchema.safeParse({ ...body, fundingSource }).success).toBe(true);
    }
    expect(ReceiveMedicationShipmentInputSchema.safeParse({ ...body, fundingSource: 'grant' }).success).toBe(false);
    expect(ReceiveMedicationShipmentInputSchema.safeParse({ ...body, fundingSource: undefined }).success).toBe(true);
  });

  it('creates the lot with its funding source, counted in doses, and writes a received entry', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(vaccine);

    const result = written(await receivePerformEffect(oystehr, receiveBody, performer));

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'POST']);
    expect(result.lot).toMatchObject({
      catalogMedicationId: 'mmr',
      locationId: 'loc-a',
      lotNumber: 'Y0112',
      expirationDate: '2027-07-11',
      ndc: '00006-4681-00',
      manufacturer: 'Merck',
      fundingSource: 'vfc',
      onHand: 10,
      unit: 'dose',
      status: 'active',
    });
    expect(result.entry).toMatchObject({ type: 'received', quantity: 10, unit: 'dose', performerReference: performer });
  });

  it('refuses a vaccine lot without a funding source before reading or writing any stock', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(vaccine);

    await expect(
      receivePerformEffect(oystehr, { ...receiveBody, fundingSource: undefined }, performer)
    ).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT, message: expect.stringContaining('funding source') });
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('gives a medication lot no funding source, even when the request carries one', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(medication);

    const result = written(
      await receivePerformEffect(oystehr, { ...receiveBody, medicationId: 'ondansetron' }, performer)
    );

    expect(result.lot).not.toHaveProperty('fundingSource');
    expect(result.lot).toMatchObject({ catalogMedicationId: 'ondansetron', unit: 'vial', onHand: 10 });
    expect(JSON.stringify(oystehr.fhir.transaction.mock.calls[0][0].requests[0].resource)).not.toContain(
      'funding-source'
    );
  });

  it('receives a medication without a funding source, as before', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(medication);

    const result = written(
      await receivePerformEffect(
        oystehr,
        { ...receiveBody, medicationId: 'ondansetron', fundingSource: undefined },
        performer
      )
    );

    expect(result.lot).toMatchObject({ onHand: 10, unit: 'vial' });
  });

  it('does not receive stock for a retired config vaccine', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(retiredConfigVaccine);

    await expect(receivePerformEffect(oystehr, receiveBody, performer)).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('says a vaccine, not a medication, is not set up when its inventory was switched off', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue({ ...vaccine, extension: undefined });

    await expect(receivePerformEffect(oystehr, receiveBody, performer)).rejects.toMatchObject({
      message: 'This vaccine is not set up for inventory. Save its inventory setup first.',
    });
  });

  describe('into a lot that already exists', () => {
    it('adds to the lot when the funding source is the same', async () => {
      const oystehr = makeMockOystehr({ lots: [vaccineLot('lot-1', 8)], ledger: [received('lot-1', 8)] });
      oystehr.fhir.get.mockResolvedValue(vaccine);

      const result = written(await receivePerformEffect(oystehr, receiveBody, performer));

      const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
      expect(requests.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
      expect(result.lot).toMatchObject({ id: 'lot-1', fundingSource: 'vfc', onHand: 18 });
    });

    it('refuses another funding source while the lot has doses on hand, and writes nothing', async () => {
      const oystehr = makeMockOystehr({ lots: [vaccineLot('lot-1', 8)], ledger: [received('lot-1', 8)] });
      oystehr.fhir.get.mockResolvedValue(vaccine);

      await expect(
        receivePerformEffect(oystehr, { ...receiveBody, fundingSource: 'private' }, performer)
      ).rejects.toMatchObject({
        code: APIErrorCode.INVALID_INPUT,
        message:
          'Lot Y0112 at this location is VFC stock with 8 on hand, so it cannot be received as Private. Receive it as VFC, or adjust the lot to zero first to change its funding source.',
      });
      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
    });

    it('an empty lot takes the funding source of the shipment received into it', async () => {
      const oystehr = makeMockOystehr({ lots: [vaccineLot('lot-1', 0)], ledger: [] });
      oystehr.fhir.get.mockResolvedValue(vaccine);

      const result = written(
        await receivePerformEffect(oystehr, { ...receiveBody, fundingSource: 'private' }, performer)
      );

      expect(result.lot).toMatchObject({ id: 'lot-1', fundingSource: 'private', onHand: 10 });
    });

    it('correcting the expiration of a lot does not change the funding source of its doses either', async () => {
      const oystehr = makeMockOystehr({ lots: [vaccineLot('lot-1', 8)], ledger: [received('lot-1', 8)] });
      oystehr.fhir.get.mockResolvedValue(vaccine);
      const body = {
        ...receiveBody,
        expirationDate: '2028-01-01',
        expirationConflict: 'correct-existing' as const,
        lotId: 'lot-1',
      };

      await expect(receivePerformEffect(oystehr, { ...body, fundingSource: 'state' }, performer)).rejects.toMatchObject(
        {
          code: APIErrorCode.INVALID_INPUT,
          message: expect.stringContaining('is VFC stock'),
        }
      );
      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();

      const result = written(await receivePerformEffect(oystehr, body, performer));
      expect(result.lot).toMatchObject({ id: 'lot-1', expirationDate: '2028-01-01', fundingSource: 'vfc', onHand: 18 });
    });

    it('a second lot of the same number under another date can be another stock', async () => {
      const oystehr = makeMockOystehr({ lots: [vaccineLot('lot-1', 8)], ledger: [received('lot-1', 8)] });
      oystehr.fhir.get.mockResolvedValue(vaccine);

      const result = written(
        await receivePerformEffect(
          oystehr,
          {
            ...receiveBody,
            expirationDate: '2028-01-01',
            expirationConflict: 'separate-lot',
            fundingSource: 'private',
          },
          performer
        )
      );

      expect(oystehr.fhir.transaction.mock.calls[0][0].requests.map((r: any) => r.method)).toEqual(['POST', 'POST']);
      expect(result.lot).toMatchObject({ lotNumber: 'Y0112', expirationDate: '2028-01-01', fundingSource: 'private' });
    });
  });
});

describe('list-medication-inventory with vaccines', () => {
  const privateLot = vaccineLot('lot-2', 10, {
    lotNumber: 'Y0200',
    expirationDate: '2028-01-11',
    fundingSource: 'private',
  });
  const oystehrWithStock = (): MockOystehr =>
    makeMockOystehr({
      catalog: [medication, vaccine, retiredConfigVaccine],
      lots: [vaccineLot('lot-1', 8), privateLot, medicationLot],
    });

  it('lists vaccines beside medications, each marked with its type, and never a retired config vaccine', async () => {
    const oystehr = oystehrWithStock();

    const { drugs } = await listPerformEffect(oystehr, { view: 'location', locationId: 'loc-a', today });

    expect(drugs.map((drug) => [drug.name, drug.type, drug.countedAs, drug.onHand])).toEqual([
      ['MMR', 'vaccine', 'dose', 18],
      ['Ondansetron 4 MG/2ML', 'medication', 'vial', 6],
    ]);
    const catalogSearch = oystehr.fhir.search.mock.calls
      .map(([call]) => call)
      .find(
        (call) =>
          call.resourceType === 'Medication' &&
          !call.params.some((param: any) => String(param.value).startsWith(INVENTORY_LOT_IDENTIFIER_SYSTEM))
      );
    expect(catalogSearch.params).toEqual([
      { name: 'identifier', value: `${INVENTORY_MEDICATION_TYPE_CODE},${INVENTORY_VACCINE_TYPE_CODE}` },
    ]);
  });

  it('gives each vaccine lot its funding source at a location, and a medication lot none', async () => {
    const { drugs } = await listPerformEffect(oystehrWithStock(), { view: 'location', locationId: 'loc-a', today });

    expect(drugs[0].lots.map((lot) => [lot.lotNumber, lot.fundingSource, lot.onHand, lot.unit])).toEqual([
      ['Y0112', 'vfc', 8, 'dose'],
      ['Y0200', 'private', 10, 'dose'],
    ]);
    expect(drugs[1].lots).toHaveLength(1);
    expect(drugs[1].lots[0]).not.toHaveProperty('fundingSource');
  });

  it('shows a vaccine per location in the all-locations view, without lots', async () => {
    const { drugs } = await listPerformEffect(oystehrWithStock(), { view: 'all-locations', today });

    expect(drugs[0]).toMatchObject({ name: 'MMR', type: 'vaccine', onHand: 18, lots: [] });
    expect(drugs[0].locations).toEqual([
      { locationId: 'loc-a', locationName: 'Main Street', onHand: 18, earliestExpiration: '2027-07-11', markers: [] },
    ]);
  });

  it('leaves out a vaccine whose inventory was switched off', async () => {
    const oystehr = makeMockOystehr({ catalog: [{ ...vaccine, extension: undefined }, medication], lots: [] });

    const { drugs } = await listPerformEffect(oystehr, { view: 'location', locationId: 'loc-a', today });

    expect(drugs.map((drug) => drug.name)).toEqual(['Ondansetron 4 MG/2ML']);
  });
});

describe('adjust-medication-inventory on a vaccine lot', () => {
  it('counts the lot in doses and leaves its funding source as it was', async () => {
    const oystehr = makeMockOystehr({ ledger: [received('lot-1', 8)] });
    oystehr.fhir.get.mockResolvedValue(vaccineLot('lot-1', 8));

    const result = await adjustPerformEffect(oystehr, { action: 'count', lotId: 'lot-1', counted: 7 }, performer);

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
    expect(parseInventoryLot(requests[1].resource)).toMatchObject({ fundingSource: 'vfc', onHand: 7, unit: 'dose' });
    expect(result.lot).toMatchObject({ id: 'lot-1', fundingSource: 'vfc', onHand: 7 });
    expect(result.entry).toMatchObject({ type: 'count', quantity: -1, unit: 'dose' });
  });

  it('adjusts the lot to zero and keeps the funding source on the empty lot', async () => {
    const oystehr = makeMockOystehr({ ledger: [received('lot-1', 8)] });
    oystehr.fhir.get.mockResolvedValue(vaccineLot('lot-1', 8));

    const result = await adjustPerformEffect(
      oystehr,
      { action: 'adjust', lotId: 'lot-1', direction: 'remove', quantity: 8, reason: 'expired' },
      performer
    );

    expect(result.lot).toMatchObject({ fundingSource: 'vfc', onHand: 0, status: 'inactive' });
  });
});
