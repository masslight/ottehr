/**
 * Apply quick picks of any admin-managed category to a target Oystehr project.
 *
 * Categories supported (driven by REGISTRY at the top of the file):
 *   procedure, medical-condition  (more added incrementally)
 *
 * Usage:
 *   # Dry-run a single example
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-quick-picks/synthesize-quick-picks.ts \
 *     --type medical-condition \
 *     scripts/synthetic-quick-picks/examples/medical-conditions/hypertension.json
 *
 *   # Execute every example for a category
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-quick-picks/synthesize-quick-picks.ts \
 *     --type procedure --all-examples --execute
 *
 * Idempotent on each category's natural human-readable label (procedure → name,
 * medical-condition → display, etc.). Re-running first looks up existing picks
 * via the get-zambda; matching titles route to admin-update, new ones to
 * admin-create.
 *
 * Talks to the local zambda server (default http://localhost:3000/local).
 */
import { readdirSync, readFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import type { z } from 'zod';
import {
  allergyQuickPickSchema,
  immunizationQuickPickSchema,
  inHouseMedicationQuickPickSchema,
  medicalConditionQuickPickSchema,
  medicationHistoryQuickPickSchema,
  procedureQuickPickSchema,
  radiologyQuickPickSchema,
} from './schema';

const ZAMBDA_API = process.env.ZAMBDA_API ?? 'http://localhost:3000/local';
const PROJECT_ID = process.env.PROJECT_ID;

// ── Per-category registry ──
type QuickPickCategoryConfig<S extends z.ZodTypeAny> = {
  schema: S;
  examplesDir: string;
  getZambda: string;
  createZambda: string;
  updateZambda: string;
  /** How to extract the human-readable label (the dedup key). */
  getLabel: (qp: z.infer<S>) => string;
};

const REGISTRY: Record<string, QuickPickCategoryConfig<any>> = {
  procedure: {
    schema: procedureQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/procedures',
    getZambda: 'admin-get-procedure-quick-picks',
    createZambda: 'admin-create-procedure-quick-pick',
    updateZambda: 'admin-update-procedure-quick-pick',
    getLabel: (qp) => qp.name,
  },
  'medical-condition': {
    schema: medicalConditionQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/medical-conditions',
    getZambda: 'admin-get-medical-condition-quick-picks',
    createZambda: 'admin-create-medical-condition-quick-pick',
    updateZambda: 'admin-update-medical-condition-quick-pick',
    getLabel: (qp) => qp.display,
  },
  radiology: {
    schema: radiologyQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/radiology',
    getZambda: 'admin-get-radiology-quick-picks',
    createZambda: 'admin-create-radiology-quick-pick',
    updateZambda: 'admin-update-radiology-quick-pick',
    getLabel: (qp) => qp.name,
  },
  allergy: {
    schema: allergyQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/allergies',
    getZambda: 'admin-get-allergy-quick-picks',
    createZambda: 'admin-create-allergy-quick-pick',
    updateZambda: 'admin-update-allergy-quick-pick',
    getLabel: (qp) => qp.name,
  },
  'medication-history': {
    schema: medicationHistoryQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/medication-history',
    getZambda: 'admin-get-medication-history-quick-picks',
    createZambda: 'admin-create-medication-history-quick-pick',
    updateZambda: 'admin-update-medication-history-quick-pick',
    getLabel: (qp) => qp.name,
  },
  immunization: {
    schema: immunizationQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/immunizations',
    getZambda: 'admin-get-immunization-quick-picks',
    createZambda: 'admin-create-immunization-quick-pick',
    updateZambda: 'admin-update-immunization-quick-pick',
    getLabel: (qp) => qp.name,
  },
  'in-house-medication': {
    schema: inHouseMedicationQuickPickSchema,
    examplesDir: 'scripts/synthetic-quick-picks/examples/in-house-medications',
    getZambda: 'admin-get-in-house-medication-quick-picks',
    createZambda: 'admin-create-in-house-medication-quick-pick',
    updateZambda: 'admin-update-in-house-medication-quick-pick',
    getLabel: (qp) => qp.name,
  },
};

// ── CLI parsing ──
const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const isExecute = args.includes('--execute');
const isAll = args.includes('--all-examples');
const typeArg = getFlag('--type');
const positional = args.filter((a, i, arr) => !a.startsWith('--') && (i === 0 || arr[i - 1] !== '--type'));

if (!typeArg || !REGISTRY[typeArg]) {
  console.error(
    `Usage: tsx synthesize-quick-picks.ts --type <${Object.keys(REGISTRY).join(
      '|'
    )}> <example.json | --all-examples> [--execute]`
  );
  process.exit(1);
}
if (!isAll && positional.length === 0) {
  console.error('Provide an example JSON path, or --all-examples to run every JSON in the category directory.');
  process.exit(1);
}
const config = REGISTRY[typeArg];

// ── Auth + zambda call helpers ──
async function mintToken(): Promise<string> {
  const res = await fetch(process.env.AUTH0_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT,
      client_secret: process.env.AUTH0_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`token mint failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function callZambda<T>(zambda: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${ZAMBDA_API}/zambda/${zambda}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-zapehr-project-id': PROJECT_ID ?? '',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${zambda} failed: ${res.status} ${text}`);
  const parsed = text ? JSON.parse(text) : {};
  return (parsed.output ?? parsed) as T;
}

// ── Load + validate examples ──
function loadExamples(): { path: string; data: any }[] {
  const paths = isAll
    ? readdirSync(resolve(config.examplesDir))
        .filter((f) => f.endsWith('.json'))
        .map((f) => join(config.examplesDir, f))
    : positional;

  return paths.map((p) => {
    const raw = JSON.parse(readFileSync(resolve(p), 'utf-8'));
    const result = config.schema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i: any) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Schema validation failed for ${p}:\n${issues}`);
    }
    return { path: p, data: result.data };
  });
}

async function main(): Promise<void> {
  const examples = loadExamples();
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Type: ${typeArg}`);
  console.log(`Examples: ${examples.length}`);

  const token = await mintToken();
  const existingResp = await callZambda<{ quickPicks: any[] }>(config.getZambda, {}, token);
  const existing = new Map(existingResp.quickPicks.map((qp) => [config.getLabel(qp), qp.id as string]));
  console.log(`Existing picks on project: ${existing.size}\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const { path, data } of examples) {
    const label = config.getLabel(data);
    const existsId = existing.get(label);
    const action = existsId ? 'UPDATE' : 'CREATE';
    console.log(`[${action}] ${basename(path)}  label="${label}"`);
    if (!isExecute) continue;
    try {
      if (existsId) {
        await callZambda(config.updateZambda, { quickPickId: existsId, quickPick: data }, token);
        updated++;
      } else {
        await callZambda(config.createZambda, { quickPick: data }, token);
        created++;
      }
      console.log(`    ✓`);
    } catch (e: any) {
      console.log(`    ✗ ${e?.message ?? e}`);
      failed++;
    }
  }

  if (isExecute) console.log(`\nDone. created=${created}  updated=${updated}  failed=${failed}`);
  else console.log(`\n[DRY RUN] No changes made. Pass --execute to apply.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
