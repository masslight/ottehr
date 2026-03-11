/**
 * Generates project-specific config files from merged JSON.
 *
 * For simple modules (data inline in index.ts):
 *   Reads core index.ts, replaces the data constant with merged JSON data.
 *
 * For complex modules (data in defaults.ts):
 *   Reads core defaults.ts, replaces the data exports with merged JSON data.
 *
 * Usage: npx tsx scripts/generate-project-configs.ts <project>
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_CONFIG = path.join(__dirname, '..', 'packages', 'utils', 'lib', 'ottehr-config');

// Modules where the core has a separate defaults.ts
const COMPLEX_MODULES = new Set([
  'booking',
  'examination',
  'intake-paperwork',
  'intake-paperwork-virtual',
  'patient-record',
  'vitals',
]);

// Module -> { dataVarName: name of the const in index.ts that holds the raw data }
const SIMPLE_MODULE_DATA_VAR: Record<string, string> = {
  branding: 'BRANDING_DATA',
  'consent-forms': 'CONSENT_FORMS_DATA',
  forms: 'FORMS_DATA',
  legal: 'LEGAL_DATA',
  locations: 'LOCATION_DATA',
  'medical-history': 'MEDICAL_HISTORY_DATA',
  procedures: 'PROCEDURES_DATA',
  provider: 'PROVIDER_DATA',
  sendgrid: 'SENDGRID_DATA',
  texting: 'TEXTING_DATA',
  'value-sets': 'formValueSetsData',
};

function main(): void {
  const project = process.argv[2];
  if (!project) {
    console.error('Usage: npx tsx scripts/generate-project-configs.ts <project>');
    process.exit(1);
  }

  const mergedBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config-merged');
  const outputBase = path.join(ROOT, 'secrets', project, 'configuration', 'ottehr-config');

  if (!fs.existsSync(mergedBase)) {
    console.log(`No merged configs found for ${project}`);
    return;
  }

  const modules = fs.readdirSync(mergedBase).filter((f) => fs.statSync(path.join(mergedBase, f)).isDirectory());

  for (const mod of modules) {
    const mergedFile = path.join(mergedBase, mod, 'merged.json');
    if (!fs.existsSync(mergedFile)) continue;

    const mergedData = JSON.parse(fs.readFileSync(mergedFile, 'utf8'));

    if (COMPLEX_MODULES.has(mod)) {
      generateComplexModuleDefaults(mod, mergedData, outputBase);
    } else if (SIMPLE_MODULE_DATA_VAR[mod]) {
      generateSimpleModuleIndex(mod, mergedData, outputBase);
    } else if (mod === 'screening-questions') {
      generateScreeningQuestions(mergedData, outputBase);
    } else {
      console.warn(`  ${mod}: no generator defined`);
    }
  }
}

function generateSimpleModuleIndex(mod: string, data: any, outputBase: string): void {
  const coreIndexPath = path.join(CORE_CONFIG, mod, 'index.ts');
  const coreContent = fs.readFileSync(coreIndexPath, 'utf8');
  const varName = SIMPLE_MODULE_DATA_VAR[mod];

  // Find and replace the data variable assignment
  // Pattern: const VARNAME = { ... } as const satisfies ...;
  // or: const VARNAME = { ... } as const;
  // or: const VARNAME: Type = { ... };
  const dataStr = formatAsTypescript(data);

  // Use regex to find the const declaration and replace the object
  const patterns = [
    // const VARNAME = { ... } as const satisfies Type;
    new RegExp(`(const ${varName}[^=]*=\\s*)\\{[\\s\\S]*?\\}\\s*as\\s+const\\s+satisfies\\s+\\w+;`, 'm'),
    // const VARNAME = { ... } as const;
    new RegExp(`(const ${varName}[^=]*=\\s*)\\{[\\s\\S]*?\\}\\s*as\\s+const;`, 'm'),
    // const VARNAME: Type = { ... };
    new RegExp(`(const ${varName}[^=]*=\\s*)\\{[\\s\\S]*?\\};`, 'm'),
  ];

  let newContent = coreContent;
  let replaced = false;

  for (const pattern of patterns) {
    const match = coreContent.match(pattern);
    if (match) {
      // Extract the prefix (const VARNAME = ) and the suffix (as const satisfies Type;)
      const fullMatch = match[0];
      const prefix = match[1];

      // Find what comes after the object (as const satisfies ...; or as const; or ;)
      const suffixMatch = fullMatch.match(/\}\s*(as\s+const\s+satisfies\s+\w+;|as\s+const;|;)\s*$/);
      const suffix = suffixMatch ? suffixMatch[1] : ';';

      newContent = coreContent.replace(fullMatch, `${prefix}${dataStr} ${suffix}`);
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    console.warn(`  ${mod}: could not find data var '${varName}' to replace`);
    return;
  }

  const outDir = path.join(outputBase, mod);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.ts'), newContent);
  console.log(`  ${mod}: generated index.ts`);
}

function generateComplexModuleDefaults(mod: string, data: any, outputBase: string): void {
  // For complex modules, we'd need to generate a defaults.ts
  // This is harder because defaults.ts contains functions and complex structures
  // For now, just save the merged JSON for manual handling
  const outDir = path.join(outputBase, mod);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'merged-data.json'), JSON.stringify(data, null, 2));
  console.log(`  ${mod}: saved merged JSON (complex module - needs manual conversion)`);
}

function generateScreeningQuestions(data: any, outputBase: string): void {
  // screening-questions uses a different pattern - it re-exports from a types file
  // The override replaces the entire config
  const outDir = path.join(outputBase, 'screening-questions');
  fs.mkdirSync(outDir, { recursive: true });

  const content = `import { ScreeningQuestionsConfig } from '../../types/data/screening-questions/types';

export { ScreeningQuestionsConfig };

export const patientScreeningQuestionsConfig: ScreeningQuestionsConfig = ${formatAsTypescript(data)};
`;

  fs.writeFileSync(path.join(outDir, 'index.ts'), content);
  console.log(`  screening-questions: generated index.ts`);
}

function formatAsTypescript(obj: any, _indent: number = 0): string {
  return JSON.stringify(obj, null, 2);
}

main();
