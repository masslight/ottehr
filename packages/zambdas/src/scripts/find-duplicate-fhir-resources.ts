/**
 * Finds (and optionally deletes) duplicate FHIR resources MANAGED BY THE IaC CONFIG
 * (config/oystehr/*.json) — i.e. duplicates created by a bad `terraform apply-local`.
 *
 * For each managed config entry it does a TARGETED FHIR search by the entry's identity
 * (canonical url[+version], or the full set of declared identifiers AND-ed together) to collect all
 * live copies. This is reliable (no offset pagination), and precise — it won't lump together
 * resources that merely share a "type" identifier (e.g. vaccines) or a placeholder NPI.
 *
 * WHICH COPY IS KEPT:
 *   - With --state <file>: the resource id that terraform currently tracks for that config entry is
 *     the source of truth. All other live copies are extras. (Recommended — robust against churn.)
 *     Produce the file from deploy/:  terraform workspace select <env> && terraform state pull > /tmp/tfstate.json
 *   - Without --state: falls back to keeping the OLDEST copy (by meta.lastUpdated) — only a heuristic,
 *     since lastUpdated reflects last modification, not creation.
 *
 * Usage (run from packages/zambdas):
 *   tsx src/scripts/find-duplicate-fhir-resources.ts [env] [--state <file>]            -- report only
 *   tsx src/scripts/find-duplicate-fhir-resources.ts [env] [--state <file>] --delete   -- delete extras
 *
 * WARNING: FHIR resources may be referenced by others; deletion keeps the canonical (state) copy so
 * existing references stay valid. Review the report before running --delete.
 */
import Oystehr from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { Secrets } from 'utils';
import { getAuth0Token } from '../shared/getAuth0Token';

const ROOT = path.resolve(__dirname, '../../../..');
const CONFIG_DIRS = [path.resolve(ROOT, 'config/oystehr'), path.resolve(ROOT, 'config/oystehr-core')];

const CANONICAL_TYPES = new Set(['Questionnaire', 'ValueSet', 'ActivityDefinition', 'PlanDefinition']);

const fhirApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.fhir-api.zapehr.com';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.fhir-api.zapehr.com';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.fhir-api.zapehr.com';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.fhir-api.zapehr.com';
    case 'https://api.zapehr.com':
      return 'https://fhir-api.zapehr.com';
    default:
      throw new Error(`Unexpected auth0 audience value, could not map to a fhirApiUrl: ${auth0Audience}`);
  }
};

function loadJson(filePath: string): any {
  const full = path.resolve(ROOT, filePath);
  if (!fs.existsSync(full)) return {};
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

// Resolve config placeholders like "#{var/lab-autolab-lab-id}" against config/.env/<env>.json.
// Returns undefined if any placeholder can't be resolved (e.g. "#{ref/...}"), so we don't search blindly.
function resolveTemplate(value: unknown, secrets: Record<string, string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  let ok = true;
  const resolved = value.replace(/#\{([^}]+)\}/g, (_m, expr) => {
    const m = /^var\/(.+)$/.exec(expr);
    if (m && secrets[m[1]] !== undefined) return secrets[m[1]];
    ok = false; // unresolved: missing var, or a ref we cannot resolve here
    return '';
  });
  return ok ? resolved : undefined;
}

interface ManagedEntry {
  configName: string; // the config key, e.g. "VACCINE_TDAP" — and the terraform state resource name
  resourceType: FhirResource['resourceType'];
  url?: string;
  version?: string;
  identifiers: { system: string; value: string }[];
  tags: { system: string; code: string }[];
  name?: string; // last-resort identity (matched exactly), e.g. OTTEHR_ORGANIZATION
  criteria?: string; // for Subscription — uniquely identifies a managed subscription
}

