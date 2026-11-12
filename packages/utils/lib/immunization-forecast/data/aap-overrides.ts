/**
 * Where the AAP childhood schedule differs from the CDC CDSi data we ship, applied on top of it.
 * The CDC data stays as converted; the CDSi test cases run against it without these overrides.
 */
import { AntigenRules, RulesManifest } from '../rules-types';

export const AAP_SOURCE_ID = 'aap-2026';

export const AAP_SOURCE: RulesManifest['sources'][number] = {
  name: 'AAP immunization schedule',
  version: '2026',
  url: 'https://publications.aap.org/aapnews/news/34141/AAP-s-2026-immunization-schedule-keeps-routine',
  file: 'data/aap-overrides.ts',
  antigens: ['HPV'],
};

/** AAP 2026: HPV is recommended from 9 years (CDC 4.64: 11 years). */
const HPV_EARLIEST_REC_AGE = '9 years';

function overrideHpv(antigen: AntigenRules): AntigenRules {
  return {
    ...antigen,
    source: AAP_SOURCE_ID,
    series: antigen.series.map((series) => ({
      ...series,
      doses: series.doses.map((dose, index) =>
        index === 0 && dose.ages
          ? {
              ...dose,
              ages: dose.ages.map((age) =>
                age.earliestRecAge === '11 years' ? { ...age, earliestRecAge: HPV_EARLIEST_REC_AGE } : age
              ),
            }
          : dose
      ),
    })),
  };
}

export function applyAapOverrides(
  manifest: RulesManifest,
  antigens: AntigenRules[]
): { manifest: RulesManifest; antigens: AntigenRules[] } {
  return {
    manifest: { ...manifest, sources: [...manifest.sources, AAP_SOURCE] },
    antigens: antigens.map((antigen) => (antigen.antigen === 'HPV' ? overrideHpv(antigen) : antigen)),
  };
}
