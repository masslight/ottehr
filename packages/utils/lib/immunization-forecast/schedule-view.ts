/**
 * The read-only Vaccine Schedule reference (Admin › Clinical › Vaccine Schedule, decision #7), built from the
 * shipped rules data: per lane the series the data selects by default, its doses with their ages and intervals as
 * the CDSi data words them, and the season dates of the seasonal lanes. Nothing here is editable.
 */
import { getRulesData, RulesData } from './data/rules-data';
import { addDuration } from './dates';
import { FORECAST_GROUPS, ForecastGroupDefinition } from './groups';
import { SeriesDoseRule, SeriesRule } from './rules-types';
import { ImmunizationGroupId } from './types';

export type VaccineScheduleLevel = 'Routine' | 'Shared decision' | 'Risk-based';

export interface VaccineScheduleDose {
  /** "Dose 1", "Dose 2", … as the data names it; "Booster" for a recurring dose. */
  label: string;
  recurring: boolean;
  minAge?: string;
  recommendedAge?: string;
  /** The end of the recommended window (CDSi latest recommended age): the dose is past due after it. */
  pastDueAge?: string;
  minInterval?: string;
  recommendedInterval?: string;
}

export interface VaccineScheduleLane {
  group: ImmunizationGroupId;
  label: string;
  antigen: string;
  seriesName: string;
  level: VaccineScheduleLevel;
  /** "4", "Every season", "5, then Tdap at 11–12 y". */
  target: string;
  doses: VaccineScheduleDose[];
  guidance: string[];
}

export interface VaccineSeasonRow {
  group: ImmunizationGroupId;
  label: string;
  seriesName: string;
  seasonStart?: string;
  seasonEnd?: string;
  minAge?: string;
  /** Source name and version the antigen's rules come from, e.g. "AIRA medical societies … 26.1". */
  source: string;
}

export interface VaccineScheduleSource {
  name: string;
  version: string;
  antigens: string[];
}

export interface VaccineScheduleView {
  dataVersion: string;
  sources: VaccineScheduleSource[];
  children: VaccineScheduleLane[];
  adults: VaccineScheduleLane[];
  seasonal: VaccineSeasonRow[];
}

const ADULT_ONLY_LANES: ImmunizationGroupId[] = ['pneumo-adult', 'rsv-adult', 'zoster'];
/** Series that start at this age or later are the adolescent/adult schedule (varicella 13+, HPV 15+, MenB 16+). */
const ADULT_SERIES_START = '13 years';
const AGE_BASE = '2000-01-01';

const laneSeries = (rules: RulesData, lane: ForecastGroupDefinition, antigen: string): SeriesRule[] =>
  (rules.antigens.get(antigen)?.series ?? []).filter(
    (series) =>
      series.seriesType !== 'Evaluation Only' &&
      (!lane.seriesGroups || lane.seriesGroups.includes(series.select.seriesGroup))
  );

const preferred = (candidates: SeriesRule[]): SeriesRule | undefined =>
  candidates.find((series) => series.select.defaultSeries) ??
  [...candidates].sort((a, b) => a.select.seriesPreference - b.select.seriesPreference)[0];

/** The age rule in force today: the one without a cessation date. */
const currentAge = (dose: SeriesDoseRule): SeriesDoseRule['ages'][number] | undefined =>
  dose.ages.find((age) => !age.cessationDate) ?? dose.ages[0];

const seriesStartAge = (series: SeriesRule): string | undefined =>
  series.select.minAgeToStart ?? currentAge(series.doses[0])?.minAge ?? currentAge(series.doses[0])?.absMinAge;

const startsAtOrAfter = (series: SeriesRule, age: string): boolean => {
  const start = seriesStartAge(series);
  return start !== undefined && addDuration(AGE_BASE, start) >= addDuration(AGE_BASE, age);
};

const levelOf = (series: SeriesRule): VaccineScheduleLevel =>
  series.seriesType === 'Risk'
    ? 'Risk-based'
    : /shared clinical decision/i.test(series.seriesName)
    ? 'Shared decision'
    : 'Routine';