// Read config/oystehr*/*.json and collect the managed entries to look for.
function collectManagedEntries(secrets: Record<string, string>): ManagedEntry[] {
  const entries: ManagedEntry[] = [];
  const files = CONFIG_DIRS.flatMap((dir) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => path.join(dir, f)) : []
  );
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const fhirResources = parsed?.fhirResources;
    if (!fhirResources || typeof fhirResources !== 'object') continue;
    for (const [configName, entry] of Object.entries<any>(fhirResources)) {
      const resource = entry?.resource;
      if (!resource?.resourceType) continue;

      const url = CANONICAL_TYPES.has(resource.resourceType) ? resolveTemplate(resource.url, secrets) : undefined;

      const identifiers = (Array.isArray(resource.identifier) ? resource.identifier : [])
        .map((i: any) => ({
          system: resolveTemplate(i?.system, secrets) ?? i?.system,
          value: resolveTemplate(i?.value, secrets),
        }))
        .filter((i: any) => i.value !== undefined && typeof i.system === 'string')
        .map((i: any) => ({ system: i.system, value: i.value as string }));

      const tags = (Array.isArray(resource.meta?.tag) ? resource.meta.tag : [])
        .filter((t: any) => t?.system && t?.code)
        .map((t: any) => ({ system: t.system as string, code: t.code as string }));

      const name = typeof resource.name === 'string' ? resolveTemplate(resource.name, secrets) : undefined;

      // Subscription has no identifier/url/tag; its `criteria` is the unique identity.
      const criteria =
        resource.resourceType === 'Subscription' ? resolveTemplate(resource.criteria, secrets) : undefined;

      // Need some literal identity to find live copies.
      if (!url && identifiers.length === 0 && tags.length === 0 && !name && !criteria) continue;

      entries.push({
        configName,
        resourceType: resource.resourceType,
        url,
        version: url ? resource.version ?? '' : undefined,
        identifiers,
        tags,
        name,
        criteria,
      });
    }
  }
  return entries;
}

// Map terraform state resource name (== config key) -> tracked FHIR resource id.
function loadStateIds(stateFile: string): Map<string, string> {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const map = new Map<string, string>();
  for (const r of state.resources ?? []) {
    if (r.type !== 'oystehr_fhir_resource') continue;
    const id = r.instances?.[0]?.attributes?.id;
    if (r.name && id) map.set(r.name, id);
  }
  return map;
}

// Targeted search for all live copies sharing this entry's identity.
async function findCopies(oystehr: Oystehr, entry: ManagedEntry): Promise<any[]> {
  const params: { name: string; value: string }[] = [
    // include `reason` and `criteria` so Subscription identity/divergence checks have what they need
    { name: '_elements', value: 'id,identifier,url,version,name,title,status,meta,criteria,reason' },
    { name: '_count', value: '1000' },
  ];
  const useName = entry.identifiers.length === 0 && entry.tags.length === 0 && !!entry.name;
  if (entry.url !== undefined) {
    params.push({ name: 'url', value: entry.url });
    if (entry.version) params.push({ name: 'version', value: entry.version });
  } else if (entry.criteria !== undefined) {
    params.push({ name: 'criteria', value: entry.criteria });
  } else {
    // Repeated params are AND-ed by FHIR — narrows to true copies.
    for (const id of entry.identifiers) params.push({ name: 'identifier', value: `${id.system}|${id.value}` });
    for (const t of entry.tags) params.push({ name: '_tag', value: `${t.system}|${t.code}` });
    // name is a fuzzy server-side match, so only fall back to it when there's no precise key.
    if (useName) params.push({ name: 'name', value: entry.name as string });
  }
  let copies = (await oystehr.fhir.search<any>({ resourceType: entry.resourceType, params })).unbundle();
  // Tighten the fuzzy name match to an exact-equality check.
  if (useName) copies = copies.filter((c: any) => (typeof c.name === 'string' ? c.name : '') === entry.name);
  // Defensive: confirm the criteria matched exactly (in case the server normalised it).
  if (entry.criteria !== undefined) copies = copies.filter((c: any) => c.criteria === entry.criteria);
  return copies;
}

function labelOf(resource: any): string {
  if (resource.title) return String(resource.title);
  if (resource.name) return typeof resource.name === 'string' ? resource.name : JSON.stringify(resource.name);
  // Subscriptions have no name/title; the human-meaningful label is `reason`.
  if (resource.reason) return String(resource.reason);
  return '';
}

