import { InventoryHistoryEntry } from 'utils/lib/types/api/config/in-house-medications';
import { describe, expect, it } from 'vitest';
import { describeReason } from '../../src/features/admin/inventory/inventory.helpers';

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
  it("shows each receipt's own vendor, not the lot's latest", () => {
    expect(describeReason(entry({ vendor: 'McKesson' }))).toBe('Received · McKesson');
    expect(describeReason(entry({ vendor: 'Henry Schein', quantity: 10 }))).toBe('Received · Henry Schein');
  });

  it('leaves an earlier receipt without a vendor unknown when a later receipt has one', () => {
    expect(describeReason(entry({}))).toBe('Received');
    expect(describeReason(entry({ id: 'entry-2', vendor: 'Henry Schein', quantity: 10 }))).toBe(
      'Received · Henry Schein'
    );
  });

  it('labels a reversal from an edited order "changed" and from a deleted order "deleted"', () => {
    // 2 mg → 4 mg on the same 4 mg vial: nothing more comes off, the 2 mg waste is taken back
    const edited = entry({
      type: 'administration-reversed',
      reason: 'partial-dose-waste',
      quantity: 0,
      components: [{ code: 'waste-amount', value: -2, unit: 'mg' }],
    });
    expect(describeReason(edited)).toBe('Administration changed');
    expect(describeReason({ ...edited, administrationDeleted: true })).toBe('Administration deleted');
  });

  it('labels an expiration correction with its note', () => {
    const correction = entry({
      type: 'adjustment',
      reason: 'expiration-corrected',
      quantity: 0,
      note: 'Expiration changed from 03/31/2027 to 01/01/2028',
    });
    expect(describeReason(correction)).toBe('Expiration corrected: Expiration changed from 03/31/2027 to 01/01/2028');
  });
});
