import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_LOCATION_TAG_SYSTEM,
  makeInventoryLot,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { describe, expect, it, vi } from 'vitest';
import { getInventoryLotsOnHand } from '../../src/shared/medication-inventory';

const catalog: Medication & { id: string } = { resourceType: 'Medication', id: 'med-catalog' };

const lot = (id: string, expirationDate: string, onHand: number): Medication => ({
  ...withLotOnHand(
    makeInventoryLot(catalog, {
      locationId: 'loc-a',
      lotNumber: id,
      expirationDate,
      ndc: '72572-0160-25',
      unit: 'vial',
    }),
    onHand
  ),
  id,
});

const SERVER_PAGE_SIZE = 2;

const makePagingOystehr = (lots: Medication[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
    const numberParam = (name: string): number | undefined => {
      const value = params.find((param) => param.name === name)?.value;
      return value === undefined ? undefined : Number(value);
    };
    const offset = numberParam('_offset') ?? 0;
    const count = Math.min(numberParam('_count') ?? SERVER_PAGE_SIZE, SERVER_PAGE_SIZE);
    const page = lots.slice(offset, offset + count);
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: lots.length,
      entry: page.map((resource) => ({ resource, search: { mode: 'match' } })),
      unbundle: () => page,
    };
  });
  return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
};

describe('getInventoryLotsOnHand', () => {
  it('reads every result page, drops empty and negative lots, and sorts by expiration date', async () => {
    const { oystehr, search } = makePagingOystehr([
      lot('lot-b', '2027-06-30', 5),
      lot('lot-empty', '2027-02-28', 0),
      lot('lot-negative', '2027-01-15', -3),
      lot('lot-c', '2027-09-30', 2),
      lot('lot-a', '2027-01-31', 1),
    ]);

    const lots = await getInventoryLotsOnHand(oystehr, { catalogMedicationId: 'med-catalog', locationId: 'loc-a' });

    expect(lots.map(({ id, expirationDate, onHand }) => ({ id, expirationDate, onHand }))).toEqual([
      { id: 'lot-a', expirationDate: '2027-01-31', onHand: 1 },
      { id: 'lot-b', expirationDate: '2027-06-30', onHand: 5 },
      { id: 'lot-c', expirationDate: '2027-09-30', onHand: 2 },
    ]);
    for (const [{ params }] of search.mock.calls) {
      expect(params).toEqual(
        expect.arrayContaining([
          { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|med-catalog` },
          { name: '_tag', value: `${INVENTORY_LOT_LOCATION_TAG_SYSTEM}|loc-a` },
          { name: 'status', value: 'active' },
          { name: '_sort', value: 'expiration-date' },
        ])
      );
    }
  });
});
