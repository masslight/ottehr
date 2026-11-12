import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, Medication } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import { getMedicationCvx } from 'utils/lib/fhir/medication-inventory';
import {
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { createVaccine } from '../ehr/configuration/in-house-medications/create-in-house-medication/index';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../ehr/shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QUICK_PICK_TAG_SYSTEM,
  quickPickToActivityDefinition,
} from '../ehr/shared/quick-pick-helpers';

/** A vaccine the retired config/oystehr/vaccines.json created (name only, no CVX) and the catalog entry that replaces it. */
export interface ConfigVaccineMapping {
  configName: string;
  cvx: string;
  /** Why this CVX, where the config name covered more than one product. */
  note?: string;
}

/**
 * The 26 config vaccines → catalog CVX. Several config names were billing or age splits of one product
 * (MMR, Varicella, IPV, MenACWY) and fold into one catalog entry.
 */
export const CONFIG_VACCINE_MAPPINGS: readonly ConfigVaccineMapping[] = [
  {
    configName: 'COVID-19 (Adult/Adol)',
    cvx: '309',
    note: 'Pfizer 12+ (30 mcg/0.3 mL); Moderna 12+ is 312, Novavax is 313',
  },
  {
    configName: 'COVID-19 (Pediatric)',
    cvx: '310',
    note: 'Pfizer 5-11 y (10 mcg/0.3 mL); Moderna 6 mo-11 y is 311; the Pfizer under-5 dose is not offered',
  },
  { configName: 'DTaP (Infanrix/Daptacel)', cvx: '20', note: 'Infanrix; Daptacel (5 pertussis antigens) is 106' },
  {
    configName: 'Flu (Adult)',
    cvx: '140',
    note: 'standard-dose trivalent PF (US flu vaccines are trivalent since 2024-25); quadrivalent stock is 150',
  },
  {
    configName: 'Flu (Pediatric)',
    cvx: '140',
    note: 'children from 6 months get the same 0.5 mL trivalent dose as adults; the 0.25 mL pediatric code 161 is discontinued',
  },
  { configName: 'Flu (Senior)', cvx: '135', note: 'Fluzone High-Dose trivalent; Fluad (adjuvanted trivalent) is 168' },
  { configName: 'Hep A (Adult)', cvx: '52' },
  { configName: 'Hep A (Pediatric)', cvx: '83' },
  {
    configName: 'Hep B (Engerix-B/Recombivax - Adult - MVX: SKB/MSD)',
    cvx: '43',
    note: 'one CVX covers both products at the adult dose',
  },
  {
    configName: 'Hep B (Engerix-B/Recombivax - Ped/Adol - MVX: SKB/MSD)',
    cvx: '08',
    note: 'one CVX covers both products at the pediatric dose',
  },
  { configName: 'Hep B (Heplisav-B - MVX: DVA)', cvx: '189' },
  {
    configName: 'Meningococcal ACWY (Adolescent)',
    cvx: '203',
    note: 'MenQuadfi (MenACWY-TT); Menveo is 136, Menactra (114) is discontinued',
  },
  {
    configName: 'Meningococcal ACWY (Adult/Traveler)',
    cvx: '203',
    note: 'same product as the adolescent dose',
  },
  { configName: 'MMR - Ped with Counseling', cvx: '03', note: 'a billing split of one product' },
  { configName: 'MMR - Standard Admin', cvx: '03' },
  { configName: 'Pneumococcal (PCV15 - Pediatric)', cvx: '215' },
  { configName: 'Pneumococcal (PCV20 - Adult)', cvx: '216' },
  { configName: 'Polio (IPV - Adult)', cvx: '10', note: 'one product for all ages' },
  { configName: 'Polio (IPV - Pediatric)', cvx: '10' },
  {
    configName: 'Rabies (Post-Exposure)',
    cvx: '175',
    note: 'Imovax (human diploid cell); RabAvert (chick fibroblast) is 176',
  },
  {
    configName: 'RSV (Adult)',
    cvx: '303',
    note: 'Arexvy (adjuvanted RSVpreF3); Abrysvo is 305, mResvia is 326',
  },
  {
    configName: 'Td (Tetanus/Diphtheria)',
    cvx: '113',
    note: 'Tenivac and TdVax (5 Lf); the 2 Lf formulation is 09, Lf unknown is 196',
  },
  { configName: 'Tdap (Adacel/Boostrix)', cvx: '115', note: 'one CVX covers both products' },
  { configName: 'Typhoid (Injectable)', cvx: '101', note: 'Typhim Vi; the oral vaccine is 25' },
  { configName: 'Varicella - Ped', cvx: '21', note: 'a billing split of one product' },
  { configName: 'Varicella - Standard Admin', cvx: '21' },
];

