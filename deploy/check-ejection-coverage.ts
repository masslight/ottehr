/**
 * check-ejection-coverage — CI safety gate for the self-service-scheduling ejection.
 *
 * Guarantees that no `oystehr_fhir_resource` leaves Terraform management without a
 * `removed { destroy = false }` block backed by a `config/runtime-seed` entry — computed
 * against the PR's target branch. A resource that would be DESTROYED on apply (rather than
 * ejected) fails the check. See docs/self-service-scheduling.md (Part I → Safeguards).
 *
 * The core `evaluate` is pure set-logic (exported for unit tests). The CI job runs
 * `generate` for the base + head refs into separate output dirs and passes them in.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface RemovalBlock {
  key: string;
  /** `lifecycle.destroy` as read from the removed{} block; must be exactly `false`. */
  destroy: unknown;
}

export interface EvaluateInput {
  /** oystehr_fhir_resource keys managed on the target (base) ref. */
  baseManaged: string[];
  /** oystehr_fhir_resource keys managed on the PR (head) ref. */
  headManaged: string[];
  /** removed{} blocks declared on the PR (head) ref. */
  removed: RemovalBlock[];
  /** resource keys present in config/runtime-seed on the PR (head) ref. */
  seed: string[];
}

export interface EvaluateResult {
  failures: string[];
  warnings: string[];
}

/**
 * Pure evaluation of the ejection-coverage invariants. No I/O — trivially testable.
 *
 * "Ejected" is derived from the cross-ref diff (`baseManaged − headManaged`), NOT from the
 * removal blocks: the removals are generated from the seed, so checking them against the
 * seed would be vacuous. The diff is the only thing that catches a resource that fell out
 * of config with no removal block (which `apply` would destroy).
 */
export const evaluate = (input: EvaluateInput): EvaluateResult => {
  const baseManaged = new Set(input.baseManaged);
  const headManaged = new Set(input.headManaged);
  const removedKeys = new Set(input.removed.map((r) => r.key));
  const seed = new Set(input.seed);

  const failures: string[] = [];
  const warnings: string[] = [];

  // Resources that left TF management on this PR.
  const ejected = [...baseManaged].filter((k) => !headManaged.has(k));

  // (1a) No silent un-management: anything ejected must have a removal block.
  const silentlyDropped = ejected.filter((k) => !removedKeys.has(k)).sort();
  if (silentlyDropped.length > 0) {
    failures.push(
      `Left TF management with NO removed{} block — would be DESTROYED on apply, not ejected: ${silentlyDropped.join(
        ', '
      )}`
    );
  }

  // (1b) Every removal must be non-destructive (state-only drop).
  const destructive = input.removed
    .filter((r) => r.destroy !== false)
    .map((r) => r.key)
    .sort();
  if (destructive.length > 0) {
    failures.push(
      `removed{} block(s) without destroy=false — would DESTROY the FHIR resource, not just drop it from state: ${destructive.join(
        ', '
      )}`
    );
  }

  // (2) Reproducibility: every removal must be backed by seed data.
  const removalNotSeeded = [...removedKeys].filter((k) => !seed.has(k)).sort();
  if (removalNotSeeded.length > 0) {
    failures.push(
      `removed{} block(s) not backed by config/runtime-seed — ejected but not re-seedable: ${removalNotSeeded.join(
        ', '
      )}`
    );
  }

  // Informational: a removal for something the base didn't manage is a stale/no-op block.
  const staleRemovals = [...removedKeys].filter((k) => !baseManaged.has(k)).sort();
  if (staleRemovals.length > 0) {
    warnings.push(
      `removed{} block(s) for resources not managed on the target branch (stale/no-op): ${staleRemovals.join(', ')}`
    );
  }

  return { failures, warnings };
};

// ---- File I/O (thin readers over the generated tf.json + seed) ----

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;

/** oystehr_fhir_resource keys from a generated `fhir-resources.tf.json` (HCL-JSON). */
export const readManagedKeys = (oystehrDir: string): string[] => {
  const file = path.join(oystehrDir, 'fhir-resources.tf.json');
  if (!fs.existsSync(file)) return [];
  const resource = readJson(file).resource;
  // HCL-JSON allows the `resource` block as an object or an array of objects.
  const blocks = Array.isArray(resource) ? resource : resource ? [resource] : [];
  const keys: string[] = [];
  for (const block of blocks) {
    const byName = (block as Record<string, unknown>)?.oystehr_fhir_resource;
    if (byName && typeof byName === 'object') keys.push(...Object.keys(byName));
  }
  return keys;
};

/** removed{} blocks from a generated `removed-locations.tf.json`. */
export const readRemovals = (oystehrDir: string): RemovalBlock[] => {
  const file = path.join(oystehrDir, 'removed-locations.tf.json');
  if (!fs.existsSync(file)) return [];
  const removed = readJson(file).removed;
  if (!Array.isArray(removed)) return [];
  return removed.map((block: Record<string, unknown>) => ({
    key: String(block?.from ?? '').replace(/^oystehr_fhir_resource\./, ''),
    destroy: (block?.lifecycle as Record<string, unknown> | undefined)?.destroy,
  }));
};

/** resource keys from every `config/runtime-seed/*.json`. */
export const readSeedKeys = (seedDir: string): string[] => {
  if (!fs.existsSync(seedDir)) return [];
  const keys: string[] = [];
  for (const name of fs.readdirSync(seedDir).filter((n) => n.endsWith('.json'))) {
    const fhirResources = readJson(path.join(seedDir, name)).fhirResources;
    if (fhirResources && typeof fhirResources === 'object') keys.push(...Object.keys(fhirResources));
  }
  return keys;
};

interface Args {
  baseDir: string;
  headDir: string;
  seedDir: string;
}

const parseArgs = (argv: string[]): Args => {
  const get = (flag: string): string => {
    const i = argv.indexOf(flag);
    if (i === -1 || i + 1 >= argv.length) throw new Error(`Missing required arg: ${flag}`);
    return argv[i + 1];
  };
  return { baseDir: get('--base-dir'), headDir: get('--head-dir'), seedDir: get('--seed-dir') };
};

const main = (): void => {
  const { baseDir, headDir, seedDir } = parseArgs(process.argv.slice(2));
  const result = evaluate({
    baseManaged: readManagedKeys(baseDir),
    headManaged: readManagedKeys(headDir),
    removed: readRemovals(headDir),
    seed: readSeedKeys(seedDir),
  });

  for (const w of result.warnings) console.warn(`::warning::[ejection-coverage] ${w}`);

  if (result.failures.length > 0) {
    console.error('❌ Ejection coverage check FAILED:');
    for (const f of result.failures) console.error(`   - ${f}`);
    console.error(
      '\nEvery FHIR resource that leaves Terraform management must have a removed{ destroy = false } ' +
        'block backed by a config/runtime-seed entry. See docs/self-service-scheduling.md (Safeguards).'
    );
    process.exit(1);
  }

  console.log(
    '✅ Ejection coverage check passed — nothing leaves TF management without a seed-backed, non-destructive removal.'
  );
};

export { main };

// Mirror generate-oystehr-resources.ts: run only when invoked as a script, not on import.
const isMainModule =
  require.main === module ||
  (typeof process !== 'undefined' && process.argv[1]?.endsWith('check-ejection-coverage.ts'));
if (isMainModule) {
  main();
}
