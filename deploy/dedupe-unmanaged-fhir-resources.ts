/**
 * Find (and optionally delete) un-managed FHIR resources that are duplicates of the
 * Terraform-managed FHIR resources in an Oystehr project.
 *
 * Background: a `terraform apply` was run without the real state in scope, so the oystehr
 * provider re-created many FHIR resources (Questionnaires, ValueSets, Subscriptions, …) it
 * thought were missing. The originals are still referenced by the real (S3) Terraform state —
 * those are the "managed" copies. The re-created copies share the same identity but have new
 * FHIR ids and are NOT in the state — those are the duplicates to remove.
 *
 * "Managed" is defined exactly as: the resource id recorded in the Terraform state. The state is
 * the only authoritative signal (a meta tag can't help — the duplicates were created identically).
 *
 * Safety:
 *   - Dry run by default. Nothing is deleted unless you pass --execute.
 *   - A resource is only ever flagged for deletion if it (a) is NOT a managed id and (b) matches a
 *     managed resource's identity. Unrelated resources of the same type are never touched.
 *   - Managed types with no confident identity rule are reported and SKIPPED, never guessed at.
 *
 * Usage:
 *   # 1. Pull the real state for the env's workspace (review it if you like):
 *   cd deploy && terraform workspace select local && terraform state pull > /tmp/tfstate.local.json
 *
 *   # 2. Dry run (default) — writes a plan you can review:
 *   ENV=local npx tsx dedupe-unmanaged-fhir-resources.ts --state-file /tmp/tfstate.local.json
 *
 *   # 3. After reviewing the plan, actually delete:
 *   ENV=local npx tsx dedupe-unmanaged-fhir-resources.ts --state-file /tmp/tfstate.local.json --execute
 *
 * Flags:
 *   --env <env>           Env whose config/.env/<env>.json holds auth (default: $ENV or "local").
 *   --state-file <path>   Path to `terraform state pull` JSON. Required unless --pull is given.
 *   --pull                Run `terraform state pull` in this dir instead (needs the correct
 *                         workspace already selected + backend init + AWS creds).
 *   --types <a,b,c>       Restrict to these FHIR resource types (default: all managed types).
 *   --out <path>          Where to write the JSON plan (default: ./dedupe-plan.<env>.json).
 *   --execute             Actually delete the duplicates (otherwise dry run).
 *   --yes                 Skip the interactive confirmation in --execute mode.
 */

import Oystehr from '@oystehr/sdk';
import { execSync } from 'child_process';
import { FhirResource } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';
import {
  fhirApiUrlFromAuth0Audience,
  getAll,
  projectApiUrlFromAuth0Audience,
} from '../packages/zambdas/src/scripts/helpers';
import { getAuth0Token } from '../packages/zambdas/src/shared';

const DELETE_BATCH_SIZE = 100;

interface Args {
  env: string;
  stateFile?: string;
  pull: boolean;
  types?: string[];
  out: string;
  execute: boolean;
  yes: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const env = get('--env') ?? process.env.ENV ?? 'local';
  return {
    env,
    stateFile: get('--state-file'),
    pull: argv.includes('--pull'),
    types: get('--types')
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    out: get('--out') ?? path.join(__dirname, `dedupe-plan.${env}.json`),
    execute: argv.includes('--execute'),
    yes: argv.includes('--yes'),
  };
}

// ── Managed-resource extraction from Terraform state ──────────────────────────

interface ManagedEntry {
  tfName: string;
  resourceType: string;
  fhirId: string;
  data: Record<string, any>;
}

