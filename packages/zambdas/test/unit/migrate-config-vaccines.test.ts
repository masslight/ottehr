// The one-time upgrade that switches on the catalog vaccine for each vaccine the retired config/oystehr/vaccines.json
// created: the mapping table and the plan built from a project's vaccine Medications.
import Oystehr from '@oystehr/sdk';
import { Bundle, Medication } from 'fhir/r4b';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIG_VACCINE_MAPPINGS,
  migrateConfigVaccines,
  planConfigVaccineMigration,
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

/** One page holding everything, as getAllFhirSearchPages reads it. */
const searchPage = (resources: Medication[]): Bundle<Medication> & { unbundle: () => Medication[] } => ({
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

describe('running the migration', () => {
  const project = [
    configVaccine('old-mmr', 'MMR - Standard Admin'),
    configVaccine('old-tdap', 'Tdap (Adacel/Boostrix)'),
    catalogVaccine('cat-tdap', '115'),
  ];

  // The listing search returns the project; createVaccine's own search by CVX finds nothing, so it creates.
  const mockOystehr = (): Oystehr => {
    const search = vi
      .fn()
      .mockImplementation(async ({ params }: { params: { name: string }[] }) =>
        params.some((param) => param.name === 'code') ? searchPage([]) : searchPage(project)
      );
    const create = vi.fn().mockImplementation(async (resource: Medication) => ({ ...resource, id: 'new-mmr' }));
    return { fhir: { search, create, patch: vi.fn() } } as unknown as Oystehr;
  };

  it('switches on the missing entries through the zambda builder and counts the rest', async () => {
    const oystehr = mockOystehr();
    const stats = await migrateConfigVaccines(oystehr, false);

    expect(stats).toEqual({ configVaccines: 2, switchedOn: 1, alreadyOn: 1, unknown: 0, failed: 0 });
    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
    const created = (oystehr.fhir.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as Medication;
    expect(created.code?.coding?.[0]).toMatchObject({ system: CVX_CODE_SYSTEM_URL, code: '03' });
    expect(created.status).toBe('active');
  });

  it('a dry run writes nothing and reports what it would switch on', async () => {
    const oystehr = mockOystehr();
    const stats = await migrateConfigVaccines(oystehr, true);

    expect(stats).toEqual({ configVaccines: 2, switchedOn: 1, alreadyOn: 1, unknown: 0, failed: 0 });
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('counts a failed switch-on instead of stopping', async () => {
    const oystehr = mockOystehr();
    (oystehr.fhir.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('FHIR down'));
    const stats = await migrateConfigVaccines(oystehr, false);
    expect(stats.failed).toBe(1);
    expect(stats.switchedOn).toBe(0);
  });
});
