/** CMS Claims Processing Manual, Ch.12 §30.5; NCCI 2026 Ch.XI §B.
 * https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c12.pdf
 * https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
 * The code implements the practitioner/office path, not the facility hierarchy.
 * Vaccines and chemotherapy need other codes.
 *
 * Hydration (96360/96361) is handled here too, because the catalog routes hydration procedures into this
 * family and the two services interact. Sources, with their vintage:
 *  - NCCI 2026 Ch.XI (Revision Date 1/1/2026) §B.2: "CPT codes 96360, 96365, 96374, 96409, and 96413 describe
 *    'initial' service codes. For a patient encounter, only one 'initial' service code may be reported unless it
 *    is medically reasonable and necessary that the drug or substance administrations occur at separate
 *    intravenous access sites."
 *  - NCCI 2026 Ch.XI §B.6: "Hydration concurrent with other drug administration services is not separately
 *    reportable." §B.5: "the fluid used to administer drug(s)/substance(s) is incidental hydration and shall not
 *    be reported separately." §B.16: additional-hour codes "shall not be reported for 'keep open' infusions".
 *  - Claims Processing Manual Ch.12 §30.5.E (Rev. 13012, eff. 2025-01-01): "The physician may report the
 *    infusion code for 'each additional hour' only if the infusion interval is greater than 30 minutes beyond
 *    the 1 hour increment." Stated generically for every "each additional hour" code; §30.5.A names Hydration
 *    as one of the three categories the section governs.
 *  - Noridian JE A54635, Billing and Coding: Hydration Services (current version effective 2025-09-25):
 *    "a minimum time duration of 31 minutes of hydration infusion is required to report the service."
 * Deliberately NOT implemented: the initial-code hierarchy for an encounter mixing hydration with a drug
 * administration. CMS states only that one initial code owns the encounter (Ch.12 §30.5.E, "key or primary
 * reason for the encounter") and that an add-on may be billed under an initial code from another section --
 * stated in the deleted 90760/90761 numbering. How hydration hours are then counted is not settled in either
 * source, so that combination is handed to a coder rather than guessed.
 */
import { buildEvaluation, coder, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { INJECTION_INFUSION_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, FamilyEvaluation, LegacyProcedureFields, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readRows, ScalarCodingField } from '../structured-fields';

const INJECTION_INFUSION_CODES = {
  InitialHydration: '96360',
  AdditionalHydrationHour: '96361',
  InitialIvInfusion: '96365',
  AdditionalInfusionHour: '96366',
  IntramuscularOrSubcutaneousInjection: '96372',
  InitialIvPush: '96374',
} as const;
type InjectionInfusionCode = (typeof INJECTION_INFUSION_CODES)[keyof typeof INJECTION_INFUSION_CODES];

const ADMINISTRATION_ROUTE = {
  IntramuscularOrSubcutaneous: 'IM/SC',
  IvPush: 'IV push',
  IvInfusion: 'IV infusion',
  /** Pre-packaged fluid with or without electrolytes, given for volume repletion, not to carry a drug. */
  IvHydration: 'IV hydration',
} as const;

const administrationFields: ScalarCodingField[] = [
  {
    key: 'route',
    label: 'Route',
    kind: 'select',
    options: Object.values(ADMINISTRATION_ROUTE),
  },
  { key: 'drug', label: 'Drug', kind: 'text' },
  { key: 'site', label: 'IV access site', kind: 'text' },
  { key: 'start', label: 'Start', kind: 'time' },
  { key: 'stop', label: 'Stop', kind: 'time' },
  { key: 'event', label: 'Same administration group (for interrupted infusions)', kind: 'text' },
  { key: 'primary', label: 'Primary reason for visit', kind: 'checkbox', defaultValue: false },
  {
    key: 'separateInitial',
    label: 'Separate initial service justified by access protocol or encounter',
    kind: 'checkbox',
    defaultValue: false,
  },
  {
    key: 'distinctService',
    label: 'Separate IM/SC service from IV administration',
    kind: 'checkbox',
    defaultValue: false,
  },
];
for (const field of administrationFields) {
  if (['start', 'stop', 'event'].includes(field.key))
    field.visible = (facts) =>
      facts.route === ADMINISTRATION_ROUTE.IvInfusion || facts.route === ADMINISTRATION_ROUTE.IvHydration;
  if (['site', 'primary', 'separateInitial'].includes(field.key))
    field.visible = (facts) =>
      facts.route === ADMINISTRATION_ROUTE.IvInfusion ||
      facts.route === ADMINISTRATION_ROUTE.IvPush ||
      facts.route === ADMINISTRATION_ROUTE.IvHydration;
  if (['event', 'separateInitial', 'distinctService'].includes(field.key)) field.details = true;
}
const fields: CodingField[] = [
  { key: 'administrations', label: 'Administrations', kind: 'rows', fields: administrationFields },
];
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
// Product input-validity ceiling; this is not a CMS unit limit.
const MAX_INFUSION_MINUTES = 12 * MINUTES_PER_HOUR;
// CMS Ch.12 §30.5 timing thresholds, as documented beside the calculation below.
const MAX_IV_PUSH_MINUTES = 15;
const ADDITIONAL_HOUR_MIN_MINUTES = 31;
/** A54635: 31 minutes is the floor below which hydration is not reported at all. */
const MIN_HYDRATION_MINUTES = 31;
const FIRST_ADDITIONAL_HOUR_MINUTES = MINUTES_PER_HOUR + ADDITIONAL_HOUR_MIN_MINUTES;

interface InfusionInterval {
  startMinutes: number;
  endMinutes: number;
}

interface AdministrationEvent {
  route: string;
  drug: string;
  site: string;
  minutes: number;
  primary: boolean;
  separate: boolean;
  distinct: boolean;
  intervals: InfusionInterval[];
}

/** Hydration is timed exactly like a therapeutic infusion: elapsed clock time from start to stop. */
const isTimedInfusion = (route: unknown): boolean =>
  route === ADMINISTRATION_ROUTE.IvInfusion || route === ADMINISTRATION_ROUTE.IvHydration;

export function clockMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return undefined;
  const [hours, minutes] = value.split(':').map(Number);
  return hours < HOURS_PER_DAY && minutes < MINUTES_PER_HOUR ? hours * MINUTES_PER_HOUR + minutes : undefined;
}

