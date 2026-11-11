// The one-time upgrade that switches on the catalog vaccine for each vaccine the retired config/oystehr/vaccines.json
// created: the mapping table and the plan built from a project's vaccine Medications.
import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, Bundle, Medication } from 'fhir/r4b';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { describe, expect, it, vi } from 'vitest';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../../src/ehr/shared/quick-pick-categories';
import { activityDefinitionToQuickPick, quickPickToActivityDefinition } from '../../src/ehr/shared/quick-pick-helpers';
import {
  CONFIG_VACCINE_MAPPINGS,
  migrateConfigVaccines,
  planConfigVaccineMigration,
  planQuickPickRepoints,
} from '../../src/scripts/migrate-config-vaccines.helpers';

const configVaccine = (id: string, name: string): Medication => ({
  resourceType: 'Medication',
  id,
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
  ],
});

const catalogVaccine = (id: string, cvx: string, status: Medication['status'] = 'active'): Medication => ({
  ...configVaccine(id, getCvxVaccine(cvx)?.name ?? cvx),
  status,
  code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }] },
});

const quickPick = (
  id: string,
  name: string,
  vaccine: Medication | undefined,
  rest: Partial<ImmunizationQuickPickData> = {}
): ImmunizationQuickPickData => ({
  id,
  name,
  vaccine: vaccine && { id: vaccine.id!, name: vaccine.identifier![1].value! },
  dose: '0.5',
  units: 'ml',
  route: 'Intramuscular route',
  ...rest,
});

/** One page holding everything, as getAllFhirSearchPages reads it. */
const searchPage = <T extends Medication | ActivityDefinition>(
  resources: T[]
): Bundle<T> & { unbundle: () => T[] } => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' as const } })),
  unbundle: () => resources,
});

describe('the config vaccine → catalog mapping', () => {
  it('names each of the 26 config vaccines once and only CVX codes from the shipped list', () => {
    expect(CONFIG_VACCINE_MAPPINGS).toHaveLength(26);
    expect(new Set(CONFIG_VACCINE_MAPPINGS.map((mapping) => mapping.configName)).size).toBe(26);
    for (const mapping of CONFIG_VACCINE_MAPPINGS) {
      expect(getCvxVaccine(mapping.cvx), `${mapping.configName} → CVX ${mapping.cvx}`).toBeDefined();
    }
  });
});

describe('planning the migration', () => {
  it('switches on one catalog entry per CVX, folding config names that share one, and skips entries already on', () => {
    const plan = planConfigVaccineMigration([
      configVaccine('old-mmr-1', 'MMR - Ped with Counseling'),
      configVaccine('old-mmr-2', 'MMR - Standard Admin'),
      configVaccine('old-tdap', 'Tdap (Adacel/Boostrix)'),
      configVaccine('old-dtap', 'DTaP (Infanrix/Daptacel)'),
      catalogVaccine('cat-tdap', '115'),
    ]);

    expect(plan.switchOn).toEqual([
      { cvx: '03', catalogName: 'MMR', configNames: ['MMR - Ped with Counseling', 'MMR - Standard Admin'] },
      { cvx: '20', catalogName: 'DTaP', configNames: ['DTaP (Infanrix/Daptacel)'] },
    ]);
    expect(plan.alreadyOn).toEqual([{ cvx: '115', catalogName: 'Tdap', configNames: ['Tdap (Adacel/Boostrix)'] }]);
    expect(plan.unknown).toEqual([]);
  });

  it('an entry switched off is switched on again, and a name not in the table is left alone', () => {
    const plan = planConfigVaccineMigration([
      configVaccine('old-tdap', 'Tdap (Adacel/Boostrix)'),
      catalogVaccine('cat-tdap', '115', 'inactive'),
      configVaccine('own', 'Shingles (practice added)'),
    ]);

    expect(plan.switchOn.map((entry) => entry.cvx)).toEqual(['115']);
    expect(plan.alreadyOn).toEqual([]);
    expect(plan.unknown).toEqual(['Shingles (practice added)']);
  });

  it('a project with only catalog vaccines has nothing to do', () => {
    expect(planConfigVaccineMigration([catalogVaccine('cat-mmr', '03')])).toEqual({
      switchOn: [],
      alreadyOn: [],
      unknown: [],
    });
  });
});

describe('planning the quick pick repoints', () => {
  const oldTd = configVaccine('old-td', 'Td (Tetanus/Diphtheria)');
  const oldTdap = configVaccine('old-tdap', 'Tdap (Adacel/Boostrix)');
  const catTdap = catalogVaccine('cat-tdap', '115');
  const medications = [oldTd, oldTdap, catTdap, configVaccine('own', 'Shingles (practice added)')];

  it("the quick pick's own CVX wins over the table", () => {
    // Td's row maps to 113 as well, so give the quick pick the 2 Lf code to show its CVX is what is used.
    const td = quickPick('qp-td', 'Td (Tetanus/Diphtheria) | 0.5 | ml | Intramuscular route', oldTd, {
      cvx: '09',
      mvx: 'PMC',
      cptCodes: [{ code: '90471', display: 'Immunization admin' }],
    });
    const plan = planQuickPickRepoints([td], medications);
    expect(plan.repoint).toEqual([
      {
        quickPick: td,
        oldVaccineName: 'Td (Tetanus/Diphtheria)',
        cvx: '09',
        catalogName: getCvxVaccine('09')?.name,
        reason: 'quick pick CVX',
        unknownCvx: undefined,
      },
    ]);
    expect(plan.alreadyCatalog).toBe(0);
    expect(plan.unknown).toEqual([]);
  });

  it('with no CVX of its own the table decides', () => {
    const plan = planQuickPickRepoints([quickPick('qp-tdap', 'Tdap booster', oldTdap)], medications);
    expect(plan.repoint).toMatchObject([{ cvx: '115', catalogName: 'Tdap', reason: 'table', unknownCvx: undefined }]);
  });

  it('a CVX not in the catalog falls back to the table and is reported', () => {
    const plan = planQuickPickRepoints([quickPick('qp-tdap', 'Tdap booster', oldTdap, { cvx: '999' })], medications);
    expect(plan.repoint).toMatchObject([{ cvx: '115', reason: 'table', unknownCvx: '999' }]);
  });

  it('a quick pick already on a catalog vaccine, or with no vaccine, is skipped', () => {
    const plan = planQuickPickRepoints(
      [quickPick('qp-cat', 'Tdap booster', catTdap, { cvx: '115' }), quickPick('qp-none', 'No vaccine', undefined)],
      medications
    );
    expect(plan).toEqual({ repoint: [], alreadyCatalog: 2, unknown: [] });
  });

  it('a quick pick whose old vaccine is not in the table, or is gone, is left alone', () => {
    const plan = planQuickPickRepoints(
      [
        quickPick('qp-own', 'Shingles', medications[3]),
        quickPick('qp-gone', 'Gone', configVaccine('deleted', 'Td (Tetanus/Diphtheria)')),
      ],
      medications
    );
    expect(plan).toEqual({ repoint: [], alreadyCatalog: 0, unknown: ['Shingles', 'Gone'] });
  });
});

