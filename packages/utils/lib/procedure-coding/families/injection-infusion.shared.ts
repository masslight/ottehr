import { DETAILS_FIELD_LABEL, TO_DETAILS, whereClauseFor } from '../family-support';
import { citing, ENTRY_SCOPE, FactValue, Finding, FindingScope, WhereToDocument } from '../model.types';
import {
  describeDuration,
  InfusionDuration,
  InjectionInfusionFacts,
  MAX_PLAUSIBLE_INFUSION_MINUTES,
} from './injection-infusion.extract';
import { InfusionKind, initialCodeForRoute, InjectionRoute, ROUTE_DOCUMENTED_LABELS } from './injection-infusion.rules';

export const INJECTION_J_CODE_PAYER_NOTE =
  "Billing note: 96372 pairs with the administered drug's J-code on the claim — that pairing happens in the billing layer, not on this page.";

export const INFUSION_HIERARCHY_PAYER_NOTE =
  "Billing note: CPT's infusion hierarchy reports an infusion for therapy, prophylaxis, or diagnosis ahead of hydration when both are documented — which service is initial and which is subsequent is settled in the billing layer, not on this page.";

export const WHERE_TO_DOCUMENT = {
  route: {
    destination: `in the Medication used field or ${DETAILS_FIELD_LABEL}`,
    example: '"Rocephin 500 mg IM, left deltoid" or "NS 1000 mL IV infusion"',
  },
  substance: {
    destination: `in the Medication used field or ${DETAILS_FIELD_LABEL}`,
    example: '"NS 1000 mL infused" for hydration, or "Rocephin 1 g in 100 mL NS infused" for a drug infusion',
  },
  drug: { destination: 'in the Medication used field', example: '"Toradol 60 mg"' },
  dose: { destination: `in the Medication used field or ${DETAILS_FIELD_LABEL}`, example: '"60 mg"' },
  site: { destination: 'in the Body site field, or name it in Procedure details', example: '"left deltoid"' },
  fluidVolume: { destination: TO_DETAILS, example: '"NS 1000 mL"' },
  times: { destination: TO_DETAILS, example: '"Start Time: 14:05, Stop Time: 15:47"' },
  tolerance: {
    destination: `in the Patient response field, or note it in ${DETAILS_FIELD_LABEL}`,
    example: '"tolerated without adverse reaction"',
  },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export const ROUTE_ASK_CLAUSE =
  'the administration route selects the code: IM/SubQ injection → 96372, IV push → 96374, IV hydration infusion → 96360 (with 96361 beyond the first hour), IV infusion of a drug → 96365 (with 96366 beyond the first hour)';

export const SUBSTANCE_ASK_CLAUSE =
  'the infusate selects the infusion family: prepackaged fluid or electrolytes alone is hydration → 96360 (with 96361 beyond the first hour), while a drug or other substance infused for therapy, prophylaxis, or diagnosis → 96365 (with 96366 beyond the first hour)';

export const SUBSTANCE_CONFLICT_CLAUSE =
  'the note documents both an infusion fluid and a drug without saying which one was infused — please reconcile them';

export const TIMES_REQUIREMENT_CLAUSE =
  'the infusion codes are time-based: 96360 requires at least 31 minutes of hydration, an IV drug administration of 15 minutes or less is an IV push (96374) rather than 96365, and the documented duration drives the add-on units beyond the first hour; the Time spent dropdown records a total only and does not satisfy the start/stop requirement';

export const IMMUNIZATION_NOT_ASSESSED_REASON =
  'The note documents an immunization. Immunization administration is reported with 90471/90472 plus the vaccine product code, which these checks do not cover — not assessed.';

export const IMMUNIZATION_ADVISORY =
  'The note also documents an immunization — immunization administration (90471/90472 plus the vaccine product code) is a separately reportable service these checks do not cover. That administration needs its own procedure entry.';

export function immunizationOutOfScope(facts: InjectionInfusionFacts): boolean {
  return (
    facts.vaccineDocumented !== undefined &&
    facts.namedDrugDocumented === undefined &&
    facts.infusionDocumented === undefined
  );
}

export function immunizationFinding(facts: InjectionInfusionFacts, message: string): Finding {
  return {
    level: 'bestPractice',
    scope: ENTRY_SCOPE,
    message,
    evidence: citing(facts.vaccineDocumented),
  };
}

export function otherRouteAdvisories(routes: FactValue<InjectionRoute>[], kind: InfusionKind | undefined): Finding[] {
  return routes.map((route) => ({
    level: 'bestPractice' as const,
    scope: ENTRY_SCOPE,
    message: `The note also documents ${
      ROUTE_DOCUMENTED_LABELS[route.value]
    } — that is a separately reportable administration, coded from its own route (${initialCodeForRoute(
      route.value,
      kind
    )}) rather than folded into this entry. That administration needs its own procedure entry.`,
    evidence: citing(route),
  }));
}

export function implausibleDurationFinding(duration: InfusionDuration, scope: FindingScope): Finding {
  return {
    level: 'contradiction',
    scope,
    message: `The documented start/stop times ${describeDuration(duration)}, which is longer than ${
      MAX_PLAUSIBLE_INFUSION_MINUTES / 60
    } hours — an in-person visit does not plausibly cover an infusion that long, so this reads as a mistyped time rather than a documented duration${
      duration.crossesMidnight
        ? ' (the stop time is earlier than the start time, so it was read as running past midnight)'
        : ''
    }. No additional-hour units are computed from it. ${whereClause('times', 'Re-record them')}`,
    evidence: duration.evidence,
  };
}

export function usableDuration(
  facts: InjectionInfusionFacts,
  findings: Finding[],
  scope: FindingScope = ENTRY_SCOPE
): InfusionDuration | undefined {
  const duration = facts.duration;

  if (duration === undefined) return undefined;

  if (!duration.implausible) return duration;

  findings.push(implausibleDurationFinding(duration, scope));

  return undefined;
}

export function infusateAskMessage(facts: InjectionInfusionFacts, forCode?: string): string {
  const subject = forCode === undefined ? '' : ` for ${forCode}`;
  return facts.infusionSubstanceConflict
    ? `The infusate is ambiguous${subject} — ${SUBSTANCE_CONFLICT_CLAUSE}; ${SUBSTANCE_ASK_CLAUSE}. ${whereClause(
        'substance',
        'Name the substance that was infused'
      )}`
    : `The infused substance is not documented${subject} — ${SUBSTANCE_ASK_CLAUSE}. ${whereClause(
        'substance',
        'Add it'
      )}`;
}
