import Oystehr from '@oystehr/sdk';
import { Location, Schedule } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { assertScheduleLocationActorBookable, INACTIVE_LOCATION_SLOT_ERROR_MESSAGE } from './helpers';

const scheduleFor = (reference: string): Schedule => ({ resourceType: 'Schedule', actor: [{ reference }] });

const stubOystehr = (location?: Location): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } => {
  const get = vi.fn(async () => {
    if (!location) throw { issue: [{ code: 'not-found' }] };
    return location;
  });
  return { oystehr: { fhir: { get } } as unknown as Oystehr, get };
};

describe('assertScheduleLocationActorBookable', () => {
  it('rejects a schedule owned by a deactivated Location', async () => {
    const { oystehr, get } = stubOystehr({ resourceType: 'Location', id: 'loc-1', status: 'inactive' });
    await expect(assertScheduleLocationActorBookable(scheduleFor('Location/loc-1'), oystehr)).rejects.toEqual({
      code: APIErrorCode.INVALID_INPUT,
      message: INACTIVE_LOCATION_SLOT_ERROR_MESSAGE,
    });
    expect(get).toHaveBeenCalledWith({ resourceType: 'Location', id: 'loc-1' });
  });

  it.each([['active' as const], [undefined]])('allows a Location with status %s', async (status) => {
    const { oystehr } = stubOystehr({ resourceType: 'Location', id: 'loc-1', ...(status ? { status } : {}) });
    await expect(assertScheduleLocationActorBookable(scheduleFor('Location/loc-1'), oystehr)).resolves.toBeUndefined();
  });

  it('allows a Location actor that no longer resolves', async () => {
    const { oystehr } = stubOystehr();
    await expect(assertScheduleLocationActorBookable(scheduleFor('Location/gone'), oystehr)).resolves.toBeUndefined();
  });

  it('does not fetch anything for non-Location actors', async () => {
    const { oystehr, get } = stubOystehr();
    await expect(
      assertScheduleLocationActorBookable(scheduleFor('PractitionerRole/pr-1'), oystehr)
    ).resolves.toBeUndefined();
    await expect(
      assertScheduleLocationActorBookable(scheduleFor('HealthcareService/hs-1'), oystehr)
    ).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });
});
