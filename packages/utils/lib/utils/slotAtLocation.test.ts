import { Slot } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { makeSlotAtLocationExtensionEntry, SLOT_AT_LOCATION_EXTENSION_URL } from '../fhir/constants';
import { getSlotAtLocationId } from './scheduleUtils';

const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
  resourceType: 'Slot',
  status: 'free',
  start: '2026-06-01T10:00:00.000Z',
  end: '2026-06-01T10:15:00.000Z',
  schedule: { reference: 'Schedule/sched-1' },
  ...overrides,
});

describe('makeSlotAtLocationExtensionEntry', () => {
  it('produces an extension with the slot-at-location url and a Location valueReference', () => {
    const entry = makeSlotAtLocationExtensionEntry('loc-abc');
    expect(entry).toEqual({
      url: SLOT_AT_LOCATION_EXTENSION_URL,
      valueReference: { reference: 'Location/loc-abc' },
    });
  });
});

describe('getSlotAtLocationId', () => {
  it('round-trips an id through the writer + reader', () => {
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-abc')] });
    expect(getSlotAtLocationId(slot)).toBe('loc-abc');
  });

  it('returns undefined when the slot has no extensions at all', () => {
    expect(getSlotAtLocationId(makeSlot())).toBeUndefined();
  });

  it('returns undefined when the slot has extensions but none matches the at-location url', () => {
    const slot = makeSlot({
      extension: [{ url: 'http://example.com/other', valueString: 'whatever' }],
    });
    expect(getSlotAtLocationId(slot)).toBeUndefined();
  });

  it('returns undefined when the extension exists but the reference is not a Location', () => {
    const slot = makeSlot({
      extension: [
        {
          url: SLOT_AT_LOCATION_EXTENSION_URL,
          valueReference: { reference: 'Practitioner/wrong-type' },
        },
      ],
    });
    expect(getSlotAtLocationId(slot)).toBeUndefined();
  });

  it('returns undefined when the extension exists but valueReference is missing the reference field', () => {
    const slot = makeSlot({
      extension: [{ url: SLOT_AT_LOCATION_EXTENSION_URL, valueReference: {} }],
    });
    expect(getSlotAtLocationId(slot)).toBeUndefined();
  });
});
