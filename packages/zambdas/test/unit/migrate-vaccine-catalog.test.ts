// The one-time upgrade that adds a catalog vaccine for each vaccine a practice already uses: the vaccines the
// retired config/oystehr/vaccines.json created and the ones its immunization quick picks give.
import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, Bundle, Medication } from 'fhir/r4b';
import { getMedicationInventoryConfig } from 'utils/lib/fhir/medication-inventory';
import { VACCINE_DEFAULT_INVENTORY } from 'utils/lib/types/api/config/in-house-medications';
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
import { quickPickToActivityDefinition } from '../../src/ehr/shared/quick-pick-helpers';
import { migrateVaccineCatalog, planVaccineCatalog } from '../../src/scripts/migrate-vaccine-catalog.helpers';

/** A vaccine the retired config file created: the vaccine type and a name, no CVX code. */
const configVaccine = (id: string, name: string): Medication => ({
  resourceType: 'Medication',
  id,
  status: 'active',
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
  vaccine: ImmunizationQuickPickData['vaccine'],
  rest: Partial<ImmunizationQuickPickData> = {}
): ImmunizationQuickPickData => ({ id, name, vaccine, dose: '0.5', units: 'ml', route: '78421000', ...rest });

/** A quick pick saved before the vaccine list: its vaccine id is the old Medication's, not a CVX code. */
const onConfigVaccine = (name: string): { id: string; name: string } => ({
  id: 'a3f1c2d4-0000-4000-8000-000000000001',
  name,
});

const nameOf = (cvx: string): string => getCvxVaccine(cvx)!.name;

describe('planVaccineCatalog', () => {
  it('adds one catalog vaccine per CVX for the config vaccines, folding the names that share one', () => {
    const plan = planVaccineCatalog(
      [
        configVaccine('m-1', 'MMR - Ped with Counseling'),
        configVaccine('m-2', 'MMR - Standard Admin'),
        configVaccine('m-3', 'Tdap (Adacel/Boostrix)'),
      ],
      []
    );
    expect(plan.toAdd).toEqual([
      {
        cvx: '03',
        vaccineName: nameOf('03'),
        configNames: ['MMR - Ped with Counseling', 'MMR - Standard Admin'],
        quickPickNames: [],
      },
      { cvx: '115', vaccineName: nameOf('115'), configNames: ['Tdap (Adacel/Boostrix)'], quickPickNames: [] },
    ]);
    expect(plan).toMatchObject({ alreadyActive: [], removed: [], unknownConfigVaccines: [], unknownQuickPicks: [] });
  });

  it('adds the list vaccine a quick pick gives, once for the quick picks that share it', () => {
    const plan = planVaccineCatalog(
      [],
      [
        quickPick('qp-1', 'Varicella 0.5 mL', { id: '21', name: nameOf('21') }),
        quickPick('qp-2', 'Varicella catch-up', { id: '21', name: nameOf('21') }),
        quickPick('qp-3', 'Daptacel', { id: '106', name: nameOf('106') }),
      ]
    );
    expect(plan.toAdd.map((entry) => [entry.cvx, entry.quickPickNames])).toEqual(
      [
        ['106', ['Daptacel']],
        ['21', ['Varicella 0.5 mL', 'Varicella catch-up']],
      ].sort((a, b) => nameOf(a[0] as string).localeCompare(nameOf(b[0] as string)))
    );
  });

  it('a quick pick saved before the vaccine list adds nothing, whatever its old vaccine or its own CVX', () => {
    const plan = planVaccineCatalog(
      [],
      [
        quickPick('qp-1', 'Tdap adult', onConfigVaccine('Tdap (Adacel/Boostrix)')),
        quickPick('qp-2', 'Daptacel', onConfigVaccine('DTaP (Infanrix/Daptacel)'), { cvx: '106' }),
      ]
    );
    expect(plan.toAdd).toEqual([]);
    expect(plan.unknownQuickPicks).toEqual(['Tdap adult', 'Daptacel']);
  });

  it('a quick pick on a product the table does not name adds that product beside the table one', () => {
    const plan = planVaccineCatalog(
      [configVaccine('m-1', 'DTaP (Infanrix/Daptacel)')],
      [quickPick('qp-1', 'Daptacel', { id: '106', name: nameOf('106') })]
    );
    expect(plan.toAdd.map((entry) => entry.cvx).sort()).toEqual(['106', '20']);
    expect(plan.toAdd.find((entry) => entry.cvx === '20')).toMatchObject({
      configNames: ['DTaP (Infanrix/Daptacel)'],
      quickPickNames: [],
    });
  });

  it('skips a vaccine the catalog has, and leaves one that was removed from the catalog removed', () => {
    const plan = planVaccineCatalog(
      [
        configVaccine('m-1', 'MMR - Standard Admin'),
        configVaccine('m-2', 'Tdap (Adacel/Boostrix)'),
        configVaccine('m-3', 'Varicella - Ped'),
        catalogVaccine('c-1', '03'),
        catalogVaccine('c-2', '115', 'inactive'),
      ],
      []
    );
    expect(plan.toAdd.map((entry) => entry.cvx)).toEqual(['21']);
    expect(plan.alreadyActive.map((entry) => entry.cvx)).toEqual(['03']);
    expect(plan.removed.map((entry) => entry.cvx)).toEqual(['115']);
  });

  it('leaves alone a config vaccine the table does not have, and a quick pick without a vaccine', () => {
    const plan = planVaccineCatalog(
      [configVaccine('m-1', 'Our own vaccine name')],
      [quickPick('qp-1', 'Custom', onConfigVaccine('Our own vaccine name')), quickPick('qp-2', 'No vaccine', undefined)]
    );
    expect(plan.toAdd).toEqual([]);
    expect(plan.unknownConfigVaccines).toEqual(['Our own vaccine name']);
    expect(plan.unknownQuickPicks).toEqual(['Custom']);
  });

  it('has nothing to do for a project with only catalog vaccines', () => {
    const plan = planVaccineCatalog([catalogVaccine('c-1', '03'), catalogVaccine('c-2', '115')], []);
    expect(plan).toEqual({
      toAdd: [],
      alreadyActive: [],
      removed: [],
      unknownConfigVaccines: [],
      unknownQuickPicks: [],
    });
  });
});

/** One page holding everything, as getAllFhirSearchPages reads it. */
const searchPage = <T extends Medication | ActivityDefinition>(
  resources: T[]
): Bundle<T> & { unbundle: () => unknown } => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' as const } })),
  unbundle: () => resources,
});

