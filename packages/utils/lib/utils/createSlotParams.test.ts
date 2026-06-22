import { Slot } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { SlotServiceCategory } from '../fhir';
import { ServiceMode } from '../types';
import { createSlotParamsFromSlotAndOptions } from './scheduleUtils';

const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
  resourceType: 'Slot',
  status: 'free',
  start: '2099-06-01T10:00:00.000Z',
  end: '2099-06-01T10:15:00.000Z',
  schedule: { reference: 'Schedule/sched-1' },
  ...overrides,
});

// A Slot stamped in-person via its serviceCategory — getServiceModeFromSlot
// reads this and would return 'in-person'.
const inPersonSlot = makeSlot({ serviceCategory: [SlotServiceCategory.inPersonServiceMode] });
// A Slot stamped virtual.
const virtualSlot = makeSlot({ serviceCategory: [SlotServiceCategory.virtualServiceMode] });
// A Slot with no serviceCategory at all — no mode can be inferred from it.
const noModeSlot = makeSlot();

describe('createSlotParamsFromSlotAndOptions — serviceModality resolution', () => {
  it('prefers an explicit options.serviceModality over the mode inferred from the Slot', () => {
    // Regression guard for group-booking links: the Slot vended for a group
    // is owned by a PractitionerRole / HealthcareService and gets stamped
    // in-person, but a /prebook/virtual link asks for virtual. The explicit
    // option must win, otherwise the booking becomes in-person.
    const params = createSlotParamsFromSlotAndOptions(inPersonSlot, {
      status: 'busy-tentative',
      serviceModality: ServiceMode.virtual,
    });
    expect(params.serviceModality).toBe(ServiceMode.virtual);
  });

  it('prefers an explicit in-person serviceModality over a Slot stamped virtual', () => {
    const params = createSlotParamsFromSlotAndOptions(virtualSlot, {
      status: 'busy-tentative',
      serviceModality: ServiceMode['in-person'],
    });
    expect(params.serviceModality).toBe(ServiceMode['in-person']);
  });

  it('falls back to the Slot-inferred mode when no explicit serviceModality is given (virtual Slot)', () => {
    const params = createSlotParamsFromSlotAndOptions(virtualSlot, { status: 'busy-tentative' });
    expect(params.serviceModality).toBe(ServiceMode.virtual);
  });

  it('falls back to the Slot-inferred mode when no explicit serviceModality is given (in-person Slot)', () => {
    const params = createSlotParamsFromSlotAndOptions(inPersonSlot, { status: 'busy-tentative' });
    expect(params.serviceModality).toBe(ServiceMode['in-person']);
  });

  it('defaults to in-person when neither an explicit mode nor a Slot-inferred mode is available', () => {
    const params = createSlotParamsFromSlotAndOptions(noModeSlot, { status: 'busy-tentative' });
    expect(params.serviceModality).toBe(ServiceMode['in-person']);
  });
});
