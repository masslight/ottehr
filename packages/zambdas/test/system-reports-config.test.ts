import type { Basic } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  buildSystemReportsConfig,
  SHIPPED_SYSTEM_REPORTS,
  SYSTEM_REPORTS_CONFIG_FILE,
} from '../src/scripts/build-system-reports-config';
import { parseSystemReportBasic } from '../src/shared/system-report';

// The system reports Ottehr ships as config FHIR resources (config/oystehr/system-reports.json).
describe('shipped system reports config', () => {
  const config = JSON.parse(readFileSync(SYSTEM_REPORTS_CONFIG_FILE, 'utf-8'));

  it('is what the shipped report files build to (run `npm run build-system-reports-config` after editing one)', () => {
    expect(JSON.parse(buildSystemReportsConfig())).toEqual(config);
  });

  it('holds one system report Basic per shipped report, with the roles it names', () => {
    expect(Object.keys(config.fhirResources)).toEqual(SHIPPED_SYSTEM_REPORTS.map((r) => r.key));
    for (const { key, roles } of SHIPPED_SYSTEM_REPORTS) {
      const report = parseSystemReportBasic({ ...(config.fhirResources[key].resource as Basic), id: key });
      expect(report).not.toBeNull();
      expect(report?.roles).toEqual(roles);
    }
  });
});
