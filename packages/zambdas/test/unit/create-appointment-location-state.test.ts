import Oystehr, { User } from '@oystehr/sdk';
import { HealthcareService, Location, Resource, Schedule, Slot } from 'fhir/r4b';
import {
  makeSlotAtLocationExtensionEntry,
  PatientInfo,
  PUBLIC_EXTENSION_BASE_URL,
  ServiceMode,
  SlotServiceCategory,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import {
  type CreateAppointmentBasicInput,
  createAppointmentComplexValidation,
} from '../../src/patient/appointment/create-appointment/validateRequestParameters';

// createAppointmentComplexValidation does FHIR I/O through the Oystehr client.
// Stub it with just the two searches the virtual-group path exercises:
//   - the Slot search (with _include Schedule + _include:iterate actor),
//   - the booking-Location search (by _id).
// Everything else (capacity guard, service-category catalog) is skipped by
// using a fully-elapsed Slot, which capacityGuardApplies() bypasses.
const makeOystehrMock = (input: { slotBundle: Resource[]; locations?: Location[] }): Oystehr => {
  const { slotBundle, locations = [] } = input;
  return {
    fhir: {
      search: vi.fn(async ({ resourceType }: { resourceType: string }) => {
        if (resourceType === 'Slot') return { unbundle: () => slotBundle };
        if (resourceType === 'Location') return { unbundle: () => locations };
        return { unbundle: () => [] };
      }),
    },
  } as unknown as Oystehr;
};

// Fully-elapsed slot → capacity guard is bypassed, so no checkSlotAvailable /
// resolveServiceCategory FHIR calls are made.
const PAST_START = '2020-01-01T10:00:00.000Z';
const PAST_END = '2020-01-01T10:15:00.000Z';

const makeVirtualSlot = (overrides: Partial<Slot> = {}): Slot => ({
  resourceType: 'Slot',
  id: 'slot-1',
  status: 'busy-tentative',
  start: PAST_START,
  end: PAST_END,
  schedule: { reference: 'Schedule/sched-1' },
  // Stamped virtual → getServiceModeFromSlot returns virtual.
  serviceCategory: [SlotServiceCategory.virtualServiceMode],
  // Points the booking at the (virtual) group member Location.
  extension: [makeSlotAtLocationExtensionEntry('virtual-loc-1')],
  ...overrides,
});

// Schedule actored by a HealthcareService group — a NON-Location owner.
const groupSchedule: Schedule = {
  resourceType: 'Schedule',
  id: 'sched-1',
  actor: [{ reference: 'HealthcareService/group-1' }],
};
const groupOwner: HealthcareService = { resourceType: 'HealthcareService', id: 'group-1', active: true };

const makeVirtualLocation = (state?: string): Location => ({
  resourceType: 'Location',
  id: 'virtual-loc-1',
  status: 'active',
  extension: [
    {
      url: `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`,
      valueCoding: { code: 'vi', display: 'Virtual' },
    },
  ],
  ...(state ? { address: { state } } : {}),
});

// In-person slot: stamped in-person → getServiceModeFromSlot returns in-person.
const makeInPersonSlot = (overrides: Partial<Slot> = {}): Slot => ({
  resourceType: 'Slot',
  id: 'slot-1',
  status: 'busy-tentative',
  start: PAST_START,
  end: PAST_END,
  schedule: { reference: 'Schedule/sched-1' },
  serviceCategory: [SlotServiceCategory.inPersonServiceMode],
  extension: [makeSlotAtLocationExtensionEntry('loc-1')],
  ...overrides,
});

// Legacy physical Location (no location-form coding) → in-person by default.
const makePhysicalLocation = (): Location => ({
  resourceType: 'Location',
  id: 'loc-1',
  status: 'active',
  address: { state: 'FL' },
});

const baseInput = (overrides: Partial<CreateAppointmentBasicInput> = {}): CreateAppointmentBasicInput =>
  ({
    slotId: 'slot-1',
    user: { id: 'u1' } as unknown as User,
    isEHRUser: false,
    // No patient.id → the patient-access check is skipped; the rest of the
    // patient payload is irrelevant to complex validation.
    patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-01-01' } as unknown as PatientInfo,
    secrets: null,
    ...overrides,
  }) as CreateAppointmentBasicInput;

describe('createAppointmentComplexValidation — virtual locationState derivation', () => {
  it('derives locationState from the virtual member Location for a group (non-Location owner) booking', async () => {
    const oystehr = makeOystehrMock({
      slotBundle: [makeVirtualSlot(), groupSchedule, groupOwner],
      locations: [makeVirtualLocation('FL')],
    });

    const result = await createAppointmentComplexValidation(baseInput(), oystehr);

    expect(result.serviceMode).toBe(ServiceMode.virtual);
    expect(result.locationState).toBe('FL');
    expect(result.bookingLocation?.id).toBe('virtual-loc-1');
  });

  it('does not throw INVALID_INPUT for a virtual group booking without an explicit locationState', async () => {
    const oystehr = makeOystehrMock({
      slotBundle: [makeVirtualSlot(), groupSchedule, groupOwner],
      locations: [makeVirtualLocation('FL')],
    });

    await expect(createAppointmentComplexValidation(baseInput(), oystehr)).resolves.toBeDefined();
  });

  it('honors an explicitly supplied locationState (caller value wins over derivation)', async () => {
    const oystehr = makeOystehrMock({
      slotBundle: [makeVirtualSlot(), groupSchedule, groupOwner],
      locations: [makeVirtualLocation('FL')],
    });

    const result = await createAppointmentComplexValidation(baseInput({ locationState: 'CA' }), oystehr);

    expect(result.locationState).toBe('CA');
  });

  it('still throws when the virtual member Location has no usable state and none is supplied', async () => {
    const oystehr = makeOystehrMock({
      slotBundle: [makeVirtualSlot(), groupSchedule, groupOwner],
      // Virtual Location but no address.state → nothing to derive.
      locations: [makeVirtualLocation(undefined)],
    });

    await expect(createAppointmentComplexValidation(baseInput(), oystehr)).rejects.toThrow(/locationState/);
  });
});

// The backstop: reject a slot whose resolved booking Location can't fulfill the
// slot's service mode, in BOTH directions. Before this guard, the virtual
// mismatch fell into a confusing "locationState is required" error and — worse
// — the in-person mismatch (in-person slot on a virtual-only Location) booked a
// broken visit with no error at all.
describe('createAppointmentComplexValidation — service-mode vs booking-Location backstop', () => {
  it('rejects a virtual booking whose resolved Location is not virtual', async () => {
    // Physical Location (no vi coding) resolved for a virtual slot → rejected
    // up front, a clearer failure than the old locationState path.
    const nonVirtualLoc: Location = {
      resourceType: 'Location',
      id: 'virtual-loc-1',
      status: 'active',
      address: { state: 'FL' },
    };
    const oystehr = makeOystehrMock({
      slotBundle: [makeVirtualSlot(), groupSchedule, groupOwner],
      locations: [nonVirtualLoc],
    });

    await expect(createAppointmentComplexValidation(baseInput(), oystehr)).rejects.toThrow(/not available for virtual/);
  });

  it('rejects an in-person booking whose resolved Location is virtual-only', async () => {
    // Regression guard for the hole this PR closes: an in-person slot resolving
    // to a virtual-only Location used to book successfully.
    const oystehr = makeOystehrMock({
      slotBundle: [makeInPersonSlot(), groupSchedule, groupOwner],
      locations: [makeVirtualLocation('FL')],
    });

    await expect(createAppointmentComplexValidation(baseInput(), oystehr)).rejects.toThrow(
      /not available for in-person/
    );
  });

  it('resolves an in-person booking whose resolved Location supports in-person', async () => {
    const oystehr = makeOystehrMock({
      slotBundle: [makeInPersonSlot(), groupSchedule, groupOwner],
      locations: [makePhysicalLocation()],
    });

    const result = await createAppointmentComplexValidation(baseInput(), oystehr);

    expect(result.serviceMode).toBe(ServiceMode['in-person']);
    expect(result.bookingLocation?.id).toBe('loc-1');
  });
});
