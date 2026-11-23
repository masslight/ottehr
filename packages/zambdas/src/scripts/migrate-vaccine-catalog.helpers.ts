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
import { activityDefinitionToQuickPick, QUICK_PICK_TAG_SYSTEM } from '../ehr/shared/quick-pick-helpers';
import { CONFIG_VACCINE_MAPPINGS } from './config-vaccine-mappings';

/** A vaccine the practice already uses, and why it is taken to: its old config vaccines and its quick picks. */
export interface PlannedCatalogVaccine {
  cvx: string;
  /** The list vaccine's name, which the catalog entry is named with. */
  vaccineName: string;
  /** The retired config vaccines this catalog entry stands for. */
  configNames: string[];
  /** The immunization quick picks that give this vaccine. */
  quickPickNames: string[];
}

export interface VaccineCatalogPlan {
  toAdd: PlannedCatalogVaccine[];
  alreadyActive: PlannedCatalogVaccine[];
  /** In the catalog but inactive: someone removed it, so it stays removed. */
  removed: PlannedCatalogVaccine[];
  /** Retired config vaccines whose name is not in the mapping table (an instance's own vaccines); left alone. */
  unknownConfigVaccines: string[];
  /** Quick picks saved before the vaccine list, whose vaccine it does not have; left alone. */
  unknownQuickPicks: string[];
}

/**
 * Which vaccines to add to the catalog of a practice that gave vaccines before it had one. A practice already
 * uses a vaccine when it has the retired config vaccine for it (a vaccine Medication without a CVX code, matched
 * through CONFIG_VACCINE_MAPPINGS) or an immunization quick pick that gives it. A quick pick counts by the list
 * vaccine it points at. One saved before the vaccine list points at a retired config vaccine instead: it is
 * reported and adds nothing, since delete-immunization-quick-picks deletes those. Vaccines that share a CVX code
 * fold into one entry. A vaccine the catalog already has is skipped, active or not, so a run can be repeated and
 * never brings back a vaccine someone removed.
 */
export function planVaccineCatalog(
  vaccineMedications: Medication[],
  quickPicks: ImmunizationQuickPickData[]
): VaccineCatalogPlan {
  const byCvx = new Map<string, PlannedCatalogVaccine>();
  const planned = (cvx: string): PlannedCatalogVaccine => {
    const entry = byCvx.get(cvx) ?? {
      cvx,
      vaccineName: getCvxVaccine(cvx)?.name ?? cvx,
      configNames: [],
      quickPickNames: [],
    };
    byCvx.set(cvx, entry);
    return entry;
  };

  const unknownConfigVaccines: string[] = [];
  for (const medication of vaccineMedications) {
    if (getMedicationCvx(medication)) continue;
    const configName = getMedicationName(medication);
    if (!configName) continue;
    const cvx = getCvxVaccine(CONFIG_VACCINE_MAPPINGS.find((mapping) => mapping.configName === configName)?.cvx)?.cvx;
    if (!cvx) {
      unknownConfigVaccines.push(configName);
      continue;
    }
    planned(cvx).configNames.push(configName);
  }

  const unknownQuickPicks: string[] = [];
  for (const quickPick of quickPicks) {
    if (!quickPick.vaccine) continue;
    const cvx = getCvxVaccine(quickPick.vaccine.id)?.cvx;
    if (!cvx) {
      unknownQuickPicks.push(quickPick.name);
      continue;
    }
    planned(cvx).quickPickNames.push(quickPick.name);
  }

  const activeCvx = new Set<string>();
  const inactiveCvx = new Set<string>();
  for (const medication of vaccineMedications) {
    const cvx = getMedicationCvx(medication);
    if (cvx) (medication.status === 'active' ? activeCvx : inactiveCvx).add(cvx);
  }
  const entries = [...byCvx.values()].sort((a, b) => a.vaccineName.localeCompare(b.vaccineName));
  return {
    toAdd: entries.filter((entry) => !activeCvx.has(entry.cvx) && !inactiveCvx.has(entry.cvx)),
    alreadyActive: entries.filter((entry) => activeCvx.has(entry.cvx)),
    removed: entries.filter((entry) => !activeCvx.has(entry.cvx) && inactiveCvx.has(entry.cvx)),
    unknownConfigVaccines,
    unknownQuickPicks,
  };
}

export interface VaccineCatalogMigrationStats {
  /** Retired config vaccines found in the project. */
  configVaccines: number;
  /** Immunization quick picks found in the project. */
  quickPicks: number;
  added: number;
  alreadyActive: number;
  /** In the catalog but inactive, and left that way. */
  removed: number;
  /** Config vaccines and quick picks that could not be matched to a list vaccine. */
  unknown: number;
  failed: number;
}

export async function migrateVaccineCatalog(oystehr: Oystehr, dryRun: boolean): Promise<VaccineCatalogMigrationStats> {
  const vaccineMedications = await getAllFhirSearchPages<Medication>(
    {
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: `${MEDICATION_TYPE_SYSTEM}|${INVENTORY_VACCINE_TYPE_CODE}` }],
    },
    oystehr
  );
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

  const plan = planVaccineCatalog(vaccineMedications, quickPicks);
  const stats: VaccineCatalogMigrationStats = {
    configVaccines: vaccineMedications.filter((medication) => !getMedicationCvx(medication)).length,
    quickPicks: quickPicks.length,
    added: 0,
    alreadyActive: plan.alreadyActive.length,
    removed: plan.removed.length,
    unknown: plan.unknownConfigVaccines.length + plan.unknownQuickPicks.length,
    failed: 0,
  };
  const label = (entry: PlannedCatalogVaccine): string => {
    const reasons = [
      entry.configNames.length ? `for ${entry.configNames.join(', ')}` : undefined,
      entry.quickPickNames.length
        ? `quick pick${entry.quickPickNames.length > 1 ? 's' : ''} ${entry.quickPickNames
            .map((name) => `"${name}"`)
            .join(', ')}`
        : undefined,
    ].filter(Boolean);
    return `${entry.vaccineName} (CVX ${entry.cvx}) ${reasons.join('; ')}`;
  };

  for (const entry of plan.alreadyActive) console.log(`  = already in the catalog: ${label(entry)}`);
  for (const entry of plan.removed) console.log(`  - removed from the catalog before, left removed: ${label(entry)}`);
  for (const configName of plan.unknownConfigVaccines) {
    console.log(`  ? config vaccine "${configName}" is not in the mapping table, left alone`);
  }
  for (const quickPickName of plan.unknownQuickPicks) {
    console.log(
      `  ? quick pick "${quickPickName}" was saved before the vaccine list, left alone ` +
        `(delete-immunization-quick-picks deletes these)`
    );
  }
  for (const entry of plan.toAdd) {
    if (dryRun) {
      console.log(`  + would add ${label(entry)}`);
      stats.added += 1;
      continue;
    }
    try {
      const medication = await createVaccine(oystehr, entry.cvx);
      console.log(`  ✓ Medication/${medication.id}: ${label(entry)}`);
      stats.added += 1;
    } catch (error) {
      console.error(`  ✗ failed to add ${label(entry)}:`, error);
      stats.failed += 1;
    }
  }
  return stats;
}
