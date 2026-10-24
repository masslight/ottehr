#! npx tsx

/**
 * zambda-access — keeps role zambda grants in sync with the `access` declared on each zambda.
 *
 *   npm run zambda-access:check      # exit 1 if a declaration is missing/invalid or roles.json is stale
 *   npm run zambda-access:generate   # rewrite the zambda grants in roles.json from the declarations
 *
 * Runs on every commit touching config (lint-staged) and on every PR (Lint and Build), so a new
 * http_auth zambda cannot land without saying which roles may invoke it. See config/README.md
 * ("Zambda access") and packages/spec/src/zambda-access.ts for the rules.
 *
 * Usage: npx tsx scripts/config/zambda-access.ts [--check | --write] [--config-dir <dir>]
 * Any other arguments (e.g. the file names lint-staged appends) are ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  discoverSpecFiles,
  evaluateZambdaAccess,
  serializeSpecFile,
  ZambdaAccessEvaluation,
} from '../../packages/spec/src/zambda-access';

interface Args {
  write: boolean;
  configDir: string;
}

const parseArgs = (argv: string[]): Args => {
  let write = false;
  let configDir = path.resolve(__dirname, '../../config');
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') {
      write = true;
    } else if (arg === '--check') {
      write = false;
    } else if (arg === '--config-dir') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--config-dir requires a path');
      }
      configDir = path.resolve(value);
      i++;
    }
    // Anything else is ignored: lint-staged appends the staged file names.
  }
  return { write, configDir };
};

const relative = (file: string): string => path.relative(process.cwd(), file) || '.';

const annotate = (level: 'error' | 'warning', message: string): void => {
  // GitHub Actions turns these into annotations on the workflow run.
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::${level}::[zambda-access] ${message}`);
  }
};

const printFailures = (evaluation: ZambdaAccessEvaluation): void => {
  if (evaluation.failures.length > 0) {
    console.error('❌ Zambda access declarations are invalid:');
    for (const failure of evaluation.failures) {
      console.error(`   - ${failure}`);
      annotate('error', failure);
    }
  }
  if (evaluation.stale.length > 0) {
    console.error('❌ Role zambda grants are out of date:');
    for (const message of evaluation.stale) {
      console.error(`   - ${message}`);
      annotate('error', message);
    }
  }
};

const main = (): void => {
  const { write, configDir } = parseArgs(process.argv.slice(2));
  const specFiles = discoverSpecFiles(configDir);
  if (specFiles.length === 0) {
    throw new Error(`No spec files found under ${configDir}`);
  }
  const evaluation = evaluateZambdaAccess(specFiles);

  if (evaluation.failures.length > 0) {
    printFailures(evaluation);
    console.error(
      '\nEvery http_auth zambda must declare "access" (the lowest role keys that may invoke it, or [] for ' +
        'M2M-only). Fix the declarations above, then run `npm run zambda-access:generate` to regenerate the ' +
        'role grants. See config/README.md (Zambda access).'
    );
    process.exit(1);
  }

  if (write) {
    const changedFiles = evaluation.roleFiles.filter((roleFile) => roleFile.changed);
    for (const roleFile of changedFiles) {
      const source = specFiles.find((specFile) => specFile.path === roleFile.path);
      fs.writeFileSync(roleFile.path, serializeSpecFile(roleFile.spec, source?.trailingNewline ?? true));
      console.log(`✍️  Updated ${relative(roleFile.path)}`);
    }
    for (const message of evaluation.stale) {
      console.log(`   - ${message}`);
    }
    if (changedFiles.length === 0) {
      console.log('✅ Role zambda grants already match the access declarations; nothing to write.');
    } else {
      console.log(`\n✅ Regenerated zambda grants in ${changedFiles.length} file(s). Review and commit the change.`);
    }
    return;
  }

  if (evaluation.stale.length > 0) {
    printFailures(evaluation);
    console.error(
      '\nRun `npm run zambda-access:generate` to regenerate the role grants from the "access" declarations, ' +
        'then stage the updated roles file. See config/README.md (Zambda access).'
    );
    process.exit(1);
  }

  const zambdaCount = Object.values(evaluation.grants).flat().length;
  const roleCount = Object.keys(evaluation.grants).length;
  console.log(
    `✅ Zambda access check passed — every http_auth zambda declares its access and the ${roleCount} roles ` +
      `carry ${zambdaCount} matching grants.`
  );
};

main();
