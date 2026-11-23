import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../ehr/shared/quick-pick-categories';
import { QUICK_PICK_TAG_SYSTEM } from '../ehr/shared/quick-pick-helpers';

export interface ImmunizationQuickPickDeletionStats {
  /** Immunization quick picks found, removed ones included. */
  quickPicks: number;
  deleted: number;
  failed: number;
}

/**
 * Deletes every immunization quick pick, the ones already removed in the app (status retired) included. Quick
 * picks of the other categories are not read. Nothing refers to a quick pick by id: applying one copies its
 * values into the order.
 */
export async function deleteImmunizationQuickPicks(
  oystehr: Oystehr,
  dryRun: boolean
): Promise<ImmunizationQuickPickDeletionStats> {
  const activityDefinitions = await getAllFhirSearchPages<ActivityDefinition>(
    {
      resourceType: 'ActivityDefinition',
      params: [{ name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${IMMUNIZATION_QUICK_PICK_CATEGORY.tagCode}` }],
    },
    oystehr
  );
  const stats: ImmunizationQuickPickDeletionStats = { quickPicks: activityDefinitions.length, deleted: 0, failed: 0 };

  for (const activityDefinition of activityDefinitions) {
    const label = `quick pick "${activityDefinition.title ?? ''}" (ActivityDefinition/${activityDefinition.id}, ${
      activityDefinition.status
    })`;
    if (!activityDefinition.id) {
      console.error(`  ✗ no id on ${label}`);
      stats.failed += 1;
      continue;
    }
    if (dryRun) {
      console.log(`  - would delete ${label}`);
      stats.deleted += 1;
      continue;
    }
    try {
      await oystehr.fhir.delete({ resourceType: 'ActivityDefinition', id: activityDefinition.id });
      console.log(`  ✓ deleted ${label}`);
      stats.deleted += 1;
    } catch (error) {
      console.error(`  ✗ failed to delete ${label}:`, error);
      stats.failed += 1;
    }
  }
  return stats;
}
