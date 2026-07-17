/**
 * Read-only diagnostic: explain the "retries left" number shown in the outreach report for
 * charge-card actions, by dumping BOTH halves of the calculation straight from FHIR:
 *
 *   1. The configured actions — for every charge-card action in the scheduled-outreach config
 *      PlanDefinition, the stored `retryAttempts` (what you typed in the UI).
 *   2. The live tasks — for every charge-card Task, the `charge-card-config.retryAttempts` baked
 *      into the task, the recorded `attempt-count` output, and the EXACT numbers the report
 *      renders ("Attempts X / maxAttempts" and "Remaining").
 *
 * Why this exists: the report's "Remaining" counts TOTAL ATTEMPTS, not retries.
 *   maxAttempts = retryAttempts + 1   (the initial charge + the configured retries)
 *   Remaining   = maxAttempts - attemptCount
 * So 4 configured retries shows "Remaining: 5" before the first charge (1 initial + 4 retries).
 * This probe prints the configured retries, the report's number, and the TRUE retries remaining
 * side by side so the discrepancy is unambiguous.
 *
 * The script prompts for the access token (masked), project id, and (optional) Encounter id
 * directly in your terminal, so the token never passes through chat or the command line. You may
 * pre-set them via env vars to skip the prompts:
 *
 *   OYSTEHR_TOKEN, OYSTEHR_PROJECT_ID, OUTREACH_ENCOUNTER_ID
 *   OYSTEHR_FHIR_API_URL  (optional, defaults to https://fhir-api.zapehr.com)
 *
 * Run (from packages/zambdas):  npm run probe-outreach-retries
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import Oystehr from '@oystehr/sdk';
import { PlanDefinition, Task } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';

// Tee everything printed by this probe into a tmp file so it can be captured and shared after a run.
// The token is never printed (it is read via a masked prompt), so the dump is safe to hand off.
const OUTPUT_FILE = path.resolve(process.cwd(), 'tmp', 'probe-outreach-retries-output.txt');
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

// These MUST mirror the producer/report code exactly so the probe reproduces the real numbers.
const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;
const ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';
const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const OUTREACH_ACTION_ID_TAG_SYSTEM = `${OUTREACH_TASK_TAG_SYSTEM}/action-id`;

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

function actionTypeOf(task: Task): string | undefined {
  return task.code?.coding?.find((c) => c.system === ACTION_TYPE_SYSTEM)?.code ?? task.code?.coding?.[0]?.code;
}

// ── Dump the CONFIGURED charge-card actions from the PlanDefinition. ──────────────────────────
async function dumpConfiguredActions(oystehr: Oystehr): Promise<void> {
  console.log('\n════════ configured charge-card actions (PlanDefinition) ════════');
  const bundle = await oystehr.fhir.search<PlanDefinition>({
    resourceType: 'PlanDefinition',
    params: [
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|scheduled-outreach-config` },
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|rcm` },
    ],
  });
  const planDefs = bundle.unbundle();
  if (planDefs.length === 0) {
    console.log('No scheduled-outreach config PlanDefinition found via tag search.');
    return;
  }
  for (const pd of planDefs) {
    console.log(`PlanDefinition/${pd.id}  (version ${pd.meta?.versionId ?? '?'})`);
    const actions = pd.action ?? [];
    let chargeCount = 0;
    for (const action of actions) {
      const code = (action as any).code?.[0]?.coding?.[0]?.code;
      if (code !== 'charge-card') continue;
      chargeCount++;
      // retryAttempts is serialized to timingTiming.repeat.count (helpers.ts buildChargeCardFhirAction).
      const repeat = (action as any).timingTiming?.repeat;
      const retryAttempts = repeat?.count ?? 0;
      const retryIntervalDays = repeat?.period ?? 0;
      const trigger = (action as any).trigger?.[0]?.name ?? '?';
      console.log(
        `   action.id=${(action as any).id ?? '<MISSING>'}  trigger=${trigger}\n` +
          `        configured retryAttempts=${retryAttempts}  retryIntervalDays=${retryIntervalDays}\n` +
          `        → report maxAttempts = retryAttempts + 1 = ${retryAttempts + 1}` +
          `   (1 initial charge + ${retryAttempts} retries)`
      );
    }
    if (chargeCount === 0) console.log('   (no charge-card actions configured)');
  }
}

interface RetryView {
  id: string;
  status: string;
  focus: string;
  actionIdTag: string | undefined;
  configuredRetryAttempts: number | undefined;
  attemptCount: number;
  reportMaxAttempts: number;
  reportRemaining: number;
  trueRetriesRemaining: number;
}

function viewChargeTask(task: Task): RetryView {
  const configStr = task.input?.find((i) => i.type?.text === 'charge-card-config')?.valueString;
  let configuredRetryAttempts: number | undefined;
  if (configStr) {
    try {
      configuredRetryAttempts = (JSON.parse(configStr) as { retryAttempts?: number }).retryAttempts ?? 0;
    } catch {
      configuredRetryAttempts = undefined;
    }
  }
  const attemptCount = task.output?.find((o) => o.type?.text === 'attempt-count')?.valueInteger ?? 0;
  const retryAttempts = configuredRetryAttempts ?? 0;
  // Exactly what the report renders (list-outreach-tasks extractRetryInfo + OutreachTasksReport).
  const reportMaxAttempts = retryAttempts + 1;
  const reportRemaining = Math.max(0, reportMaxAttempts - attemptCount);
  // The TRUE retries remaining, matching the charge processor: retries used = max(0, attemptCount - 1).
  const trueRetriesRemaining = Math.max(0, retryAttempts - Math.max(0, attemptCount - 1));
  return {
    id: task.id ?? '<no id>',
    status: task.status ?? '<no status>',
    focus: task.focus?.reference ?? '<no focus>',
    actionIdTag: tagCode(task, OUTREACH_ACTION_ID_TAG_SYSTEM),
    configuredRetryAttempts,
    attemptCount,
    reportMaxAttempts,
    reportRemaining,
    trueRetriesRemaining,
  };
}

function printRetryView(v: RetryView): void {
  console.log(
    `   Task/${v.id}  status=${v.status}  focus=${v.focus}\n` +
      `        action-id=${v.actionIdTag ?? '<MISSING>'}  configured retryAttempts=${
        v.configuredRetryAttempts ?? '<no charge-card-config>'
      }  attempt-count=${v.attemptCount}\n` +
      `        REPORT SHOWS →  Attempts: ${v.attemptCount} / ${v.reportMaxAttempts}   Remaining: ${v.reportRemaining}\n` +
      `        TRUE retries remaining (charge processor) = ${v.trueRetriesRemaining}` +
      `   ← compare with the report's "Remaining: ${v.reportRemaining}"`
  );
}

async function dumpChargeTasks(oystehr: Oystehr, focusRef: string | undefined): Promise<void> {
  console.log(`\n════════ charge-card tasks${focusRef ? ` for ${focusRef}` : ''} ════════`);
  const params: { name: string; value: string }[] = [
    { name: 'code', value: `${ACTION_TYPE_SYSTEM}|charge-card` },
    { name: '_count', value: '1000' },
  ];
  if (focusRef) params.push({ name: 'focus', value: focusRef });
  const bundle = await oystehr.fhir.search<Task>({ resourceType: 'Task', params });
  let tasks = bundle.unbundle();
  // Defensive: keep only genuine charge-card tasks (in case the code search param is loose).
  tasks = tasks.filter((t) => actionTypeOf(t) === 'charge-card');

  if (tasks.length >= 1000) {
    console.log('WARNING: hit the 1000-task page cap — re-run scoped to a single Encounter for a complete view.');
  }
  console.log(`Found ${tasks.length} charge-card task(s).\n`);

  const views = tasks.map(viewChargeTask);
  for (const v of views) printRetryView(v);

  // Summary: distinct configured retry values seen, and whether report ever disagrees with truth.
  const configuredValues = new Set(views.map((v) => v.configuredRetryAttempts ?? -1));
  const anyMismatch = views.some((v) => v.reportRemaining !== v.trueRetriesRemaining);
  console.log('\n════════ summary ════════');
  console.log(`charge-card tasks inspected:              ${views.length}`);
  console.log(
    `distinct configured retryAttempts values: { ${[...configuredValues]
      .map((n) => (n === -1 ? '<none>' : n))
      .join(', ')} }`
  );
  console.log(
    `report "Remaining" ever differs from true retries remaining: ${anyMismatch ? 'YES' : 'no'}` +
      `${anyMismatch ? '  (the report counts the initial attempt, so it is +1 vs retries)' : ''}`
  );
  console.log(
    '\nReading the result:\n' +
      '  • configured retryAttempts is what you typed in the UI (e.g. 4).\n' +
      '  • report maxAttempts = retryAttempts + 1 (it counts the initial charge).\n' +
      '  • report "Remaining" = maxAttempts - attempt-count, so with 0 attempts it shows retryAttempts + 1.\n' +
      '  • TRUE retries remaining = retryAttempts - max(0, attempt-count - 1) (what the charger enforces).'
  );
}

async function main(): Promise<void> {
  const accessToken = await resolveValue('OYSTEHR_TOKEN', 'Access token (input hidden): ', { hidden: true });
  const projectId = await resolveValue('OYSTEHR_PROJECT_ID', 'Project ID (blank for an M2M token): ', {
    required: false,
  });
  const encounterId = await resolveValue(
    'OUTREACH_ENCOUNTER_ID',
    'Encounter ID (task focus; blank = all charge-card tasks): ',
    { required: false }
  );
  const fhirApiUrl = process.env.OYSTEHR_FHIR_API_URL || 'https://fhir-api.zapehr.com';

  const oystehr = new Oystehr({
    accessToken,
    ...(projectId ? { projectId } : {}),
    services: { fhirApiUrl },
  });

  const focusRef = encounterId ? `Encounter/${encounterId}` : undefined;

  await dumpConfiguredActions(oystehr);
  await dumpChargeTasks(oystehr, focusRef);

  flushOutputFile();
}

main().catch((err) => {
  console.error('Probe failed:', err);
  flushOutputFile();
  process.exit(1);
});