function loadStateJson(args: Args): any {
  if (args.stateFile) {
    return JSON.parse(fs.readFileSync(args.stateFile, 'utf8'));
  }
  if (args.pull) {
    console.log('Running `terraform state pull` in', __dirname);
    const raw = execSync('terraform state pull', { cwd: __dirname, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return JSON.parse(raw);
  }
  throw new Error('Provide --state-file <path> (preferred) or --pull. See the header comment for how to pull state.');
}

function stripIdPrefix(id: string): string {
  // The provider may store the id as "ResourceType/uuid" or just "uuid".
  return id.includes('/') ? id.split('/').pop()! : id;
}

function extractManaged(state: any): ManagedEntry[] {
  const resources: any[] = state?.resources ?? [];
  const managed: ManagedEntry[] = [];
  for (const res of resources) {
    if (res?.type !== 'oystehr_fhir_resource') continue;
    for (const inst of res.instances ?? []) {
      const attrs = inst?.attributes ?? {};
      // data may be a JSON string or already an object depending on provider serialization.
      let data: Record<string, any> = {};
      const rawData = attrs.data ?? attrs.resource;
      if (typeof rawData === 'string') {
        try {
          data = JSON.parse(rawData);
        } catch {
          data = {};
        }
      } else if (rawData && typeof rawData === 'object') {
        data = rawData;
      }
      const rawId: string | undefined = attrs.id ?? attrs.resource_id ?? data.id;
      if (!rawId) continue;
      const fhirId = stripIdPrefix(String(rawId));
      const resourceType: string | undefined =
        attrs.type ??
        attrs.resource_type ??
        data.resourceType ??
        (String(rawId).includes('/') ? String(rawId).split('/')[0] : undefined);
      if (!resourceType) continue;
      managed.push({ tfName: res.name, resourceType, fhirId, data });
    }
  }
  return managed;
}

// ── Identity rules ────────────────────────────────────────────────────────────
// Returns a stable key for a resource's identity, plus which rule produced it.
// null means we have no confident identity rule for this resource → never dedupe it.

function identityKey(resourceType: string, data: Record<string, any>): { key: string; rule: string } | null {
  if (data?.url) {
    return { key: `url|${data.url}|${data.version ?? ''}`, rule: 'canonical(url+version)' };
  }
  if (resourceType === 'Subscription') {
    const endpoint = data?.channel?.endpoint ?? '';
    if (data?.criteria) {
      return { key: `subscription|${data.criteria}|${endpoint}`, rule: 'subscription(criteria+endpoint)' };
    }
  }
  if (Array.isArray(data?.identifier) && data.identifier.length > 0) {
    const idents = data.identifier
      .map((i: any) => `${i.system ?? ''}|${i.value ?? ''}`)
      .sort()
      .join(',');
    return { key: `identifier|${resourceType}|${idents}`, rule: 'identifier' };
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

interface DuplicateRecord {
  resourceType: string;
  duplicateId: string;
  keeperId: string;
  keeperTfName: string;
  identityRule: string;
  identityKey: string;
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(prompt, resolve));
  rl.close();
  return answer.trim() === 'DELETE';
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Auth (same pattern as deploy/fill-env-with-created-resources-data.ts).
  const envFilePath = path.join(__dirname, `../config/.env/${args.env}.json`);
  const secrets = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));
  const token = await getAuth0Token(secrets);
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
    projectApiUrl: projectApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // 1. Managed resources from Terraform state.
  const state = loadStateJson(args);
  const managed = extractManaged(state);
  if (managed.length === 0) {
    throw new Error(
      'No oystehr_fhir_resource entries found in the Terraform state. Refusing to proceed — ' +
        'check that the state file is for the right workspace/env and was produced by `terraform state pull`.'
    );
  }

  // Build managed-id sets and identity index, keyed by resource type.
  const managedIdsByType = new Map<string, Set<string>>();
  const managedIdentityByType = new Map<string, Map<string, ManagedEntry>>();
  const skippedNoIdentity: ManagedEntry[] = [];
  for (const entry of managed) {
    if (!managedIdsByType.has(entry.resourceType)) {
      managedIdsByType.set(entry.resourceType, new Set());
      managedIdentityByType.set(entry.resourceType, new Map());
    }
    managedIdsByType.get(entry.resourceType)!.add(entry.fhirId);
    const ident = identityKey(entry.resourceType, entry.data);
    if (!ident) {
      skippedNoIdentity.push(entry);
      continue;
    }
    managedIdentityByType.get(entry.resourceType)!.set(ident.key, entry);
  }

  const allTypes = [...managedIdsByType.keys()].sort();
  const typesToScan = args.types ? allTypes.filter((t) => args.types!.includes(t)) : allTypes;

  console.log('='.repeat(80));
  console.log(`Env: ${args.env}`);
  console.log(`Managed oystehr_fhir_resource entries in state: ${managed.length}`);
  console.log(`Managed types: ${allTypes.map((t) => `${t}(${managedIdsByType.get(t)!.size})`).join(', ')}`);
  if (skippedNoIdentity.length) {
    console.log(
      `\n⚠ ${skippedNoIdentity.length} managed resource(s) have no confident identity rule and will NOT be deduped ` +
        `(review these types manually):`
    );
    for (const e of skippedNoIdentity) {
      console.log(`   - ${e.resourceType} ${e.fhirId} (tf: ${e.tfName})`);
    }
  }
  console.log('='.repeat(80));

  // 2. For each managed type, fetch all FHIR resources and classify.
  const duplicates: DuplicateRecord[] = [];
  const missingKeepers: { resourceType: string; identityKey: string; keeperId: string; tfName: string }[] = [];

  for (const resourceType of typesToScan) {
    const managedIds = managedIdsByType.get(resourceType)!;
    const identityIndex = managedIdentityByType.get(resourceType)!;

    const all = (await getAll(resourceType as FhirResource['resourceType'], [], oystehr)) as FhirResource[];
    const seenKeepers = new Set<string>();

    for (const resource of all) {
      const id = resource.id!;
      if (managedIds.has(id)) {
        seenKeepers.add(id);
        continue; // this is the managed copy — keep it
      }
      const ident = identityKey(resourceType, resource as Record<string, any>);
      if (!ident) continue; // can't identify → leave it alone
      const keeper = identityIndex.get(ident.key);
      if (!keeper) continue; // not a duplicate of any managed resource → leave it alone
      duplicates.push({
        resourceType,
        duplicateId: id,
        keeperId: keeper.fhirId,
        keeperTfName: keeper.tfName,
        identityRule: ident.rule,
        identityKey: ident.key,
      });
    }

    // Sanity: every managed identity should still have its keeper present in FHIR.
    for (const [key, keeper] of identityIndex.entries()) {
      if (!seenKeepers.has(keeper.fhirId)) {
        missingKeepers.push({ resourceType, identityKey: key, keeperId: keeper.fhirId, tfName: keeper.tfName });
      }
    }
  }

  // 3. Report.
  const byType = new Map<string, DuplicateRecord[]>();
  for (const d of duplicates) {
    if (!byType.has(d.resourceType)) byType.set(d.resourceType, []);
    byType.get(d.resourceType)!.push(d);
  }

  console.log(`\n${args.execute ? 'EXECUTE' : 'DRY RUN'} — duplicate un-managed resources to delete:\n`);
  if (duplicates.length === 0) {
    console.log('  None found. 🎉');
  } else {
    for (const type of [...byType.keys()].sort()) {
      const recs = byType.get(type)!;
      console.log(`  ${type}: ${recs.length} duplicate(s)`);
      for (const r of recs) {
        console.log(
          `     delete ${type}/${r.duplicateId}  (keep ${r.keeperId} [tf:${r.keeperTfName}], by ${r.identityRule})`
        );
      }
    }
  }
  console.log(`\nTotal duplicates flagged for deletion: ${duplicates.length}`);

  if (missingKeepers.length) {
    console.log(
      `\n⚠ ${missingKeepers.length} managed resource(s) referenced by state were NOT found in FHIR ` +
        `(state may be stale, or the wrong copy was kept earlier):`
    );
    for (const m of missingKeepers) {
      console.log(`   - ${m.resourceType} ${m.keeperId} (tf: ${m.tfName})`);
    }
  }

  // 4. Write the plan for review.
  const plan = {
    env: args.env,
    generatedAt: new Date().toISOString(),
    mode: args.execute ? 'execute' : 'dry-run',
    managedCount: managed.length,
    skippedNoIdentity: skippedNoIdentity.map((e) => ({ resourceType: e.resourceType, id: e.fhirId, tfName: e.tfName })),
    missingKeepers,
    duplicates,
  };
  fs.writeFileSync(args.out, JSON.stringify(plan, null, 2));
  console.log(`\nFull plan written to: ${args.out}`);

  if (!args.execute) {
    console.log('\nDry run only — nothing deleted. Re-run with --execute (after reviewing the plan) to delete.');
    return;
  }

  if (duplicates.length === 0) return;

  // 5. Execute deletes (guarded).
  if (!args.yes) {
    console.log(`\nAbout to DELETE ${duplicates.length} resources from env "${args.env}". This cannot be undone.`);
    const ok = await confirm('Type DELETE to proceed: ');
    if (!ok) {
      console.log('Aborted — no resources deleted.');
      return;
    }
  }

  // Double-guard: never delete a managed id.
  const allManagedIds = new Set<string>();
  for (const set of managedIdsByType.values()) for (const id of set) allManagedIds.add(id);

  const toDelete = duplicates.filter((d) => !allManagedIds.has(d.duplicateId));
  let deleted = 0;
  const failures: { id: string; resourceType: string; error: string }[] = [];

  for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + DELETE_BATCH_SIZE);
    const requests = chunk.map((d) => ({ method: 'DELETE' as const, url: `/${d.resourceType}/${d.duplicateId}` }));
    try {
      await oystehr.fhir.batch({ requests });
      deleted += chunk.length;
      console.log(`Deleted ${deleted}/${toDelete.length}...`);
    } catch {
      // Fall back to per-resource deletes so one bad entry doesn't fail the whole chunk.
      for (const d of chunk) {
        try {
          await oystehr.fhir.delete({
            resourceType: d.resourceType as FhirResource['resourceType'],
            id: d.duplicateId,
          });
          deleted += 1;
        } catch (err: any) {
          failures.push({ id: d.duplicateId, resourceType: d.resourceType, error: String(err?.message ?? err) });
        }
      }
    }
  }

  console.log(`\nDone. Deleted ${deleted}/${toDelete.length}.`);
  if (failures.length) {
    console.log(`${failures.length} failed:`);
    for (const f of failures) console.log(`   - ${f.resourceType}/${f.id}: ${f.error}`);
  }
}

main()
  .then(() => console.log('\nFinished.'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
