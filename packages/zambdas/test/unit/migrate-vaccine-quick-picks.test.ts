// The one-time upgrade that repoints immunization quick picks from the vaccines the retired
// config/oystehr/vaccines.json created to the vaccine list: the mapping table, the plan and the update.
import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, Bundle } from 'fhir/r4b';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { describe, expect, it, vi } from 'vitest';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../../src/ehr/shared/quick-pick-categories';
import { activityDefinitionToQuickPick, quickPickToActivityDefinition } from '../../src/ehr/shared/quick-pick-helpers';
import {
  CONFIG_VACCINE_MAPPINGS,
  migrateVaccineQuickPicks,
  planQuickPickRepoints,
  repointQuickPickVaccine,
} from '../../src/scripts/migrate-vaccine-quick-picks.helpers';

// The names config/oystehr/vaccines.json shipped before it was retired.
const SHIPPED_CONFIG_VACCINES = [
  'COVID-19 (Adult/Adol)',
  'COVID-19 (Pediatric)',
  'DTaP (Infanrix/Daptacel)',
  'Flu (Adult)',
  'Flu (Pediatric)',
  'Flu (Senior)',
  'Hep A (Adult)',
  'Hep A (Pediatric)',
  'Hep B (Engerix-B/Recombivax - Adult - MVX: SKB/MSD)',
  'Hep B (Engerix-B/Recombivax - Ped/Adol - MVX: SKB/MSD)',
  'Hep B (Heplisav-B - MVX: DVA)',
  'Meningococcal ACWY (Adolescent)',
  'Meningococcal ACWY (Adult/Traveler)',
  'MMR - Ped with Counseling',
  'MMR - Standard Admin',
  'Pneumococcal (PCV15 - Pediatric)',
  'Pneumococcal (PCV20 - Adult)',
  'Polio (IPV - Adult)',
  'Polio (IPV - Pediatric)',
  'Rabies (Post-Exposure)',
  'RSV (Adult)',
  'Td (Tetanus/Diphtheria)',
  'Tdap (Adacel/Boostrix)',
  'Typhoid (Injectable)',
  'Varicella - Ped',
  'Varicella - Standard Admin',
];

const quickPick = (
  id: string,
  name: string,
  vaccine: ImmunizationQuickPickData['vaccine'],
  rest: Partial<ImmunizationQuickPickData> = {}
): ImmunizationQuickPickData => ({ id, name, vaccine, dose: '0.5', units: 'ml', route: '78421000', ...rest });

const configVaccine = (name: string): { id: string; name: string } => ({
  id: 'a3f1c2d4-0000-4000-8000-000000000001',
  name,
});

const asActivityDefinition = (data: ImmunizationQuickPickData): ActivityDefinition => ({
  ...quickPickToActivityDefinition(data, IMMUNIZATION_QUICK_PICK_CATEGORY),
  id: data.id,
});

/** One page holding everything, as getAllFhirSearchPages reads it. */
const searchPage = (resources: ActivityDefinition[]): Bundle<ActivityDefinition> & { unbundle: () => unknown } => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' as const } })),
  unbundle: () => resources,
});

describe('CONFIG_VACCINE_MAPPINGS', () => {
  it('maps every shipped config vaccine, once, to a vaccine in the list', () => {
    expect(CONFIG_VACCINE_MAPPINGS.map((mapping) => mapping.configName).sort()).toEqual(
      [...SHIPPED_CONFIG_VACCINES].sort()
    );
    for (const mapping of CONFIG_VACCINE_MAPPINGS) {
      expect(getCvxVaccine(mapping.cvx), `${mapping.configName} → CVX ${mapping.cvx}`).toBeDefined();
    }
  });
});

