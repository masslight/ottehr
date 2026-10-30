import Oystehr from '@oystehr/sdk';
import { Medication, Observation } from 'fhir/r4b';
import {
  INVENTORY_ENTRY_REASON_SYSTEM,
  INVENTORY_ENTRY_TYPE_SYSTEM,
  INVENTORY_LOT_CLINIC_TAG_SYSTEM,
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_VALUE,
  INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM,
  INVENTORY_STOCK_ENTRY_CODE,
  makeInventoryLot,
  makeInventoryStockEntry,
  makeMedicationInventoryExtension,
  parseInventoryLot,
  parseInventoryStockEntry,
  sumStockEntries,
  withLotDetails,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  InHouseMedicationInventory,
  InventoryStockWriteResponse,
  ReceiveMedicationShipmentResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as receivePerformEffect } from '../../src/ehr/configuration/in-house-medications/receive-medication-shipment/index';
import { validateRequestParameters } from '../../src/ehr/configuration/in-house-medications/receive-medication-shipment/validateRequestParameters';
import { writeInventoryStockEntry } from '../../src/shared/medication-inventory';
import { ZambdaInput } from '../../src/shared/types/common';

const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg', in: { amount: 2, unit: 'ml' } },
  use: 'single-use',
  reorderLevels: [],
};

const catalog: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'med-catalog',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ondansetron HCl Injection Solution 4 MG/2ML' },
  ],
  status: 'active',
  code: {
    coding: [
      { system: CODE_SYSTEM_NDC, code: '0409-1234-01' },
      { system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345' },
    ],
  },
  extension: [makeMedicationInventoryExtension(inventory)],
};

const untrackedCatalog: Medication = { ...catalog, extension: undefined };

const lotInput = {
  locationId: 'loc-a',
  lotNumber: 'A123',
  expirationDate: '2027-03-31',
  ndc: '72572-0160-25',
  manufacturer: 'Civica',
  vendor: 'McKesson',
  unit: 'vial',
};

const entry = (value: number, id = `entry-${value}`): Observation => ({
  ...makeInventoryStockEntry({
    lotReference: 'Medication/lot-1',
    locationId: 'loc-a',
    type: 'adjustment',
    reason: 'broken-container',
    quantity: value,
    unit: 'vial',
    effectiveDateTime: '2026-10-30T14:02:00Z',
  }),
  id,
});

// ─── lot builder / parser ─────────────────────────────────────────────────────

