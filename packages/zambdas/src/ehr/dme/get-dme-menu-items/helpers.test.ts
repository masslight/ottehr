import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { makeDmeMenuItemActivityDefinition } from '../../../shared/dme';
import { assertDmeMenuItemNameAvailable, getDmeMenuItemResourceOrThrow, searchDmeMenuItems } from './helpers';

const item = (id: string, name: string): ActivityDefinition =>
  makeDmeMenuItemActivityDefinition({ name, hcpcsCodes: [] }, id);

const fakeOystehr = (resources: ActivityDefinition[], get?: () => Promise<ActivityDefinition>): Oystehr => {
  const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
    const offset = Number(params.find((p) => p.name === '_offset')?.value ?? 0);
    const count = Number(params.find((p) => p.name === '_count')?.value);
    const page = resources.slice(offset, offset + count);
    return {
      total: resources.length,
      entry: page.map((resource) => ({ resource, search: { mode: 'match' } })),
      unbundle: () => page,
    };
  });
  return { fhir: { search, get: get ?? vi.fn() } } as unknown as Oystehr;
};

describe('DME menu helpers', () => {
  it('returns DME items sorted by name case-insensitively and skips untagged resources', async () => {
    const untagged: ActivityDefinition = { resourceType: 'ActivityDefinition', id: 'x', status: 'active', title: 'A' };
    const oystehr = fakeOystehr([item('1', 'walker'), item('2', 'Ankle Brace'), untagged, item('3', 'crutches')]);

    expect((await searchDmeMenuItems(oystehr)).map((i) => i.name)).toEqual(['Ankle Brace', 'crutches', 'walker']);
  });

  it('rejects a duplicate name regardless of case unless it is the item being edited', async () => {
    const oystehr = fakeOystehr([item('1', 'Ankle Brace')]);

    await expect(assertDmeMenuItemNameAvailable(oystehr, ' ankle BRACE ')).rejects.toMatchObject({
      message: 'A DME item named "ankle BRACE" already exists',
    });
    await expect(assertDmeMenuItemNameAvailable(oystehr, 'Ankle brace', '1')).resolves.toBeUndefined();
    await expect(assertDmeMenuItemNameAvailable(oystehr, 'Knee Brace')).resolves.toBeUndefined();
  });

  it('maps missing, deleted and non-DME resources to a 404', async () => {
    const quickPick: ActivityDefinition = { resourceType: 'ActivityDefinition', id: 'qp', status: 'active' };
    const fhirError = (code: number): Error => Object.assign(new Error(`HTTP ${code}`), { code });
    const cases = [
      () => Promise.reject(fhirError(404)),
      () => Promise.reject(fhirError(410)),
      () => Promise.resolve(quickPick),
    ];
    for (const get of cases) {
      await expect(getDmeMenuItemResourceOrThrow(fakeOystehr([], get), 'id')).rejects.toMatchObject({
        statusCode: 404,
      });
    }

    const found = item('1', 'Ankle Brace');
    const withGet = (get: () => Promise<ActivityDefinition>): Oystehr => fakeOystehr([], get);
    await expect(
      getDmeMenuItemResourceOrThrow(
        withGet(() => Promise.resolve(found)),
        '1'
      )
    ).resolves.toBe(found);
    await expect(
      getDmeMenuItemResourceOrThrow(
        withGet(() => Promise.reject(fhirError(500))),
        '1'
      )
    ).rejects.toThrow('HTTP 500');
  });
});
