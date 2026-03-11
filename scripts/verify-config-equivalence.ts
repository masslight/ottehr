/**
 * Verifies that project-specific defaults.ts files produce configs
 * equivalent to the old defaults+overrides merge system.
 *
 * For each project, for each module with a merged JSON snapshot:
 * 1. Backs up core defaults.ts
 * 2. Copies the project's defaults.ts into core
 * 3. Runs a subprocess to import the module and output its config as JSON
 * 4. Compares against the merged JSON snapshot
 * 5. Restores the core defaults.ts
 *
 * Usage: npx tsx scripts/verify-config-equivalence.ts <project|all>
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_CONFIG = path.join(__dirname, '..', 'packages', 'utils', 'lib', 'ottehr-config');

const MODULE_CONFIG_KEY: Record<string, string> = {
  booking: 'BOOKING_CONFIG',
  branding: 'BRANDING_CONFIG',
  'consent-forms': 'CONSENT_FORMS_CONFIG',
  forms: 'FORMS_CONFIG',
  'intake-paperwork': 'INTAKE_PAPERWORK_CONFIG',
  'intake-paperwork-virtual': 'VIRTUAL_INTAKE_PAPERWORK_CONFIG',
  legal: 'LEGAL_CONFIG',
  locations: 'LOCATION_CONFIG',
  'medical-history': 'MEDICAL_HISTORY_CONFIG',
  'patient-record': 'PATIENT_RECORD_CONFIG',
  procedures: 'PROCEDURES_CONFIG',
  provider: 'PROVIDER_CONFIG',
  'screening-questions': 'patientScreeningQuestionsConfig',
  sendgrid: 'SENDGRID_CONFIG',
  texting: 'TEXTING_CONFIG',
  'value-sets': 'VALUE_SETS',
};

/**
 * Known-harmless differences between old merged snapshots and new config output.
 *
 * - booking top-level FormFields: harmless artifact of old double-merge
 *   (override merged at both form-level and booking-level). No consumer reads it.
 * - booking formConfig hiddenFields/requiredFields: old overrides had FormFields at
 *   the booking-level, so the form-level merge never received them. Our new defaults
 *   apply the intended customizations that the old system silently dropped.
 * - intake-paperwork / intake-paperwork-virtual: Zod schema applies
 *   `.default('hidden')` to `disabledDisplay` fields. Old snapshot was captured
 *   pre-schema so has `undefined`; new output has `"hidden"`. Same runtime behavior.
 * - branding intentional fixes: urgikids supportPhoneNumber moved to locations config;
 *   xpress logoUrl (wrong case) fixed to logoURL (schema-accepted key).
 */
function isKnownHarmlessDiff(mod: string, diffPath: string, snapshotVal: any, configVal: any): boolean {
  // Booking: top-level FormFields key is a double-merge artifact
  if (mod === 'booking' && diffPath.startsWith('FormFields')) return true;

  // Booking: formConfig hiddenFields/requiredFields — old overrides never took effect
  // due to double-merge structure; new defaults apply the intended customizations
  if (
    mod === 'booking' &&
    (diffPath.startsWith('formConfig.FormFields.patientInfo.hiddenFields') ||
      diffPath.startsWith('formConfig.FormFields.patientInfo.requiredFields'))
  )
    return true;

  // Intake paperwork: disabledDisplay defaults applied by Zod schema
  if (
    (mod === 'intake-paperwork' || mod === 'intake-paperwork-virtual') &&
    diffPath.endsWith('.disabledDisplay') &&
    snapshotVal === undefined &&
    configVal === 'hidden'
  )
    return true;

  // Branding: intentional fixes — supportPhoneNumber removed, logoUrl→logoURL
  if (mod === 'branding' && diffPath === 'email.supportPhoneNumber') return true;
  if (mod === 'branding' && (diffPath === 'email.logoUrl' || diffPath === 'email.logoURL')) return true;

  return false;
}