describe('planQuickPickRepoints', () => {
  it('repoints a quick pick on a config vaccine using the table', () => {
    const plan = planQuickPickRepoints([quickPick('qp-1', 'Tdap adult', configVaccine('Tdap (Adacel/Boostrix)'))]);
    expect(plan).toEqual({
      repoint: [
        {
          quickPickId: 'qp-1',
          quickPickName: 'Tdap adult',
          oldVaccineName: 'Tdap (Adacel/Boostrix)',
          cvx: '115',
          vaccineName: 'Tdap',
          reason: 'table',
          tableCvx: undefined,
          unlistedCvx: undefined,
        },
      ],
      alreadyCurrent: 0,
      unknown: [],
    });
  });

  it("lets the quick pick's own CVX win, and says when the table disagrees", () => {
    const plan = planQuickPickRepoints([
      quickPick('qp-1', 'Flu quad', configVaccine('Flu (Adult)'), { cvx: '150' }),
      quickPick('qp-2', 'Custom', configVaccine('Our own vaccine name'), { cvx: '03' }),
    ]);
    expect(plan.repoint).toMatchObject([
      { quickPickId: 'qp-1', cvx: '150', reason: 'quick pick CVX', tableCvx: '140' },
      { quickPickId: 'qp-2', cvx: '03', vaccineName: 'MMR', reason: 'quick pick CVX', tableCvx: undefined },
    ]);
  });

  it("falls back to the table when the quick pick's own CVX is not in the list", () => {
    const plan = planQuickPickRepoints([
      quickPick('qp-1', 'MMR', configVaccine('MMR - Standard Admin'), { cvx: '999' }),
    ]);
    expect(plan.repoint).toMatchObject([{ cvx: '03', reason: 'table', unlistedCvx: '999' }]);
  });

  it('leaves alone quick picks already on a list vaccine, without a vaccine, or not in the mapping', () => {
    const plan = planQuickPickRepoints([
      quickPick('qp-1', 'Tdap', { id: '115', name: 'Tdap' }),
      quickPick('qp-2', 'Codes only', undefined, { cvx: '115' }),
      quickPick('qp-3', 'Custom', configVaccine('Our own vaccine name')),
    ]);
    expect(plan.repoint).toEqual([]);
    expect(plan.alreadyCurrent).toBe(2);
    expect(plan.unknown).toEqual([{ quickPickName: 'Custom', oldVaccineName: 'Our own vaccine name' }]);
  });
});

describe('repointQuickPickVaccine', () => {
  it('replaces only the vaccine in the stored quick pick', () => {
    const original = quickPick('qp-1', 'Tdap adult', configVaccine('Tdap (Adacel/Boostrix)'), {
      cvx: '115',
      cptCodes: [{ code: '90715', display: 'Tdap vaccine' }],
      instructions: 'Deltoid',
    });
    const activityDefinition: ActivityDefinition = {
      ...asActivityDefinition(original),
      meta: { tag: [{ system: 'other', code: 'kept' }], versionId: '3' },
      description: 'kept',
    };
    const updated = repointQuickPickVaccine(activityDefinition, { id: '115', name: 'Tdap' });
    expect(activityDefinitionToQuickPick(updated, IMMUNIZATION_QUICK_PICK_CATEGORY)).toEqual({
      ...original,
      vaccine: { id: '115', name: 'Tdap' },
    });
    expect({ ...updated, extension: undefined }).toEqual({ ...activityDefinition, extension: undefined });
  });
});

describe('migrateVaccineQuickPicks', () => {
  const quickPicks = [
    quickPick('qp-1', 'Tdap adult', configVaccine('Tdap (Adacel/Boostrix)')),
    quickPick('qp-2', 'Already moved', { id: '03', name: 'MMR' }),
    quickPick('qp-3', 'Custom', configVaccine('Our own vaccine name')),
  ];
  const makeOystehr = (update = vi.fn(async (resource: ActivityDefinition) => resource)): Oystehr =>
    ({
      fhir: { search: vi.fn(async () => searchPage(quickPicks.map(asActivityDefinition))), update },
    }) as unknown as Oystehr;

  it('writes nothing on a dry run', async () => {
    const update = vi.fn();
    const stats = await migrateVaccineQuickPicks(makeOystehr(update), true);
    expect(update).not.toHaveBeenCalled();
    expect(stats).toEqual({ quickPicks: 3, repointed: 1, alreadyCurrent: 1, unknown: 1, failed: 0 });
  });

  it('updates each planned quick pick and no other', async () => {
    const update = vi.fn(async (resource: ActivityDefinition) => resource);
    const stats = await migrateVaccineQuickPicks(makeOystehr(update), false);
    expect(update).toHaveBeenCalledTimes(1);
    const written = update.mock.calls[0][0];
    expect(written.id).toBe('qp-1');
    expect(activityDefinitionToQuickPick(written, IMMUNIZATION_QUICK_PICK_CATEGORY).vaccine).toEqual({
      id: '115',
      name: 'Tdap',
    });
    expect(stats).toEqual({ quickPicks: 3, repointed: 1, alreadyCurrent: 1, unknown: 1, failed: 0 });
  });

  it('counts a failed update and carries on', async () => {
    const update = vi.fn(async () => {
      throw new Error('boom');
    });
    const stats = await migrateVaccineQuickPicks(makeOystehr(update), false);
    expect(stats).toMatchObject({ repointed: 0, failed: 1 });
  });
});
