/**
 * Immunization forecast engine: CDSi logic specification v4.6 processing model (chapter 4) on the rules data
 * under ./data. Public entry point: forecastImmunizations(). See ./README.md.
 */
import { getRulesData, RulesData } from './data/rules-data';
import { addDuration, ageInYears, isIsoDate, IsoDate, maxDate, minDate } from './dates';
import {
  AntigenDose,
  DoseEvaluation,
  evaluateAndForecastSeries,
  EvaluationContext,
  lastTargetMaxAgeDate,
  PatientDose,
  PatientSeries,
  seriesFinishDate,
} from './evaluate';
import { FORECAST_GROUPS, ForecastGroupDefinition } from './groups';
import { SeriesRule } from './rules-types';
import {
  CdsiSeriesStatus,
  EvaluatedDose,
  ForecastDoseInput,
  ForecastPatientSex,
  IMMUNIZATION_REPORT_ORIGIN,
  ImmunizationForecast,
  ImmunizationForecastInput,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
  ImmunizationGroupStatus,
  NextDose,
} from './types';

/** Patients this old at the assessment date get the adult pneumococcal / RSV lanes. */
const ADULT_AGE_YEARS = 19;

/** Ottehr runs US practices; the CDSi varicella immunity rule (born before 1980) applies to US-born patients. */
const DEFAULT_BIRTH_COUNTRY = 'U.S.';

/**
 * CDC rule for undocumented (recalled) doses: only written, dated records count, except COVID-19, influenza,
 * PPSV23 and polio in adults, where self-report is accepted.
 */
const SELF_REPORT_ANTIGENS = new Set(['COVID-19', 'Influenza']);
const PPSV23_CVX = '33';

type CdsiSex = 'Female' | 'Male' | 'Unknown';

function toCdsiSex(sex?: ForecastPatientSex): CdsiSex {
  if (sex === 'female') return 'Female';
  if (sex === 'male') return 'Male';
  return 'Unknown';
}

interface OrganizedHistory {
  /** antigen → dated, counted doses in ascending date order. */
  byAntigen: Map<string, AntigenDose[]>;
  patientDoses: PatientDose[];
  /** Doses shown but never counted, with the antigens they would have belonged to. */
  notCounted: { input: ForecastDoseInput; antigens: string[]; reason: string }[];
  unmapped: ForecastDoseInput[];
}