export interface PlannedCatalogVaccine {
  cvx: string;
  catalogName: string;
  /** The config vaccines this entry replaces. */
  configNames: string[];
}

export interface ConfigVaccineMigrationPlan {
  switchOn: PlannedCatalogVaccine[];
  alreadyOn: PlannedCatalogVaccine[];
  /** Config vaccines whose name is not in the table (a practice's own edit of vaccines.json); left alone. */
  unknown: string[];
}

/**
 * Which catalog entries to switch on for the config vaccines a project has. A config vaccine is a vaccine
 * Medication without a CVX; the catalog entry replacing it is skipped when one with that CVX is already active,
 * so a run can be repeated. Config vaccines that share a CVX fold into one entry.
 */
export function planConfigVaccineMigration(vaccineMedications: Medication[]): ConfigVaccineMigrationPlan {
  const activeCvx = new Set(
    vaccineMedications.filter((medication) => medication.status === 'active').map(getMedicationCvx)
  );
  const byCvx = new Map<string, PlannedCatalogVaccine>();
  const unknown: string[] = [];
  for (const medication of vaccineMedications) {
    if (getMedicationCvx(medication)) continue;
    const configName = getMedicationName(medication);
    if (!configName) continue;
    const mapping = CONFIG_VACCINE_MAPPINGS.find((candidate) => candidate.configName === configName);
    if (!mapping) {
      unknown.push(configName);
      continue;
    }
    const planned = byCvx.get(mapping.cvx) ?? {
      cvx: mapping.cvx,
      catalogName: getCvxVaccine(mapping.cvx)?.name ?? mapping.cvx,
      configNames: [],
    };
    planned.configNames.push(configName);
    byCvx.set(mapping.cvx, planned);
  }
  const planned = [...byCvx.values()];
  return {
    switchOn: planned.filter((entry) => !activeCvx.has(entry.cvx)),
    alreadyOn: planned.filter((entry) => activeCvx.has(entry.cvx)),
    unknown,
  };
}

export interface PlannedQuickPickRepoint {
  quickPick: ImmunizationQuickPickData;
  oldVaccineName: string;
  cvx: string;
  catalogName: string;
  /** Where the CVX came from: the quick pick's own CVX, or the old vaccine's row in the table. */
  reason: 'quick pick CVX' | 'table';
  /** The quick pick's own CVX when it is not in the catalog, so the table was used instead. */
  unknownCvx?: string;
}

export interface QuickPickRepointPlan {
  repoint: PlannedQuickPickRepoint[];
  /** Quick picks already pointing at a catalog vaccine (or at no vaccine). */
  alreadyCatalog: number;
  /** Quick picks whose old vaccine is missing or not in the table, and whose own CVX is not in the catalog; left alone. */
  unknown: string[];
}

/**
 * Which immunization quick picks to repoint from an old config vaccine to a catalog vaccine. The quick pick's
 * own CVX wins when the catalog has it; otherwise the old vaccine's row in the table. Only the vaccine
 * reference changes; name, dose, route, codes and the quick pick's CVX stay as they are.
 */
export function planQuickPickRepoints(
  quickPicks: ImmunizationQuickPickData[],
  vaccineMedications: Medication[]
): QuickPickRepointPlan {
  const medicationsById = new Map(vaccineMedications.map((medication) => [medication.id, medication]));
  const plan: QuickPickRepointPlan = { repoint: [], alreadyCatalog: 0, unknown: [] };
  for (const quickPick of quickPicks) {
    const medication = quickPick.vaccine ? medicationsById.get(quickPick.vaccine.id) : undefined;
    if (!quickPick.vaccine || (medication && getMedicationCvx(medication))) {
      plan.alreadyCatalog += 1;
      continue;
    }
    const oldVaccineName = getMedicationName(medication);
    const ownCvx = quickPick.cvx && getCvxVaccine(quickPick.cvx) ? quickPick.cvx : undefined;
    const mapping = CONFIG_VACCINE_MAPPINGS.find((candidate) => candidate.configName === oldVaccineName);
    const cvx = ownCvx ?? mapping?.cvx;
    if (!oldVaccineName || !cvx) {
      plan.unknown.push(quickPick.name);
      continue;
    }
    plan.repoint.push({
      quickPick,
      oldVaccineName,
      cvx,
      catalogName: getCvxVaccine(cvx)?.name ?? cvx,
      reason: ownCvx ? 'quick pick CVX' : 'table',
      unknownCvx: !ownCvx && quickPick.cvx ? quickPick.cvx : undefined,
    });
  }
  return plan;
}

export interface ConfigVaccineMigrationStats {
  configVaccines: number;
  switchedOn: number;
  alreadyOn: number;
  unknown: number;
  quickPicksRepointed: number;
  quickPicksAlreadyCatalog: number;
  quickPicksUnknown: number;
  failed: number;
}