describe('migrateVaccineCatalog', () => {
  // Two config vaccines (MMR has no catalog entry, Tdap has one) and a quick pick that gives varicella.
  const project = [
    configVaccine('old-mmr', 'MMR - Standard Admin'),
    configVaccine('old-tdap', 'Tdap (Adacel/Boostrix)'),
    configVaccine('old-own', 'Our own vaccine name'),
    catalogVaccine('cat-tdap', '115'),
  ];
  const quickPicks = [quickPick('qp-var', 'Varicella 0.5 mL', { id: '21', name: nameOf('21') })].map((data) => ({
    ...quickPickToActivityDefinition(data, IMMUNIZATION_QUICK_PICK_CATEGORY),
    id: data.id,
  }));

  // The two listing searches return the project's vaccines and its immunization quick picks; createVaccine's own
  // search by CVX code returns the catalog entry with that code, if there is one.
  const makeOystehr = (medications: Medication[] = project, create?: ReturnType<typeof vi.fn>): Oystehr => {
    const search = vi.fn(
      async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        if (resourceType === 'ActivityDefinition') return searchPage(quickPicks);
        const code = params.find((param) => param.name === 'code')?.value;
        return searchPage(
          code
            ? medications.filter((medication) => code.endsWith(`|${medication.code?.coding?.[0].code}`))
            : medications
        );
      }
    );
    return {
      fhir: {
        search,
        create: create ?? vi.fn(async (resource: Medication) => ({ ...resource, id: 'new' })),
        patch: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as Oystehr;
  };
  const created = (oystehr: Oystehr): Medication[] =>
    (oystehr.fhir.create as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as Medication);
  const stats = { configVaccines: 3, quickPicks: 1, added: 2, alreadyActive: 1, removed: 0, unknown: 1, failed: 0 };

  it('adds each missing vaccine as a catalog entry set up for inventory in doses, and nothing else', async () => {
    const oystehr = makeOystehr();
    expect(await migrateVaccineCatalog(oystehr, false)).toEqual(stats);

    expect(created(oystehr).map((medication) => medication.code?.coding?.[0].code)).toEqual(['03', '21']);
    for (const medication of created(oystehr)) {
      expect(medication.status).toBe('active');
      expect(medication.identifier).toContainEqual({
        system: MEDICATION_TYPE_SYSTEM,
        value: INVENTORY_VACCINE_TYPE_CODE,
      });
      expect(getMedicationInventoryConfig(medication)).toEqual(VACCINE_DEFAULT_INVENTORY);
    }
    // the quick picks and the retired config vaccines are read, never written
    expect(oystehr.fhir.update).not.toHaveBeenCalled();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('writes nothing on a dry run and reports what it would add', async () => {
    const oystehr = makeOystehr();
    expect(await migrateVaccineCatalog(oystehr, true)).toEqual(stats);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('a second run adds nothing', async () => {
    const afterFirstRun = [...project, catalogVaccine('cat-mmr', '03'), catalogVaccine('cat-var', '21')];
    const oystehr = makeOystehr(afterFirstRun);
    expect(await migrateVaccineCatalog(oystehr, false)).toEqual({ ...stats, added: 0, alreadyActive: 3 });
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('does not bring back a vaccine that was removed from the catalog', async () => {
    const oystehr = makeOystehr([...project, catalogVaccine('cat-mmr', '03', 'inactive')]);
    expect(await migrateVaccineCatalog(oystehr, false)).toEqual({ ...stats, added: 1, removed: 1 });
    expect(created(oystehr).map((medication) => medication.code?.coding?.[0].code)).toEqual(['21']);
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('counts a failed add and carries on with the rest', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(async (resource: Medication) => ({ ...resource, id: 'new' }));
    const oystehr = makeOystehr(project, create);
    expect(await migrateVaccineCatalog(oystehr, false)).toEqual({ ...stats, added: 1, failed: 1 });
    expect(create).toHaveBeenCalledTimes(2);
  });
});
