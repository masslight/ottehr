/**
 * Read-only diagnostic: inspect the actual invoice-due outreach Tasks for one Encounter (focus)
 * to find out WHY the daily cron regenerates tasks that should have been deduplicated — even
 * completed ones.
 *
 * It dumps the dedup-relevant fields of every matching Task and then replays the producer's own
 * dedup query so you can see, empirically, what differs between the supposed "duplicates":
 *   - action-id tag (if these differ across runs, action.id is unstable → the real culprit)
 *   - focus.reference  (if these differ, the focus is not stable across runs)
 *   - the outreach-task|<trigger> tag (if missing/wrong, the dedup search can't find the task)
 *   - status (completed/failed are SUPPOSED to suppress re-creation; cancelled is not)
 *
 * The script prompts for the access token (masked), project id, and the Encounter id directly in
 * your terminal, so the token never passes through chat or the command line. You may pre-set them
 * via env vars to skip the prompts:
 *
 *   OYSTEHR_TOKEN, OYSTEHR_PROJECT_ID, OUTREACH_ENCOUNTER_ID
 *   OYSTEHR_FHIR_API_URL  (optional, defaults to https://fhir-api.zapehr.com)
 *
 * Run (from packages/zambdas):  npm run probe-outreach-tasks
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';

// Tee everything printed by this probe into a tmp file so it can be captured and shared after a run.
// The token is never printed (it is read via a masked prompt), so the dump is safe to hand off.
const OUTPUT_FILE = path.resolve(process.cwd(), 'tmp', 'probe-outreach-tasks-output.txt');
const OUTPUT_LINES: string[] = [];
const originalLog = console.log.bind(console);
const originalErr = console.error.bind(console);
console.log = (...args: unknown[]): void => {
  OUTPUT_LINES.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  originalLog(...args);
};
console.error = (...args: unknown[]): void => {
  OUTPUT_LINES.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  originalErr(...args);
};
function flushOutputFile(): void {
  try {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, OUTPUT_LINES.join('\n') + '\n', 'utf8');
    originalLog(`\nWrote probe output to ${OUTPUT_FILE}`);
  } catch (writeErr) {
    originalErr('Failed to write probe output file:', writeErr);
  }
}

// These MUST mirror the producer (produce-outreach-tasks.ts) exactly, or the probe would not be
// reproducing the real dedup behaviour.
const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const OUTREACH_ACTION_ID_TAG_SYSTEM = `${OUTREACH_TASK_TAG_SYSTEM}/action-id`;
const OUTREACH_BIRTHDAY_YEAR_TAG_SYSTEM = `${OUTREACH_TASK_TAG_SYSTEM}/birthday-year`;
const OUTREACH_ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';
const OUTREACH_TASK_DEDUP_STATUSES = 'draft,requested,in-progress,completed,failed';
const TRIGGER_EVENT = 'invoice-due';

/** Prompt for a value on the terminal. When `hidden` is true the typed characters are masked. */
function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void };
    rlAny._writeToOutput = (stringToWrite: string) => {
      if (stringToWrite.includes(question)) {
        process.stdout.write(question);
      }
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (hidden) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Use an env var if present, otherwise prompt interactively. */
async function resolveValue(
  envName: string,
  question: string,
  { hidden = false, required = true } = {}
): Promise<string> {
  const fromEnv = process.env[envName];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const answer = await prompt(question, hidden);
  if (required && !answer) {
    throw new Error(`A value is required for ${envName}`);
  }
  return answer;
}

function tagCode(task: Task, system: string): string | undefined {
  return task.meta?.tag?.find((t) => t.system === system)?.code;
}

interface TaskView {
  id: string;
  status: string;
  actionType: string | undefined;
  focus: string;
  triggerTag: string | undefined;
  actionIdTag: string | undefined;
  birthdayYearTag: string | undefined;
  authoredOn: string | undefined;
  executionStart: string | undefined;
  basedOn: string | undefined;
}

function viewTask(task: Task): TaskView {
  return {
    id: task.id ?? '<no id>',
    status: task.status ?? '<no status>',
    actionType: task.code?.coding?.find((c) => c.system === OUTREACH_ACTION_TYPE_SYSTEM)?.code,
    focus: task.focus?.reference ?? '<no focus>',
    triggerTag: tagCode(task, OUTREACH_TASK_TAG_SYSTEM),
    actionIdTag: tagCode(task, OUTREACH_ACTION_ID_TAG_SYSTEM),
    birthdayYearTag: tagCode(task, OUTREACH_BIRTHDAY_YEAR_TAG_SYSTEM),
    authoredOn: task.authoredOn,
    executionStart: task.executionPeriod?.start,
    basedOn: task.basedOn?.find((b) => b.reference?.startsWith('PlanDefinition/'))?.reference,
  };
}

function printTask(v: TaskView): void {
  console.log(
    `   Task/${v.id}  status=${v.status}  actionType=${v.actionType ?? '<MISSING>'}\n` +
      `        focus=${v.focus}\n` +
      `        trigger-tag=${v.triggerTag ?? '<MISSING>'}  action-id-tag=${v.actionIdTag ?? '<MISSING>'}` +
      `${v.birthdayYearTag ? `  birthday-year=${v.birthdayYearTag}` : ''}\n` +
      `        authoredOn=${v.authoredOn ?? '?'}  executionStart=${v.executionStart ?? '?'}  basedOn=${
        v.basedOn ?? '?'
      }`
  );
}

async function main(): Promise<void> {
  const accessToken = await resolveValue('OYSTEHR_TOKEN', 'Access token (input hidden): ', { hidden: true });
  const projectId = await resolveValue('OYSTEHR_PROJECT_ID', 'Project ID (blank for an M2M token): ', {
    required: false,
  });
  const encounterId = await resolveValue(
    'OUTREACH_ENCOUNTER_ID',
    'Encounter ID (the task focus; blank = all invoice-due tasks): ',
    { required: false }
  );
  const sinceInput = await resolveValue(
    'OUTREACH_SINCE',
    'Only flag duplicates authored on/after this ISO date (e.g. 2026-06-18; blank = all time): ',
    { required: false }
  );
  const since = sinceInput ? DateTime.fromISO(sinceInput) : undefined;
  if (sinceInput && !since?.isValid) {
    throw new Error(`OUTREACH_SINCE is not a valid ISO date: ${sinceInput}`);
  }
  const fhirApiUrl = process.env.OYSTEHR_FHIR_API_URL || 'https://fhir-api.zapehr.com';

  const oystehr = new Oystehr({
    accessToken,
    ...(projectId ? { projectId } : {}),
    services: { fhirApiUrl },
  });

  const focusRef = encounterId ? `Encounter/${encounterId}` : undefined;

  // ── Search A: EVERY invoice-due task for this focus, ALL statuses (incl. cancelled). ──────────
  const allParams: { name: string; value: string }[] = [
    { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|${TRIGGER_EVENT}` },
    { name: '_count', value: '1000' },
  ];
  if (focusRef) allParams.push({ name: 'focus', value: focusRef });
  const allBundle = await oystehr.fhir.search<Task>({ resourceType: 'Task', params: allParams });
  const allTasks = allBundle.unbundle();

  console.log(`\n════════ ALL invoice-due tasks${focusRef ? ` for ${focusRef}` : ''} (any status) ════════`);
  if (since) console.log(`(duplicate analysis only flags tasks authored on/after ${since.toISODate()})`);
  if (allTasks.length >= 1000) {
    console.log('WARNING: hit the 1000-task page cap — re-run scoped to a single Encounter for a complete view.');
  }
  console.log(`Found ${allTasks.length} task(s).\n`);
  const views = allTasks.map(viewTask);
  for (const v of views) printTask(v);

  // ── Search B: replay the producer's exact dedup query (focus + trigger tag + dedup statuses). ─
  // This is what findExistingOutreachTasks runs. If a prior completed task exists but does NOT
  // come back here, the dedup query is the problem (focus/tag/status mismatch or indexing).
  if (focusRef) {
    const dedupBundle = await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'focus', value: focusRef },
        { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|${TRIGGER_EVENT}` },
        { name: 'status', value: OUTREACH_TASK_DEDUP_STATUSES },
      ],
    });
    const dedupTasks = dedupBundle.unbundle();
    console.log(`\n════════ producer dedup query result (findExistingOutreachTasks) ════════`);
    console.log(
      `focus=${focusRef} & _tag=${OUTREACH_TASK_TAG_SYSTEM}|${TRIGGER_EVENT} & status=${OUTREACH_TASK_DEDUP_STATUSES}`
    );
    console.log(`Returned ${dedupTasks.length} task(s); their extracted action-id tags become the dedup set:`);
    const dedupActionIds = new Set(dedupTasks.map((t) => tagCode(t, OUTREACH_ACTION_ID_TAG_SYSTEM)).filter(Boolean));
    console.log(`   dedup action-id set: { ${[...dedupActionIds].join(', ') || '∅'} }`);
    const cancelledExcluded = allTasks.filter((t) => t.status === 'cancelled');
    if (cancelledExcluded.length > 0) {
      console.log(
        `   NOTE: ${cancelledExcluded.length} cancelled task(s) are NOT in this set (cancelled is excluded).`
      );
    }
  }

  // ── Grouping: bucket by (focus, action-id tag). >1 task in a bucket = the daily duplicates. ──
  console.log(`\n════════ duplicate analysis — grouped by (focus, action-id tag) ════════\n`);
  const groups = new Map<string, TaskView[]>();
  for (const v of views) {
    const key = `${v.focus} :: ${v.actionIdTag ?? '<MISSING>'}`;
    const arr = groups.get(key) ?? [];
    arr.push(v);
    groups.set(key, arr);
  }

  let anyDuplicateBucket = false;
  let anyMissingActionTag = false;
  let anyPostSinceDuplicate = false;
  for (const [key, arr] of groups) {
    if (arr[0].actionIdTag === undefined) anyMissingActionTag = true;
    if (arr.length > 1) {
      anyDuplicateBucket = true;
      // Sort by authoredOn so the regeneration cadence (e.g. one new task per day) is visible.
      const sorted = [...arr].sort((a, b) => (a.authoredOn ?? '').localeCompare(b.authoredOn ?? ''));
      const timeline = sorted.map((a) => `${(a.authoredOn ?? '?').slice(0, 10)}:${a.status}`).join('  ');
      // How many of these duplicates were authored on/after the deploy cutoff?
      const postSince = since ? sorted.filter((a) => a.authoredOn && DateTime.fromISO(a.authoredOn) >= since) : sorted;
      const isPostSinceDup = postSince.length > 1;
      if (isPostSinceDup) anyPostSinceDuplicate = true;
      // When a `since` cutoff is given, only shout about buckets that still duplicate AFTER it;
      // pre-cutoff piles are historical residue from before the fix was deployed.
      if (!since || isPostSinceDup) {
        console.log(`● ${arr.length}× tasks share the SAME (focus, action-id) → ${key}`);
        console.log(`    actionType=${arr[0].actionType ?? '<MISSING>'}`);
        console.log(`    timeline (authoredOn:status): ${timeline}`);
        if (since) {
          console.log(
            `    authored on/after ${since.toISODate()}: ${postSince.length}` +
              `${isPostSinceDup ? '  ← STILL DUPLICATING POST-DEPLOY' : ''}`
          );
        }
        console.log('');
      }
    }
  }

  // Distinct action-id tags seen per focus — if a single focus has MANY distinct action-id tags
  // for what should be one logical action, that points to action.id instability across runs.
  const actionIdsByFocus = new Map<string, Set<string>>();
  for (const v of views) {
    const s = actionIdsByFocus.get(v.focus) ?? new Set<string>();
    if (v.actionIdTag) s.add(v.actionIdTag);
    actionIdsByFocus.set(v.focus, s);
  }

  // ── Rollup by action TYPE: charge-card failures (expected) must be told apart from
  //    send-notification duplicates (the real concern). ──
  console.log('════════ rollup by action type ════════');
  const byType = new Map<string, TaskView[]>();
  for (const v of views) {
    const t = v.actionType ?? '<MISSING>';
    const arr = byType.get(t) ?? [];
    arr.push(v);
    byType.set(t, arr);
  }
  for (const [type, arr] of byType) {
    const statusCounts = new Map<string, number>();
    for (const v of arr) statusCounts.set(v.status, (statusCounts.get(v.status) ?? 0) + 1);
    const statusStr = [...statusCounts].map(([s, n]) => `${s}=${n}`).join(', ');
    const distinctActionIds = new Set(arr.map((v) => v.actionIdTag ?? '<MISSING>'));
    console.log(`  ${type}: ${arr.length} task(s)  [${statusStr}]  distinct action-ids=${distinctActionIds.size}`);
  }
  console.log('');

  console.log('════════ summary ════════');
  console.log(`tasks inspected:                         ${views.length}`);
  console.log(`buckets with duplicate (focus,action-id): ${anyDuplicateBucket ? 'YES' : 'no'}`);
  if (since) {
    console.log(
      `buckets STILL duplicating on/after ${since.toISODate()}: ${anyPostSinceDuplicate ? 'YES' : 'no'}` +
        `${anyPostSinceDuplicate ? '' : '  (pre-cutoff piles are historical residue)'}`
    );
  }
  console.log(`any task missing the action-id tag:       ${anyMissingActionTag ? 'YES' : 'no'}`);
  for (const [focus, ids] of actionIdsByFocus) {
    console.log(`distinct action-id tags for ${focus}: ${ids.size}  { ${[...ids].join(', ') || '∅'} }`);
  }
  console.log(
    '\nReading the result:\n' +
      '  • Duplicates share the SAME action-id tag  → dedup search/conditional-create is not matching\n' +
      '    (focus format, trigger tag, status filter, or _tag indexing). Look at the per-task dump.\n' +
      '  • A single focus has MANY distinct action-id tags for one logical action → action.id is\n' +
      '    unstable across cron runs (the parse fallback minted new ids).\n' +
      '  • Duplicates are all status=cancelled → the cancelled-exclusion path (separate issue).'
  );

  flushOutputFile();
}

main().catch((err) => {
  console.error('Probe failed:', err);
  flushOutputFile();
  process.exit(1);
});