const doseRow = (dose: SeriesDoseRule): VaccineScheduleDose => {
  const age = currentAge(dose);
  const interval =
    dose.intervals.find((rule) => rule.fromPrevious && !rule.cessationDate) ??
    dose.intervals.find((rule) => !rule.cessationDate);
  return {
    label: dose.recurringDose ? 'Booster' : dose.doseNumber,
    recurring: dose.recurringDose,
    ...(age?.minAge && { minAge: age.minAge }),
    ...(age?.earliestRecAge && { recommendedAge: age.earliestRecAge }),
    ...(age?.latestRecAge && { pastDueAge: age.latestRecAge }),
    ...(interval?.minInt && { minInterval: interval.minInt }),
    ...(interval?.earliestRecInt && { recommendedInterval: interval.earliestRecInt }),
  };
};

const targetText = (lane: ForecastGroupDefinition, series: SeriesRule): string =>
  lane.targetText ??
  (lane.seasonal
    ? 'Every season'
    : lane.targetDoses?.toString() ??
      /(\d+)-dose/i.exec(series.seriesName)?.[1] ??
      String(series.doses.filter((dose) => !dose.recurringDose).length));

const toLane = (
  lane: ForecastGroupDefinition,
  antigen: string,
  series: SeriesRule,
  doses: SeriesDoseRule[]
): VaccineScheduleLane => ({
  group: lane.id,
  label: lane.label,
  antigen,
  seriesName: series.seriesName,
  level: levelOf(series),
  target: targetText(lane, series),
  doses: doses.map(doseRow),
  guidance: series.seriesAdminGuidance,
});

export function buildVaccineScheduleView(rules: RulesData = getRulesData()): VaccineScheduleView {
  const children: VaccineScheduleLane[] = [];
  const adults: VaccineScheduleLane[] = [];
  const seasonal: VaccineSeasonRow[] = [];
  // An antigen's source id is "<prefix>-<version>" ("cdc-4.64", "aira-26.1"); the manifest has the full name.
  const sourceName = (sourceId: string): string => {
    const source = rules.manifest.sources.find((candidate) => sourceId.endsWith(`-${candidate.version}`));
    return source ? `${source.name} ${source.version}` : sourceId;
  };

  for (const lane of FORECAST_GROUPS) {
    const antigen = rules.vaccineGroupAntigens.get(lane.vaccineGroup)?.[0];
    if (!antigen) continue;
    const candidates = laneSeries(rules, lane, antigen);
    const childSeries = preferred(candidates);
    if (!childSeries) continue;

    const seasonDose = childSeries.doses.find((dose) => dose.seasonalRecommendation);
    if (seasonDose) {
      seasonal.push({
        group: lane.id,
        label: lane.label,
        seriesName: childSeries.seriesName,
        ...(seasonDose.seasonalRecommendation?.startDate && {
          seasonStart: seasonDose.seasonalRecommendation.startDate,
        }),
        ...(seasonDose.seasonalRecommendation?.endDate && { seasonEnd: seasonDose.seasonalRecommendation.endDate }),
        ...(currentAge(childSeries.doses[0])?.minAge && { minAge: currentAge(childSeries.doses[0])?.minAge }),
        source: sourceName(rules.antigens.get(antigen)?.source ?? ''),
      });
      continue;
    }

    if (!ADULT_ONLY_LANES.includes(lane.id)) children.push(toLane(lane, antigen, childSeries, childSeries.doses));

    const adultSeries = preferred(candidates.filter((series) => startsAtOrAfter(series, ADULT_SERIES_START)));
    if (adultSeries) {
      adults.push(toLane(lane, antigen, adultSeries, adultSeries.doses));
    } else {
      // No adolescent/adult series: the childhood series' recurring booster (Td every 10 years) is the adult rule.
      const boosters = childSeries.doses.filter((dose) => dose.recurringDose);
      if (boosters.length) adults.push(toLane(lane, antigen, childSeries, boosters));
    }
  }

  return {
    dataVersion: rules.manifest.version,
    sources: rules.manifest.sources.map(({ name, version, antigens }) => ({ name, version, antigens })),
    children,
    adults,
    seasonal,
  };
}
