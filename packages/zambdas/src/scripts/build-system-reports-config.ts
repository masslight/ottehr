// Turns the system reports Ottehr ships (config/oystehr/system-reports/*.report.json, Report Studio files) into
// the FHIR Basic resources of config/oystehr/system-reports.json, which the deploy creates and updates in place
// like any other config FHIR resource. Run after adding or editing a shipped report:
//
//   npm run build-system-reports-config
//
// Per-practice extras are published with publish-system-report instead.
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { systemReportFromStudioFile } from 'utils/lib/types/adhoc/system/system-report';
import { RoleType } from 'utils/lib/types/api/user.types';
import { makeSystemReportBasic } from '../shared/system-report';

const CONFIG_DIR = path.resolve(__dirname, '../../../../config/oystehr');
export const SYSTEM_REPORTS_CONFIG_FILE = path.join(CONFIG_DIR, 'system-reports.json');

/** The shipped reports: the terraform resource key, the Report Studio file and the roles that may see each. */
export const SHIPPED_SYSTEM_REPORTS: { key: string; file: string; roles: RoleType[] }[] = [];

export function buildSystemReportsConfig(): string {
  const fhirResources: Record<string, unknown> = {};
  for (const { key, file, roles } of SHIPPED_SYSTEM_REPORTS) {
    const source = JSON.parse(readFileSync(path.join(CONFIG_DIR, 'system-reports', file), 'utf-8'));
    const converted = systemReportFromStudioFile(source, { roles });
    if (!converted.ok) throw new Error(`${file} is not a publishable report:\n  ${converted.errors.join('\n  ')}`);
    fhirResources[key] = { resource: makeSystemReportBasic(converted.definition) };
  }
  return JSON.stringify({ 'schema-version': '2025-09-25', fhirResources }, null, 2) + '\n';
}

if (require.main === module) {
  writeFileSync(SYSTEM_REPORTS_CONFIG_FILE, buildSystemReportsConfig());
  console.log(
    `Wrote ${SYSTEM_REPORTS_CONFIG_FILE} (${SHIPPED_SYSTEM_REPORTS.map((r) => r.key).join(', ') || 'no reports'})`
  );
}