function deepDiff(a: any, b: any, p: string = ''): string[] {
  const diffs: string[] = [];
  if (a === b) return diffs;
  if (a === null || b === null || typeof a !== typeof b) {
    diffs.push(`${p}: ${JSON.stringify(a)?.slice(0, 80)} !== ${JSON.stringify(b)?.slice(0, 80)}`);
    return diffs;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) diffs.push(`${p}: array length ${a.length} !== ${b.length}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diffs.push(...deepDiff(a[i], b[i], `${p}[${i}]`));
    }
    return diffs;
  }
  if (typeof a === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diffs.push(...deepDiff(a[key], b[key], p ? `${p}.${key}` : key));
    }
    return diffs;
  }
  if (a !== b) diffs.push(`${p}: ${JSON.stringify(a)?.slice(0, 60)} !== ${JSON.stringify(b)?.slice(0, 60)}`);
  return diffs;
}

function verifyProject(project: string): { passed: number; failed: number } {
  const mergedBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config-merged');
  const projectConfigBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config');
  let passed = 0;
  let failed = 0;

  if (!fs.existsSync(mergedBase)) {
    console.log(`  No merged configs for ${project}`);
    return { passed, failed };
  }

  const modules = fs.readdirSync(mergedBase).filter((f) => fs.statSync(path.join(mergedBase, f)).isDirectory());

  for (const mod of modules) {
    const snapshotFile = path.join(mergedBase, mod, 'merged.json');
    if (!fs.existsSync(snapshotFile)) continue;

    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const configKey = MODULE_CONFIG_KEY[mod];

    if (!configKey) {
      console.log(`  ${mod}: ✗ SKIP (no config key mapping)`);
      failed++;
      continue;
    }

    const projectDefaultsPath = path.join(projectConfigBase, mod, 'defaults.ts');
    if (!fs.existsSync(projectDefaultsPath)) {
      console.log(`  ${mod}: ✗ MISSING (no project defaults.ts)`);
      failed++;
      continue;
    }

    const coreDefaultsPath = path.join(CORE_CONFIG, mod, 'defaults.ts');
    const backupPath = coreDefaultsPath + '.bak';
    let restored = false;

    try {
      // Backup core defaults & copy project defaults
      if (fs.existsSync(coreDefaultsPath)) {
        fs.copyFileSync(coreDefaultsPath, backupPath);
      }
      fs.copyFileSync(projectDefaultsPath, coreDefaultsPath);

      // Run subprocess to import and serialize the config
      const result = execSync(`npx tsx scripts/verify-single-module.ts "${mod}" "${configKey}"`, {
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const config = JSON.parse(result);
      const allDiffs = deepDiff(snapshot, config);

      // Separate harmless known differences from real failures
      const realDiffs: string[] = [];
      const ignoredDiffs: string[] = [];
      for (const d of allDiffs) {
        // Parse path and values from diff string: "path: valA !== valB"
        const colonIdx = d.indexOf(':');
        const diffPath = d.slice(0, colonIdx).trim();
        // Check against raw snapshot/config values at the path
        const pathParts = diffPath.replace(/\[(\d+)\]/g, '.$1').split('.');
        let snapVal: any = snapshot;
        let confVal: any = config;
        for (const part of pathParts) {
          snapVal = snapVal?.[part];
          confVal = confVal?.[part];
        }
        if (isKnownHarmlessDiff(mod, diffPath, snapVal, confVal)) {
          ignoredDiffs.push(d);
        } else {
          realDiffs.push(d);
        }
      }

      if (realDiffs.length === 0) {
        const suffix = ignoredDiffs.length > 0 ? ` (${ignoredDiffs.length} known-harmless ignored)` : '';
        console.log(`  ${mod}: ✓ PASS${suffix}`);
        passed++;
      } else {
        console.log(`  ${mod}: ✗ FAIL (${realDiffs.length} differences)`);
        for (const d of realDiffs.slice(0, 5)) console.log(`    ${d}`);
        if (realDiffs.length > 5) console.log(`    ... and ${realDiffs.length - 5} more`);
        failed++;
      }
    } catch (err: any) {
      console.log(`  ${mod}: ✗ ERROR - ${err.message?.split('\n')[0]}`);
      failed++;
    } finally {
      // Restore core defaults
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, coreDefaultsPath);
        fs.unlinkSync(backupPath);
        restored = true;
      }
      if (!restored && fs.existsSync(coreDefaultsPath + '.bak')) {
        // Shouldn't happen, but safety check
        fs.copyFileSync(coreDefaultsPath + '.bak', coreDefaultsPath);
        fs.unlinkSync(coreDefaultsPath + '.bak');
      }
    }
  }

  return { passed, failed };
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npx tsx scripts/verify-config-equivalence.ts <project|all>');
    process.exit(1);
  }

  const projects = arg === 'all' ? ['nightwatch', 'quality', 'urgikids', 'xpress'] : [arg];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const project of projects) {
    console.log(`\n=== ${project} ===`);
    const { passed, failed } = verifyProject(project);
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Passed: ${totalPassed}, Failed: ${totalFailed}, Total: ${totalPassed + totalFailed}`);
  if (totalFailed > 0) process.exit(1);
}

main();
