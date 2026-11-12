import { DateTime } from 'luxon';
import { FORECAST_GROUPS } from 'utils/lib/immunization-forecast/groups';
import { ImmunizationForecast, ImmunizationGroupId } from 'utils/lib/immunization-forecast/types';
import { InventoryDrugRow, InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { Vaccine } from 'utils/lib/types/data/immunization/types';
import { isPublicFunding, sortVaccineLotsForPatient, VfcEligibilityCode } from 'utils/lib/types/data/immunization/vfc';
import { applyImmunizationQuickPick, applyLotToLine, ImmunizationFormValues } from './immunizationLines';

/** CVX → the forecast groups it covers, as the forecast endpoint returns it. */
export type CvxGroups = Record<string, ImmunizationGroupId[]>;

/** A vaccine the practice gives, with the CVX codes and quick picks it is known by and its lots on hand. */
export interface StockedVaccine {
  id: string;
  name: string;
  cvxCodes: string[];
  quickPicks: ImmunizationQuickPickData[];
  /** On hand at the visit's location; empty when inventory is not set up for it. */
  lots: InventoryLot[];
  /** Its lots are tracked in inventory and none is on hand: still offered, grayed out (it may be a false negative). */
  outOfStock: boolean;
}

/** A group due today or past due, and the CVX codes the forecast allows for its next dose. */
export interface DueGroup {
  id: ImmunizationGroupId;
  label: string;
  status: 'due' | 'pastdue';
  cvx: string[];
}

/** A stocked vaccine that covers something due, and what else it would give. */
export interface DueTodayCandidate {
  vaccine: StockedVaccine;
  /** The due groups it covers. */
  covers: ImmunizationGroupId[];
  /** Groups it also gives that are not due (Vaxelis's Hep B at 4 months). */
  extras: ImmunizationGroupId[];
}

/** One row of the box: the vaccine with the fewest shots for its group of due diseases, and the other ways. */
export interface DueTodayRow {
  lead: DueTodayCandidate;
  /** The due groups this row is for. */
  covers: ImmunizationGroupId[];
  alternatives: DueTodayCandidate[];
}

export interface DueToday {
  due: DueGroup[];
  /** Every forecast group's display name, for the extras a vaccine would give. */
  labels: Partial<Record<ImmunizationGroupId, string>>;
  rows: DueTodayRow[];
  /** Due groups no stocked vaccine with a CVX covers. */
  unstocked: DueGroup[];
  /** "Rotavirus (declined)": marked groups leave the box. */
  notSuggested: string[];
  /** "Hep B 3 not due until 12/23/2026": the next few doses coming up. */
  upcoming: string[];
}

// The engine keys CVX codes with their leading zero ("08"); a typed quick pick may not.
const normalizeCvx = (cvx: string): string => cvx.trim().padStart(2, '0');

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const onHand = (lots: InventoryLot[]): InventoryLot[] => lots.filter((lot) => lot.onHand > 0);

/**
 * The vaccines the practice can give today, each with the CVX of its catalog entry and its quick picks; this is the
 * one place that decides what "stocked" means. Every vaccine on the practice's list (get-vaccines) is offered. One
 * whose lots are tracked at the visit's location but none is on hand is out of stock; one with no lots ever entered
 * is not tracked in Ottehr, so it counts as available.
 */
export const stockedVaccines = (
  vaccines: Vaccine[] | undefined,
  quickPicks: ImmunizationQuickPickData[],
  inventory?: InventoryDrugRow[]
): StockedVaccine[] =>
  (vaccines ?? []).map((vaccine) => {
    const allLots = inventory?.find((row) => row.medicationId === vaccine.id)?.lots ?? [];
    const lots = onHand(allLots);
    return {
      id: vaccine.id,
      name: vaccine.name,
      cvxCodes: vaccine.cvx?.trim() ? [normalizeCvx(vaccine.cvx)] : [],
      quickPicks: quickPicks.filter((quickPick) => quickPick.vaccine?.id === vaccine.id),
      lots,
      outOfStock: allLots.length > 0 && lots.length === 0,
    };
  });

/** The name the box shows: a vaccine given one way reads as its quick pick ("Prevnar 20 infant"), else as itself. */
export const stockedVaccineName = (vaccine: StockedVaccine): string =>
  vaccine.quickPicks.length === 1 ? vaccine.quickPicks[0].name : vaccine.name;

export const dueGroups = (forecast: ImmunizationForecast): DueGroup[] =>
  forecast.groups.flatMap((group) =>
    (group.status === 'due' || group.status === 'pastdue') && group.next
      ? [{ id: group.group, label: group.label, status: group.status, cvx: group.next.cvx.map(normalizeCvx) }]
      : []
  );

/** A CVX covers a due group when the data recommends it for the next dose or, where the data names no forecast
 * vaccine type for the dose (the CDC data does so only for product-specific recommendations, e.g. PCV15/PCV20),
 * when the CVX gives one of the group's antigens. */
const coversGroup = (cvx: string, group: DueGroup, cvxGroups: CvxGroups): boolean =>
  group.cvx.length ? group.cvx.includes(cvx) : (cvxGroups[cvx] ?? []).includes(group.id);

const candidatesFor = (
  stocked: StockedVaccine[],
  due: DueGroup[],
  cvxGroups: CvxGroups,
  forecastGroups: Set<ImmunizationGroupId>
): DueTodayCandidate[] =>
  stocked.flatMap((vaccine) => {
    const covers = due
      .filter((group) => vaccine.cvxCodes.some((cvx) => coversGroup(cvx, group, cvxGroups)))
      .map((g) => g.id);
    if (!covers.length) return [];
    const extras = unique(vaccine.cvxCodes.flatMap((cvx) => cvxGroups[cvx] ?? [])).filter(
      (id) => forecastGroups.has(id) && !covers.includes(id)
    );
    return [{ vaccine, covers, extras }];
  });

/** The on-hand lot that expires soonest; a vaccine without lots sorts after one with them. */
const soonestExpiration = (candidate: DueTodayCandidate): string =>
  candidate.vaccine.lots.map((lot) => lot.expirationDate.slice(0, 10)).sort()[0] ?? '9999-12-31';

/** The tie rule (decision #8), after in stock before out of stock: fewest shots for what's due, then nothing given
 * that isn't due, then the lot that expires soonest. The name settles what is left, so the box reads the same every
 * time. */
const rank = (a: DueTodayCandidate, b: DueTodayCandidate, gain: (c: DueTodayCandidate) => number): number =>
  Number(a.vaccine.outOfStock) - Number(b.vaccine.outOfStock) ||
  gain(b) - gain(a) ||
  a.extras.length - b.extras.length ||
  soonestExpiration(a).localeCompare(soonestExpiration(b)) ||
  a.vaccine.name.localeCompare(b.vaccine.name);

const MAX_UPCOMING = 3;

const upcomingDoses = (forecast: ImmunizationForecast): string[] =>
  forecast.groups
    .filter((group) => (group.status === 'notyet' || group.status === 'uptodate') && group.next)
    .sort((a, b) => a.next!.recommended.localeCompare(b.next!.recommended))
    .slice(0, MAX_UPCOMING)
    .map(
      (group) =>
        `${group.label} ${group.next!.n} not due until ${DateTime.fromISO(group.next!.recommended).toFormat(
          'MM/dd/yyyy'
        )}`
    );

/** Option A, fewest shots first: one row per group of due diseases, led by the stocked vaccine covering the most. */
export const buildDueToday = (
  forecast: ImmunizationForecast,
  stocked: StockedVaccine[],
  cvxGroups: CvxGroups
): DueToday => {
  const due = dueGroups(forecast);
  const candidates = candidatesFor(stocked, due, cvxGroups, new Set(forecast.groups.map((group) => group.group)));
  const uncovered = new Set(due.map((group) => group.id));
  const rows: DueTodayRow[] = [];
  const leads = new Set<string>();
  while (uncovered.size) {
    const gain = (candidate: DueTodayCandidate): number => candidate.covers.filter((id) => uncovered.has(id)).length;
    const [best] = candidates.filter((c) => !leads.has(c.vaccine.id) && gain(c) > 0).sort((a, b) => rank(a, b, gain));
    if (!best) break;
    const covers = best.covers.filter((id) => uncovered.has(id));
    covers.forEach((id) => uncovered.delete(id));
    leads.add(best.vaccine.id);
    rows.push({ lead: best, covers, alternatives: [] });
  }
  for (const row of rows) {
    const overlap = (candidate: DueTodayCandidate): number =>
      candidate.covers.filter((id) => row.covers.includes(id)).length;
    row.alternatives = candidates
      .filter((c) => !leads.has(c.vaccine.id) && overlap(c) > 0)
      .sort((a, b) => rank(a, b, overlap));
  }
  return {
    due,
    labels: Object.fromEntries(forecast.groups.map((group) => [group.group, group.label])),
    rows,
    unstocked: due.filter((group) => uncovered.has(group.id)),
    notSuggested: forecast.groups.flatMap((group) => (group.mark ? [`${group.label} (${group.mark.type})`] : [])),
    upcoming: upcomingDoses(forecast),
  };
};

/** A vaccine is on the page once an order line names it. */
export const isVaccineAdded = (vaccine: StockedVaccine, lines: ImmunizationFormValues[]): boolean =>
  lines.some((line) => !line.outside && line.details.medication?.id === vaccine.id);

export interface DueTodayLotPick {
  /** The patient's VFC eligibility for the visit, once confirmed. */
  vfcEligibility?: VfcEligibilityCode;
  /** ISO yyyy-mm-dd, the browser's day: an expired lot is never pre-picked. */
  today: string;
}

/**
 * The lot ⊕ pre-picks: the patient's stock first (VFC lots for a VFC-eligible child, private otherwise), soonest
 * expiry, as the Lot blank lists them. Never an expired lot, and never the other stock: borrowing is the
 * provider's own choice in the Lot blank, where it asks for the reason. While a child's eligibility is not
 * confirmed, no VFC or state lot either: the Lot blank offers them and says eligibility is unconfirmed.
 */
export const lotToPrePick = (vaccine: StockedVaccine, pick: DueTodayLotPick): InventoryLot | undefined =>
  sortVaccineLotsForPatient(vaccine.lots, pick.vfcEligibility, pick.today).find(
    (option) =>
      !option.expired &&
      option.matches !== false &&
      (option.matches !== undefined || !isPublicFunding(option.lot.fundingSource))
  )?.lot;

/**
 * What ⊕ fills (option B): a vaccine with one quick pick fills the whole line from it; a quick pick picked in the
 * box fills from that one; otherwise only the vaccine, and the line asks. The CVX is the vaccine's own when it has
 * just one (a quick pick carries none), and with `lotPick` the line gets its lot from stock too.
 */
export const fillFromDueToday = <T extends ImmunizationFormValues>(
  line: T,
  vaccine: StockedVaccine,
  quickPick: ImmunizationQuickPickData | undefined = vaccine.quickPicks.length === 1
    ? vaccine.quickPicks[0]
    : undefined,
  lotPick?: DueTodayLotPick
): T => {
  const filled = quickPick
    ? applyImmunizationQuickPick(line, quickPick, true)
    : { ...line, details: { ...line.details, medication: { id: vaccine.id, name: vaccine.name } } };
  const withCvx = {
    ...filled,
    administrationDetails: {
      ...filled.administrationDetails,
      cvx: vaccine.cvxCodes.length === 1 ? vaccine.cvxCodes[0] : filled.administrationDetails.cvx,
    },
  };
  const lot = lotPick ? lotToPrePick(vaccine, lotPick) : undefined;
  return lot ? applyLotToLine(withCvx, lot, lotPick?.vfcEligibility) : withCvx;
};

/** The fewest-shot set "Add all due" adds: each row's lead that is not on the page yet. */
export const vaccinesToAddAll = (dueToday: DueToday, lines: ImmunizationFormValues[]): StockedVaccine[] =>
  dueToday.rows.map((row) => row.lead.vaccine).filter((vaccine) => !isVaccineAdded(vaccine, lines));

/** The diseases (forecast groups) a line gives: by the CVX typed on it, else those of the stocked vaccine it names. */
const lineGroups = (
  line: ImmunizationFormValues,
  stocked: StockedVaccine[],
  cvxGroups: CvxGroups
): Set<ImmunizationGroupId> => {
  const typed = line.administrationDetails.cvx?.trim();
  const codes = typed
    ? [normalizeCvx(typed)]
    : stocked.find((vaccine) => vaccine.id === line.details.medication?.id)?.cvxCodes ?? [];
  return new Set(codes.flatMap((cvx) => cvxGroups[cvx] ?? []));
};

export interface DuplicateGroups {
  /** The earlier line's vaccine, by its display name. */
  vaccine: string;
  /** The diseases this line gives again, by their labels. */
  groups: string[];
}

/**
 * For each order line, the diseases an earlier line on the page already gives, any disease (due or not), grouped by
 * that earlier line. Outside lines and lines without a vaccine are left out. Informs only: never blocks saving.
 */
export const duplicateGroupsByLine = (
  lines: ImmunizationFormValues[],
  stocked: StockedVaccine[],
  cvxGroups: CvxGroups
): DuplicateGroups[][] => {
  const given = lines.map((line) =>
    !line.outside && line.details.medication ? lineGroups(line, stocked, cvxGroups) : new Set<ImmunizationGroupId>()
  );
  return lines.map((_, index) => {
    // each disease is named once, against the first earlier line that gives it
    const named = new Set<ImmunizationGroupId>();
    const duplicates: DuplicateGroups[] = [];
    for (let earlier = 0; earlier < index; earlier++) {
      const groups = [...given[index]].filter((group) => given[earlier].has(group) && !named.has(group));
      groups.forEach((group) => named.add(group));
      if (groups.length) {
        duplicates.push({ vaccine: lines[earlier].details.medication!.name, groups: groups.map(groupLabel) });
      }
    }
    return duplicates;
  });
};

const groupLabel = (group: ImmunizationGroupId): string =>
  FORECAST_GROUPS.find((definition) => definition.id === group)?.label ?? group;

/** "Hep B is also in Pediarix above." / "Hep B, Polio are also in Pediarix above." */
export const duplicateWarningText = (duplicates: DuplicateGroups[]): string =>
  duplicates
    .map(({ vaccine, groups }) => `${groups.join(', ')} ${groups.length > 1 ? 'are' : 'is'} also in ${vaccine} above.`)
    .join(' ');