export async function migrateConfigVaccines(oystehr: Oystehr, dryRun: boolean): Promise<ConfigVaccineMigrationStats> {
  const vaccineMedications = await getAllFhirSearchPages<Medication>(
    {
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: `${MEDICATION_TYPE_SYSTEM}|${INVENTORY_VACCINE_TYPE_CODE}` }],
    },
    oystehr
  );
  const plan = planConfigVaccineMigration(vaccineMedications);
  const stats: ConfigVaccineMigrationStats = {
    configVaccines: vaccineMedications.filter((medication) => !getMedicationCvx(medication)).length,
    switchedOn: 0,
    alreadyOn: plan.alreadyOn.length,
    unknown: plan.unknown.length,
    quickPicksRepointed: 0,
    quickPicksAlreadyCatalog: 0,
    quickPicksUnknown: 0,
    failed: 0,
  };
  const label = (entry: PlannedCatalogVaccine): string =>
    `${entry.catalogName} (CVX ${entry.cvx}) for ${entry.configNames.join(', ')}`;
  // Active catalog Medications by CVX: what the project has, plus what this run switches on, so a quick pick's
  // catalog entry is switched on (or looked up) once however many quick picks need it.
  const catalogByCvx = new Map<string, Medication>();
  for (const medication of vaccineMedications) {
    const cvx = getMedicationCvx(medication);
    if (cvx && medication.status === 'active') catalogByCvx.set(cvx, medication);
  }

  for (const entry of plan.alreadyOn) console.log(`  = already on: ${label(entry)}`);
  for (const configName of plan.unknown) console.log(`  ? not a shipped config vaccine, left alone: ${configName}`);
  for (const entry of plan.switchOn) {
    if (dryRun) {
      console.log(`  + would switch on ${label(entry)}`);
      stats.switchedOn += 1;
      continue;
    }
    try {
      const medication = await createVaccine(oystehr, entry.cvx);
      catalogByCvx.set(entry.cvx, medication);
      console.log(`  ✓ Medication/${medication.id}: ${label(entry)}`);
      stats.switchedOn += 1;
    } catch (error) {
      console.error(`  ✗ failed to switch on ${label(entry)}:`, error);
      stats.failed += 1;
    }
  }

  // Quick picks saved against an old config vaccine: repoint them, or the order screen can't find their vaccine.
  const quickPicks = (
    await getAllFhirSearchPages<ActivityDefinition>(
      {
        resourceType: 'ActivityDefinition',
        params: [
          { name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${IMMUNIZATION_QUICK_PICK_CATEGORY.tagCode}` },
          { name: 'status', value: 'active' },
        ],
      },
      oystehr
    )
  ).map((activityDefinition) => activityDefinitionToQuickPick(activityDefinition, IMMUNIZATION_QUICK_PICK_CATEGORY));
  const quickPickPlan = planQuickPickRepoints(quickPicks, vaccineMedications);
  stats.quickPicksAlreadyCatalog = quickPickPlan.alreadyCatalog;
  stats.quickPicksUnknown = quickPickPlan.unknown.length;
  const repointLabel = (entry: PlannedQuickPickRepoint): string =>
    `quick pick "${entry.quickPick.name}": ${entry.oldVaccineName} → ${entry.catalogName} (CVX ${entry.cvx}, from the ${entry.reason})`;

  for (const name of quickPickPlan.unknown) {
    console.log(`  ? quick pick "${name}": its vaccine is not a shipped config vaccine, left alone`);
  }
  for (const entry of quickPickPlan.repoint) {
    if (entry.unknownCvx) {
      console.log(
        `  ? quick pick "${entry.quickPick.name}" has CVX ${entry.unknownCvx}, not in the catalog; using the table`
      );
    }
    if (dryRun) {
      console.log(`  + would repoint ${repointLabel(entry)}`);
      stats.quickPicksRepointed += 1;
      continue;
    }
    try {
      const medication = catalogByCvx.get(entry.cvx) ?? (await createVaccine(oystehr, entry.cvx));
      catalogByCvx.set(entry.cvx, medication);
      await oystehr.fhir.update<ActivityDefinition>(
        quickPickToActivityDefinition(
          {
            ...entry.quickPick,
            vaccine: { id: medication.id!, name: getMedicationName(medication) ?? entry.catalogName },
          },
          IMMUNIZATION_QUICK_PICK_CATEGORY,
          entry.quickPick.id
        )
      );
      console.log(`  ✓ repointed ${repointLabel(entry)}`);
      stats.quickPicksRepointed += 1;
    } catch (error) {
      console.error(`  ✗ failed to repoint ${repointLabel(entry)}:`, error);
      stats.failed += 1;
    }
  }
  return stats;
}