describe('inventory lot', () => {
  it('builds a lot that names the drug, the clinic and the box NDC, and never looks like a catalog drug', () => {
    const lot = makeInventoryLot(catalog, lotInput);
    expect(lot.identifier).toEqual([
      { system: INVENTORY_LOT_IDENTIFIER_SYSTEM, value: INVENTORY_LOT_IDENTIFIER_VALUE },
      { system: INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM, value: 'med-catalog' },
    ]);
    expect(lot.identifier?.some((identifier) => identifier.value === INVENTORY_MEDICATION_TYPE_CODE)).toBe(false);
    expect(lot.meta?.tag).toEqual([{ system: INVENTORY_LOT_CLINIC_TAG_SYSTEM, code: 'loc-a' }]);
    expect(lot.code?.coding).toEqual([
      { system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345' },
      { system: CODE_SYSTEM_NDC, code: '72572-0160-25' },
    ]);
    expect(lot.code?.text).toBe('Ondansetron HCl Injection Solution 4 MG/2ML');
    expect(lot.batch).toEqual({ lotNumber: 'A123', expirationDate: '2027-03-31' });
    expect(lot.manufacturer).toEqual({ display: 'Civica' });
    expect(lot.status).toBe('inactive');
  });

  it('round-trips through parseInventoryLot and caches on hand with a derived status', () => {
    const lot = { ...withLotOnHand(makeInventoryLot(catalog, lotInput), 23), id: 'lot-1' };
    expect(lot.status).toBe('active');
    expect(parseInventoryLot(lot)).toEqual({
      id: 'lot-1',
      catalogMedicationId: 'med-catalog',
      locationId: 'loc-a',
      lotNumber: 'A123',
      expirationDate: '2027-03-31',
      ndc: '72572-0160-25',
      manufacturer: 'Civica',
      vendor: 'McKesson',
      onHand: 23,
      unit: 'vial',
      status: 'active',
    });
    expect(withLotOnHand(lot, 0).status).toBe('inactive');
    expect(parseInventoryLot(withLotOnHand(lot, -2))?.onHand).toBe(-2);
  });

  it('keeps other extensions and lets vendor be replaced without touching on hand', () => {
    const other = { url: 'https://example.com/other', valueString: 'keep' };
    const lot = { ...withLotOnHand(makeInventoryLot(catalog, lotInput), 5), id: 'lot-1' };
    const updated = withLotDetails(
      { ...lot, extension: [other, ...(lot.extension ?? [])] },
      { vendor: 'Henry Schein' }
    );
    expect(updated.extension?.[0]).toEqual(other);
    expect(parseInventoryLot(updated)).toMatchObject({ vendor: 'Henry Schein', onHand: 5 });
  });

  it('does not parse a catalog drug as a lot', () => {
    expect(parseInventoryLot(catalog)).toBeUndefined();
  });
});

// ─── entry builder / parser / balance ─────────────────────────────────────────

describe('inventory stock entry', () => {
  it('builds an Observation with the inventory category and tag, no encounter and no patient', () => {
    const observation = makeInventoryStockEntry({
      lotReference: 'Medication/lot-1',
      locationId: 'loc-a',
      type: 'administered',
      reason: 'partial-dose-waste',
      quantity: -2,
      unit: 'vial',
      performerReference: 'Practitioner/nurse-1',
      effectiveDateTime: '2026-10-30T15:10:00Z',
      medicationAdministrationId: 'ma-789',
      components: [{ code: 'waste-amount', value: 2, unit: 'mg' }],
    });
    expect(observation.category?.[0]?.coding?.[0]).toEqual({
      system: INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM,
      code: INVENTORY_STOCK_ENTRY_CODE,
    });
    expect(observation.code?.coding).toEqual([
      { system: INVENTORY_ENTRY_TYPE_SYSTEM, code: 'administered' },
      { system: INVENTORY_ENTRY_REASON_SYSTEM, code: 'partial-dose-waste' },
    ]);
    expect(observation.subject).toEqual({ reference: 'Medication/lot-1' });
    expect(observation.focus).toEqual([{ reference: 'Location/loc-a' }]);
    expect(observation.partOf).toEqual([{ reference: 'MedicationAdministration/ma-789' }]);
    expect(observation.valueQuantity).toEqual({ value: -2, unit: 'vial' });
    expect(observation.encounter).toBeUndefined();
    expect(observation.component?.[0]?.valueQuantity).toEqual({ value: 2, unit: 'mg' });
  });

  it('round-trips through parseInventoryStockEntry', () => {
    const observation = {
      ...makeInventoryStockEntry({
        lotReference: 'Medication/lot-1',
        locationId: 'loc-a',
        type: 'administration-reversed',
        quantity: 2,
        unit: 'vial',
        performerReference: 'Practitioner/nurse-1',
        effectiveDateTime: '2026-10-30T15:40:00Z',
        medicationAdministrationId: 'ma-789',
        reversesEntryId: 'entry-1',
        note: 'deleted by nurse',
      }),
      id: 'entry-2',
    };
    expect(parseInventoryStockEntry(observation)).toEqual({
      id: 'entry-2',
      lotId: 'lot-1',
      locationId: 'loc-a',
      type: 'administration-reversed',
      quantity: 2,
      unit: 'vial',
      performerReference: 'Practitioner/nurse-1',
      effectiveDateTime: '2026-10-30T15:40:00Z',
      medicationAdministrationId: 'ma-789',
      reversesEntryId: 'entry-1',
      note: 'deleted by nurse',
    });
  });

  it("keeps a receipt's own vendor on the entry", () => {
    const observation = {
      ...makeInventoryStockEntry({
        lotReference: 'Medication/lot-1',
        locationId: 'loc-a',
        type: 'received',
        quantity: 25,
        unit: 'vial',
        effectiveDateTime: '2026-10-30T14:02:00Z',
        vendor: 'McKesson',
      }),
      id: 'entry-3',
    };
    expect(observation.extension?.[0]?.extension).toEqual([{ url: 'vendor', valueString: 'McKesson' }]);
    expect(parseInventoryStockEntry(observation)).toMatchObject({ vendor: 'McKesson' });
  });

  it('ignores a chart Observation', () => {
    const vital: Observation = {
      resourceType: 'Observation',
      id: 'vital-1',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '8310-5' }] },
      subject: { reference: 'Patient/p1' },
      valueQuantity: { value: 37, unit: 'C' },
      effectiveDateTime: '2026-10-30T15:40:00Z',
    };
    expect(parseInventoryStockEntry(vital)).toBeUndefined();
  });

  it('sums signed values for on hand', () => {
    expect(sumStockEntries([entry(25), entry(-2), entry(2), entry(-3)])).toBe(22);
    expect(sumStockEntries([])).toBe(0);
  });
});

