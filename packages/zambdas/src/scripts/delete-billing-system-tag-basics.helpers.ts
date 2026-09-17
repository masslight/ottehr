import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { isSystemManagedTagName, SYSTEM_MANAGED_TAGS } from 'utils/lib/types/data/billing/system-tags';
import { searchTagBasics } from '../billing/shared';

const DELETE_CHUNK_SIZE = 100;

export interface TagBasicRef {
  id: string;
  name: string;
}

export interface SystemTagBasicCleanupPlan {
  // Stored definitions of a system-managed tag. All of these are deleted: system tags are reported
  // from SYSTEM_MANAGED_TAGS, so a stored one is a leftover that only ever shows up as a duplicate.
  deletions: TagBasicRef[];
  // Deletion count per system-managed name, so a run reports the damage it is undoing.
  deletionsByName: Map<string, number>;
  // Definitions whose name merely resembles a system-managed one (e.g. a pre-rename
  // "auto-accident"). These are ordinary editable tags now and may be in use, so they are only
  // reported — deciding their fate is a human call.
  nearMisses: TagBasicRef[];
  // User tags stored more than once. Reported, never deleted: unlike system tags these are the only
  // record the tag exists, and picking a survivor is not this script's business.
  userDuplicates: { name: string; ids: string[] }[];
  userTagCount: number;
}

// Loose enough to catch a rename that changed separators, which exact or case-insensitive matching
// misses: "auto-accident" and "Auto Accident" both reduce to "autoaccident".
function normalizeForNearMiss(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const SYSTEM_TAG_NORMALIZED_NAMES = new Set(SYSTEM_MANAGED_TAGS.map((def) => normalizeForNearMiss(def.name)));

export function planSystemTagBasicCleanup(basics: Basic[]): SystemTagBasicCleanupPlan {
  const deletions: TagBasicRef[] = [];
  const deletionsByName = new Map<string, number>();
  const nearMisses: TagBasicRef[] = [];
  const userIdsByName = new Map<string, string[]>();

  for (const basic of basics) {
    const name = basic.code?.text;
    // A definition with no id can't be addressed for deletion, and one with no name can't be
    // classified; neither is something this script should guess at.
    if (!name || !basic.id) continue;
    const ref: TagBasicRef = {
      id: basic.id,
      name,
    };

    if (isSystemManagedTagName(name)) {
      deletions.push(ref);
      deletionsByName.set(name, (deletionsByName.get(name) ?? 0) + 1);
      continue;
    }
    if (SYSTEM_TAG_NORMALIZED_NAMES.has(normalizeForNearMiss(name))) {
      nearMisses.push(ref);
      continue;
    }
    userIdsByName.set(name, [...(userIdsByName.get(name) ?? []), basic.id]);
  }

  const userDuplicates = [...userIdsByName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, ids]) => ({
      name,
      ids,
    }));

  return {
    deletions,
    deletionsByName,
    nearMisses,
    userDuplicates,
    userTagCount: userIdsByName.size,
  };
}

export function describeSystemTagBasicCleanupPlan(plan: SystemTagBasicCleanupPlan): string {
  const lines: string[] = [];

  if (plan.deletions.length === 0) {
    lines.push('No stored system-managed tag definitions found — already at baseline.');
  } else {
    lines.push(`Deleting ${plan.deletions.length} stored system-managed tag definition(s):`);
    for (const def of SYSTEM_MANAGED_TAGS) {
      const count = plan.deletionsByName.get(def.name) ?? 0;
      lines.push(`  ${def.name}: ${count}${count > 1 ? ` (${count - 1} duplicate(s))` : ''}`);
    }
  }

  lines.push(`Leaving ${plan.userTagCount} user-created tag(s) untouched.`);

  if (plan.nearMisses.length > 0) {
    lines.push(`Review manually — ${plan.nearMisses.length} definition(s) resembling a system-managed name:`);
    plan.nearMisses.forEach((ref) => lines.push(`  Basic/${ref.id} "${ref.name}"`));
  }
  if (plan.userDuplicates.length > 0) {
    lines.push(`Review manually — ${plan.userDuplicates.length} user tag(s) stored more than once:`);
    plan.userDuplicates.forEach((dup) => lines.push(`  "${dup.name}": ${dup.ids.join(', ')}`));
  }

  return lines.join('\n');
}

export async function deleteTagBasics(oystehr: Oystehr, refs: TagBasicRef[]): Promise<number> {
  let deleted = 0;
  const chunks = chunkThings(refs, DELETE_CHUNK_SIZE);

  for (const [index, chunk] of chunks.entries()) {
    const requests: BatchInputDeleteRequest[] = chunk.map((ref) => ({
      method: 'DELETE',
      url: `Basic/${ref.id}`,
    }));
    try {
      await oystehr.fhir.transaction({ requests });
      deleted += chunk.length;
      console.log(`  deleted chunk ${index + 1} of ${chunks.length} (${chunk.length} definitions)`);
    } catch (error) {
      console.error(`  FAILED chunk ${index + 1} of ${chunks.length}:`, error);
    }
  }

  return deleted;
}

export async function planSystemTagBasicCleanupFor(oystehr: Oystehr): Promise<SystemTagBasicCleanupPlan> {
  return planSystemTagBasicCleanup(await searchTagBasics(oystehr));
}