/** Only parses clock syntax; does not extract times or clinical facts from narrative. */
export function infusionMinutes(start: unknown, stop: unknown): number | undefined {
  const startMinutes = clockMinutes(start);
  const stopMinutes = clockMinutes(stop);

  if (startMinutes === undefined || stopMinutes === undefined || startMinutes === stopMinutes) return undefined;

  // A stop before the start represents crossing midnight.
  return stopMinutes > startMinutes ? stopMinutes - startMinutes : stopMinutes + MINUTES_PER_DAY - startMinutes;
}

/**
 * Hydration alone in the encounter. A54635 sets the 31-minute floor; Ch.12 §30.5.E allows an additional
 * hour only when the interval runs more than 30 minutes past the previous hour, which is the same
 * arithmetic the therapeutic infusion uses below.
 */
function suggestHydration(events: AdministrationEvent[]): FamilyEvaluation {
  if (events.length > 1) return coder('Separate fluid replacements in one visit need a coder to assign the codes.');

  const minutes = events[0].minutes;

  if (minutes < MIN_HYDRATION_MINUTES)
    return noCode('Fluid replacement shorter than 31 minutes is not reported separately.');

  const lines: CodeSuggestion[] = [
    {
      code: INJECTION_INFUSION_CODES.InitialHydration,
      display: 'Initial hydration infusion',
      justification: `Hydration: ${minutes} minutes.`,
      units: 1,
      modifiers: [],
    },
  ];

  if (minutes >= FIRST_ADDITIONAL_HOUR_MINUTES)
    lines.push({
      requiresCode: INJECTION_INFUSION_CODES.InitialHydration,
      code: INJECTION_INFUSION_CODES.AdditionalHydrationHour,
      display: 'Additional hydration hour',
      justification: 'Additional elapsed hydration time.',
      units: Math.floor((minutes - ADDITIONAL_HOUR_MIN_MINUTES) / MINUTES_PER_HOUR),
      modifiers: [],
    });

  return buildEvaluation({
    suggestions: lines,
    payerNotes: [
      'Fluid given only to keep a line open, or as the carrier for a medication, is not reported separately.',
    ],
  });
}

