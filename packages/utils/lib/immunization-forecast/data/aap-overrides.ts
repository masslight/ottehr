/**
 * Where the AAP childhood schedule differs from the CDC CDSi data we ship, applied on top of it.
 * The CDC data stays as converted; the CDSi test cases run against it without these overrides.
 * Quotes are from the AAP 2026 schedule (https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf).
 */
import { AntigenRules, RulesManifest, SeriesDoseRule, SeriesRule } from '../rules-types';

export const AAP_SOURCE_ID = 'aap-2026';

const MMR_ANTIGENS = ['Measles', 'Mumps', 'Rubella', 'Varicella'];
const DTAP_ANTIGENS = ['Diphtheria', 'Tetanus', 'Pertussis'];

export const AAP_SOURCE: RulesManifest['sources'][number] = {
  name: 'AAP immunization schedule',
  version: '2026',
  url: 'https://publications.aap.org/aapnews/news/34141/AAP-s-2026-immunization-schedule-keeps-routine',
  file: 'data/aap-overrides.ts',
  antigens: ['HPV', ...MMR_ANTIGENS, ...DTAP_ANTIGENS],
};

/** AAP 2026: HPV is recommended from 9 years (CDC 4.64: 11 years). */
const HPV_EARLIEST_REC_AGE = '9 years';
/** Replaces the CDC guidance "ACIP recommends routine HPV vaccination at age 11 or 12 years …". */
export const HPV_GUIDANCE =
  'The AAP recommends starting the HPV series between the ages of 9 and 12 years, at an age the pediatric health ' +
  'care professional deems optimal for acceptance and completion of the vaccination series.';

function overrideHpv(antigen: AntigenRules): AntigenRules {
  return {
    ...antigen,
    source: AAP_SOURCE_ID,
    series: antigen.series.map((series) => ({
      ...series,
      seriesAdminGuidance: [HPV_GUIDANCE, ...series.seriesAdminGuidance.slice(1)],
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

/**
 * AAP 2026, MMR and Varicella notes: "The AAP expresses no preference between MMR plus monovalent varicella vaccine
 * or MMRV for toddlers receiving their first immunization of this kind … For the 2nd dose at 4–6 years, MMRV
 * generally is preferred". CDC 4.64 lists MMRV as preferable only from 4 years for both doses. Dose 1 takes MMRV as
 * preferable from 12 months; the dose 2 preference is guidance only, since CDSi ranks no vaccine above another
 * preferable one and a forecast vaccine type would stop the due-today matcher accepting MMR plus varicella.
 */
const MMRV_CVX = '94';
const MMRV_DOSE_1_BEGIN_AGE = '12 months';
export const MMRV_GUIDANCE =
  'The AAP expresses no preference between MMR plus varicella or MMRV for the first dose at 12–15 months; counsel ' +
  'parents about the rare febrile seizure 1 to 2 weeks after a first dose of MMRV. For the second dose at 4–6 years, ' +
  'MMRV generally is preferred to minimize the number of injections. The maximum age for MMRV is 12 years.';

const hasMmrv = (dose: SeriesDoseRule | undefined): boolean =>
  dose?.preferableVaccines.some((vaccine) => vaccine.cvx === MMRV_CVX) ?? false;

function overrideMmrv(antigen: AntigenRules): AntigenRules {
  return {
    ...antigen,
    source: AAP_SOURCE_ID,
    series: antigen.series.map((series) =>
      hasMmrv(series.doses[0])
        ? {
            ...series,
            seriesAdminGuidance: [MMRV_GUIDANCE, ...series.seriesAdminGuidance],
            doses: series.doses.map((dose, index) =>
              index === 0
                ? {
                    ...dose,
                    preferableVaccines: dose.preferableVaccines.map((vaccine) =>
                      vaccine.cvx === MMRV_CVX ? { ...vaccine, beginAge: MMRV_DOSE_1_BEGIN_AGE } : vaccine
                    ),
                  }
                : dose
            ),
          }
        : series
    ),
  };
}

/**
 * AAP 2026, DTaP notes: "Dose 4 may be administered as early as age 12 months if at least 6 months have elapsed
 * since dose 3." CDC 4.64 forecasts dose 4 from 15 months (`minAge`); the 6-month interval, the recommended age
 * of 15 months and the retrospective 4-month allowable interval are already in the data and stay as they are.
 */
const DTAP_DOSE_4 = 'Dose 4';
const DTAP_DOSE_4_CDC_MIN_AGE = '15 months';
const DTAP_DOSE_4_MIN_AGE = '12 months';

const overrideDtapDose4 = (series: SeriesRule): SeriesRule => ({
  ...series,
  doses: series.doses.map((dose) =>
    dose.doseNumber === DTAP_DOSE_4
      ? {
          ...dose,
          ages: dose.ages.map((age) =>
            age.minAge === DTAP_DOSE_4_CDC_MIN_AGE ? { ...age, minAge: DTAP_DOSE_4_MIN_AGE } : age
          ),
        }
      : dose
  ),
});

function overrideDtap(antigen: AntigenRules): AntigenRules {
  return { ...antigen, source: AAP_SOURCE_ID, series: antigen.series.map(overrideDtapDose4) };
}

function overrideAntigen(antigen: AntigenRules): AntigenRules {
  if (antigen.antigen === 'HPV') return overrideHpv(antigen);
  if (MMR_ANTIGENS.includes(antigen.antigen)) return overrideMmrv(antigen);
  if (DTAP_ANTIGENS.includes(antigen.antigen)) return overrideDtap(antigen);
  return antigen;
}

export function applyAapOverrides(
  manifest: RulesManifest,
  antigens: AntigenRules[]
): { manifest: RulesManifest; antigens: AntigenRules[] } {
  return {
    manifest: { ...manifest, sources: [...manifest.sources, AAP_SOURCE] },
    antigens: antigens.map(overrideAntigen),
  };
}