describe('running the migration', () => {
  const oldMmr = configVaccine('old-mmr', 'MMR - Standard Admin');
  const catTdap = catalogVaccine('cat-tdap', '115');
  const project = [oldMmr, configVaccine('old-tdap', 'Tdap (Adacel/Boostrix)'), catTdap];
  // One quick pick on an old vaccine (its own CVX, 03, matches the table), one already on a catalog vaccine.
  const quickPicks = [
    quickPick('qp-mmr', 'MMR | 0.5 | ml | Subcutaneous route', oldMmr, { cvx: '03', mvx: 'MSD' }),
    quickPick('qp-tdap', 'Tdap booster', catTdap, { cvx: '115' }),
  ].map((data) => quickPickToActivityDefinition(data, IMMUNIZATION_QUICK_PICK_CATEGORY, data.id));

  // The listing searches return the project and, for the immunization tag only, its quick picks; createVaccine's
  // own search by CVX finds nothing for MMR, so it creates; for Tdap it finds the active entry.
  const mockOystehr = (): Oystehr => {
    const search = vi
      .fn()
      .mockImplementation(
        async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
          if (resourceType === 'ActivityDefinition') {
            const tag = params.find((param) => param.name === '_tag')?.value;
            return searchPage(tag?.endsWith('|immunization-quick-pick') ? quickPicks : []);
          }
          const code = params.find((param) => param.name === 'code')?.value;
          if (code)
            return searchPage(project.filter((medication) => code.endsWith(`|${medication.code?.coding?.[0].code}`)));
          return searchPage(project);
        }
      );
    const create = vi.fn().mockImplementation(async (resource: Medication) => ({ ...resource, id: 'new-mmr' }));
    const update = vi.fn().mockImplementation(async (resource: ActivityDefinition) => resource);
    return { fhir: { search, create, patch: vi.fn(), update } } as unknown as Oystehr;
  };
  const updated = (oystehr: Oystehr): ActivityDefinition[] =>
    (oystehr.fhir.update as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as ActivityDefinition);
  const fullStats = {
    configVaccines: 2,
    switchedOn: 1,
    alreadyOn: 1,
    unknown: 0,
    quickPicksRepointed: 1,
    quickPicksAlreadyCatalog: 1,
    quickPicksUnknown: 0,
    failed: 0,
  };

  it('switches on the missing entries through the zambda builder and counts the rest', async () => {
    const oystehr = mockOystehr();
    const stats = await migrateConfigVaccines(oystehr, false);

    expect(stats).toEqual(fullStats);
    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
    const created = (oystehr.fhir.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as Medication;
    expect(created.code?.coding?.[0]).toMatchObject({ system: CVX_CODE_SYSTEM_URL, code: '03' });
    expect(created.status).toBe('active');
  });

  it('repoints only the vaccine reference of a quick pick on an old vaccine, through the quick pick helpers', async () => {
    const oystehr = mockOystehr();
    await migrateConfigVaccines(oystehr, false);

    expect(updated(oystehr)).toHaveLength(1);
    const repointed = activityDefinitionToQuickPick(updated(oystehr)[0], IMMUNIZATION_QUICK_PICK_CATEGORY);
    expect(repointed).toEqual({
      ...activityDefinitionToQuickPick(quickPicks[0], IMMUNIZATION_QUICK_PICK_CATEGORY),
      vaccine: { id: 'new-mmr', name: 'MMR' },
    });
    expect(updated(oystehr)[0].id).toBe('qp-mmr');
    expect(updated(oystehr)[0].meta?.tag?.[0].code).toBe('immunization-quick-pick');
  });

  it('a dry run writes nothing and reports what it would switch on and repoint', async () => {
    const oystehr = mockOystehr();
    const stats = await migrateConfigVaccines(oystehr, true);

    expect(stats).toEqual(fullStats);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
    expect(oystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('counts a failed switch-on or repoint instead of stopping', async () => {
    const oystehr = mockOystehr();
    (oystehr.fhir.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('FHIR down'));
    const stats = await migrateConfigVaccines(oystehr, false);
    // The MMR switch-on fails, and so does the MMR quick pick, which needs that same catalog entry.
    expect(stats.failed).toBe(2);
    expect(stats.switchedOn).toBe(0);
    expect(stats.quickPicksRepointed).toBe(0);
  });
});
