import fs from 'node:fs';
import path from 'node:path';
import { BatchInputPostRequest, default as Oystehr } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource } from 'fhir/r4b';
import { SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

/**
 * One-shot, idempotent seeder for the FHIR resources under config/runtime-seed/.
 *
 * These resources (Locations + their Schedules, the default group-scheduling
 * graph, and any future scheduling resources) used to be Terraform-managed. They
 * were moved out of Terraform so they can be created + maintained self-service via
 * the admin UI (see removed-locations.tf.json, generated from config/runtime-seed/).
 * Terraform now only fires this seeder once per fresh environment to create the
 * defaults; from there their lifecycle lives entirely in FHIR + the admin UI.
 *
 * It reads whatever the active instance ships in config/runtime-seed/, so it is one
 * script for every instance — the per-instance data lives in the config, not here.
 *
 * "Faithful": each file's resources are POSTed as authored, with two rewrites —
 *   1. intra-file `#{ref/fhirResources/KEY/...}` placeholders resolve to the
 *      target's `urn:uuid` fullUrl inside the transaction, and
 *   2. placeholders that only Terraform can resolve (`#{var/...}` and cross-file
 *      `#{ref/...}` to resources not in the seed set, e.g. a lab Organization) are
 *      dropped along with the field/element that carries them. Those are all
 *      optional integration fields (stripe/advapacs/lab identifiers) that an admin
 *      now configures self-service — never booking-gating fields.
 */
const RUNTIME_SEED_DIR = path.resolve(__dirname, '../../../../config/runtime-seed');

interface SeedFile {
  name: string;
  resources: Record<string, { resource: any }>;
}

const readSeedFiles = (): SeedFile[] => {
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(RUNTIME_SEED_DIR).filter((name) => name.endsWith('.json'));
  } catch (err: any) {
    // No runtime-seed directory → nothing to seed.
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
  return fileNames.map((name) => {
    const parsed = JSON.parse(fs.readFileSync(path.join(RUNTIME_SEED_DIR, name), 'utf-8'));
    return { name, resources: parsed.fhirResources ?? {} };
  });
};

const containsPlaceholder = (node: unknown): boolean => JSON.stringify(node ?? null).includes('#{');

/**
 * Resolves intra-file references to `urn:uuid` fullUrls. A `.../id` reference
 * (bare, `Type/`-prefixed, or `#{ref/.../type}/`-prefixed) that targets a member
 * of THIS file becomes that member's urn:uuid; a `.../type` reference becomes the
 * literal resourceType. References to keys not in this file are left untouched so
 * the strip step below can remove them.
 */
const resolveIntraFileRefs = (
  resource: any,
  uuidByKey: Record<string, string>,
  typeByKey: Record<string, string>
): any => {
  const serialized = JSON.stringify(resource)
    .replace(
      /(?:[A-Za-z]+\/|#\{ref\/fhirResources\/[A-Za-z0-9_]+\/type\}\/)?#\{ref\/fhirResources\/([A-Za-z0-9_]+)\/id\}/g,
      (match, key: string) => (uuidByKey[key] ? `urn:uuid:${uuidByKey[key]}` : match)
    )
    .replace(/#\{ref\/fhirResources\/([A-Za-z0-9_]+)\/type\}/g, (match, key: string) => typeByKey[key] ?? match);
  return JSON.parse(serialized);
};

/**
 * Drops any array element or object field whose subtree still carries an
 * unresolvable placeholder — removing the whole carrier (e.g. a lab-account
 * identifier or a stripe-account extension), not just the placeholder string,
 * so the result is always valid FHIR.
 */
const stripUnresolvablePlaceholders = (node: any): any => {
  if (Array.isArray(node)) {
    // Drop whole elements that carry a placeholder (e.g. a lab-account
    // identifier), keeping and recursing into the clean ones (e.g. the slug).
    return node.filter((child) => !containsPlaceholder(child)).map(stripUnresolvablePlaceholders);
  }
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      // Clean the field first, THEN drop it only if a placeholder survives — so a
      // field like `identifier` keeps its clean entries (the slug) while shedding
      // dirty ones, instead of being dropped wholesale.
      const cleaned = stripUnresolvablePlaceholders(value);
      if (containsPlaceholder(cleaned)) {
        continue;
      }
      out[key] = cleaned;
    }
    return out;
  }
  return node;
};

const slugOf = (resource: any): string | undefined =>
  resource.identifier?.find((identifier: any) => identifier.system === SLUG_SYSTEM)?.value;

/**
 * Idempotency: a file is considered already-seeded if any of its slug-bearing
 * "anchor" resources already exists. This makes the seeder a safe one-time
 * bootstrap — re-runs (and the migration of environments that already had these
 * resources via Terraform) are no-ops. Incremental additions happen self-service,
 * not by re-seeding.
 */
const alreadySeeded = async (oystehr: Oystehr, resources: SeedFile['resources']): Promise<boolean> => {
  const anchors = Object.values(resources)
    .map((wrapper) => wrapper.resource)
    .map((resource) => ({ resourceType: resource.resourceType, slug: slugOf(resource) }))
    .filter((anchor): anchor is { resourceType: string; slug: string } => Boolean(anchor.slug));

  for (const anchor of anchors) {
    const existing = await oystehr.fhir.search({
      resourceType: anchor.resourceType as any,
      params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|${anchor.slug}` }],
    });
    if (existing.entry?.length) {
      return true;
    }
  }
  return false;
};

const seedFile = async (oystehr: Oystehr, file: SeedFile): Promise<void> => {
  const entries = Object.entries(file.resources);
  if (entries.length === 0) {
    return;
  }
  if (await alreadySeeded(oystehr, file.resources)) {
    console.log(`'${file.name}' already seeded — skipping.`);
    return;
  }

  const uuidByKey = Object.fromEntries(entries.map(([key]) => [key, randomUUID()]));
  const typeByKey = Object.fromEntries(entries.map(([key, wrapper]) => [key, wrapper.resource.resourceType]));

  const requests: BatchInputPostRequest<FhirResource>[] = entries.map(([key, wrapper]) => {
    const resolved = resolveIntraFileRefs(wrapper.resource, uuidByKey, typeByKey);
    const resource = stripUnresolvablePlaceholders(resolved) as FhirResource;
    return {
      method: 'POST',
      url: `/${resource.resourceType}`,
      resource,
      fullUrl: `urn:uuid:${uuidByKey[key]}`,
    };
  });

  console.log(`Seeding '${file.name}' (${requests.length} resources)...`);
  await oystehr.fhir.transaction<FhirResource>({ requests });
  console.log(`Seeded '${file.name}'.`);
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(async (config) => {
    const oystehr = await createOystehrClientFromConfig(config);
    for (const file of readSeedFiles()) {
      await seedFile(oystehr, file);
    }
  });
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
