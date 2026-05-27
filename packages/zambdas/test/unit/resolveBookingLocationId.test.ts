import { HealthcareService, Location, Practitioner, PractitionerRole, Slot } from 'fhir/r4b';
import { makeSlotAtLocationExtensionEntry } from 'utils';
import { describe, expect, it } from 'vitest';
import { resolveBookingLocationId } from '../../src/patient/appointment/create-appointment/resolveBookingLocationId';

const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
  resourceType: 'Slot',
  status: 'free',
  start: '2026-06-01T10:00:00.000Z',
  end: '2026-06-01T10:15:00.000Z',
  schedule: { reference: 'Schedule/sched-1' },
  ...overrides,
});

const makeLocation = (id: string): Location => ({ resourceType: 'Location', id, status: 'active' });
const makePR = (id: string, locationIds: string[], practitionerId?: string): PractitionerRole => ({
  resourceType: 'PractitionerRole',
  id,
  active: true,
  location: locationIds.map((lid) => ({ reference: `Location/${lid}` })),
  ...(practitionerId && { practitioner: { reference: `Practitioner/${practitionerId}` } }),
});
const makeHS = (id: string): HealthcareService => ({ resourceType: 'HealthcareService', id, active: true });
const makePractitioner = (id: string): Practitioner => ({ resourceType: 'Practitioner', id });

describe('resolveBookingLocationId — Location-actor precedence', () => {
  it('returns the owner Location id when scheduleOwner is a Location', () => {
    const scheduleOwner = makeLocation('loc-direct');
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBe('loc-direct');
  });

  it('returns the owner Location id even if the slot also carries an extension (actor wins)', () => {
    const scheduleOwner = makeLocation('loc-actor');
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-extension')] });
    expect(resolveBookingLocationId({ scheduleOwner, slot })).toBe('loc-actor');
  });
});

describe('resolveBookingLocationId — single-location PR-actor precedence', () => {
  it('returns the only PR.location[] id for a single-location PR', () => {
    const scheduleOwner = makePR('pr-1', ['loc-a']);
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBe('loc-a');
  });

  it('returns the only PR.location[] id even if the slot also carries an extension (actor wins)', () => {
    const scheduleOwner = makePR('pr-1', ['loc-from-actor']);
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-from-extension')] });
    expect(resolveBookingLocationId({ scheduleOwner, slot })).toBe('loc-from-actor');
  });
});

describe('resolveBookingLocationId — multi-location PR-actor falls through to extension', () => {
  it('returns the extension id when PR has multiple locations and an extension is present', () => {
    const scheduleOwner = makePR('pr-1', ['loc-a', 'loc-b']);
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-a')] });
    expect(resolveBookingLocationId({ scheduleOwner, slot })).toBe('loc-a');
  });

  it('returns undefined when PR has multiple locations and no extension', () => {
    const scheduleOwner = makePR('pr-1', ['loc-a', 'loc-b']);
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBeUndefined();
  });

  it('returns undefined when PR has zero locations and no extension', () => {
    const scheduleOwner = makePR('pr-1', []);
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBeUndefined();
  });

  it('returns the extension id when PR has zero locations and an extension is present', () => {
    const scheduleOwner = makePR('pr-1', []);
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-from-extension')] });
    expect(resolveBookingLocationId({ scheduleOwner, slot })).toBe('loc-from-extension');
  });
});

describe('resolveBookingLocationId — HealthcareService-actor uses extension', () => {
  it('returns the extension id when scheduleOwner is a HealthcareService and the slot carries the extension', () => {
    const scheduleOwner = makeHS('group-1');
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-from-extension')] });
    expect(resolveBookingLocationId({ scheduleOwner, slot })).toBe('loc-from-extension');
  });

  it('returns undefined when scheduleOwner is a HealthcareService and the slot has no extension', () => {
    const scheduleOwner = makeHS('group-1');
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBeUndefined();
  });
});

describe('resolveBookingLocationId — Practitioner-actor uses extension', () => {
  it('returns the extension id when scheduleOwner is a Practitioner and the slot carries the extension', () => {
    const scheduleOwner = makePractitioner('prac-1');
    const slot = makeSlot({ extension: [makeSlotAtLocationExtensionEntry('loc-from-extension')] });
    expect(resolveBookingLocationId({ scheduleOwner, slot })).toBe('loc-from-extension');
  });

  it('returns undefined when scheduleOwner is a Practitioner and the slot has no extension', () => {
    const scheduleOwner = makePractitioner('prac-1');
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBeUndefined();
  });
});

describe('resolveBookingLocationId — PR-actor ignores location refs that lack an id', () => {
  it('skips a location entry whose reference has no id segment', () => {
    // PR.location[] entry without a parseable id is ignored when counting "qualifying" locations.
    // Two entries — one valid, one malformed — collapses to one valid → still unambiguous.
    const scheduleOwner: PractitionerRole = {
      resourceType: 'PractitionerRole',
      id: 'pr-1',
      active: true,
      location: [{ reference: 'Location/loc-a' }, { display: 'placeholder with no reference' }],
    };
    expect(resolveBookingLocationId({ scheduleOwner, slot: makeSlot() })).toBe('loc-a');
  });
});