/** 4.2 Organize immunization history: split doses into antigen administered records. */
function organizeHistory(rules: RulesData, dob: IsoDate, doses: ForecastDoseInput[]): OrganizedHistory {
  const byAntigen = new Map<string, AntigenDose[]>();
  const patientDoses: PatientDose[] = [];
  const notCounted: OrganizedHistory['notCounted'] = [];
  const unmapped: ForecastDoseInput[] = [];

  for (const input of doses) {
    const cvx = input.cvx.padStart(2, '0');
    const map = rules.cvxMap.get(cvx);
    if (!map) {
      unmapped.push(input);
      continue;
    }
    const allAntigens = map.associations.map((a) => a.antigen);
    if (!input.date || !isIsoDate(input.date)) {
      notCounted.push({ input, antigens: allAntigens, reason: 'Date unknown' });
      continue;
    }
    const date = input.date;
    const antigens = map.associations
      .filter(
        (a) => (!a.beginAge || date >= addDuration(dob, a.beginAge)) && (!a.endAge || date < addDuration(dob, a.endAge))
      )
      .map((a) => a.antigen);
    const isRecall = input.source === 'outside' && input.outsideSource === IMMUNIZATION_REPORT_ORIGIN.RECALL;
    const counted = isRecall
      ? antigens.filter(
          (antigen) =>
            SELF_REPORT_ANTIGENS.has(antigen) ||
            (antigen === 'Pneumococcal' && cvx === PPSV23_CVX) ||
            (antigen === 'Polio' && ageInYears(dob, date) >= 18)
        )
      : antigens;
    const dropped = antigens.filter((a) => !counted.includes(a));
    if (dropped.length) notCounted.push({ input, antigens: dropped, reason: 'Unverified (patient or family recall)' });
    if (counted.length === 0) continue;
    patientDoses.push({ id: input.id, date, cvx });
    for (const antigen of counted) {
      const list = byAntigen.get(antigen) ?? [];
      list.push({ input, date, cvx });
      byAntigen.set(antigen, list);
    }
  }
  for (const list of byAntigen.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  patientDoses.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { byAntigen, patientDoses, notCounted, unmapped };
}

// ---------------------------------------------------------------------------------------------------------
// Chapter 5 + 8: relevant series, evaluation of each, best series per series group
// ---------------------------------------------------------------------------------------------------------

interface AntigenResult {
  antigen: string;
  /** Series group → best patient series (chapter 8.8). */
  best: Map<number, PatientSeries>;
  all: PatientSeries[];
}

function evaluateAntigen(
  ctx: EvaluationContext,
  rules: RulesData,
  antigen: string,
  doses: AntigenDose[]
): AntigenResult {
  const antigenRules = rules.antigens.get(antigen);
  if (!antigenRules) return { antigen, best: new Map(), all: [] };

  // 5.1 Relevant patient series: Standard / Evaluation Only series for the patient's gender.
  const relevant = antigenRules.series.filter(
    (s) => !s.requiresIndication && (!s.requiredGender?.length || s.requiredGender.includes(ctx.sex))
  );

  // 7.2 Evidence of immunity by date of birth (coded clinical history is not available to the engine).
  const immunity = antigenRules.immunity;
  const immune =
    !!immunity &&
    ctx.dob < immunity.birthDate &&
    (!immunity.birthCountry || immunity.birthCountry === ctx.birthCountry);

  // Series are evaluated lazily so "Completed Series" skip conditions can look at other series groups.
  const results = new Map<string, PatientSeries>();
  const inProgress = new Set<string>();
  const evaluate = (rule: SeriesRule): PatientSeries => {
    const existing = results.get(rule.seriesName);
    if (existing) return existing;
    inProgress.add(rule.seriesName);
    const series = evaluateAndForecastSeries(
      {
        ...ctx,
        isSeriesGroupComplete: (groups) =>
          relevant
            .filter((r) => groups.includes(r.select.seriesGroup) && !inProgress.has(r.seriesName))
            .some((r) => evaluate(r).forecast.status === 'Complete'),
      },
      rule,
      doses,
      immune
    );
    inProgress.delete(rule.seriesName);
    results.set(rule.seriesName, series);
    return series;
  };
  const all = relevant.map(evaluate);

  const byGroup = new Map<number, PatientSeries[]>();
  for (const s of all) {
    const list = byGroup.get(s.rule.select.seriesGroup) ?? [];
    list.push(s);
    byGroup.set(s.rule.select.seriesGroup, list);
  }

  const prioritized = new Map<number, PatientSeries>();
  for (const [group, list] of byGroup) {
    const p = prioritizedSeries(ctx, list);
    if (p) prioritized.set(group, p);
  }

  // 8.8 Determine best patient series (table 8-14; Risk series are not shipped).
  const best = new Map<number, PatientSeries>();
  for (const [group, series] of prioritized) {
    const complete = series.forecast.status === 'Complete';
    if (complete) {
      best.set(group, series);
      continue;
    }
    if (series.rule.seriesType === 'Evaluation Only') continue;
    const equivalentComplete = (series.rule.equivalentSeriesGroups ?? []).some(
      (g) => prioritized.get(g)?.forecast.status === 'Complete'
    );
    if (!equivalentComplete) best.set(group, series);
  }
  return { antigen, best, all };
}

const firstValidDoseDate = (s: PatientSeries): IsoDate | undefined => {
  const ev = s.evaluations.find((e) => e.status === 'Valid');
  return ev ? s.doses[ev.doseIndex].date : undefined;
};

/** 8.1 – 8.7 for one series group. */
function prioritizedSeries(ctx: EvaluationContext, group: PatientSeries[]): PatientSeries | undefined {
  const defaults = group.filter((s) => s.rule.select.defaultSeries);
  const noValidAnywhere = group.every((s) => s.validCount === 0);

  // SELECTSCORE-2
  const scorable = group.filter((s) => {
    const { seriesType } = s.rule;
    const { maxAgeToStart } = s.rule.select;
    if (seriesType === 'Evaluation Only') return s.forecast.status === 'Complete';
    if (seriesType !== 'Standard') return false;
    if (s.validCount > 0) {
      // The spec checks only the maximum age to start (minAgeToStart is informational).
      return !maxAgeToStart || firstValidDoseDate(s)! < addDuration(ctx.dob, maxAgeToStart);
    }
    return noValidAnywhere && defaults.length === 0;
  });

  // Table 8-3
  const complete = scorable.filter((s) => s.forecast.status === 'Complete');
  const inProcess = scorable.filter((s) => s.validCount > 0 && s.forecast.status === 'Not Complete');
  if (scorable.length === 0) return defaults[0] ?? fallbackSeries(group);
  if (scorable.length === 1) return scorable[0];
  if (complete.length === 1) return complete[0];
  if (complete.length === 0 && inProcess.length === 1) return inProcess[0];
  if (complete.length === 0 && inProcess.length === 0 && defaults.length === 1 && scorable.includes(defaults[0])) {
    return defaults[0];
  }

  // Table 8-5: which scorable series are scored
  let scored: PatientSeries[];
  let scoreFn: (s: PatientSeries, peers: PatientSeries[]) => number;
  if (complete.length >= 2) {
    scored = complete;
    scoreFn = scoreComplete;
  } else if (inProcess.length >= 2) {
    scored = inProcess;
    scoreFn = (s, peers) => scoreInProcess(ctx, s, peers);
  } else {
    scored = scorable.filter((s) => s.validCount === 0);
    if (scored.length === 0) scored = scorable;
    scoreFn = (s, peers) => scoreNoValidDoses(ctx, s, peers);
  }
  const withScores = scored.map((s) => ({ s, score: scoreFn(s, scored) }));
  withScores.sort((a, b) => b.score - a.score || a.s.rule.select.seriesPreference - b.s.rule.select.seriesPreference);
  return withScores[0].s;
}

/** Nothing scorable and no default series: keep the series with the most valid doses so a forecast still exists. */
function fallbackSeries(group: PatientSeries[]): PatientSeries | undefined {
  return group
    .slice()
    .sort((a, b) => b.validCount - a.validCount || a.rule.select.seriesPreference - b.rule.select.seriesPreference)[0];
}

/** +1 / 0 / -1 for a condition true of this series alone / of several / not of this series. */
function award(points: number, s: PatientSeries, peers: PatientSeries[], test: (x: PatientSeries) => boolean): number {
  const mine = test(s);
  if (!mine) return -points;
  return peers.filter(test).length > 1 ? 0 : points;
}

function mostValidDoses(s: PatientSeries, peers: PatientSeries[]): boolean {
  return peers.every((p) => p.validCount <= s.validCount);
}

/** Table 8-7 */
function scoreComplete(s: PatientSeries, peers: PatientSeries[]): number {
  return award(1, s, peers, (x) => mostValidDoses(x, peers));
}

function isCompletable(ctx: EvaluationContext, s: PatientSeries): boolean {
  const finish = seriesFinishDate(ctx, s);
  const maxAge = lastTargetMaxAgeDate(ctx, s);
  return !!finish && (!maxAge || finish < maxAge);
}

/** Table 8-9 */
function scoreInProcess(ctx: EvaluationContext, s: PatientSeries, peers: PatientSeries[]): number {
  let score = 0;
  const allValid = (x: PatientSeries): boolean =>
    x.rule.select.productPath && x.evaluations.every((e) => e.status === 'Valid');
  score += allValid(s) ? 2 : -2;
  score += isCompletable(ctx, s) ? 3 : -3;
  score += award(2, s, peers, (x) => mostValidDoses(x, peers));
  const notSatisfied = (x: PatientSeries): number => x.targets.filter((t) => t.status === 'not-satisfied').length;
  score += award(2, s, peers, (x) => peers.every((p) => notSatisfied(p) >= notSatisfied(x)));
  const completable = peers.filter((p) => isCompletable(ctx, p));
  score += award(1, s, peers, (x) => {
    if (!isCompletable(ctx, x)) return false;
    const mine = seriesFinishDate(ctx, x)!;
    return completable.every((p) => seriesFinishDate(ctx, p)! >= mine);
  });
  return score;
}

/** Table 8-11 */
function scoreNoValidDoses(ctx: EvaluationContext, s: PatientSeries, peers: PatientSeries[]): number {
  let score = 0;
  const start = (x: PatientSeries): IsoDate | undefined => x.forecast.earliest;
  score += award(1, s, peers, (x) => {
    const mine = start(x);
    return !!mine && peers.every((p) => !start(p) || start(p)! >= mine);
  });
  score += isCompletable(ctx, s) ? 1 : -1;
  score += s.rule.select.productPath ? -1 : 1;
  return score;
}

// ---------------------------------------------------------------------------------------------------------
// Chapter 9: vaccine group forecast + Ottehr presentation
// ---------------------------------------------------------------------------------------------------------

interface GroupInputs {
  definition: ForecastGroupDefinition;
  antigens: string[];
  /** Best series (across the lane's series groups) per antigen. */
  seriesByAntigen: Map<string, PatientSeries[]>;
}

function pickSeriesStatus(forecasts: PatientSeries[]): CdsiSeriesStatus {
  // Table 9-4 (Contraindicated / Immune come from marks, not series)
  const statuses = forecasts.map((s) => s.forecast.status);
  if (statuses.includes('Aged Out')) return 'Aged Out';
  if (statuses.includes('Not Recommended')) return 'Not Recommended';
  if (statuses.includes('Not Complete')) return 'Not Complete';
  if (statuses.length > 0 && statuses.every((s) => s === 'Immune')) return 'Immune';
  return 'Complete';
}

function uiStatus(
  seriesStatus: CdsiSeriesStatus,
  next: NextDose | null,
  asOf: IsoDate,
  anyValid: boolean
): ImmunizationGroupStatus {
  if (seriesStatus === 'Immune') return 'immune';
  // Aged out or not recommended with no dose ever given: nothing was completed, so not "complete".
  if ((seriesStatus === 'Aged Out' || seriesStatus === 'Not Recommended') && !anyValid) return 'notroutine';
  if (seriesStatus !== 'Not Complete' || !next) return 'complete';
  if (asOf < next.recommended) return anyValid ? 'uptodate' : 'notyet';
  if (next.pastDue && asOf > next.pastDue) return 'pastdue';
  return 'due';
}

function buildGroupForecast(
  ctx: EvaluationContext,
  rules: RulesData,
  inputs: GroupInputs,
  history: OrganizedHistory,
  input: ImmunizationForecastInput
): ImmunizationGroupForecast {
  const { definition } = inputs;
  const contained = inputs.antigens.flatMap((a) => inputs.seriesByAntigen.get(a) ?? []);
  const seriesStatus = pickSeriesStatus(contained);
  const notComplete = contained.filter((s) => s.forecast.status === 'Not Complete');
  const notes: string[] = [];

  // Forecast dates (9.2 / 9.3 and FORECASTVG-2/3/4, FORECASTDN-2)
  let next: NextDose | null = null;
  if (seriesStatus === 'Not Complete' && notComplete.length) {
    const groupDoses = history.patientDoses.filter((d) =>
      (rules.cvxMap.get(d.cvx)?.associations ?? []).some((a) => inputs.antigens.includes(a.antigen))
    );
    const hasPriority = notComplete.some((s) => s.forecast.priority);
    const earliest = hasPriority
      ? maxDate(minDate(...notComplete.map((s) => s.forecast.earliest)), maxDate(...groupDoses.map((d) => d.date)))!
      : maxDate(...notComplete.map((s) => s.forecast.earliest))!;
    const recommended = maxDate(minDate(...notComplete.map((s) => s.forecast.recommended)), earliest)!;
    const pastDues = notComplete.map((s) => s.forecast.pastDue).filter((d): d is IsoDate => !!d);
    const pastDue = pastDues.length === notComplete.length ? maxDate(minDate(...pastDues), earliest)! : null;
    const latest = minDate(...notComplete.map((s) => s.forecast.latest)) ?? null;
    const doseNumbers = notComplete.map((s) => s.forecast.doseNumber ?? 1);
    const administerFull = rules.vaccineGroupAdministerFull.get(definition.vaccineGroup) ?? false;
    const cvx = [...new Set(notComplete.flatMap((s) => s.forecast.cvx))];
    const guidance = notComplete.find((s) => s.rule.seriesAdminGuidance.length)?.rule.seriesAdminGuidance[0];
    next = {
      n: administerFull ? Math.min(...doseNumbers) : Math.max(...doseNumbers),
      earliest,
      recommended,
      pastDue,
      latest,
      cvx,
      note: guidance,
    };
  }
  for (const s of contained) {
    if (s.forecast.status !== 'Not Complete' && s.forecast.reason && !notes.includes(s.forecast.reason)) {
      notes.push(s.forecast.reason);
    }
  }

  // Evaluated doses: shown once per input dose, taken from the primary antigen (the first one still not
  // complete) when it holds the dose, otherwise from the first contained series that does (e.g. a mumps-only
  // dose in the MMR lane).
  const primary = notComplete[0] ?? contained[0];
  const doses: EvaluatedDose[] = [];
  const seen = new Set<string>();
  const ordered = primary ? [primary, ...contained.filter((s) => s !== primary)] : [];
  for (const series of ordered) {
    const targetNumber = new Map<number, number>();
    let n = 0;
    series.targets.forEach((t, i) => {
      if (t.status !== 'skipped') n++;
      targetNumber.set(i, n);
    });
    for (const ev of series.evaluations) {
      const dose = series.doses[ev.doseIndex];
      if (seen.has(dose.input.id)) continue;
      seen.add(dose.input.id);
      const target = ev.targetIndex === undefined ? undefined : series.targets[ev.targetIndex];
      const valid = ev.status === 'Valid';
      const window = valid ? target?.window : undefined;
      doses.push({
        id: dose.input.id,
        date: dose.date,
        cvx: dose.cvx,
        doseNumber: valid && ev.targetIndex !== undefined ? targetNumber.get(ev.targetIndex)! : null,
        status: valid ? 'valid' : ev.status === 'Extraneous' ? 'extraneous' : 'invalid',
        reason: valid ? undefined : ev.reason,
        counted: valid,
        window,
        timing: window ? timing(dose.date, window) : undefined,
      });
    }
  }
  for (const nc of history.notCounted) {
    if (!nc.antigens.some((a) => inputs.antigens.includes(a))) continue;
    doses.push({
      id: nc.input.id,
      date: nc.input.date,
      cvx: nc.input.cvx,
      doseNumber: null,
      status: 'not-counted',
      reason: nc.reason,
      counted: false,
    });
  }
  doses.sort((a, b) => ((a.date ?? '9999') < (b.date ?? '9999') ? -1 : 1));

  // Target count and skipped doses from the primary series
  const notNeeded: number[] = [];
  let targetDoses: number | null = null;
  let targetText = '';
  if (primary) {
    const base = primary.targets.filter((t) => !t.inserted);
    const noMoreDoses = seriesStatus === 'Aged Out' || seriesStatus === 'Not Recommended';
    let k = 0;
    base.forEach((t) => {
      k++;
      if (t.status === 'skipped' || (noMoreDoses && t.status === 'not-satisfied')) notNeeded.push(k);
    });
    const named = /(\d+)-dose/i.exec(primary.rule.seriesName);
    if (definition.seasonal) {
      targetText = 'Every season';
    } else if (definition.targetDoses !== undefined) {
      targetDoses = definition.targetDoses;
      targetText = definition.targetText ?? String(definition.targetDoses);
    } else if (named) {
      targetDoses = Number(named[1]);
      targetText = named[1];
    } else {
      targetDoses = base.filter((t) => t.status !== 'skipped').length;
      targetText = String(targetDoses);
    }
    for (const t of base) {
      if (t.status !== 'skipped') continue;
      const description = t.rule.conditionalSkips.flatMap((s) => s.sets).find((s) => s.description)?.description;
      if (description && !notes.includes(description)) notes.push(description);
    }
    // Alternate target doses beyond the nominal count (e.g. dose 5 of the "4-dose" PCV series) are not shown.
    if (targetDoses !== null) notNeeded.splice(0, notNeeded.length, ...notNeeded.filter((n) => n <= targetDoses!));
  }

  const mark = input.marks?.[definition.id];
  const anyValid = doses.some((d) => d.counted);
  const status: ImmunizationGroupStatus = mark ? mark.type : uiStatus(seriesStatus, next, ctx.asOf, anyValid);

  return {
    group: definition.id,
    label: definition.label,
    status,
    seriesStatus,
    seriesNames: contained.map((s) => s.rule.seriesName),
    targetDoses,
    targetText,
    doses,
    next,
    notNeeded,
    mark,
    notes,
  };
}

function timing(
  date: IsoDate,
  window: { recommended: string | null; pastDue: string | null }
): 'early' | 'on-time' | 'late' {
  if (window.recommended && date < window.recommended) return 'early';
  if (window.pastDue && date > window.pastDue) return 'late';
  return 'on-time';
}

// ---------------------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------------------

/**
 * Evaluates the patient's immunization history and forecasts the next dose of every vaccine group,
 * following the CDC CDSi logic specification v4.6 with the rules data under ./data.
 *
 * Pure and synchronous: no I/O, no clock (the caller passes `asOf`).
 */
export function forecastImmunizations(
  input: ImmunizationForecastInput,
  rules: RulesData = getRulesData()
): ImmunizationForecast {
  if (!isIsoDate(input.dob)) throw new Error(`forecastImmunizations: dob must be an ISO date, got "${input.dob}"`);
  if (!isIsoDate(input.asOf)) throw new Error(`forecastImmunizations: asOf must be an ISO date, got "${input.asOf}"`);

  const history = organizeHistory(rules, input.dob, input.doses);
  const ctx: EvaluationContext = {
    dob: input.dob,
    asOf: input.asOf,
    sex: toCdsiSex(input.sex),
    birthCountry: input.birthCountry ?? DEFAULT_BIRTH_COUNTRY,
    patientDoses: history.patientDoses,
    conflictsByCurrentCvx: rules.conflictsByCurrentCvx,
    isSeriesGroupComplete: () => false,
  };

  const wanted = new Set<ImmunizationGroupId>(input.groups ?? FORECAST_GROUPS.map((g) => g.id));
  const isAdult = ageInYears(input.dob, input.asOf) >= ADULT_AGE_YEARS;
  const antigenResults = new Map<string, AntigenResult>();
  const groups: ImmunizationGroupForecast[] = [];

  for (const definition of FORECAST_GROUPS) {
    if (!wanted.has(definition.id)) continue;
    const antigens = rules.vaccineGroupAntigens.get(definition.vaccineGroup) ?? [];
    const hasDoses = antigens.some((a) => (history.byAntigen.get(a)?.length ?? 0) > 0);
    // Adult-only lanes appear for adults; the childhood lane of a split group appears for children or when it has doses.
    // Zoster is adult-only too, unless a child has a Zoster dose.
    if (definition.id === 'zoster' && !isAdult && !hasDoses && !input.groups) continue;
    if (definition.seriesGroups) {
      const adultLane = definition.id === 'pneumo-adult' || definition.id === 'rsv-adult';
      if (adultLane && !isAdult && !input.groups) continue;
      if (!adultLane && isAdult && !hasDoses && !input.groups) continue;
    }
    const seriesByAntigen = new Map<string, PatientSeries[]>();
    for (const antigen of antigens) {
      let result = antigenResults.get(antigen);
      if (!result) {
        result = evaluateAntigen(ctx, rules, antigen, history.byAntigen.get(antigen) ?? []);
        antigenResults.set(antigen, result);
      }
      const series = [...result.best.entries()]
        .filter(([group]) => !definition.seriesGroups || definition.seriesGroups.includes(group))
        .map(([, s]) => s);
      seriesByAntigen.set(antigen, series);
    }
    groups.push(buildGroupForecast(ctx, rules, { definition, antigens, seriesByAntigen }, history, input));
  }

  return { asOf: input.asOf, dataVersion: rules.manifest.version, groups, unmappedDoses: history.unmapped };
}

/** Exposed for tests and tooling: the per-series CDSi evaluation for one antigen. */
export function evaluateAntigenForTests(
  input: ImmunizationForecastInput,
  antigen: string,
  rules: RulesData = getRulesData()
): { best: PatientSeries[]; all: PatientSeries[]; evaluations: DoseEvaluation[][] } {
  const history = organizeHistory(rules, input.dob, input.doses);
  const ctx: EvaluationContext = {
    dob: input.dob,
    asOf: input.asOf,
    sex: toCdsiSex(input.sex),
    birthCountry: input.birthCountry ?? DEFAULT_BIRTH_COUNTRY,
    patientDoses: history.patientDoses,
    conflictsByCurrentCvx: rules.conflictsByCurrentCvx,
    isSeriesGroupComplete: () => false,
  };
  const result = evaluateAntigen(ctx, rules, antigen, history.byAntigen.get(antigen) ?? []);
  return { best: [...result.best.values()], all: result.all, evaluations: result.all.map((s) => s.evaluations) };
}
