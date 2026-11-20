/**
 * Evaluation and forecasting of one relevant patient series (CDSi logic spec v4.6, chapters 6 and 7).
 * Rule ids in comments (CALCDTINT-1, FORECASTDT-2, …) refer to the specification's business rules.
 */
import { addDays, addDuration, IsoDate, maxDate } from './dates';
import {
  ConditionalSkipRule,
  LiveVirusConflictRule,
  SeriesAgeRule,
  SeriesDoseRule,
  SeriesIntervalRule,
  SeriesRule,
  SkipCondition,
  SkipSet,
} from './rules-types';
import { CdsiSeriesStatus, DoseWindow, ForecastDoseInput } from './types';

/** One antigen's share of a counted, dated dose (CDSi "antigen administered record"). */
export interface AntigenDose {
  input: ForecastDoseInput;
  date: IsoDate;
  cvx: string;
}

/** Every counted, dated dose of the patient, any antigen; used for vaccine conflicts. */
export interface PatientDose {
  date: IsoDate;
  cvx: string;
  id: string;
}

export interface EvaluationContext {
  dob: IsoDate;
  asOf: IsoDate;
  sex: 'Female' | 'Male' | 'Unknown';
  birthCountry: string;
  patientDoses: PatientDose[];
  conflictsByCurrentCvx: Map<string, LiveVirusConflictRule[]>;
  /** Whether a relevant series in one of these series groups is complete (for "Completed Series" skips). */
  isSeriesGroupComplete: (seriesGroups: number[]) => boolean;
}

export type TargetDoseStatus = 'not-satisfied' | 'satisfied' | 'skipped';

export interface TargetDose {
  rule: SeriesDoseRule;
  status: TargetDoseStatus;
  /** Index into the antigen dose list of the dose that satisfied this target dose. */
  satisfiedBy?: number;
  /** Window this target dose was due in, as forecast from the history before the satisfying dose. */
  window?: DoseWindow;
  /** True for the copy of a recurring dose inserted after the recurring dose was satisfied. */
  inserted: boolean;
}

export type CdsiEvaluationStatus = 'Valid' | 'Not Valid' | 'Extraneous';

export type EvaluationReason =
  | 'Too young'
  | 'Too old'
  | 'Too soon'
  | 'Inadvertent vaccine'
  | 'Live virus conflict'
  | 'Not a preferable or allowable vaccine'
  | 'Series already complete';

export interface DoseEvaluation {
  doseIndex: number;
  status: CdsiEvaluationStatus;
  reason?: EvaluationReason;
  inadvertent: boolean;
  /** Index of the target dose the dose was evaluated against (undefined when the series was already complete). */
  targetIndex?: number;
}

export interface SeriesForecast {
  status: CdsiSeriesStatus;
  reason?: string;
  targetIndex?: number;
  doseNumber?: number;
  earliest?: IsoDate;
  recommended?: IsoDate;
  pastDue?: IsoDate;
  latest?: IsoDate;
  unadjustedRecommended?: IsoDate;
  unadjustedPastDue?: IsoDate;
  /** The seasonal recommendation's end date, for a seasonal dose whose data has one. */
  seasonEnd?: IsoDate;
  /** Recommended CVX codes for the forecast dose (FORECASTRECVAC-1). */
  cvx: string[];
  /** FORECASTPRIORITY-1: every preferable interval of the forecast dose is an override interval. */
  priority: boolean;
}

export interface PatientSeries {
  rule: SeriesRule;
  doses: AntigenDose[];
  targets: TargetDose[];
  evaluations: DoseEvaluation[];
  forecast: SeriesForecast;
  validCount: number;
}

interface Dated {
  effectiveDate?: IsoDate;
  cessationDate?: IsoDate;
}

/** Picks the rule instance in force on `date` (effective ≤ date ≤ cessation); undated instances apply always. */
function inForce<T extends Dated>(rules: T[], date: IsoDate): T[] {
  return rules.filter(
    (r) => (!r.effectiveDate || r.effectiveDate <= date) && (!r.cessationDate || date <= r.cessationDate)
  );
}

function ageRuleOn(rule: SeriesDoseRule, date: IsoDate): SeriesAgeRule | undefined {
  const inForceRules = inForce(rule.ages, date);
  return inForceRules[0] ?? rule.ages[0];
}

