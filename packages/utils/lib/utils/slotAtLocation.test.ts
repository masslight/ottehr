import { Slot } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  makeSlotAtLocationExtensionEntry,
  makeSlotBookedViaGroupExtensionEntry,
  SLOT_AT_LOCATION_EXTENSION_URL,
  SLOT_BOOKED_VIA_GROUP_EXTENSION_URL,
} from '../fhir/constants';
import { getSlotAtLocationId, getSlotBookedViaGroupId } from './scheduleUtils';

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

describe('makeSlotBookedViaGroupExtensionEntry', () => {
  it('produces an extension with the slot-booked-via-group url and a HealthcareService valueReference', () => {
    const entry = makeSlotBookedViaGroupExtensionEntry('grp-xyz');
    expect(entry).toEqual({
      url: SLOT_BOOKED_VIA_GROUP_EXTENSION_URL,
      valueReference: { reference: 'HealthcareService/grp-xyz' },
    });
  });
});

describe('getSlotBookedViaGroupId', () => {
  it('round-trips an id through the writer + reader', () => {
    const slot = makeSlot({ extension: [makeSlotBookedViaGroupExtensionEntry('grp-xyz')] });
    expect(getSlotBookedViaGroupId(slot)).toBe('grp-xyz');
  });

  it('returns undefined when the slot has no extensions at all', () => {
    expect(getSlotBookedViaGroupId(makeSlot())).toBeUndefined();
  });

  it('returns undefined when the slot has extensions but none matches the booked-via-group url', () => {
    const slot = makeSlot({
      extension: [{ url: 'http://example.com/other', valueString: 'whatever' }],
    });
    expect(getSlotBookedViaGroupId(slot)).toBeUndefined();
  });

  it('returns undefined when the reference is not a HealthcareService', () => {
    const slot = makeSlot({
      extension: [
        {
          url: SLOT_BOOKED_VIA_GROUP_EXTENSION_URL,
          valueReference: { reference: 'Location/wrong-type' },
        },
      ],
    });
    expect(getSlotBookedViaGroupId(slot)).toBeUndefined();
  });

  it('returns undefined when valueReference is missing the reference field', () => {
    const slot = makeSlot({
      extension: [{ url: SLOT_BOOKED_VIA_GROUP_EXTENSION_URL, valueReference: {} }],
    });
    expect(getSlotBookedViaGroupId(slot)).toBeUndefined();
  });

  it('coexists with slot-at-location on the same Slot — each reader picks its own extension', () => {
    const slot = makeSlot({
      extension: [makeSlotAtLocationExtensionEntry('loc-abc'), makeSlotBookedViaGroupExtensionEntry('grp-xyz')],
    });
    expect(getSlotAtLocationId(slot)).toBe('loc-abc');
    expect(getSlotBookedViaGroupId(slot)).toBe('grp-xyz');
  });
});
