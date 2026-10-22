import type { Basic } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { describe, expect, it } from 'vitest';
import {
  assertNoDeployPlaceholders,
  buildSystemReportsConfig,
  SHIPPED_SYSTEM_REPORTS,
  SYSTEM_REPORTS_CONFIG_FILE,
} from '../src/scripts/build-system-reports-config';
import { makeSystemReportBasic, parseSystemReportBasic } from '../src/shared/system-report';

// The system reports Ottehr ships as config FHIR resources (config/oystehr/system-reports.json).
describe('shipped system reports config', () => {
  const config = JSON.parse(readFileSync(SYSTEM_REPORTS_CONFIG_FILE, 'utf-8'));

  it('is what the shipped report files build to (run `npm run build-system-reports-config` after editing one)', () => {
    expect(JSON.parse(buildSystemReportsConfig())).toEqual(config);
  });

  it('holds one system report Basic per shipped report', () => {
    expect(Object.keys(config.fhirResources)).toEqual(SHIPPED_SYSTEM_REPORTS.map((r) => r.key));
    for (const { key } of SHIPPED_SYSTEM_REPORTS) {
      const report = parseSystemReportBasic({ ...(config.fhirResources[key].resource as Basic), id: key });
      expect(report).not.toBeNull();
    }
  });

  it('refuses a report whose text contains "#{", which the deploy would rewrite as a config placeholder', () => {
    const definition: SystemReportDefinition = {
      name: 'payer-mix',
      parameters: [],
      code: 'function ReportRoot() { return null; }\nreturn ReportRoot;',
      runtimeVersion: 1,
    };
    expect(() => assertNoDeployPlaceholders('payer-mix', makeSystemReportBasic(definition))).not.toThrow();
    const withPlaceholder = { ...definition, code: 'const label = `#{var/PROJECT_ID}`;\n' + definition.code };
    expect(() => assertNoDeployPlaceholders('payer-mix', makeSystemReportBasic(withPlaceholder))).toThrow(
      /^payer-mix contains "#\{"/
    );
  });
});
