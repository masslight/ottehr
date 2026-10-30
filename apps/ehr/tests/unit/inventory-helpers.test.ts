import { InventoryHistoryEntry, InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { describe, expect, it } from 'vitest';
import { describeReason } from '../../src/features/admin/inventory/inventory.helpers';

const lot: InventoryLot = {
  id: 'lot-1',
  catalogMedicationId: 'med-catalog',
  locationId: 'loc-a',
  lotNumber: 'A123',
  expirationDate: '2027-03-31',
  vendor: 'Henry Schein',
  unitCost: 2.5,
  onHand: 35,
  unit: 'vial',
  status: 'active',
};

const entry = (overrides: Partial<InventoryHistoryEntry>): InventoryHistoryEntry => ({
  id: 'entry-1',
  lotId: 'lot-1',
  locationId: 'loc-a',
  type: 'received',
  quantity: 25,
  unit: 'vial',
  effectiveDateTime: '2026-10-01T14:02:00Z',
  onHandAfter: 25,
  ...overrides,
});

describe('inventory history reason text', () => {
  it("shows each receipt's own vendor and cost, not the lot's latest", () => {
    expect(describeReason(entry({ vendor: 'McKesson', unitCost: 1.8 }), lot)).toBe('Received · McKesson · $1.80/vial');
    expect(describeReason(entry({ vendor: 'Henry Schein', unitCost: 2.5, quantity: 10 }), lot)).toBe(
      'Received · Henry Schein · $2.50/vial'
    );
  });

  it("falls back to the lot's vendor and cost for receipts written before they were recorded per entry", () => {
    expect(describeReason(entry({}), lot)).toBe('Received · Henry Schein · $2.50/vial');
  });

  it('labels an expiration correction with its note', () => {
    const correction = entry({
      type: 'adjustment',
      reason: 'expiration-corrected',
      quantity: 0,
      note: 'Expiration changed from 03/31/2027 to 01/01/2028',
    });
    expect(describeReason(correction, lot)).toBe(
      'Expiration corrected: Expiration changed from 03/31/2027 to 01/01/2028'
    );
  });
});