function describe(resource: any): string {
  const label = resource.url ?? labelOf(resource);
  return `id=${resource.id} lastUpdated=${resource.meta?.lastUpdated ?? 'n/a'}${label ? ` ${label}` : ''}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const env = args[0] && !args[0].startsWith('--') ? args[0] : 'local';
  const shouldDelete = args.includes('--delete');
  const stateIdx = args.indexOf('--state');
  const stateFile = stateIdx >= 0 ? args[stateIdx + 1] : undefined;

  const secrets = loadJson(`config/.env/${env}.json`);
  const entries = collectManagedEntries(secrets);
  const stateIds = stateFile ? loadStateIds(stateFile) : undefined;

  console.log('Environment:', env);
  console.log('Delete mode:', shouldDelete);
  console.log(
    stateIds
      ? `Keeper authority: terraform state (${stateIds.size} tracked ids from ${stateFile})`
      : 'Keeper authority: OLDEST copy (heuristic — pass --state <file> for the reliable answer)'
  );
  console.log(`Managed config entries: ${entries.length}`);
  console.log('');

  const token = await getAuth0Token(secrets as unknown as Secrets);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets['AUTH0_AUDIENCE']),
  });

  let totalDuplicates = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;

  for (const entry of entries) {
    let copies: any[];
    try {
      copies = await findCopies(oystehr, entry);
    } catch (e) {
      console.log(`${entry.configName} [${entry.resourceType}] — SEARCH FAILED: ${(e as Error).message ?? e}`);
      continue;
    }
    if (copies.length <= 1) continue;

    const idLabel = entry.url ? `${entry.url}${entry.version ? `|${entry.version}` : ''}` : entry.configName;
    console.log(`DUPLICATE: ${entry.configName} [${entry.resourceType}] ${idLabel} — ${copies.length} copies`);

    // Pick the keeper: the terraform-tracked id, else (no state) the oldest.
    const stateId = stateIds?.get(entry.configName);
    let keeper: any;
    let keeperReason: string;
    if (stateIds) {
      keeper = copies.find((c) => c.id === stateId);
      keeperReason = 'terraform state';
    } else {
      keeper = [...copies].sort((a, b) => (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? ''))[0];
      keeperReason = 'oldest';
    }

    // Safety: if state points nowhere among the live copies (drift), don't guess — report and skip.
    if (!keeper) {
      console.log(
        `    keeper: terraform state id ${stateId ?? '(none for this entry)'} not found among live copies — DRIFT`
      );
      for (const c of copies) console.log(`    [?] ${describe(c)}`);
      console.log(`    SKIPPING — resolve drift manually (e.g. terraform import / apply).`);
      totalSkipped += copies.length;
      continue;
    }

    const extras = copies.filter((c) => c.id !== keeper.id);
    console.log(`    [KEEP]  ${describe(keeper)}  (${keeperReason})`);
    for (const c of extras) console.log(`    [EXTRA] ${describe(c)}`);

    // Defensive: if the extras don't look like the keeper, our identity search may be too broad.
    const divergent = extras.filter((c) => labelOf(c) !== labelOf(keeper) && labelOf(keeper) !== '');
    if (divergent.length > 0) {
      console.log(`    WARNING: ${divergent.length} extra(s) have a different name/title than the keeper —`);
      console.log(`             possible distinct resources sharing identity. SKIPPING in --delete mode.`);
      totalSkipped += extras.length;
      continue;
    }

    totalDuplicates += extras.length;
    if (shouldDelete) {
      for (const c of extras) {
        console.log(`    Deleting ${entry.resourceType}/${c.id}...`);
        await oystehr.fhir.delete({ resourceType: entry.resourceType, id: c.id });
        console.log(`    Deleted.`);
        totalDeleted++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total duplicate (deletable) FHIR resources: ${totalDuplicates}`);
  if (totalSkipped > 0) console.log(`Copies skipped for manual review (drift / divergent): ${totalSkipped}`);
  if (shouldDelete) {
    console.log(`Total deleted: ${totalDeleted}`);
  } else if (totalDuplicates > 0) {
    console.log(`Run with --delete to remove the extras.`);
  }
}

main()
  .then(() => console.log('\nDone.'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