// ─── transaction writer ───────────────────────────────────────────────────────

type MockOystehr = Oystehr & {
  fhir: { get: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
};

const makeMockOystehr = ({ ledger = [] as Observation[], lots = [] as Medication[] } = {}): MockOystehr => {
  const transaction = vi.fn().mockImplementation(({ requests }: { requests: { resource: any; method: string }[] }) => ({
    resourceType: 'Bundle',
    entry: requests.map((request, index) => ({
      resource: { ...request.resource, id: request.resource.id ?? `created-${index}` },
    })),
  }));
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Medication' ? lots : ledger),
  }));
  return {
    fhir: { get: vi.fn(), search, transaction },
  } as unknown as MockOystehr;
};

vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({
  getAllFhirSearchPages: vi.fn(async (params: any, oystehr: any) => oystehr.fhir.search(params).unbundle()),
}));

const existingLot: Medication = {
  ...withLotOnHand(makeInventoryLot(catalog, lotInput), 25),
  id: 'lot-1',
  meta: { versionId: '3' },
};

describe('writeInventoryStockEntry', () => {
  const received = {
    locationId: 'loc-a',
    type: 'received' as const,
    quantity: 25,
    unit: 'vial',
    performerReference: 'Practitioner/nurse-1',
    effectiveDateTime: '2026-10-30T14:02:00Z',
  };

  it('creates a new lot and its first entry in one bundle, with the entry pointing at the lot urn', async () => {
    const oystehr = makeMockOystehr();
    const result = await writeInventoryStockEntry(oystehr, makeInventoryLot(catalog, lotInput), received);

    expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(1);
    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'POST']);
    expect(requests[0].fullUrl).toMatch(/^urn:uuid:/);
    expect(requests[0].resource.id).toBeUndefined();
    expect(requests[0].resource.status).toBe('active');
    expect(requests[1].resource.subject.reference).toBe(requests[0].fullUrl);
    expect(parseInventoryLot(result.lot)?.onHand).toBe(25);
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });

  it('recomputes on hand from the ledger and guards the lot with If-Match', async () => {
    const oystehr = makeMockOystehr({ ledger: [entry(25), entry(-4)] });
    const result = await writeInventoryStockEntry(oystehr, existingLot, { ...received, quantity: 10 });

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
    expect(requests[0].resource.subject).toEqual({ reference: 'Medication/lot-1' });
    expect(requests[1].url).toBe('/Medication/lot-1');
    expect(requests[1].ifMatch).toBe('W/"3"');
    expect(parseInventoryLot(requests[1].resource)?.onHand).toBe(31); // 25 - 4 + 10, not cache 25 + 10
    expect(parseInventoryLot(result.lot)?.onHand).toBe(31);
  });

  it('re-reads the lot and retries on a version conflict, giving up after 3 attempts', async () => {
    const conflict = Object.assign(new Error('412 Precondition Failed'), { code: 412 });
    const oystehr = makeMockOystehr({ ledger: [entry(25)] });
    oystehr.fhir.get.mockResolvedValue({ ...existingLot, meta: { versionId: '4' } });
    oystehr.fhir.transaction.mockRejectedValueOnce(conflict).mockImplementationOnce(({ requests }: any) => ({
      entry: requests.map((request: any) => ({ resource: { ...request.resource, id: 'x' } })),
    }));

    await writeInventoryStockEntry(oystehr, existingLot, { ...received, quantity: -1 });
    expect(oystehr.fhir.get).toHaveBeenCalledTimes(1);
    expect(oystehr.fhir.transaction.mock.calls[1][0].requests[1].ifMatch).toBe('W/"4"');

    oystehr.fhir.transaction.mockReset().mockRejectedValue(conflict);
    await expect(writeInventoryStockEntry(oystehr, existingLot, received)).rejects.toBe(conflict);
    expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(3);
  });
});