const ageDate = (dob: IsoDate, age?: string): IsoDate | undefined => (age ? addDuration(dob, age) : undefined);

// ---------------------------------------------------------------------------------------------------------
// Conditional skip (6.2 / 7.1 / 7.6)
// ---------------------------------------------------------------------------------------------------------

interface SkipInput {
  ctx: EvaluationContext;
  series: PatientSeries;
  context: 'Evaluation' | 'Forecast';
  referenceDate: IsoDate;
  /** Doses that may be counted: evaluated doses before the current one (evaluation) or all (forecast). */
  countable: DoseEvaluation[];
  /** Date of the immediate previous dose administered, for Interval conditions. */
  previousDoseDate?: IsoDate;
}

function countConditionalDoses(input: SkipInput, c: SkipCondition): number {
  const { dob } = input.ctx;
  const beginAge = ageDate(dob, c.beginAge);
  const endAge = ageDate(dob, c.endAge);
  let count = 0;
  for (const ev of input.countable) {
    const dose = input.series.doses[ev.doseIndex];
    if (c.vaccineTypes?.length && !c.vaccineTypes.includes(dose.cvx)) continue;
    if (beginAge && dose.date < beginAge) continue;
    if (endAge && dose.date >= endAge) continue;
    if (c.startDate && dose.date < c.startDate) continue;
    if (c.endDate && dose.date >= c.endDate) continue;
    if (c.doseType !== 'Total' && ev.status !== 'Valid') continue;
    count++;
  }
  return count;
}

function conditionMet(input: SkipInput, c: SkipCondition): boolean {
  const { dob } = input.ctx;
  switch (c.type) {
    case 'Age': {
      const begin = ageDate(dob, c.beginAge);
      const end = ageDate(dob, c.endAge);
      return (!begin || input.referenceDate >= begin) && (!end || input.referenceDate < end);
    }
    case 'Interval': {
      if (!input.previousDoseDate || !c.interval) return false;
      return input.referenceDate >= addDuration(input.previousDoseDate, c.interval);
    }
    case 'Completed Series':
      return !!c.seriesGroups?.length && input.ctx.isSeriesGroupComplete(c.seriesGroups);
    case 'Vaccine Count by Age':
    case 'Vaccine Count by Date':
    case 'Vaccine Count by Date and Age': {
      const n = countConditionalDoses(input, c);
      const target = c.doseCount ?? 0;
      switch (c.doseCountLogic) {
        case 'equal to':
          return n === target;
        case 'less than':
          return n < target;
        default:
          return n > target;
      }
    }
  }
}

