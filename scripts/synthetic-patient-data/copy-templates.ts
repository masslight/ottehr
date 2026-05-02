/**
 * copy-templates.ts — copy global templates from one Oystehr project to another.
 *
 * For each template in the source project's holder list:
 *   1. Fetch the full template `List` resource (with contained chart-data).
 *   2. Create a new `List` on the destination project (preserving title, code,
 *      contained, and entry references).
 *   3. Append a reference to the new template into the destination's holder list.
 *
 * Templates already present on the destination (matched by `title`) are skipped
 * by default. Use `--force` to recopy and append a new copy regardless.
 *
 * Usage:
 *   npx tsx scripts/synthetic-patient-data/copy-templates.ts \
 *     --source-env packages/zambdas/.env/demo.json \
 *     --dest-env packages/zambdas/.env/synth.json \
 *     [--execute] [--force]
 *
 * Defaults to dry-run. Requires --execute to actually write.
 */
import Oystehr from '@oystehr/sdk';
import type { List } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Constants from packages/utils/lib/fhir/constants.ts ───────────────────────

const GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM = 'https://fhir.zapehr.com/r4/StructureDefinitions/global-template-list';
const GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/global-template-in-person';
const GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/global-template-telemed';

const TEMPLATE_CODE_SYSTEMS = [GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM, GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM];

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const sourceEnvPath = resolve(getFlag('--source-env') ?? '');
const destEnvPath = resolve(getFlag('--dest-env') ?? '');
const isExecute = args.includes('--execute');
const isForce = args.includes('--force');

if (!sourceEnvPath || !destEnvPath) {
  console.error('Usage: tsx copy-templates.ts --source-env <path> --dest-env <path> [--execute] [--force]');
  process.exit(1);
}

// ── SDK setup (per env file) ──────────────────────────────────────────────────

interface EnvConfig {
  AUTH0_ENDPOINT: string;
  AUTH0_CLIENT: string;
  AUTH0_SECRET: string;
  AUTH0_AUDIENCE: string;
  PROJECT_ID: string;
  PROJECT_API: string;
  ZAMBDA_API?: string;
}

function loadEnv(path: string): EnvConfig {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  for (const key of [
    'AUTH0_ENDPOINT',
    'AUTH0_CLIENT',
    'AUTH0_SECRET',
    'AUTH0_AUDIENCE',
    'PROJECT_ID',
    'PROJECT_API',
  ] as const) {
    if (!raw[key]) throw new Error(`${path} is missing required key: ${key}`);
  }
  return raw as EnvConfig;
}

async function createOystehrFromEnv(env: EnvConfig, label: string): Promise<Oystehr> {
  const tokenResponse = await fetch(env.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.AUTH0_CLIENT,
      client_secret: env.AUTH0_SECRET,
      audience: env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`[${label}] Oystehr IAM token request failed: ${tokenResponse.status} ${errorText}`);
  }
  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return new Oystehr({
    accessToken: tokenData.access_token,
    projectId: env.PROJECT_ID,
    services: {
      projectApiUrl: env.PROJECT_API,
      zambdaApiUrl: env.ZAMBDA_API ?? env.PROJECT_API,
    },
  });
}

// ── Holder-list helpers ───────────────────────────────────────────────────────

