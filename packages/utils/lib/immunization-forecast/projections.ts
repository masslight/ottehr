/**
 * Later doses for the age timeline, display only: each group's next dose is assumed given on its recommended date,
 * the group is forecast again from that day, and so on until the series is done. Never stored, and never used by
 * Due today or anything that decides what to give.
 */
import { cvxToGroups } from './cvx-groups';
import { forecastImmunizations } from './engine';
import { FORECAST_GROUPS } from './groups';
import {
  ForecastDoseInput,
  ImmunizationForecast,
  ImmunizationForecastInput,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
  ImmunizationGroupStatus,
  ProjectedDose,
  ProjectedDoses,
} from './types';

const MAX_PROJECTED_DOSES = 10;
const MAX_CANDIDATES = 6;
/** Done, not recommended, or an exception on the group: nothing to project. */
const NOT_PROJECTED: ImmunizationGroupStatus[] = ['complete', 'notroutine', 'immune', 'contraindicated', 'declined'];
const SEASONAL_GROUPS = new Set(FORECAST_GROUPS.filter((group) => group.seasonal).map((group) => group.id));

/** Vaccines that cover only this group, e.g. IPV (10) for polio: the fallback when the data names no CVX. */
let singleGroupCvx: Map<ImmunizationGroupId, string[]> | undefined;
const singleGroupVaccines = (group: ImmunizationGroupId): string[] => {
  if (!singleGroupCvx) {
    singleGroupCvx = new Map();
    for (const [cvx, groups] of Object.entries(cvxToGroups())) {
      if (groups.length === 1) singleGroupCvx.set(groups[0], [...(singleGroupCvx.get(groups[0]) ?? []), cvx]);
    }
  }
  return singleGroupCvx.get(group) ?? [];
};

/** What the hypothetical dose could be: the data's recommended CVX, the patient's own vaccines for the group (latest
 * first), then the single-group vaccines; the first one the series counts at that age is used. */
const candidateCvx = (group: ImmunizationGroupForecast, recommended: string[]): string[] =>
  [
    ...new Set([
      ...recommended,
      ...group.doses
        .filter((dose) => dose.doseNumber !== null)
        .map((dose) => dose.cvx)
        .reverse(),
      ...singleGroupVaccines(group.group),
    ]),
  ].slice(0, MAX_CANDIDATES);

/**
 * The doses after `next` for each group, if each is given on its recommended date. Seasonal groups (flu, COVID) get
 * none, and a projection stops at the series' target count, so a recurring booster (Td every 10 years) is not drawn.
 */
export function projectLaterDoses(input: ImmunizationForecastInput, forecast: ImmunizationForecast): ProjectedDoses {
  const projections: ProjectedDoses = {};
  for (const group of forecast.groups) {
    if (!group.next || NOT_PROJECTED.includes(group.status) || SEASONAL_GROUPS.has(group.group)) continue;
    let doses: ForecastDoseInput[] = [...input.doses];
    const projected: ProjectedDose[] = [];
    let next = group.next;
    for (let index = 0; index < MAX_PROJECTED_DOSES; index++) {
      const current = next;
      let after: ImmunizationGroupForecast | undefined;
      for (const cvx of candidateCvx(group, current.cvx)) {
        const tried = [
          ...doses,
          {
            id: `projected-${group.group}-${current.n}`,
            date: current.recommended,
            cvx,
            source: 'administered' as const,
          },
        ];
        const result = forecastImmunizations({
          ...input,
          doses: tried,
          asOf: current.recommended,
          groups: [group.group],
        }).groups[0];
        // the dose counted when the series moved on
        if (result && (result.status === 'complete' || !result.next || result.next.n > current.n)) {
          after = result;
          doses = tried;
          break;
        }
      }
      const following = after?.next;
      if (!after || !following || after.status === 'complete') break;
      if (after.targetDoses === null || following.n > after.targetDoses) break;
      projected.push({
        n: following.n,
        earliest: following.earliest,
        recommended: following.recommended,
        pastDue: following.pastDue,
      });
      next = following;
    }
    if (projected.length) projections[group.group] = projected;
  }
  return projections;
}
