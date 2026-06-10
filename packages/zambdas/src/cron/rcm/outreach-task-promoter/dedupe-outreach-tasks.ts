import { Task } from 'fhir/r4b';
import {
  getOutreachTaskIdentity,
  outreachIdentityKey,
} from '../../../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';

const LOG_PREFIX = 'cron-outreach-task-promoter';

export interface DedupeResult {
  tasksToProcess: Task[];
  tasksToCancel: { task: Task; reason: string }[];
}

/**
 * Build the logical identity key for an outreach task: focus + trigger-event + action-id
 * (+ birthday-year when present). Two tasks with the same key are duplicates of the same
 * scheduled event. Returns undefined when the key cannot be derived (task is then treated
 * as unique to avoid accidentally collapsing unrelated tasks). Delegates to the shared
 * outreach-identity definition so producer and promoter cannot drift apart.
 */
function getDedupKey(task: Task): string | undefined {
  const identity = getOutreachTaskIdentity(task);
  return identity ? outreachIdentityKey(identity) : undefined;
}

/**
 * Group due outreach tasks by logical identity and pick a single survivor per group.
 *
 * - Unique tasks (or tasks without a derivable key) pass through untouched.
 * - When a duplicate group contains a task already promoted to 'requested', that task is
 *   left alone (it may have already fired) and only the redundant drafts are cancelled.
 * - When a group is all drafts, the earliest-authored draft survives and the rest are cancelled.
 */
export function dedupeOutreachTasks(tasks: Task[]): DedupeResult {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = getDedupKey(task) ?? `__unkeyed__${task.id}`;
    const arr = groups.get(key) ?? [];
    arr.push(task);
    groups.set(key, arr);
  }

  const tasksToProcess: Task[] = [];
  const tasksToCancel: { task: Task; reason: string }[] = [];

  for (const [key, group] of groups) {
    if (group.length === 1) {
      tasksToProcess.push(group[0]);
      continue;
    }

    const requested = group.filter((t) => t.status === 'requested');
    const drafts = group.filter((t) => t.status === 'draft');

    if (requested.length > 0) {
      // A duplicate already advanced to 'requested' (and may have fired). Keep it and
      // cancel only the redundant drafts so they never get promoted.
      for (const d of drafts) {
        tasksToCancel.push({
          task: d,
          reason: `Duplicate of already-promoted outreach task (dedup key: ${key})`,
        });
      }
      if (requested.length > 1) {
        console.warn(
          `${LOG_PREFIX}: ${requested.length} duplicate 'requested' tasks for key ${key}; leaving all to avoid cancelling in-flight work`
        );
      }
      // Already-requested tasks are past the promotion stage; do not re-process.
      continue;
    }

    // All drafts: keep the earliest-authored, cancel the rest.
    const sorted = [...drafts].sort(
      (a, b) => (a.authoredOn ?? '').localeCompare(b.authoredOn ?? '') || (a.id ?? '').localeCompare(b.id ?? '')
    );
    const [first, ...rest] = sorted;
    tasksToProcess.push(first);
    for (const duplicate of rest) {
      tasksToCancel.push({
        task: duplicate,
        reason: `Duplicate outreach task; superseded by Task/${first.id} (dedup key: ${key})`,
      });
    }
  }

  return { tasksToProcess, tasksToCancel };
}
