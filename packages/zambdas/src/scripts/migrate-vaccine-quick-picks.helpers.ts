import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../ehr/shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QUICK_PICK_CONFIG_EXTENSION_URL,
  QUICK_PICK_TAG_SYSTEM,
} from '../ehr/shared/quick-pick-helpers';

/** A vaccine the retired config/oystehr/vaccines.json created (name only, no CVX) and the list vaccine that replaces it. */
export interface ConfigVaccineMapping {
  configName: string;
  cvx: string;
  /** Why this CVX, where the config name covered more than one product. */
  note?: string;
}

/**
 * The 26 config vaccines → the vaccine list (CVX_VACCINES). Several config names were billing or age splits
 * of one product (MMR, Varicella, IPV, MenACWY) and map to the same vaccine. An instance with its own vaccines
 * in vaccines.json adds its rows here before running the migration.
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
    note: 'Pfizer 5-11 y (10 mcg/0.3 mL); Moderna 6 mo-11 y is 311',
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
    note: 'children from 6 months get the same 0.5 mL trivalent dose as adults; the 0.25 mL pediatric code is 161',
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
    note: 'MenQuadfi (MenACWY-TT); Menveo is 136',
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

export interface PlannedQuickPickRepoint {
  quickPickId: string;
  quickPickName: string;
  oldVaccineName: string;
  cvx: string;
  /** The list vaccine's name, which the quick pick shows from now on. */
  vaccineName: string;
  /** Where the CVX came from: the quick pick's own CVX, or the old vaccine's row in the table. */
  reason: 'quick pick CVX' | 'table';
  /** The table's CVX for the old vaccine, when the quick pick's own CVX won and differs from it. */
  tableCvx?: string;
  /** The quick pick's own CVX when it is not in the vaccine list, so the table was used instead. */
  unlistedCvx?: string;
}

export interface QuickPickRepointPlan {
  repoint: PlannedQuickPickRepoint[];
  /** Quick picks already pointing at a list vaccine, or at no vaccine. */
  alreadyCurrent: number;
  /** Quick picks whose old vaccine is not in the table and whose own CVX is not in the list; left alone. */
  unknown: { quickPickName: string; oldVaccineName: string }[];
}

/**
 * Which immunization quick picks to repoint from a retired config vaccine to a vaccine in the list. The quick
 * pick's own CVX wins when the list has it, since that is the product the practice said it gives; otherwise the
 * old vaccine's row in the table. Only the quick pick's vaccine changes; its name, dose, route, codes and CVX
 * stay as they are.
 */
export function planQuickPickRepoints(quickPicks: ImmunizationQuickPickData[]): QuickPickRepointPlan {
  const plan: QuickPickRepointPlan = { repoint: [], alreadyCurrent: 0, unknown: [] };
  for (const quickPick of quickPicks) {
    if (!quickPick.id || !quickPick.vaccine || getCvxVaccine(quickPick.vaccine.id)) {
      plan.alreadyCurrent += 1;
      continue;
    }
    const oldVaccineName = quickPick.vaccine.name;
    const ownCvx = getCvxVaccine(quickPick.cvx)?.cvx;
    const tableCvx = CONFIG_VACCINE_MAPPINGS.find((mapping) => mapping.configName === oldVaccineName)?.cvx;
    const vaccine = getCvxVaccine(ownCvx ?? tableCvx);
    if (!vaccine) {
      plan.unknown.push({ quickPickName: quickPick.name, oldVaccineName });
      continue;
    }
    plan.repoint.push({
      quickPickId: quickPick.id,
      quickPickName: quickPick.name,
      oldVaccineName,
      cvx: vaccine.cvx,
      vaccineName: vaccine.name,
      reason: ownCvx ? 'quick pick CVX' : 'table',
      tableCvx: ownCvx && tableCvx && tableCvx !== ownCvx ? tableCvx : undefined,
      unlistedCvx: !ownCvx && quickPick.cvx ? quickPick.cvx : undefined,
    });
  }
  return plan;
}

/** The quick pick's ActivityDefinition with only the vaccine in its stored config replaced. */
export function repointQuickPickVaccine(
  activityDefinition: ActivityDefinition,
  vaccine: { id: string; name: string }
): ActivityDefinition {
  return {
    ...activityDefinition,
    extension: activityDefinition.extension?.map((extension) =>
      extension.url === QUICK_PICK_CONFIG_EXTENSION_URL
        ? { ...extension, valueString: JSON.stringify({ ...JSON.parse(extension.valueString ?? '{}'), vaccine }) }
        : extension
    ),
  };
}

export interface VaccineQuickPickMigrationStats {
  quickPicks: number;
  repointed: number;
  alreadyCurrent: number;
  unknown: number;
  failed: number;
}

export async function migrateVaccineQuickPicks(
  oystehr: Oystehr,
  dryRun: boolean
): Promise<VaccineQuickPickMigrationStats> {
  const activityDefinitions = await getAllFhirSearchPages<ActivityDefinition>(
    {
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${IMMUNIZATION_QUICK_PICK_CATEGORY.tagCode}` },
        { name: 'status', value: 'active' },
      ],
    },
    oystehr
  );
  const plan = planQuickPickRepoints(
    activityDefinitions.map((activityDefinition) =>
      activityDefinitionToQuickPick(activityDefinition, IMMUNIZATION_QUICK_PICK_CATEGORY)
    )
  );
  const stats: VaccineQuickPickMigrationStats = {
    quickPicks: activityDefinitions.length,
    repointed: 0,
    alreadyCurrent: plan.alreadyCurrent,
    unknown: plan.unknown.length,
    failed: 0,
  };

  for (const { quickPickName, oldVaccineName } of plan.unknown) {
    console.log(`  ? quick pick "${quickPickName}": "${oldVaccineName}" is not in the mapping table, left alone`);
  }
  for (const entry of plan.repoint) {
    const label = `quick pick "${entry.quickPickName}": ${entry.oldVaccineName} → ${entry.vaccineName} (CVX ${entry.cvx}, from the ${entry.reason})`;
    if (entry.tableCvx) console.log(`  ! the table maps ${entry.oldVaccineName} to CVX ${entry.tableCvx}; review`);
    if (entry.unlistedCvx) console.log(`  ! its own CVX ${entry.unlistedCvx} is not in the vaccine list; review`);
    if (dryRun) {
      console.log(`  + would repoint ${label}`);
      stats.repointed += 1;
      continue;
    }
    try {
      const activityDefinition = activityDefinitions.find((candidate) => candidate.id === entry.quickPickId);
      if (!activityDefinition) throw new Error(`ActivityDefinition/${entry.quickPickId} not found`);
      await oystehr.fhir.update<ActivityDefinition>(
        repointQuickPickVaccine(activityDefinition, { id: entry.cvx, name: entry.vaccineName })
      );
      console.log(`  ✓ repointed ${label}`);
      stats.repointed += 1;
    } catch (error) {
      console.error(`  ✗ failed to repoint ${label}:`, error);
      stats.failed += 1;
    }
  }
  return stats;
}
