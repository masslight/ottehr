/**
 * Read-only diagnostic: why aren't invoice-due day-0 charge-card outreach actions charging cards?
 *
 * Checks the pipeline end to end:
 *   producer cron (CRON-OUTREACH-INVOICE-DUE) -> draft Task -> promoter cron -> requested
 *   -> Subscription -> SUB-OUTREACH-CHARGE-CARD -> stripe.invoices.pay
 *
 * Prompts for access token (hidden) and project id. Env overrides:
 *   OYSTEHR_TOKEN, OYSTEHR_PROJECT_ID, LOOKBACK_DAYS (default 10), OYSTEHR_FHIR_API_URL
 *
 * Run (from packages/zambdas):  npx tsx src/scripts/diagnose-invoice-due-charge-card.ts
 */
import * as readline from 'node:readline';
import Oystehr from '@oystehr/sdk';
import { PlanDefinition, Subscription, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { parsePlanDefinitionToActions } from '../rcm/scheduled-outreach-config/helpers';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;
const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const OUTREACH_ACTION_TYPE_SYSTEM = 'https://ottehr.com/CodeSystem/outreach-action-type';
const PRODUCER_RUN_HOUR_UTC = 6;

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(question);
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

async function resolveValue(envName: string, question: string, hidden = false): Promise<string> {
  const fromEnv = process.env[envName]?.trim();
  return fromEnv || prompt(question, hidden);
}

const section = (title: string): void => console.log(`\n=== ${title} ===`);
const utc = (unix: number): string => DateTime.fromSeconds(unix, { zone: 'utc' }).toISO()!;

// The producer runs at 06:00 UTC and lists invoices with due_date <= 00:00 UTC of that day.
function firstProducerRunThatSeesInvoice(dueUnix: number): DateTime {
  const due = DateTime.fromSeconds(dueUnix, { zone: 'utc' });
  const dayStart = due.startOf('day');
  const runDay = due.equals(dayStart) ? dayStart : dayStart.plus({ days: 1 });
  return runDay.set({ hour: PRODUCER_RUN_HOUR_UTC });
}

const output = (task: Task, name: string): string | undefined => {
  const o = task.output?.find((x) => x.type?.text === name);
  return o?.valueString ?? (o?.valueInteger !== undefined ? String(o.valueInteger) : undefined);
};

async function main(): Promise<void> {
  const accessToken = await resolveValue('OYSTEHR_TOKEN', 'Access token (input hidden): ', true);
  const projectId = await resolveValue('OYSTEHR_PROJECT_ID', 'Project ID: ');
  if (!accessToken || !projectId) throw new Error('Access token and project ID are required');
  const lookbackDays = Number(process.env.LOOKBACK_DAYS || 10);

  const oystehr = new Oystehr({
    accessToken,
    projectId,
    services: { fhirApiUrl: process.env.OYSTEHR_FHIR_API_URL || 'https://fhir-api.zapehr.com' },
  });

  section('Zambdas');
  const zambdas = await oystehr.zambda.list();
  for (const name of ['cron-outreach-invoice-due', 'cron-outreach-task-promoter', 'sub-outreach-charge-card']) {
    const z = zambdas.find((x) => x.name.toLowerCase() === name);
    if (!z) {
      console.log(`MISSING: ${name}`);
      continue;
    }
    const full = await oystehr.zambda.get({ id: z.id });
    console.log(
      `${name}: status=${full.status} trigger=${full.triggerMethod} schedule=${JSON.stringify(full.schedule)}`
    );
    const { logStreams } = await oystehr.zambdaLogStream.list({ id: z.id });
    const recent = logStreams.sort((a, b) => b.lastEventTimestamp - a.lastEventTimestamp).slice(0, 2);
    for (const s of recent) {
      console.log(`  --- log stream ${s.logStreamName} (last event ${new Date(s.lastEventTimestamp).toISOString()})`);
      const { logEvents } = await oystehr.zambdaLogStream.get({ id: z.id, logStreamName: s.logStreamName });
      for (const e of logEvents.slice(-40)) console.log(`  ${new Date(e.timestamp).toISOString()} ${e.message.trim()}`);
    }
  }

  section('Charge-card Subscription');
  const subs = (
    await oystehr.fhir.search<Subscription>({
      resourceType: 'Subscription',
      params: [{ name: '_count', value: '500' }],
    })
  )
    .unbundle()
    .filter((s) => s.criteria?.includes('charge-card'));
  if (!subs.length) console.log('MISSING: no Subscription with charge-card criteria');
  for (const s of subs) {
    console.log(`Subscription/${s.id}: status=${s.status} criteria=${s.criteria} endpoint=${s.channel?.endpoint}`);
    if (s.error) console.log(`  error: ${s.error}`);
  }

  section('Outreach config (invoice-due charge-card actions)');
  const planDefs = (
    await oystehr.fhir.search<PlanDefinition>({
      resourceType: 'PlanDefinition',
      params: [{ name: '_tag', value: `${RCM_TAG_SYSTEM}|scheduled-outreach-config` }],
    })
  ).unbundle();
  if (!planDefs.length) console.log('MISSING: outreach config PlanDefinition');
  for (const pd of planDefs) {
    const actions = parsePlanDefinitionToActions(pd).filter(
      (a) => a.trigger.event === 'invoice-due' && a.actionType === 'charge-card'
    );
    console.log(`PlanDefinition/${pd.id} lastUpdated=${pd.meta?.lastUpdated}`);
    if (!actions.length) console.log('  No invoice-due charge-card actions configured');
    for (const a of actions) console.log(`  ${JSON.stringify(a)}`);
  }

  section('Recent charge-card Tasks');
  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'code', value: `${OUTREACH_ACTION_TYPE_SYSTEM}|charge-card` },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
  const byStatus: Record<string, number> = {};
  tasks.forEach((t) => (byStatus[t.status] = (byStatus[t.status] ?? 0) + 1));
  console.log(`Found ${tasks.length} (latest 100). By status: ${JSON.stringify(byStatus)}`);
  for (const t of tasks.slice(0, 30)) {
    const trigger = t.meta?.tag?.find((x) => x.system === OUTREACH_TASK_TAG_SYSTEM)?.code;
    const attempts = Number(output(t, 'attempt-count') ?? 0);
    const lastResult = attempts ? output(t, `attempt-${attempts}-result`) : undefined;
    console.log(
      `Task/${t.id} [${trigger}] status=${t.status} start=${t.executionPeriod?.start} focus=${t.focus?.reference} ` +
        `authored=${t.authoredOn} updated=${t.meta?.lastUpdated}` +
        (t.statusReason?.text ? ` reason="${t.statusReason.text}"` : '') +
        (lastResult ? ` lastAttempt="${lastResult}"` : '')
    );
  }
  const stuckRequested = tasks.filter(
    (t) => t.status === 'requested' && DateTime.fromISO(t.meta?.lastUpdated ?? '') < DateTime.now().minus({ hours: 1 })
  );
  if (stuckRequested.length)
    console.log(`WARNING: ${stuckRequested.length} task(s) stuck in 'requested' >1h — subscription not firing?`);

  section('Stripe open invoices due recently');
  const secretNames = (await oystehr.secret.list()).map((s) => s.name);
  const stripeKey = secretNames.includes('STRIPE_SECRET_KEY')
    ? (await oystehr.secret.get({ name: 'STRIPE_SECRET_KEY' })).value
    : undefined;
  if (!stripeKey) {
    console.log('STRIPE_SECRET_KEY secret not found; skipping Stripe checks');
    return;
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion });

  const connected = await stripe.accounts.list({ limit: 10 }).catch(() => undefined);
  const accountIds: (string | undefined)[] = [undefined, ...(connected?.data.map((a) => a.id) ?? [])];
  if (accountIds.length > 1)
    console.log(
      `NOTE: ${accountIds.length - 1} connected account(s) found; open invoices are listed per account below. ` +
        'Producers/executors without multi-account support only see the platform account.'
    );

  const now = DateTime.utc();
  const from = Math.floor(now.minus({ days: lookbackDays }).startOf('day').toSeconds());
  const to = Math.floor(now.plus({ days: 1 }).endOf('day').toSeconds());

  for (const stripeAccount of accountIds) {
    const opts = stripeAccount ? { stripeAccount } : undefined;
    const invoices: Stripe.Invoice[] = [];
    for await (const inv of stripe.invoices.list(
      { status: 'open', due_date: { gte: from, lte: to }, limit: 100 },
      opts
    ))
      invoices.push(inv);
    console.log(`\n[${stripeAccount ?? 'platform account'}] ${invoices.length} open invoice(s) due in window`);

    for (const inv of invoices) {
      const encounterId = inv.metadata?.oystehr_encounter_id ?? inv.metadata?.encounterId;
      const patientId = inv.metadata?.oystehr_patient_id;
      const firstRun = inv.due_date ? firstProducerRunThatSeesInvoice(inv.due_date) : undefined;
      const lateDays = inv.due_date
        ? Math.round(
            firstRun!.startOf('day').diff(DateTime.fromSeconds(inv.due_date, { zone: 'utc' }).startOf('day'), 'days')
              .days
          )
        : 0;

      let defaultPm = 'n/a';
      if (typeof inv.customer === 'string') {
        const cust = await stripe.customers.retrieve(inv.customer, opts);
        defaultPm = cust.deleted ? 'customer deleted' : String(cust.invoice_settings?.default_payment_method ?? 'NONE');
      }

      const encTasks = encounterId
        ? tasks.filter((t) => t.focus?.reference === `Encounter/${encounterId}`).map((t) => `${t.id}:${t.status}`)
        : [];

      console.log(
        `${inv.id} due=${inv.due_date ? utc(inv.due_date) : 'none'} amount_due=${inv.amount_due} ` +
          `collection=${inv.collection_method} patient=${patientId ?? 'MISSING'} encounter=${
            encounterId ?? 'MISSING'
          } ` +
          `defaultPM=${defaultPm}`
      );
      if (firstRun)
        console.log(
          `  first producer run that sees it: ${firstRun.toISO()}${
            lateDays > 0 ? ` (${lateDays} day(s) AFTER due date)` : ''
          }`
        );
      if (!inv.metadata?.oystehr_patient_id || !inv.metadata?.oystehr_encounter_id)
        console.log('  WARNING: producer skips invoices lacking oystehr_patient_id / oystehr_encounter_id metadata');
      console.log(`  charge-card tasks for encounter: ${encTasks.length ? encTasks.join(', ') : 'NONE'}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
