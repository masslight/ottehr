/**
 * Generates project-specific defaults.ts files from merged JSON snapshots.
 *
 * Simple modules: generates a complete defaults.ts wrapping the JSON data.
 * Complex modules: skipped (need manual handling).
 *
 * Usage: npx tsx scripts/generate-project-defaults.ts <project>
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

// Simple modules: single data export, can be generated from JSON
const SIMPLE_MODULES: Record<string, { varName: string; typeImport?: string; typeAnnotation?: string }> = {
  branding: {
    varName: 'BRANDING_DATA',
    typeImport: "import { type BrandingConfig } from 'config-types';",
    typeAnnotation: ' as const satisfies BrandingConfig',
  },
  'consent-forms': {
    varName: 'CONSENT_FORMS_DATA',
    typeImport: "import { type ConsentFormsConfig } from 'config-types';",
    typeAnnotation: ' as const satisfies ConsentFormsConfig',
  },
  forms: {
    varName: 'FORMS_DATA',
    typeImport: "import { type FormsConfig } from 'config-types';",
    typeAnnotation: ' as const satisfies FormsConfig',
  },
  legal: {
    varName: 'LEGAL_DATA',
    typeImport: "import { type LegalConfig } from 'config-types';",
    typeAnnotation: ' as const satisfies LegalConfig',
  },
  locations: {
    varName: 'LOCATION_DATA',
    typeImport: "import { type LocationConfig } from 'config-types';",
    typeAnnotation: ': LocationConfig',
  },
  'medical-history': {
    varName: 'MEDICAL_HISTORY_DATA',
    typeImport: "import { type MedicalHistoryConfig } from 'config-types';",
    typeAnnotation: ' as const satisfies MedicalHistoryConfig',
  },
  procedures: {
    varName: 'PROCEDURES_DATA',
    typeImport: "import { type PrepopulationEntry, type ProceduresConfig } from 'config-types';",
    typeAnnotation: ' as const satisfies ProceduresConfig',
  },
  provider: {
    varName: 'PROVIDER_DATA',
    typeImport: "import { type ProviderConfig } from 'config-types';",
    typeAnnotation: ': ProviderConfig',
  },
  sendgrid: {
    varName: 'SENDGRID_DATA',
    typeAnnotation: ' as const',
  },
  texting: {
    varName: 'TEXTING_DATA',
    typeAnnotation: ' as const',
  },
};

// Complex modules that need manual handling
const COMPLEX_MODULES = new Set([
  'booking',
  'examination',
  'intake-paperwork',
  'intake-paperwork-virtual',
  'patient-record',
  'screening-questions',
  'value-sets',
  'vitals',
]);

function main(): void {
  const project = process.argv[2];
  if (!project) {
    console.error('Usage: npx tsx scripts/generate-project-defaults.ts <project>');
    process.exit(1);
  }

  const mergedBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config-merged');
  const outputBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config');

  if (!fs.existsSync(mergedBase)) {
    console.log(`No merged configs for ${project}`);
    return;
  }

  const modules = fs.readdirSync(mergedBase).filter((f) => fs.statSync(path.join(mergedBase, f)).isDirectory());

  for (const mod of modules) {
    const mergedFile = path.join(mergedBase, mod, 'merged.json');
    if (!fs.existsSync(mergedFile)) continue;

    const mergedData = JSON.parse(fs.readFileSync(mergedFile, 'utf8'));

    if (COMPLEX_MODULES.has(mod)) {
      console.log(`  ${mod}: complex module, skipping (needs manual handling)`);
      continue;
    }

    const config = SIMPLE_MODULES[mod];
    if (!config) {
      console.warn(`  ${mod}: no config defined, skipping`);
      continue;
    }

    const outDir = path.join(outputBase, mod);
    fs.mkdirSync(outDir, { recursive: true });

    let content = '';
    if (config.typeImport) {
      content += config.typeImport + '\n\n';
    }

    // For sendgrid, preserve the PATH_PREFIX constant
    if (mod === 'sendgrid') {
      content += "const PATH_PREFIX = '../packages/utils/lib';\n\n";
      // Replace any path references in the data that use the old prefix
    }

    const jsonStr = JSON.stringify(mergedData, null, 2);
    const annotation = config.typeAnnotation || '';
    // : Type goes before =, as const / satisfies goes after value
    if (annotation.startsWith(':')) {
      content += `export const ${config.varName}${annotation} = ${jsonStr};\n`;
    } else {
      content += `export const ${config.varName} = ${jsonStr}${annotation};\n`;
    }

    fs.writeFileSync(path.join(outDir, 'defaults.ts'), content);
    console.log(`  ${mod}: generated defaults.ts`);
  }
}

main();
