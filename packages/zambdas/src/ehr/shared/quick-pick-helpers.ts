import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';

export const QUICK_PICK_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/quick-pick-category';
export const QUICK_PICK_CONFIG_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/quick-pick-config';

/**
 * Configuration for a quick pick category. Each category uses the same
 * ActivityDefinition resource pattern but with a different tag code and
 * a different function for extracting the display name from the data.
 */
export interface QuickPickCategory<T extends { id?: string }> {
  tagCode: string;
  /** The key in T that holds the display name (e.g. 'name' or 'display'), stripped from config extension to avoid redundancy with title */
  displayNameKey: string;
  /** Extract the human-readable name from a quick pick data object */
  getDisplayName: (data: Omit<T, 'id'>) => string;
  /** Build a quick pick data object from ActivityDefinition fields + parsed config */
  fromParsed: (id: string | undefined, title: string, config: Record<string, unknown>) => T;
}

export function activityDefinitionToQuickPick<T extends { id?: string }>(
  ad: ActivityDefinition,
  category: QuickPickCategory<T>
): T {
  const configExtension = ad.extension?.find((ext) => ext.url === QUICK_PICK_CONFIG_EXTENSION_URL);
  const configString = configExtension?.valueString ?? '{}';
  const config = JSON.parse(configString) as Record<string, unknown>;
  return category.fromParsed(ad.id, ad.title ?? ad.name ?? '', config);
}

export function quickPickToActivityDefinition<T extends { id?: string }>(
  quickPick: Omit<T, 'id'>,
  category: QuickPickCategory<T>,
  existingId?: string
): ActivityDefinition {
  const displayName = category.getDisplayName(quickPick);
  // Strip id and the display-name field before serializing config (title already stores the display name)
  const { id: _id, [category.displayNameKey]: _displayName, ...configData } = quickPick as Record<string, unknown>;

  const ad: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    status: 'active',
    name: displayName.replace(/[^a-zA-Z0-9]/g, '_'),
    title: displayName,
    meta: {
      tag: [
        {
          system: QUICK_PICK_TAG_SYSTEM,
          code: category.tagCode,
        },
      ],
    },
    extension: [
      {
        url: QUICK_PICK_CONFIG_EXTENSION_URL,
        valueString: JSON.stringify(configData),
      },
    ],
  };

  if (existingId) {
    ad.id = existingId;
  }

  return ad;
}

export async function searchQuickPicks<T extends { id?: string }>(
  oystehr: Oystehr,
  category: QuickPickCategory<T>
): Promise<T[]> {
  const activityDefinitions = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${category.tagCode}` },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();

  return activityDefinitions.map((ad) => activityDefinitionToQuickPick(ad, category));
}

export async function createQuickPick<T extends { id?: string }>(
  oystehr: Oystehr,
  quickPick: Omit<T, 'id'>,
  category: QuickPickCategory<T>
): Promise<T> {
  const ad = quickPickToActivityDefinition(quickPick, category);
  const created = (await oystehr.fhir.create(ad)) as ActivityDefinition;
  return activityDefinitionToQuickPick(created, category);
}

export async function updateQuickPick<T extends { id?: string }>(
  oystehr: Oystehr,
  quickPickId: string,
  quickPick: Omit<T, 'id'>,
  category: QuickPickCategory<T>
): Promise<T> {
  const ad = quickPickToActivityDefinition(quickPick, category, quickPickId);
  const updated = (await oystehr.fhir.update(ad)) as ActivityDefinition;
  return activityDefinitionToQuickPick(updated, category);
}

export async function removeQuickPick(oystehr: Oystehr, quickPickId: string): Promise<void> {
  let existing: ActivityDefinition;
  try {
    existing = await oystehr.fhir.get<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: quickPickId,
    });
  } catch {
    throw new Error(`ActivityDefinition with id ${quickPickId} not found`);
  }
  const hasQuickPickTag = existing.meta?.tag?.some((t) => t.system === QUICK_PICK_TAG_SYSTEM);
  if (!hasQuickPickTag) {
    throw new Error(`ActivityDefinition ${quickPickId} is not a quick pick resource`);
  }
  existing.status = 'retired';
  await oystehr.fhir.update(existing);
}