function setMet(input: SkipInput, set: SkipSet): boolean {
  const results = set.conditions.map((c) => conditionMet(input, c));
  if (results.length === 0) return false;
  return set.conditionLogic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

function skipRuleMet(input: SkipInput, rule: ConditionalSkipRule): boolean {
  const sets = inForce(rule.sets, input.referenceDate);
  if (sets.length === 0) return false;
  const results = sets.map((s) => setMet(input, s));
  return rule.setLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

/** Table 6-11: can the target dose be skipped? */
function canSkip(input: SkipInput, target: TargetDose): boolean {
  return target.rule.conditionalSkips
    .filter((s) => s.context === input.context || s.context === 'Both')
    .some((s) => skipRuleMet(input, s));
}

// ---------------------------------------------------------------------------------------------------------
// Reference doses for intervals (CALCDTINT-1, -2, -8)
// ---------------------------------------------------------------------------------------------------------

function referenceDoseDate(
  series: PatientSeries,
  interval: { fromPrevious: boolean; fromTargetDose?: number; fromMostRecent?: string[]; fromRelevantObs?: string },
  evaluated: DoseEvaluation[]
): IsoDate | undefined | null {
  if (interval.fromPrevious) {
    // CALCDTINT-1: the most immediate previous dose with a Valid / Not Valid status, not inadvertent.
    for (let k = evaluated.length - 1; k >= 0; k--) {
      const ev = evaluated[k];
      if (!ev.inadvertent && (ev.status === 'Valid' || ev.status === 'Not Valid')) {
        return series.doses[ev.doseIndex].date;
      }
    }
    return undefined;
  }
  if (interval.fromTargetDose !== undefined) {
    // CALCDTINT-2: the dose that satisfied target dose N.
    const target = series.targets.filter((t) => !t.inserted)[interval.fromTargetDose - 1];
    return target?.satisfiedBy === undefined ? undefined : series.doses[target.satisfiedBy].date;
  }
  if (interval.fromMostRecent?.length) {
    // CALCDTINT-8: the most recent dose of one of the listed vaccine types, not inadvertent.
    for (let k = evaluated.length - 1; k >= 0; k--) {
      const ev = evaluated[k];
      const dose = series.doses[ev.doseIndex];
      if (!ev.inadvertent && interval.fromMostRecent.includes(dose.cvx)) return dose.date;
    }
    return undefined;
  }
  // CALCDTINT-9 needs a coded observation; the engine has none, so the interval does not apply.
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Evaluate one dose against one target dose (chapter 6)
// ---------------------------------------------------------------------------------------------------------

function evaluateDose(
  ctx: EvaluationContext,
  series: PatientSeries,
  doseIndex: number,
  targetIndex: number
): DoseEvaluation {
  const dose = series.doses[doseIndex];
  const target = series.targets[targetIndex];
  const rule = target.rule;
  const evaluated = series.evaluations;

  // 6.3 Inadvertent vaccine
  if (rule.inadvertentVaccines.includes(dose.cvx)) {
    return { doseIndex, targetIndex, status: 'Not Valid', reason: 'Inadvertent vaccine', inadvertent: true };
  }

  // 6.4 Age (table 6-15)
  const age = ageRuleOn(rule, dose.date);
  const absMinAgeDate = ageDate(ctx.dob, age?.absMinAge);
  const maxAgeDate = ageDate(ctx.dob, age?.maxAge);
  let ageResult: 'valid' | 'too-young' | 'too-old' = 'valid';
  if (absMinAgeDate && dose.date < absMinAgeDate) ageResult = 'too-young';
  else if (maxAgeDate && dose.date >= maxAgeDate) ageResult = 'too-old';

  // 6.5 Preferable intervals (table 6-18), 6.6 allowable intervals (table 6-21)
  const intervals = inForce(rule.intervals, dose.date);
  const intervalResults = intervals.map((interval) => {
    const ref = referenceDoseDate(series, interval, evaluated);
    if (!ref) return true;
    const absMin = interval.absMinInt ? addDuration(ref, interval.absMinInt) : undefined;
    return !absMin || dose.date >= absMin;
  });
  let intervalsOk = intervalResults.every(Boolean);
  if (!intervalsOk && intervals.some((i, k) => i.priority === 'override' && intervalResults[k])) intervalsOk = true;
  if (!intervalsOk) {
    const allowable = inForce(rule.allowableIntervals, dose.date);
    if (allowable.length > 0) {
      intervalsOk = allowable.every((interval) => {
        const ref = referenceDoseDate(series, interval, evaluated);
        if (!ref) return true;
        return !interval.absMinInt || dose.date >= addDuration(ref, interval.absMinInt);
      });
    }
  }

  // 6.7 Vaccine conflict (CALCDTCONFLICT-1/2, CONFLICT-3)
  const conflictRules = ctx.conflictsByCurrentCvx.get(dose.cvx) ?? [];
  let inConflict = false;
  if (conflictRules.length > 0) {
    for (const previous of ctx.patientDoses) {
      if (previous.id === dose.input.id || previous.date > dose.date) continue;
      for (const c of conflictRules) {
        if (c.previousCvx !== previous.cvx) continue;
        const begin = addDuration(previous.date, c.conflictBeginInterval);
        const previousEvaluation = evaluated.find((ev) => series.doses[ev.doseIndex].input.id === previous.id);
        const previousValid = !previousEvaluation || previousEvaluation.status === 'Valid';
        const end = addDuration(previous.date, previousValid ? c.minConflictEndInterval : c.conflictEndInterval);
        if (dose.date >= begin && dose.date < end) inConflict = true;
      }
    }
  }

  // 6.8 / 6.9 Preferable or allowable vaccine
  const vaccineOk =
    rule.preferableVaccines.some(
      (v) =>
        v.cvx === dose.cvx &&
        (!v.beginAge || dose.date >= addDuration(ctx.dob, v.beginAge)) &&
        (!v.endAge || dose.date < addDuration(ctx.dob, v.endAge))
    ) ||
    rule.allowableVaccines.some(
      (v) =>
        v.cvx === dose.cvx &&
        (!v.beginAge || dose.date >= addDuration(ctx.dob, v.beginAge)) &&
        (!v.endAge || dose.date < addDuration(ctx.dob, v.endAge))
    );

  // 6.10 Satisfy target dose (table 6-31)
  const base = { doseIndex, targetIndex, inadvertent: false } as const;
  if (ageResult === 'too-old') return { ...base, status: 'Extraneous', reason: 'Too old' };
  if (ageResult === 'too-young') return { ...base, status: 'Not Valid', reason: 'Too young' };
  if (!intervalsOk) return { ...base, status: 'Not Valid', reason: 'Too soon' };
  if (inConflict) return { ...base, status: 'Not Valid', reason: 'Live virus conflict' };
  if (!vaccineOk) return { ...base, status: 'Not Valid', reason: 'Not a preferable or allowable vaccine' };
  return { ...base, status: 'Valid' };
}

// ---------------------------------------------------------------------------------------------------------
// Forecast dates for a target dose (7.4 / 7.5)
// ---------------------------------------------------------------------------------------------------------

interface ForecastDates {
  earliest: IsoDate;
  recommended: IsoDate;
  pastDue?: IsoDate;
  latest?: IsoDate;
  unadjustedRecommended: IsoDate;
  unadjustedPastDue?: IsoDate;
  maxAgeDate?: IsoDate;
  cvx: string[];
  priority: boolean;
}

/**
 * Forecast dates for `targetIndex` given the doses evaluated so far (`evaluated`) and the patient doses
 * administered up to `referenceDate` (the assessment date, or an administered dose's date for a window).
 */
function forecastDates(
  ctx: EvaluationContext,
  series: PatientSeries,
  targetIndex: number,
  evaluated: DoseEvaluation[],
  referenceDate: IsoDate,
  /** When computing the window of an administered dose: that dose must not conflict with itself. */
  excludeDoseId?: string
): ForecastDates {
  const rule = series.targets[targetIndex].rule;
  const age = ageRuleOn(rule, referenceDate);
  const minAgeDate = ageDate(ctx.dob, age?.minAge);
  const earliestRecAgeDate = ageDate(ctx.dob, age?.earliestRecAge);
  const latestRecAgeDate = ageDate(ctx.dob, age?.latestRecAge);
  const maxAgeDate = ageDate(ctx.dob, age?.maxAge);

  const intervals: SeriesIntervalRule[] = inForce(rule.intervals, referenceDate);
  const minIntDates: IsoDate[] = [];
  const earliestRecIntDates: IsoDate[] = [];
  const latestRecIntDates: IsoDate[] = [];
  for (const interval of intervals) {
    const ref = referenceDoseDate(series, interval, evaluated);
    if (!ref) continue;
    if (interval.minInt) minIntDates.push(addDuration(ref, interval.minInt));
    if (interval.earliestRecInt) earliestRecIntDates.push(addDuration(ref, interval.earliestRecInt));
    if (interval.latestRecInt) latestRecIntDates.push(addDuration(ref, interval.latestRecInt));
  }

  // CALCDTCONFLICT-3: forecast conflict end dates for previous doses that conflict with a preferable vaccine.
  let conflictEnd: IsoDate | undefined;
  for (const preferable of rule.preferableVaccines) {
    const rules = ctx.conflictsByCurrentCvx.get(preferable.cvx);
    if (!rules) continue;
    for (const previous of ctx.patientDoses) {
      if (previous.date > referenceDate || previous.id === excludeDoseId) continue;
      for (const c of rules) {
        if (c.previousCvx === previous.cvx) {
          conflictEnd = maxDate(conflictEnd, addDuration(previous.date, c.conflictEndInterval));
        }
      }
    }
  }

  const inadvertentDates = evaluated.filter((ev) => ev.inadvertent).map((ev) => series.doses[ev.doseIndex].date);
  const lastDoseDate = evaluated.length ? series.doses[evaluated[evaluated.length - 1].doseIndex].date : undefined;

  // FORECASTDTCAN-1
  const earliest =
    maxDate(
      minAgeDate,
      ...minIntDates,
      conflictEnd,
      rule.seasonalRecommendation?.startDate,
      ...inadvertentDates,
      lastDoseDate
    ) ?? ctx.dob;

  // FORECASTDT-2 / -5
  const unadjustedRecommended = earliestRecAgeDate ?? maxDate(...earliestRecIntDates) ?? earliest;
  const recommended = maxDate(earliest, unadjustedRecommended)!;

  // FORECASTDT-3 / -6
  const unadjustedPastDue = latestRecAgeDate
    ? addDays(latestRecAgeDate, -1)
    : latestRecIntDates.length
    ? addDays(maxDate(...latestRecIntDates)!, -1)
    : undefined;
  const pastDue = unadjustedPastDue ? maxDate(earliest, unadjustedPastDue) : undefined;

  // FORECASTDT-4
  const latest = maxAgeDate ? addDays(maxAgeDate, -1) : undefined;

  // FORECASTRECVAC-1
  const inWindow = (date: IsoDate, begin?: string, end?: string): boolean =>
    (!begin || date >= addDuration(ctx.dob, begin)) && (!end || date < addDuration(ctx.dob, end));
  const cvx = rule.preferableVaccines
    .filter(
      (v) =>
        v.forecastVaccineType &&
        (inWindow(earliest, v.beginAge, v.endAge) || inWindow(recommended, v.beginAge, v.endAge))
    )
    .map((v) => v.cvx);

  return {
    earliest,
    recommended,
    pastDue,
    latest,
    unadjustedRecommended,
    unadjustedPastDue,
    maxAgeDate,
    cvx,
    priority: intervals.length > 0 && intervals.every((i) => i.priority === 'override'),
  };
}

function toWindow(d: ForecastDates): DoseWindow {
  return { earliest: d.earliest, recommended: d.recommended, pastDue: d.pastDue ?? null };
}

// ---------------------------------------------------------------------------------------------------------
// Evaluate and forecast a relevant patient series (4.4, 6, 7)
// ---------------------------------------------------------------------------------------------------------

export function evaluateAndForecastSeries(
  ctx: EvaluationContext,
  rule: SeriesRule,
  doses: AntigenDose[],
  /** 7.2: the patient has evidence of immunity to the antigen (by date of birth). */
  immune = false
): PatientSeries {
  const series: PatientSeries = {
    rule,
    doses,
    targets: rule.doses.map((d) => ({ rule: d, status: 'not-satisfied', inserted: false })),
    evaluations: [],
    forecast: { status: 'Not Complete', cvx: [], priority: false },
    validCount: 0,
  };

  const skipInput = (
    context: 'Evaluation' | 'Forecast',
    referenceDate: IsoDate,
    countable: DoseEvaluation[]
  ): SkipInput => ({
    ctx,
    series,
    context,
    referenceDate,
    countable,
    previousDoseDate: countable.length ? series.doses[countable[countable.length - 1].doseIndex].date : undefined,
  });

  // --- Evaluation (figure 4-6) ---
  let t = 0;
  for (let i = 0; i < doses.length; i++) {
    const dose = doses[i];
    const before = series.evaluations.slice();
    while (t < series.targets.length && canSkip(skipInput('Evaluation', dose.date, before), series.targets[t])) {
      series.targets[t].status = 'skipped';
      t++;
    }
    if (t >= series.targets.length) {
      series.evaluations.push({
        doseIndex: i,
        status: 'Extraneous',
        reason: 'Series already complete',
        inadvertent: false,
      });
      continue;
    }
    const evaluation = evaluateDose(ctx, series, i, t);
    series.evaluations.push(evaluation);
    if (evaluation.status === 'Valid') {
      const target = series.targets[t];
      target.status = 'satisfied';
      target.satisfiedBy = i;
      target.window = toWindow(forecastDates(ctx, series, t, before, dose.date, dose.input.id));
      series.validCount++;
      if (target.rule.recurringDose) {
        series.targets.splice(t + 1, 0, { rule: target.rule, status: 'not-satisfied', inserted: true });
      }
      t++;
    }
  }

  // --- Forecast (chapter 7) ---
  const all = series.evaluations;
  let f = series.targets.findIndex((target) => target.status === 'not-satisfied');
  if (f < 0) f = series.targets.length;
  // Table 7-10 column 4: evidence of immunity (a series that is already complete stays Complete).
  if (immune && f < series.targets.length) {
    series.forecast = { status: 'Immune', reason: 'Patient has evidence of immunity', cvx: [], priority: false };
    return series;
  }
  for (;;) {
    while (f < series.targets.length && canSkip(skipInput('Forecast', ctx.asOf, all), series.targets[f])) {
      series.targets[f].status = 'skipped';
      f++;
    }
    if (f >= series.targets.length) {
      // Table 7-10 columns 2 and 3
      series.forecast =
        series.validCount > 0
          ? { status: 'Complete', reason: 'Patient series is complete', cvx: [], priority: false }
          : {
              status: 'Not Recommended',
              reason: 'Not recommended at this time due to past immunization history',
              cvx: [],
              priority: false,
            };
      return series;
    }
    const target = series.targets[f];
    const dates = forecastDates(ctx, series, f, all, ctx.asOf);

    // 7.6 Validate recommendation: would the dose be skipped on its earliest date?
    if (dates.earliest > ctx.asOf && canSkip(skipInput('Forecast', dates.earliest, all), target)) {
      target.status = 'skipped';
      f++;
      continue;
    }

    const seasonEnd = target.rule.seasonalRecommendation?.endDate;
    const common = {
      targetIndex: f,
      doseNumber: forecastDoseNumber(series, f),
      cvx: dates.cvx,
      priority: dates.priority,
    };
    if (seasonEnd && ctx.asOf > seasonEnd) {
      series.forecast = { ...common, status: 'Not Recommended', reason: 'Past seasonal recommendation end date' };
    } else if (dates.maxAgeDate && ctx.asOf >= dates.maxAgeDate) {
      series.forecast = { ...common, status: 'Aged Out', reason: 'Patient has exceeded the maximum age' };
    } else if (dates.maxAgeDate && dates.earliest >= dates.maxAgeDate) {
      series.forecast = {
        ...common,
        status: 'Aged Out',
        reason: 'Patient is unable to finish the series prior to the maximum age',
      };
    } else {
      series.forecast = {
        ...common,
        status: 'Not Complete',
        earliest: dates.earliest,
        recommended: dates.recommended,
        pastDue: dates.pastDue,
        latest: dates.latest,
        unadjustedRecommended: dates.unadjustedRecommended,
        unadjustedPastDue: dates.unadjustedPastDue,
        ...(seasonEnd && { seasonEnd }),
      };
    }
    return series;
  }
}

/** FORECASTDN-1: satisfied target doses + 1; for seasonal doses only those given on or after the season start. */
function forecastDoseNumber(series: PatientSeries, targetIndex: number): number {
  const seasonStart = series.targets[targetIndex].rule.seasonalRecommendation?.startDate;
  let n = 0;
  for (const target of series.targets) {
    if (target.status !== 'satisfied' || target.satisfiedBy === undefined) continue;
    if (seasonStart && series.doses[target.satisfiedBy].date < seasonStart) continue;
    n++;
  }
  return n + 1;
}

/** Dates needed by the series-selection scoring (SELECTB-3, -11, -12, -14). */
export function seriesFinishDate(ctx: EvaluationContext, series: PatientSeries): IsoDate | undefined {
  const start = series.forecast.earliest;
  if (!start) return undefined;
  let finish = start;
  const remaining = series.targets
    .slice((series.forecast.targetIndex ?? 0) + 1)
    .filter((t) => t.status === 'not-satisfied');
  for (const target of remaining) {
    const interval = inForce(target.rule.intervals, ctx.asOf).find((i) => i.fromPrevious && i.minInt);
    if (interval?.minInt) finish = addDuration(finish, interval.minInt);
  }
  return finish;
}

export function lastTargetMaxAgeDate(ctx: EvaluationContext, series: PatientSeries): IsoDate | undefined {
  const last = series.rule.doses[series.rule.doses.length - 1];
  return ageDate(ctx.dob, ageRuleOn(last, ctx.asOf)?.maxAge);
}