// ─── receive-medication-shipment ──────────────────────────────────────────────

const createInput = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: {} as any,
});

const receiveBody = {
  medicationId: 'med-catalog',
  locationId: 'loc-a',
  lotNumber: 'A123',
  expirationDate: '2027-03-31',
  quantity: 25,
  ndc: '72572-0160-25',
  manufacturer: 'Civica',
  vendor: 'McKesson',
};

describe('receive-medication-shipment - validateRequestParameters', () => {
  it('accepts a full request and keeps the user token', () => {
    const result = validateRequestParameters(createInput(receiveBody));
    expect(result).toMatchObject({ ...receiveBody, userToken: 'test-token' });
  });

  it('accepts a choice for a lot number already on hand with another expiration date', () => {
    expect(
      validateRequestParameters(createInput({ ...receiveBody, expirationConflict: 'correct-existing' }))
        .expirationConflict
    ).toBe('correct-existing');
    expect(() => validateRequestParameters(createInput({ ...receiveBody, expirationConflict: 'overwrite' }))).toThrow();
  });

  it('accepts a request without the optional fields', () => {
    const { manufacturer: _m, vendor: _v, ...required } = receiveBody;
    expect(validateRequestParameters(createInput(required))).toMatchObject({ ...required, userToken: 'test-token' });
  });

  it.each([
    ['no auth header', { ...receiveBody }, { Authorization: '' }],
    ['missing lot number', { ...receiveBody, lotNumber: ' ' }],
    ['expiration not a date', { ...receiveBody, expirationDate: '03/31/2027' }],
    ['zero quantity', { ...receiveBody, quantity: 0 }],
    ['fractional quantity', { ...receiveBody, quantity: 1.5 }],
    ['missing ndc', { ...receiveBody, ndc: undefined }],
    ['missing clinic', { ...receiveBody, locationId: '' }],
  ])('rejects %s', (_label, body, headers?) => {
    expect(() => validateRequestParameters({ ...createInput(body), ...(headers ? { headers } : {}) })).toThrow();
  });
});

