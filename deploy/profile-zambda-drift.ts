/**
 * Reports how many Zambda zips Terraform is about to re-upload, and why.
 *
 * The Oystehr provider stores a SHA-256 of the zip file it last uploaded in
 * `oystehr_zambda.source_checksum` and re-uploads whenever the freshly built zip
 * hashes differently. This script computes the same hash for every zip in
 * `packages/zambdas/.dist/zips` and diffs it against the checksums currently in
 * state, so a CI run can answer "how much of this apply is re-uploading code
 * that did not meaningfully change?".
 *
 * With ZAMBDA_DETERMINISM_CHECK=1 it additionally re-runs the bundler into a
 * scratch directory and compares the two builds, which separates "the source
 * really differs from what is deployed" from "our build is not reproducible".
 *
 * Read-only: it shells out to `terraform show -json` and never mutates state.
 *
 * Usage: TF_PROFILE_DIR=<dir> tsx profile-zambda-drift.ts
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const zambdasDir = path.resolve(__dirname, '../packages/zambdas');

interface ZambdaSpec {
  name: string;
  zip: string;
}

interface StateResource {
  type?: string;
  name?: string;
  address?: string;
  values?: { source_checksum?: string; name?: string };
}

interface StateModule {
  resources?: StateResource[];
  child_modules?: StateModule[];
}

const readZambdaSpecs = (): Record<string, ZambdaSpec> => {
  const specs: Record<string, ZambdaSpec> = {};
  const files = [
    path.resolve(__dirname, '../config/oystehr-core/zambdas.json'),
    path.resolve(__dirname, '../config/billing-app-core/zambdas.json'),
  ];
  const env = process.env.ENV;
  if (env) {
    files.push(path.resolve(__dirname, `../config/oystehr/env/${env}/zambdas.json`));
  }
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { zambdas?: Record<string, ZambdaSpec> };
    Object.assign(specs, parsed.zambdas ?? {});
  }
  return specs;
};

const sha256File = (file: string): string | undefined => {
  if (!fs.existsSync(file)) return undefined;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
};

const collectResources = (mod: StateModule | undefined, out: StateResource[] = []): StateResource[] => {
  if (!mod) return out;
  for (const resource of mod.resources ?? []) out.push(resource);
  for (const child of mod.child_modules ?? []) collectResources(child, out);
  return out;
};

const readStateChecksums = (): Map<string, string> => {
  const raw = execFileSync('terraform', ['show', '-json'], {
    cwd: __dirname,
    encoding: 'utf-8',
    maxBuffer: 512 * 1024 * 1024,
  });
  const state = JSON.parse(raw) as { values?: { root_module?: StateModule } };
  const checksums = new Map<string, string>();
  for (const resource of collectResources(state.values?.root_module)) {
    if (resource.type !== 'oystehr_zambda') continue;
    const checksum = resource.values?.source_checksum;
    if (resource.name && checksum) checksums.set(resource.name, checksum);
  }
  return checksums;
};

/**
 * Rebuilds every Zambda a second time and reports which zips hash differently
 * than the first build. Anything listed here is non-reproducible output — it
 * would be re-uploaded on every apply even with zero source changes.
 */
const runDeterminismCheck = async (specs: Record<string, ZambdaSpec>): Promise<string[]> => {
  const firstBuild = new Map<string, string>();
  for (const [key, spec] of Object.entries(specs)) {
    const hash = sha256File(path.join(zambdasDir, spec.zip));
    if (hash) firstBuild.set(key, hash);
  }

  const stash = path.join(zambdasDir, '.dist-determinism-check');
  await fsp.rm(stash, { recursive: true, force: true });
  await fsp.rename(path.join(zambdasDir, '.dist'), stash);
  try {
    execFileSync('npm', ['run', 'bundle'], { cwd: zambdasDir, stdio: 'inherit' });
    const differing: string[] = [];
    for (const [key, spec] of Object.entries(specs)) {
      const rebuilt = sha256File(path.join(zambdasDir, spec.zip));
      if (rebuilt && firstBuild.get(key) !== rebuilt) differing.push(key);
    }
    return differing;
  } finally {
    // Restore the build the plan was made against, so the apply uploads exactly
    // the artifacts Terraform hashed.
    await fsp.rm(path.join(zambdasDir, '.dist'), { recursive: true, force: true });
    await fsp.rename(stash, path.join(zambdasDir, '.dist'));
  }
};

const main = async (): Promise<void> => {
  const specs = readZambdaSpecs();
  const stateChecksums = readStateChecksums();

  const unchanged: string[] = [];
  const changed: string[] = [];
  const notInState: string[] = [];
  const missingZip: string[] = [];

  for (const [key, spec] of Object.entries(specs)) {
    const zipPath = path.join(zambdasDir, spec.zip);
    const hash = sha256File(zipPath);
    if (!hash) {
      missingZip.push(key);
      continue;
    }
    const deployed = stateChecksums.get(key);
    if (!deployed) notInState.push(key);
    else if (deployed === hash) unchanged.push(key);
    else changed.push(key);
  }

  const total = Object.keys(specs).length;
  const lines = [
    '### Zambda source drift',
    '',
    `| Bucket | Count |`,
    `| --- | --- |`,
    `| Zambdas in config | ${total} |`,
    `| Zip matches deployed checksum (no upload) | ${unchanged.length} |`,
    `| Zip differs from deployed checksum (re-upload) | ${changed.length} |`,
    `| Not yet in state (create) | ${notInState.length} |`,
    `| Zip missing from build output | ${missingZip.length} |`,
  ];

  if (process.env.ZAMBDA_DETERMINISM_CHECK === '1') {
    const nonReproducible = await runDeterminismCheck(specs);
    lines.push(
      '',
      `Rebuilt all ${total} Zambdas from the same commit: **${nonReproducible.length}** produced a different zip.`,
      nonReproducible.length
        ? `Non-reproducible: ${nonReproducible.slice(0, 20).join(', ')}${nonReproducible.length > 20 ? ', …' : ''}`
        : 'The build is byte-for-byte reproducible, so re-uploads are driven by real source differences.'
    );
  }

  const report = lines.join('\n');
  console.log(report);

  const profileDir = process.env.TF_PROFILE_DIR;
  if (profileDir) {
    await fsp.mkdir(profileDir, { recursive: true });
    await fsp.writeFile(path.join(profileDir, 'zambda-drift.md'), `${report}\n`, 'utf-8');
    await fsp.writeFile(
      path.join(profileDir, 'zambda-drift.json'),
      JSON.stringify({ total, unchanged, changed, notInState, missingZip }, null, 2),
      'utf-8'
    );
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