export const injectionInfusionFamily: ProcedureFamilyModel<InjectionInfusionCode> = {
  codePairEdits: INJECTION_INFUSION_PTP_EDITS,
  // Each administration row carries its own IV access site, so the shared site dropdown would ask twice.
  // Laterality has no per-row question here, so the shared Side of body dropdown stays.
  capturesSite: true,
  id: 'injection-infusion',
  procedureNames: PROCEDURE_NAMES['injection-infusion'],
  displayName: 'Injection/infusion',
  fields,
  codes: Object.values(INJECTION_INFUSION_CODES),
  suggest: (facts) => {
    const rows = readRows(facts, 'administrations');

    if (!rows.length) return missing('Administrations');

    const events = new Map<string, AdministrationEvent>();

    for (const [i, row] of rows.entries()) {
      // Name the row as the form numbers it, and name only what is actually unanswered: several
      // administrations can be on screen at once and a bare "Route" does not say which one is incomplete.
      const inRow = (label: string): string => `Administrations ${i + 1}: ${label}`;
      const unanswered = [
        ...(Object.values(ADMINISTRATION_ROUTE).some((route) => route === row.route) ? [] : ['Route']),
        ...(row.drug ? [] : ['Drug']),
      ];

      if (unanswered.length) return missing(...unanswered.map(inRow));

      if (row.route !== ADMINISTRATION_ROUTE.IntramuscularOrSubcutaneous && !row.site)
        return missing(inRow('IV access site'));

      const minutes = isTimedInfusion(row.route) ? infusionMinutes(row.start, row.stop) : 0;

      if (minutes === undefined || minutes > MAX_INFUSION_MINUTES)
        return missing(
          ...[...(row.start ? [] : ['Start']), ...(row.stop ? [] : ['Stop'])]
            .map(inRow)
            .concat(row.start && row.stop ? [inRow('Start'), inRow('Stop')] : [])
        );

      const key = isTimedInfusion(row.route) && row.event ? `group:${String(row.event)}` : `row:${i}`;

      const existing = events.get(key);

      if (
        existing &&
        (existing.route !== row.route ||
          existing.drug !== row.drug ||
          existing.site !== row.site ||
          !isTimedInfusion(row.route))
      ) {
        return missing('Consistent drug, route and site within one infusion group');
      }

      const event = existing ?? {
        route: String(row.route),
        drug: String(row.drug),
        site: String(row.site ?? ''),
        minutes: 0,
        primary: false,
        separate: false,
        distinct: false,
        intervals: [],
      };

      if (isTimedInfusion(row.route)) {
        const startMinutes = clockMinutes(row.start)!;
        const endMinutes = startMinutes + minutes;

        // Compare adjacent dates as well, because an interval may cross midnight.
        const overlapsPreviousSegment = event.intervals.some((interval) =>
          [-MINUTES_PER_DAY, 0, MINUTES_PER_DAY].some(
            (dayOffset) =>
              startMinutes + dayOffset < interval.endMinutes && endMinutes + dayOffset > interval.startMinutes
          )
        );
        if (overlapsPreviousSegment) return missing('Non-overlapping intervals within an administration');
        event.intervals.push({ startMinutes, endMinutes });
      }

      event.minutes += minutes;
      event.primary ||= row.primary === true;
      event.separate ||= row.separateInitial === true;
      event.distinct ||= row.distinctService === true;
      events.set(key, event);
    }
    if ([...events.values()].some((event) => event.minutes > MAX_INFUSION_MINUTES)) return missing('Start', 'Stop');

    const everyEvent = [...events.values()];
    const hydration = everyEvent.filter((event) => event.route === ADMINISTRATION_ROUTE.IvHydration);
    const all = everyEvent.filter((event) => event.route !== ADMINISTRATION_ROUTE.IvHydration);

    // NCCI XI §B.6: hydration concurrent with other drug administration is not separately reportable, and
    // §B.5 makes the fluid carrying a drug incidental. Where the two are sequential, one initial code still
    // owns the encounter (Ch.12 §30.5.E) but the hour counting for the other service is unsettled.
    if (hydration.length && all.length)
      return coder('Fluid replacement given alongside a medication in this visit needs a coder to assign the codes.');

    if (hydration.length) return suggestHydration(hydration);

    const iv = all.filter((event) => event.route !== ADMINISTRATION_ROUTE.IntramuscularOrSubcutaneous);
    const markedPrimary = iv.filter((event) => event.primary);
    let primary: AdministrationEvent | undefined;

    if (iv.length === 1) primary = iv[0];
    else if (markedPrimary.length === 1) primary = markedPrimary[0];

    if (iv.length > 1 && !primary) return missing('Primary reason for visit');

    const lines: CodeSuggestion[] = [];
    for (const event of all) {
      if (event.route === ADMINISTRATION_ROUTE.IntramuscularOrSubcutaneous) {
        if (iv.length && !event.distinct)
          return coder('Confirm a separately reportable IM/SC service alongside IV administration.');
        lines.push({
          code: INJECTION_INFUSION_CODES.IntramuscularOrSubcutaneousInjection,
          display: 'Therapeutic injection',
          justification: 'One IM/SC administration.',
          units: 1,
          modifiers: iv.length ? [CPT_MODIFIERS.DistinctService] : [],
        });
        continue;
      }

      // NCCI XI §B.2: a second initial needs medically justified separate access; primary selection follows Ch.12 §30.5.
      if (
        event !== primary &&
        !event.separate &&
        event.route === ADMINISTRATION_ROUTE.IvPush &&
        primary?.route === ADMINISTRATION_ROUTE.IvPush &&
        event.drug === primary.drug &&
        event.site === primary.site
      )
        continue;

      if (event !== primary && !event.separate)
        return coder('Additional intravenous administrations in this visit need a coder to assign their codes.');

      const modifiers = event !== primary ? [CPT_MODIFIERS.DistinctService] : [];

      if (event.route === ADMINISTRATION_ROUTE.IvPush || event.minutes <= MAX_IV_PUSH_MINUTES) {
        lines.push({
          code: INJECTION_INFUSION_CODES.InitialIvPush,
          display: 'Initial therapeutic IV push',
          justification: 'IV push or infusion lasting at most 15 minutes.',
          units: 1,
          modifiers,
        });
        continue;
      }

      lines.push({
        code: INJECTION_INFUSION_CODES.InitialIvInfusion,
        display: 'Initial therapeutic IV infusion',
        justification: `Infusion: ${event.minutes} minutes.`,
        units: 1,
        modifiers,
      });

      // Ch.12 §30.5 requires more than 30 minutes beyond the prior hour for each additional hour.
      if (event.minutes >= FIRST_ADDITIONAL_HOUR_MINUTES)
        lines.push({
          requiresCode: INJECTION_INFUSION_CODES.InitialIvInfusion,
          code: INJECTION_INFUSION_CODES.AdditionalInfusionHour,
          display: 'Additional therapeutic infusion hour',
          justification: 'Additional elapsed infusion time.',
          units: Math.floor((event.minutes - ADDITIONAL_HOUR_MIN_MINUTES) / MINUTES_PER_HOUR),
          modifiers: [],
        });
    }
    return buildEvaluation({ suggestions: lines });
  },
  dailyLimits: {
    // 96360 and 96361 are deliberately absent. CMS distributes the practitioner MUE table only as a ZIP,
    // its own page states that some MUE values are confidential and not releasable, and no MAC, payer or
    // CMS page reachable here publishes a value or an adjudication indicator for these two codes. The
    // figures circulating on coding sites disagree (8 vs 24) and none is dated to a current quarter.
    // Add both rows once they are read from medicare-ncci-<quarter>-practitioner-services-mue-table.zip.
    [INJECTION_INFUSION_CODES.InitialIvInfusion]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [INJECTION_INFUSION_CODES.AdditionalInfusionHour]: {
      maxUnits: 8,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [INJECTION_INFUSION_CODES.IntramuscularOrSubcutaneousInjection]: {
      maxUnits: 4,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [INJECTION_INFUSION_CODES.InitialIvPush]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // CMS Claims Manual Ch.12 §30.5: order/plan, administration route, timing and separate initial-service justification.
  // https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c12.pdf
  documentationChecklist: (facts) => {
    const administrations = readRows(facts, 'administrations');
    const checklist = [
      'Record the order and treatment indication; drug, dose, route and anatomic site for each administration.',
      'Identify the administering clinician and applicable supervision in the signed, dated record.',
    ];
    if (administrations.some((row) => row.route === ADMINISTRATION_ROUTE.IvInfusion))
      checklist.push(
        'Record infusion start/stop times, interruptions and medical necessity for each additional hour; keep-open time is excluded.',
        'For more than one initial IV service, document the separate access protocol or encounter and its reason.'
      );
    if (administrations.some((row) => row.route === ADMINISTRATION_ROUTE.IvPush))
      checklist.push(
        'Document the IV push and continuous clinician presence, or the timed infusion lasting no more than 15 minutes.'
      );
    if (administrations.some((row) => row.route === ADMINISTRATION_ROUTE.IntramuscularOrSubcutaneous))
      checklist.push(
        'Document each injection separately when billing multiple units; identify why an IM/SC service is distinct from any IV administration.'
      );
    checklist.push('Record the patient response and any complications.');
    return checklist;
  },

  readLegacyFacts: (input: LegacyProcedureFields) => ({
    administrations: [
      {
        start: input.infusionStartTime,
        stop: input.infusionStopTime,
        drug: input.medicationUsed,
        site: input.bodySite,
      },
    ],
  }),
};
