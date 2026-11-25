import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { findCvxVaccine } from 'utils/lib/types/data/immunization/cvx-vaccine-lookup';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../ehr/shared/quick-pick-categories';
import { activityDefinitionToQuickPick, QUICK_PICK_TAG_SYSTEM } from '../ehr/shared/quick-pick-helpers';

export interface ImmunizationQuickPickDeletion {
  found: number;
  kept: number;
  unreadable: number;
  deleted: number;
  failed: number;
}

export async function deleteImmunizationQuickPicks(
  oystehr: Oystehr,
  dryRun: boolean
): Promise<ImmunizationQuickPickDeletion> {
  const quickPicks = await getAllFhirSearchPages<ActivityDefinition>(
    {
      resourceType: 'ActivityDefinition',
      params: [{ name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${IMMUNIZATION_QUICK_PICK_CATEGORY.tagCode}` }],
    },
    oystehr
  );
  const result: ImmunizationQuickPickDeletion = {
    found: quickPicks.length,
    kept: 0,
    unreadable: 0,
    deleted: 0,
    failed: 0,
  };
  for (const quickPick of quickPicks) {
    let vaccine: ImmunizationQuickPickData['vaccine'];
    try {
      ({ vaccine } = activityDefinitionToQuickPick(quickPick, IMMUNIZATION_QUICK_PICK_CATEGORY));
    } catch (error) {
      result.unreadable += 1;
      console.error(`unreadable quick pick ActivityDefinition/${quickPick.id}`, error);
      continue;
    }
    const label = `"${quickPick.title}" (ActivityDefinition/${quickPick.id}, ${quickPick.status}, vaccine ${
      vaccine?.id ?? 'none'
    })`;
    if (!vaccine?.id || findCvxVaccine(vaccine.id)) {
      result.kept += 1;
      console.log(`keeping ${label}`);
      continue;
    }
    if (dryRun) {
      console.log(`would delete ${label}`);
      continue;
    }
    try {
      await oystehr.fhir.delete({ resourceType: 'ActivityDefinition', id: quickPick.id! });
      result.deleted += 1;
      console.log(`deleted ${label}`);
    } catch (error) {
      result.failed += 1;
      console.error(`failed to delete ${label}`, error);
    }
  }
  return result;
}