async function findHolderList(oystehr: Oystehr): Promise<List | undefined> {
  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: '_tag', value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|` }],
    })
  ).unbundle();
  return lists.find((l) => l.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM));
}

function isTemplateList(template: List): boolean {
  return template.code?.coding?.some((c) => TEMPLATE_CODE_SYSTEMS.includes(c.system ?? '')) ?? false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}${isForce ? ' (force)' : ''}`);
  console.log(`Source env: ${sourceEnvPath}`);
  console.log(`Dest env:   ${destEnvPath}`);

  const sourceEnv = loadEnv(sourceEnvPath);
  const destEnv = loadEnv(destEnvPath);
  console.log(`Source PROJECT_ID: ${sourceEnv.PROJECT_ID}`);
  console.log(`Dest PROJECT_ID:   ${destEnv.PROJECT_ID}`);

  if (sourceEnv.PROJECT_ID === destEnv.PROJECT_ID) {
    throw new Error('Source and destination PROJECT_IDs are the same. Refusing to copy.');
  }

  console.log('');
  console.log('Authenticating to both projects...');
  const [source, dest] = await Promise.all([
    createOystehrFromEnv(sourceEnv, 'source'),
    createOystehrFromEnv(destEnv, 'dest'),
  ]);
  console.log('Authenticated.');

  // Holder lists
  console.log('');
  const sourceHolder = await findHolderList(source);
  if (!sourceHolder) throw new Error('Source project has no holder list — nothing to copy from.');
  console.log(`Source holder list: ${sourceHolder.id} with ${sourceHolder.entry?.length ?? 0} entries`);

  const destHolder = await findHolderList(dest);
  if (!destHolder) {
    throw new Error(
      'Destination project has no holder list. The holder list is auto-provisioned with admin-create-template; create one template in the dest project first, or extend this script to provision a holder list.'
    );
  }
  console.log(`Dest holder list:   ${destHolder.id} with ${destHolder.entry?.length ?? 0} entries`);

  // Read source templates
  console.log('');
  console.log('Fetching source template IDs from holder list...');
  const sourceTemplateIds = [
    ...new Set(
      (sourceHolder.entry ?? []).map((e) => e.item.reference?.replace('List/', '')).filter((id): id is string => !!id)
    ),
  ];
  console.log(`Found ${sourceTemplateIds.length} unique template references.`);

  // Read existing dest templates (to skip duplicates by title)
  const destTemplateIds = [
    ...new Set(
      (destHolder.entry ?? []).map((e) => e.item.reference?.replace('List/', '')).filter((id): id is string => !!id)
    ),
  ];
  const destTemplates: List[] = [];
  for (const id of destTemplateIds) {
    try {
      destTemplates.push(await dest.fhir.get<List>({ resourceType: 'List', id }));
    } catch {
      console.warn(`  warning: dest holder references missing template ${id}`);
    }
  }
  const destTitlesAlreadyPresent = new Set(destTemplates.map((t) => t.title).filter((t): t is string => !!t));
  console.log(
    `Dest already has ${destTitlesAlreadyPresent.size} templates (will skip matching titles unless --force).`
  );

  // Fetch source templates and copy
  console.log('');
  console.log(`Copying templates...`);
  const newTemplateIds: string[] = [];
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const sourceTemplateId of sourceTemplateIds) {
    let sourceTemplate: List;
    try {
      sourceTemplate = await source.fhir.get<List>({ resourceType: 'List', id: sourceTemplateId });
    } catch (err) {
      console.warn(
        `  ✗ failed to fetch source template ${sourceTemplateId}: ${err instanceof Error ? err.message : err}`
      );
      failed++;
      continue;
    }

    if (!isTemplateList(sourceTemplate)) {
      console.warn(`  ✗ source ${sourceTemplateId} is not a template (no global-template code system) — skipping`);
      skipped++;
      continue;
    }

    const title = sourceTemplate.title ?? '(untitled)';

    if (!isForce && destTitlesAlreadyPresent.has(title)) {
      console.log(`  • skip "${title}" (already on dest)`);
      skipped++;
      continue;
    }

    if (!isExecute) {
      console.log(
        `  + would copy "${title}"  (source ${sourceTemplateId}, ${
          sourceTemplate.contained?.length ?? 0
        } contained resources)`
      );
      copied++;
      continue;
    }

    // Strip identity fields before recreating
    const { id: _id, meta, ...rest } = sourceTemplate;
    const newTemplate: List = {
      ...rest,
      // Preserve meta.tag (semantic) but drop versionId/lastUpdated (assigned by FHIR server)
      meta: meta?.tag ? { tag: meta.tag } : undefined,
    };

    try {
      const created = await dest.fhir.create<List>(newTemplate as List);
      if (!created.id) throw new Error('FHIR create returned no id');
      newTemplateIds.push(created.id);
      console.log(`  ✓ copied "${title}"  → ${created.id}`);
      copied++;
    } catch (err) {
      console.error(`  ✗ failed to create dest template "${title}": ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  // Update dest holder list with new entries
  if (isExecute && newTemplateIds.length > 0) {
    console.log('');
    console.log(`Updating dest holder list with ${newTemplateIds.length} new entries...`);
    const updatedHolder: List = {
      ...destHolder,
      entry: [
        ...(destHolder.entry ?? []),
        ...newTemplateIds.map((id) => ({
          item: { reference: `List/${id}` },
          date: new Date().toISOString(),
        })),
      ],
    };
    try {
      await dest.fhir.update<List>(updatedHolder);
      console.log(`Dest holder list updated.`);
    } catch (err) {
      console.error(`Failed to update dest holder list: ${err instanceof Error ? err.message : err}`);
      console.error('Templates were created on dest but are NOT yet linked from the holder list.');
      console.error('New template IDs to manually link:');
      for (const id of newTemplateIds) console.error(`  ${id}`);
      process.exit(2);
    }
  }

  // Summary
  console.log('');
  console.log(`-- summary --`);
  console.log(`copied:  ${copied}${isExecute ? '' : ' (would-copy)'}`);
  console.log(`skipped: ${skipped}`);
  console.log(`failed:  ${failed}`);
  if (!isExecute) {
    console.log('');
    console.log('Dry-run only. Re-run with --execute to actually copy.');
  }
}

main().catch((err) => {
  console.error('');
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
  process.exit(1);
});
