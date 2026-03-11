/**
 * Migration script: Generates merged config JSON for each project.
 * Run from local/core: npx tsx scripts/merge-project-configs.ts <project>
 */

import * as fs from 'fs';
import _ from 'lodash';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_CONFIG = path.join(__dirname, '..', 'packages', 'utils', 'lib', 'ottehr-config');

interface ModuleMapping {
  configKey: string;
  overrideKey: string;
}

const MODULE_MAP: Record<string, ModuleMapping> = {
  booking: { configKey: 'BOOKING_CONFIG', overrideKey: 'BOOKING_OVERRIDES' },
  branding: { configKey: 'BRANDING_CONFIG', overrideKey: 'BRANDING_OVERRIDES' },
  'consent-forms': { configKey: 'CONSENT_FORMS_CONFIG', overrideKey: 'CONSENT_FORMS_OVERRIDE' },
  forms: { configKey: 'FORMS_CONFIG', overrideKey: 'FORMS_CONFIG_OVERRIDE' },
  'intake-paperwork': { configKey: 'INTAKE_PAPERWORK_CONFIG', overrideKey: 'INTAKE_PAPERWORK_CONFIG' },
  'intake-paperwork-virtual': { configKey: 'VIRTUAL_INTAKE_PAPERWORK_CONFIG', overrideKey: 'INTAKE_PAPERWORK_CONFIG' },
  legal: { configKey: 'LEGAL_CONFIG', overrideKey: 'LEGAL_OVERRIDES' },
  locations: { configKey: 'LOCATION_CONFIG', overrideKey: 'LOCATIONS_OVERRIDES' },
  'medical-history': { configKey: 'MEDICAL_HISTORY_CONFIG', overrideKey: 'MEDICAL_HISTORY_OVERRIDES' },
  'patient-record': { configKey: 'PATIENT_RECORD_CONFIG', overrideKey: 'PATIENT_RECORD_OVERRIDES' },
  procedures: { configKey: 'PROCEDURES_CONFIG', overrideKey: 'PROCEDURES_CONFIG_OVERRIDE' },
  provider: { configKey: 'PROVIDER_CONFIG', overrideKey: 'PROVIDER_CONFIG_OVERRIDE' },
  'screening-questions': {
    configKey: 'patientScreeningQuestionsConfig',
    overrideKey: 'customScreeningQuestionsConfig',
  },
  sendgrid: { configKey: 'SENDGRID_CONFIG', overrideKey: 'SENDGRID_OVERRIDES' },
  texting: { configKey: 'TEXTING_CONFIG', overrideKey: 'TEXTING_OVERRIDES' },
  'value-sets': { configKey: 'VALUE_SETS', overrideKey: 'VALUE_SET_OVERRIDES' },
};

function isEmptyOverride(content: string): boolean {
  const stripped = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  if (/export\s+const\s+\w+\s*=\s*\{\}\s*(as\s*const)?\s*;?\s*$/.test(stripped)) return true;
  if (/export\s+const\s+\w+\s*=\s*undefined\s*;?\s*$/.test(stripped)) return true;
  return false;
}

async function main(): Promise<void> {
  const project = process.argv[2];
  if (!project) {
    console.error('Usage: npx tsx scripts/merge-project-configs.ts <project>');
    process.exit(1);
  }

  // Pre-import the full utils barrel to establish proper initialization order.
  // Individual module imports fail with circular dependency errors otherwise
  // (e.g., PRIVATE_EXTENSION_BASE_URL not yet initialized).
  const utilsMain = path.join(__dirname, '..', 'packages', 'utils', 'lib', 'main.ts');
  await import(utilsMain);

  const secretsBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config');
  const outputBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config-merged');

  if (!fs.existsSync(secretsBase)) {
    console.log(`No ottehr-config directory for project ${project}`);
    return;
  }

  const modules = fs.readdirSync(secretsBase).filter((f) => fs.statSync(path.join(secretsBase, f)).isDirectory());

  fs.mkdirSync(outputBase, { recursive: true });

  for (const mod of modules) {
    const overridePath = path.join(secretsBase, mod, 'overrides.ts');
    if (!fs.existsSync(overridePath)) continue;

    const content = fs.readFileSync(overridePath, 'utf8');
    if (isEmptyOverride(content)) {
      console.log(`  ${mod}: empty override, skipping`);
      continue;
    }

    const mapping = MODULE_MAP[mod];
    if (!mapping) {
      console.warn(`  ${mod}: no mapping defined, skipping`);
      continue;
    }

    // Copy override to core module dir temporarily for import resolution
    const tempFile = path.join(CORE_CONFIG, mod, '_project_override.ts');
    fs.copyFileSync(overridePath, tempFile);

    try {
      // Dynamic import of core config
      const coreModule = await import(path.join(CORE_CONFIG, mod, 'index.ts'));
      const coreConfig = coreModule[mapping.configKey];

      if (!coreConfig) {
        console.warn(
          `  ${mod}: core key '${mapping.configKey}' not found. Keys: ${Object.keys(coreModule).join(', ')}`
        );
        continue;
      }

      // Dynamic import of override
      const overrideModule = await import(tempFile);
      const overrideData = overrideModule[mapping.overrideKey];

      if (overrideData === undefined || overrideData === null) {
        console.log(`  ${mod}: override is undefined/null, skipping`);
        continue;
      }

      // Deep merge (arrays replace)
      const merged = _.mergeWith(_.cloneDeep(coreConfig), overrideData, (_: any, src: any) => {
        if (Array.isArray(src)) return src;
        return undefined;
      });

      // Write JSON
      const outDir = path.join(outputBase, mod);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'merged.json'), JSON.stringify(merged, null, 2));
      console.log(`  ${mod}: merged OK`);
    } catch (err: any) {
      console.error(`  ${mod}: ERROR - ${err.message}`);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  console.log(`\nOutput: ${outputBase}`);
}

main().catch(console.error);