describe('receive-medication-shipment - performEffect', () => {
  const performer = 'Practitioner/nurse-1';
  /** The write result; fails the test if the zambda answered with an expiration conflict instead. */
  const written = (result: ReceiveMedicationShipmentResponse): InventoryStockWriteResponse => {
    if ('expirationConflict' in result) throw new Error('expected a write, got an expiration conflict');
    return result;
  };

  it('rejects a drug without inventory setup before writing anything', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(untrackedCatalog);
    await expect(receivePerformEffect(oystehr, receiveBody, performer)).rejects.toMatchObject({
      message: expect.stringContaining('not set up for inventory'),
    });
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('rejects a Medication that is not a catalog drug', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(existingLot);
    await expect(receivePerformEffect(oystehr, receiveBody, performer)).rejects.toMatchObject({
      code: expect.any(Number),
    });
  });

  it('creates the lot when drug × clinic × lot number is new and writes a received entry', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockResolvedValue(catalog);
    const result = written(await receivePerformEffect(oystehr, receiveBody, performer));

    const [{ params }] = oystehr.fhir.search.mock.calls[0];
    expect(params).toContainEqual({ name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|med-catalog` });
    expect(params).toContainEqual({ name: '_tag', value: `${INVENTORY_LOT_CLINIC_TAG_SYSTEM}|loc-a` });
    expect(params).toContainEqual({ name: 'lot-number', value: 'A123' });

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'POST']);
    expect(result.lot).toMatchObject({
      catalogMedicationId: 'med-catalog',
      locationId: 'loc-a',
      lotNumber: 'A123',
      expirationDate: '2027-03-31',
      ndc: '72572-0160-25',
      manufacturer: 'Civica',
      vendor: 'McKesson',
      onHand: 25,
      unit: 'vial',
      status: 'active',
    });
    expect(result.entry).toMatchObject({
      type: 'received',
      quantity: 25,
      unit: 'vial',
      locationId: 'loc-a',
      performerReference: performer,
    });
    expect(result.entry.effectiveDateTime).toBeTruthy();
  });

  it('adds to the existing lot, updating vendor when given', async () => {
    const oystehr = makeMockOystehr({ lots: [existingLot], ledger: [entry(25)] });
    oystehr.fhir.get.mockResolvedValue(catalog);
    const result = written(
      await receivePerformEffect(oystehr, { ...receiveBody, quantity: 10, vendor: 'Henry Schein' }, performer)
    );

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
    expect(requests[1].ifMatch).toBe('W/"3"');
    expect(result.lot).toMatchObject({ id: 'lot-1', vendor: 'Henry Schein', onHand: 35 });
  });

  it('keeps the existing lot vendor when the request has none', async () => {
    const oystehr = makeMockOystehr({ lots: [existingLot], ledger: [entry(25)] });
    oystehr.fhir.get.mockResolvedValue(catalog);
    const { vendor: _v, ...body } = receiveBody;
    const result = written(await receivePerformEffect(oystehr, { ...body, quantity: 5 }, performer));
    expect(result.lot).toMatchObject({ vendor: 'McKesson', onHand: 30 });
  });

  it('records each receipt with its own vendor while the lot keeps the latest', async () => {
    const oystehr = makeMockOystehr({ lots: [existingLot], ledger: [entry(25)] });
    oystehr.fhir.get.mockResolvedValue(catalog);
    const first = await receivePerformEffect(oystehr, receiveBody, performer);
    const second = await receivePerformEffect(
      oystehr,
      { ...receiveBody, quantity: 10, vendor: 'Henry Schein' },
      performer
    );

    expect(first).toMatchObject({ entry: { vendor: 'McKesson' }, lot: { vendor: 'McKesson' } });
    expect(second).toMatchObject({ entry: { vendor: 'Henry Schein' }, lot: { vendor: 'Henry Schein' } });
    // what was written is what the history reads back
    const writtenEntry = oystehr.fhir.transaction.mock.calls[1][0].requests[0].resource as Observation;
    expect(parseInventoryStockEntry({ ...writtenEntry, id: 'x' })).toMatchObject({ vendor: 'Henry Schein' });
  });

  it('does not stamp vendor on a receipt entered without one', async () => {
    const oystehr = makeMockOystehr({ lots: [existingLot], ledger: [entry(25)] });
    oystehr.fhir.get.mockResolvedValue(catalog);
    const { vendor: _v, ...body } = receiveBody;
    const { entry: receipt } = written(await receivePerformEffect(oystehr, body, performer));
    expect(receipt.vendor).toBeUndefined();
  });

  describe('same lot number with a different expiration date', () => {
    const newDate = { ...receiveBody, quantity: 10, expirationDate: '2028-01-01' };

    it('answers with the existing lot and writes nothing when no choice was made', async () => {
      const oystehr = makeMockOystehr({ lots: [existingLot] });
      oystehr.fhir.get.mockResolvedValue(catalog);
      const result = await receivePerformEffect(oystehr, newDate, performer);
      expect(result).toEqual({
        expirationConflict: { lotId: 'lot-1', expirationDate: '2027-03-31', onHand: 25, unit: 'vial' },
      });
      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
    });

    it('separate-lot creates a second lot with the same number and leaves the first alone', async () => {
      const oystehr = makeMockOystehr({ lots: [existingLot] });
      oystehr.fhir.get.mockResolvedValue(catalog);
      const result = await receivePerformEffect(oystehr, { ...newDate, expirationConflict: 'separate-lot' }, performer);

      expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(1);
      const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
      expect(requests.map((r: any) => r.method)).toEqual(['POST', 'POST']);
      expect(requests[0].resource.batch).toEqual({ lotNumber: 'A123', expirationDate: '2028-01-01' });
      expect(result).toMatchObject({ lot: { lotNumber: 'A123', expirationDate: '2028-01-01', onHand: 10 } });
      expect(result).not.toMatchObject({ lot: { id: 'lot-1' } });
    });

    it('correct-existing changes the expiration, records it as a zero entry, then receives into the lot', async () => {
      const oystehr = makeMockOystehr({ lots: [existingLot], ledger: [entry(25)] });
      oystehr.fhir.get.mockResolvedValue(catalog);
      const result = await receivePerformEffect(
        oystehr,
        { ...newDate, expirationConflict: 'correct-existing' },
        performer
      );

      expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(2);
      const correction = oystehr.fhir.transaction.mock.calls[0][0].requests;
      expect(correction.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
      expect(parseInventoryStockEntry({ ...correction[0].resource, id: 'x' })).toMatchObject({
        type: 'adjustment',
        reason: 'expiration-corrected',
        quantity: 0,
        note: 'Expiration changed from 03/31/2027 to 01/01/2028',
        performerReference: performer,
      });
      expect(correction[1].ifMatch).toBe('W/"3"');
      expect(correction[1].resource.batch).toEqual({ lotNumber: 'A123', expirationDate: '2028-01-01' });

      const receipt = oystehr.fhir.transaction.mock.calls[1][0].requests;
      expect(receipt.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
      expect(receipt[0].resource.subject).toEqual({ reference: 'Medication/lot-1' });
      expect(result).toMatchObject({
        lot: { id: 'lot-1', expirationDate: '2028-01-01', onHand: 35 },
        entry: { type: 'received', quantity: 10 },
      });
    });

    it('adds to the lot with the matching expiration when the clinic holds the number under two dates', async () => {
      const laterLot: Medication = {
        ...existingLot,
        id: 'lot-2',
        batch: { lotNumber: 'A123', expirationDate: '2028-01-01' },
      };
      const oystehr = makeMockOystehr({ lots: [existingLot, laterLot], ledger: [entry(25)] });
      oystehr.fhir.get.mockResolvedValue(catalog);
      const result = await receivePerformEffect(oystehr, newDate, performer);

      expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(1);
      expect(oystehr.fhir.transaction.mock.calls[0][0].requests[1].url).toBe('/Medication/lot-2');
      expect(result).toMatchObject({ lot: { id: 'lot-2', expirationDate: '2028-01-01' } });
    });
  });
});
