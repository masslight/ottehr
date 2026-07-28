import {
  firstMatch,
  medicationOrTechniqueOrTextFlag,
  snippetAround,
  textFlag,
  textMention,
  TOLERANCE_PATTERN,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFromInfo,
  defendSelectedCodes,
  DETAILS_FIELD_LABEL,
  INFUSION_TIMES_FIELD_LABEL,
  MEDICATION_FIELD_LABEL,
  PATIENT_RESPONSE_FIELD_LABEL,
  SITE_FIELD_LABEL,
  TECHNIQUE_FIELD_LABEL,
  TO_DETAILS,
  whereClauseFor,
} from '../family-support';
import { clockSpan, formatClock, parseClockTime } from '../format';
import {
  citing,
  CodeAssessmentKind,
  codeScope,
  determinedCode,
  emptyDefenseEvaluation,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FactProvenance,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  FindingScope,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  ProcedureStructuredField,
  setCodeAssessment,
  textEvidence,
  WhereToDocument,
} from '../model.types';

export { formatInfusionTimeRange } from '../format';

export type InjectionRoute = 'im-subq' | 'iv-push' | 'infusion';

export type InfusionKind = 'hydration' | 'therapeutic';

const INJECTION_INFUSION_CODES = {
  imSubq: '96372',
  ivPush: '96374',
  hydrationInitial: '96360',
  hydrationAdditionalHour: '96361',
  therapeuticInitial: '96365',
  therapeuticAdditionalHour: '96366',
} as const;

type InjectionInfusionCode = (typeof INJECTION_INFUSION_CODES)[keyof typeof INJECTION_INFUSION_CODES];

interface InjectionCodeInfo {
  route: InjectionRoute;
  kind?: InfusionKind;
  baseCode?: InjectionInfusionCode;
  display: string;
}

const INJECTION_CODE_INFO: Record<InjectionInfusionCode, InjectionCodeInfo> = {
  [INJECTION_INFUSION_CODES.imSubq]: {
    route: 'im-subq',
    display: 'Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular',
  },
  [INJECTION_INFUSION_CODES.ivPush]: {
    route: 'iv-push',
    display: 'Therapeutic, prophylactic, or diagnostic injection; intravenous push',
  },
  [INJECTION_INFUSION_CODES.hydrationInitial]: {
    route: 'infusion',
    kind: 'hydration',
    display: 'Intravenous infusion, hydration; initial, 31 minutes to 1 hour',
  },
  [INJECTION_INFUSION_CODES.hydrationAdditionalHour]: {
    route: 'infusion',
    kind: 'hydration',
    baseCode: INJECTION_INFUSION_CODES.hydrationInitial,
    display: 'Intravenous infusion, hydration; each additional hour (add-on to 96360)',
  },
  [INJECTION_INFUSION_CODES.therapeuticInitial]: {
    route: 'infusion',
    kind: 'therapeutic',
    display:
      'Intravenous infusion, for therapy, prophylaxis, or diagnosis (specify substance or drug); initial, up to 1 hour',
  },
  [INJECTION_INFUSION_CODES.therapeuticAdditionalHour]: {
    route: 'infusion',
    kind: 'therapeutic',
    baseCode: INJECTION_INFUSION_CODES.therapeuticInitial,
    display: 'Intravenous infusion, for therapy, prophylaxis, or diagnosis; each additional hour (add-on to 96365)',
  },
};

export function isInjectionInfusionCode(code: string): code is InjectionInfusionCode {
  return code in INJECTION_CODE_INFO;
}

const codeCandidate = codeCandidateFromInfo(INJECTION_CODE_INFO);

const INFUSION_INITIAL_CODE = {
  hydration: INJECTION_INFUSION_CODES.hydrationInitial,
  therapeutic: INJECTION_INFUSION_CODES.therapeuticInitial,
} as const satisfies Record<InfusionKind, InjectionInfusionCode>;
const INFUSION_ADD_ON_CODE = {
  hydration: INJECTION_INFUSION_CODES.hydrationAdditionalHour,
  therapeutic: INJECTION_INFUSION_CODES.therapeuticAdditionalHour,
} as const satisfies Record<InfusionKind, InjectionInfusionCode>;

const INFUSION_KIND_LABELS = {
  hydration: 'hydration (prepackaged fluid or electrolytes, with no drug infused)',
  therapeutic: 'an infusion of a drug or other substance for therapy, prophylaxis, or diagnosis',
} satisfies Record<InfusionKind, string>;

const INFUSION_KIND_TITLES = {
  hydration: 'IV hydration infusion',
  therapeutic: 'IV infusion of a drug for therapy, prophylaxis, or diagnosis',
} satisfies Record<InfusionKind, string>;

const ROUTE_CODE_LABELS = {
  'im-subq': 'an IM/SubQ injection code',
  'iv-push': 'an IV push code',
  infusion: 'an IV infusion code',
} satisfies Record<InjectionRoute, string>;

const ROUTE_DOCUMENTED_LABELS = {
  'im-subq': 'an IM/SubQ injection',
  'iv-push': 'an IV push',
  infusion: 'an IV infusion',
} satisfies Record<InjectionRoute, string>;

const ROUTE_HIERARCHY = ['infusion', 'iv-push', 'im-subq'] satisfies InjectionRoute[];

function initialCodeForRoute(route: InjectionRoute, kind: InfusionKind | undefined): string {
  if (route === 'im-subq') return INJECTION_INFUSION_CODES.imSubq;
  if (route === 'iv-push') return INJECTION_INFUSION_CODES.ivPush;
  return kind === undefined ? '96360 for hydration or 96365 for a drug infusion' : INFUSION_INITIAL_CODE[kind];
}

function codeForRoute(route: InjectionRoute, kind: InfusionKind | undefined): string {
  const initial = initialCodeForRoute(route, kind);
  return route === 'infusion' && kind !== undefined
    ? `${initial} (+${INFUSION_ADD_ON_CODE[kind]} beyond the first hour)`
    : initial;
}

export const HYDRATION_MINIMUM_MINUTES = 31;

export const IV_PUSH_MAXIMUM_MINUTES = 15;

export const MAX_PLAUSIBLE_INFUSION_MINUTES = 12 * 60;

const ADDITIONAL_HOUR_MINIMUM_MINUTES = 31;

export const INJECTION_J_CODE_PAYER_NOTE =
  "Billing note: 96372 pairs with the administered drug's J-code on the claim — that pairing happens in the billing layer, not on this page.";

export const INFUSION_HIERARCHY_PAYER_NOTE =
  "Billing note: CPT's infusion hierarchy reports an infusion for therapy, prophylaxis, or diagnosis ahead of hydration when both are documented — which service is initial and which is subsequent is settled in the billing layer, not on this page.";

const TIME_TOKEN_SOURCE = String.raw`(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?`;
const START_TIME_PATTERN = new RegExp(
  String.raw`(?:start(?:ed)?|beg[au]n|initiated)\s*(?:time)?:?\s*(?:at\s+)?${TIME_TOKEN_SOURCE}`,
  'i'
);
const STOP_TIME_PATTERN = new RegExp(
  String.raw`(?:stop(?:ped)?|end(?:ed)?|discontinued|completed|finished)\s*(?:time)?:?\s*(?:at\s+)?${TIME_TOKEN_SOURCE}`,
  'i'
);
const TIME_RANGE_PATTERN = new RegExp(
  String.raw`${TIME_TOKEN_SOURCE}\s*(?:[-–—]|to|until|through)\s*${TIME_TOKEN_SOURCE}`,
  'i'
);

function tokenToMinutes(hours: string, minutes: string, meridiem: string | undefined): number | undefined {
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59) return undefined;
  if (meridiem !== undefined) {
    if (h < 1 || h > 12) return undefined;
    const isPm = meridiem.toLowerCase().startsWith('p');
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
  } else if (h > 23) {
    return undefined;
  }
  return h * 60 + m;
}

export interface InfusionDuration {
  startMinutes: number;
  stopMinutes: number;
  durationMinutes: number;
  crossesMidnight: boolean;
  implausible: boolean;
  evidence: FactProvenance;
}

function durationFrom(startMinutes: number, stopMinutes: number, evidence: FactProvenance): InfusionDuration {
  const { durationMinutes, crossesMidnight } = clockSpan(startMinutes, stopMinutes);
  return {
    startMinutes,
    stopMinutes,
    durationMinutes,
    crossesMidnight,
    implausible: durationMinutes > MAX_PLAUSIBLE_INFUSION_MINUTES,
    evidence,
  };
}

/** Start/stop times: the structured fields first, then start/stop lines or a time range in the text. */
export function extractInfusionDuration(input: ProcedureFactsInput, text: string): InfusionDuration | undefined {
  const structuredStart = parseClockTime(input.infusionStartTime);
  const structuredStop = parseClockTime(input.infusionStopTime);
  if (structuredStart !== undefined && structuredStop !== undefined) {
    return durationFrom(structuredStart, structuredStop, fieldEvidence(INFUSION_TIMES_FIELD_LABEL));
  }

  const startMatch = START_TIME_PATTERN.exec(text);
  const stopMatch = STOP_TIME_PATTERN.exec(text);
  if (startMatch && stopMatch) {
    const start = tokenToMinutes(startMatch[1], startMatch[2], startMatch[3]);
    const stop = tokenToMinutes(stopMatch[1], stopMatch[2], stopMatch[3]);
    if (start !== undefined && stop !== undefined) {
      const first = startMatch.index < stopMatch.index ? startMatch : stopMatch;
      return durationFrom(start, stop, textEvidence(snippetAround(text, first.index, first[0].length)));
    }
  }

  const range = TIME_RANGE_PATTERN.exec(text);
  if (range) {
    const start = tokenToMinutes(range[1], range[2], range[3] ?? range[6]);
    const stop = tokenToMinutes(range[4], range[5], range[6]);
    if (start !== undefined && stop !== undefined) {
      return durationFrom(start, stop, textEvidence(snippetAround(text, range.index, range[0].length)));
    }
  }
  return undefined;
}

export function additionalHourUnits(durationMinutes: number): number {
  const beyondFirstHour = durationMinutes - 60;
  if (beyondFirstHour < ADDITIONAL_HOUR_MINIMUM_MINUTES) return 0;
  return Math.floor(beyondFirstHour / 60) + (beyondFirstHour % 60 >= ADDITIONAL_HOUR_MINIMUM_MINUTES ? 1 : 0);
}

function describeDuration(duration: InfusionDuration): string {
  return `${formatClock(duration.startMinutes)}–${formatClock(duration.stopMinutes)}${
    duration.crossesMidnight ? ' (crossing midnight)' : ''
  } total ${duration.durationMinutes} minutes`;
}

export interface InjectionInfusionFacts {
  imSubqDocumented?: FactValue<true>;
  ivPushDocumented?: FactValue<true>;
  infusionDocumented?: FactValue<true>;
  documentedRoutes: FactValue<InjectionRoute>[];
  route?: FactValue<InjectionRoute>;
  infusionKind?: FactValue<InfusionKind>;
  infusionSubstanceConflict: boolean;
  vaccineDocumented?: FactValue<true>;
  drugDocumented?: FactValue<true>;
  namedDrugDocumented?: FactValue<true>;
  doseDocumented?: FactValue<true>;
  siteDocumented?: FactValue<true>;
  fluidDocumented?: FactValue<true>;
  volumeDocumented?: FactValue<true>;
  duration?: InfusionDuration;
  toleranceDocumented?: FactValue<true>;
}

const IM_SUBQ_PATTERN =
  /\bIM\b|intramuscular\w*|\bsub-?q\b|\bSQ\b|subcutaneous\w*|\bdeltoid\b|ventro-?gluteal|\bgluteal\b|vastus\s+lateralis/i;

const IV_PUSH_PATTERN =
  /\bIV\s*push|\bIVP\b|intravenous\s+push|slow\s+(?:IV\s+)?push|push(?:ed)?\s+(?:slowly\s+)?(?:IV|intravenously)/i;

const INFUSION_PATTERN = /\binfus\w*|\bhydration\b|\bIV\s+fluids?\b|\bdrip\b/i;

const HYDRATION_WORDING_PATTERN = /\bhydration\b|\bIV\s+fluids?\b|fluid\s+bolus|bolus\s+of\s+fluids?/i;

const FLUID_PATTERN =
  /\bNSS?\b|normal\s+saline|\bLR\b|lactated\s+ringer'?s?\b|\bD5(?:\s*(?:½|1\/2)\s*)?(?:W|NS|LR)?\b|\bD10W?\b|0\.9\s*%\s*(?:NaCl|saline|sodium\s+chloride)|sodium\s+chloride|dextrose/i;

const VOLUME_PATTERN = /\d+(?:\.\d+)?\s*(?:mL|cc)\b|\b\d+(?:\.\d+)?\s*(?:L|liters?)\b/i;

const VOLUME_FIGURE_PATTERN = /(\d+(?:\.\d+)?)\s*(mL|cc|L|liters?)\b/i;
const DOSE_PATTERN = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|units?|mEq)\b/i;

const DRUG_NAME_PATTERN =
  /toradol|ketorolac|rocephin|ceftriaxone|decadron|dexamethasone|zofran|ondansetron|phenergan|promethazine|benadryl|diphenhydramine|solu-?medrol|methylprednisolone|kenalog|triamcinolone|epinephrine|glucagon|bicillin|penicillin|vitamin\s+B-?12/i;
const ADMIN_SITE_TEXT_PATTERN =
  /\bdeltoid\b|ventro-?gluteal|\bgluteal\b|vastus\s+lateralis|\bthigh\b|antecubital|\bAC\s+fossa\b|\bforearm\b|upper\s+arm|\babdomen\b/i;

const FLUSH_PATTERN =
  /flush\w*|saline\s+lock|\bs\/l\b|hep(?:arin)?[-\s]?lock|\bKVO\b|\bTKO\b|keep(?:ing)?\s+(?:the\s+)?(?:vein|line)\s+open|line\s+patency/i;

const GENERIC_SUBSTANCE_PATTERN =
  /\bantibiotics?\b|\bABX\b|\bmedications?\b|\bmeds?\b|\bdrugs?\b|\bsteroids?\b|\banti-?emetics?\b|\banalgesics?\b/i;

const ELECTROLYTE_ADDITIVE_PATTERN = /\bKCl\b|potassium(?:\s+chloride)?|\bdextrose\b|sodium\s+bicarbonate|\bbicarb\b/i;

const VACCINE_PATTERN =
  /\bvaccin\w*|\bimmuniz\w*|\btoxoid\b|\bTdap\b|\bDTaP\b|\btetanus\b|\bMMR\b|\bHPV\b|gardasil|flu\s+shot|influenza\s+(?:shot|vaccin\w*)|pneumococc\w*|prevnar|pneumovax|meningococc\w*|menactra|varicella|shingrix|boostrix|adacel|hepatitis\s+[ab]\s+(?:vaccin\w*|series)|rabies\s+(?:vaccin\w*|series)/i;

const MINIMUM_INFUSION_VOLUME_ML = 50;

const CLAUSE_BOUNDARY_PATTERN = /(?<!\d)\.(?!\d)|[;\n]|,?\s+then\s+|,?\s+followed\s+by\s+/i;

interface AdministrationClause {
  text: string;
  provenance: FactProvenance;
  imSubq: boolean;
  ivPush: boolean;
  infusion: boolean;
  hydrationFluid: boolean;
  namedDrug: boolean;
  unnamedSubstance: boolean;
}

function clauseMentions(clause: string, pattern: RegExp): boolean {
  return firstMatch(clause, pattern) !== undefined;
}

function largestVolumeMl(clause: string): number {
  const regex = new RegExp(VOLUME_FIGURE_PATTERN.source, 'gi');
  let largest = 0;
  let result: RegExpExecArray | null;
  while ((result = regex.exec(clause)) !== null) {
    const value = parseFloat(result[1]);
    if (!Number.isFinite(value)) continue;
    const milliliters = /^l/i.test(result[2]) ? value * 1000 : value;
    if (milliliters > largest) largest = milliliters;
  }
  return largest;
}

function analyzeClause(text: string, provenance: FactProvenance): AdministrationClause {
  const ivPush = clauseMentions(text, IV_PUSH_PATTERN);
  const flush = FLUSH_PATTERN.test(text);
  const fluid = clauseMentions(text, FLUID_PATTERN);
  const hungBag = fluid && !flush && largestVolumeMl(text) >= MINIMUM_INFUSION_VOLUME_ML;
  const namedDrug = clauseMentions(text, DRUG_NAME_PATTERN);
  return {
    text,
    provenance,
    imSubq: clauseMentions(text, IM_SUBQ_PATTERN),
    ivPush,
    infusion: (clauseMentions(text, INFUSION_PATTERN) && !flush) || (hungBag && !ivPush),
    hydrationFluid: fluid || HYDRATION_WORDING_PATTERN.test(text),
    namedDrug,
    unnamedSubstance:
      !namedDrug &&
      (GENERIC_SUBSTANCE_PATTERN.test(text) || (DOSE_PATTERN.test(text) && !ELECTROLYTE_ADDITIVE_PATTERN.test(text))),
  };
}

function administrationClauses(input: ProcedureFactsInput): AdministrationClause[] {
  const structured = [
    { field: MEDICATION_FIELD_LABEL, values: [input.medicationUsed ?? ''] },
    { field: TECHNIQUE_FIELD_LABEL, values: input.technique ?? [] },
  ].flatMap(({ field, values }) =>
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => analyzeClause(value, fieldEvidence(field)))
  );
  const fromText = (input.procedureDetails ?? '')
    .split(CLAUSE_BOUNDARY_PATTERN)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0)
    .map((clause) => analyzeClause(clause, textEvidence(clause)));
  return [...structured, ...fromText];
}

function clauseFlag(clause: AdministrationClause | undefined): FactValue<true> | undefined {
  return clause === undefined ? undefined : { value: true, evidence: clause.provenance };
}

function clauseKindFact(clause: AdministrationClause, kind: InfusionKind): FactValue<InfusionKind> {
  return { value: kind, evidence: clause.provenance };
}

interface InfusateResolution {
  kind?: FactValue<InfusionKind>;
  /** True when the note documents an infusion but leaves the infusate genuinely open. */
  conflict: boolean;
}

function resolveInfusate(clauses: AdministrationClause[]): InfusateResolution {
  const infusionClauses = clauses.filter((clause) => clause.infusion);
  if (infusionClauses.length === 0) return { conflict: false };

  const drugInfused = infusionClauses.find((clause) => clause.namedDrug);
  if (drugInfused) return { kind: clauseKindFact(drugInfused, 'therapeutic'), conflict: false };

  if (infusionClauses.some((clause) => clause.unnamedSubstance)) return { conflict: true };

  const fluidInfused = infusionClauses.find((clause) => clause.hydrationFluid);
  if (fluidInfused === undefined) return { conflict: false };

  const unboundDrug = clauses.some(
    (clause) => clause.namedDrug && !clause.infusion && !clause.imSubq && !clause.ivPush
  );
  return unboundDrug ? { conflict: true } : { kind: clauseKindFact(fluidInfused, 'hydration'), conflict: false };
}

/** Deterministic injection/infusion fact extraction: structured fields first, then details-text patterns. */
export function extractInjectionInfusionFacts(input: ProcedureFactsInput): InjectionInfusionFacts {
  const text = input.procedureDetails ?? '';
  const structuredHaystack = [input.medicationUsed ?? '', ...(input.technique ?? [])].join(' ');
  const clauses = administrationClauses(input);

  const imSubqDocumented = medicationOrTechniqueOrTextFlag(input, text, IM_SUBQ_PATTERN);
  const ivPushDocumented = medicationOrTechniqueOrTextFlag(input, text, IV_PUSH_PATTERN);
  const infusionDocumented = clauseFlag(clauses.find((clause) => clause.infusion));

  const routeEvidence = {
    infusion: infusionDocumented,
    'iv-push': ivPushDocumented,
    'im-subq': imSubqDocumented,
  } satisfies Record<InjectionRoute, FactValue<true> | undefined>;
  const documentedRoutes: FactValue<InjectionRoute>[] = ROUTE_HIERARCHY.flatMap((route) => {
    const evidence = routeEvidence[route];
    return evidence === undefined ? [] : [{ ...evidence, value: route }];
  });

  const infusate = resolveInfusate(clauses);
  const drugStructured = Boolean(input.medicationUsed?.trim());
  const siteStructured = Boolean(input.bodySite?.trim() || input.otherBodySite?.trim());
  const toleranceStructured = Boolean(input.patientResponse?.trim());

  return {
    imSubqDocumented,
    ivPushDocumented,
    infusionDocumented,
    documentedRoutes,
    route: documentedRoutes[0],
    infusionKind: infusate.kind,
    infusionSubstanceConflict: infusate.conflict,
    vaccineDocumented: medicationOrTechniqueOrTextFlag(input, text, VACCINE_PATTERN),
    drugDocumented: drugStructured
      ? { value: true, evidence: fieldEvidence(MEDICATION_FIELD_LABEL) }
      : textFlag(text, DRUG_NAME_PATTERN),
    namedDrugDocumented: medicationOrTechniqueOrTextFlag(input, text, DRUG_NAME_PATTERN),
    doseDocumented: DOSE_PATTERN.test(structuredHaystack)
      ? { value: true, evidence: fieldEvidence(MEDICATION_FIELD_LABEL) }
      : textFlag(text, DOSE_PATTERN),
    siteDocumented: siteStructured
      ? { value: true, evidence: fieldEvidence(SITE_FIELD_LABEL) }
      : textFlag(text, ADMIN_SITE_TEXT_PATTERN),
    fluidDocumented: medicationOrTechniqueOrTextFlag(input, text, FLUID_PATTERN),
    volumeDocumented: medicationOrTechniqueOrTextFlag(input, text, VOLUME_PATTERN),
    duration: extractInfusionDuration(input, text),
    toleranceDocumented: toleranceStructured
      ? { value: true, evidence: fieldEvidence(PATIENT_RESPONSE_FIELD_LABEL) }
      : textMention(text, TOLERANCE_PATTERN),
  };
}

const WHERE_TO_DOCUMENT = {
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

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

const ROUTE_ASK_CLAUSE =
  'the administration route selects the code: IM/SubQ injection → 96372, IV push → 96374, IV hydration infusion → 96360 (with 96361 beyond the first hour), IV infusion of a drug → 96365 (with 96366 beyond the first hour)';

const SUBSTANCE_ASK_CLAUSE =
  'the infusate selects the infusion family: prepackaged fluid or electrolytes alone is hydration → 96360 (with 96361 beyond the first hour), while a drug or other substance infused for therapy, prophylaxis, or diagnosis → 96365 (with 96366 beyond the first hour)';

const SUBSTANCE_CONFLICT_CLAUSE =
  'the note documents both an infusion fluid and a drug without saying which one was infused — please reconcile them';

const TIMES_REQUIREMENT_CLAUSE =
  'the infusion codes are time-based: 96360 requires at least 31 minutes of hydration, an IV drug administration of 15 minutes or less is an IV push (96374) rather than 96365, and the documented duration drives the add-on units beyond the first hour; the Time spent dropdown records a total only and does not satisfy the start/stop requirement';

const ROUTE_OPEN_CANDIDATE_CODES = [
  INJECTION_INFUSION_CODES.imSubq,
  INJECTION_INFUSION_CODES.ivPush,
  INJECTION_INFUSION_CODES.hydrationInitial,
  INJECTION_INFUSION_CODES.therapeuticInitial,
] as const;
const ROUTE_OPEN_SUMMARY =
  '96372 / 96374 / 96360 / 96365 — the administration route, and for an infusion the infusate, determine the code';
const INFUSION_KIND_OPEN_SUMMARY =
  '96360–96361 (hydration) vs 96365–96366 (drug infusion) — the documented infusate determines which family applies';
const PUSH_VS_INFUSION_OPEN_SUMMARY =
  '96374 vs 96360 / 96365 — whether the administration was a push or an infusion determines the code';

function infusionTimesOpenSummary(kind: InfusionKind): string {
  return `${INFUSION_INITIAL_CODE[kind]}–${INFUSION_ADD_ON_CODE[kind]} — the documented infusion duration determines the initial code and its additional-hour units`;
}

const IMMUNIZATION_NOT_ASSESSED_REASON =
  'The note documents an immunization. Immunization administration is reported with 90471/90472 plus the vaccine product code, which these checks do not cover — not assessed.';

const IMMUNIZATION_ADVISORY =
  'The note also documents an immunization — immunization administration (90471/90472 plus the vaccine product code) is a separately reportable service these checks do not cover. That administration needs its own procedure entry.';

function immunizationOutOfScope(facts: InjectionInfusionFacts): boolean {
  return (
    facts.vaccineDocumented !== undefined &&
    facts.namedDrugDocumented === undefined &&
    facts.infusionDocumented === undefined
  );
}

function immunizationFinding(facts: InjectionInfusionFacts, message: string): Finding {
  return {
    level: 'bestPractice',
    scope: ENTRY_SCOPE,
    message,
    evidence: citing(facts.vaccineDocumented),
  };
}

function otherRouteAdvisories(routes: FactValue<InjectionRoute>[], kind: InfusionKind | undefined): Finding[] {
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

function implausibleDurationFinding(duration: InfusionDuration, scope: FindingScope): Finding {
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

function usableDuration(
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

function infusateAskMessage(facts: InjectionInfusionFacts, forCode?: string): string {
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

function documentedInfusionCode(facts: InjectionInfusionFacts): string {
  return codeForRoute('infusion', facts.infusionKind?.value);
}

function suggestInjectionInfusionCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractInjectionInfusionFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const payerNotes: string[] = [];

  if (immunizationOutOfScope(facts)) {
    findings.push(immunizationFinding(facts, IMMUNIZATION_NOT_ASSESSED_REASON));
    evaluation.outcome = notAssessedCode(IMMUNIZATION_NOT_ASSESSED_REASON);
    return evaluation;
  }
  if (facts.vaccineDocumented) {
    findings.push(immunizationFinding(facts, IMMUNIZATION_ADVISORY));
  }

  const route = facts.route;
  if (route === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The administration route is not documented — ${ROUTE_ASK_CLAUSE}. ${whereClause('route', 'Add it')}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(ROUTE_OPEN_CANDIDATE_CODES.map(codeCandidate), ROUTE_OPEN_SUMMARY);
    return evaluation;
  }

  findings.push(
    ...otherRouteAdvisories(
      facts.documentedRoutes.filter((documented) => documented.value !== route.value),
      facts.infusionKind?.value
    )
  );
  if (facts.infusionSubstanceConflict || (facts.infusionKind?.value === 'therapeutic' && facts.fluidDocumented)) {
    payerNotes.push(INFUSION_HIERARCHY_PAYER_NOTE);
  }
  const finish = (): FamilyEvaluation => {
    if (payerNotes.length > 0) evaluation.payerNotes = payerNotes;
    return evaluation;
  };

  if (route.value === 'im-subq') {
    evaluation.outcome = determinedCode({
      code: INJECTION_INFUSION_CODES.imSubq,
      display: codeCandidate(INJECTION_INFUSION_CODES.imSubq).display,
      justification: 'IM/SubQ administration documented → 96372.',
    });
    payerNotes.push(INJECTION_J_CODE_PAYER_NOTE);
    return finish();
  }

  if (route.value === 'iv-push') {
    const pushDuration = usableDuration(facts, findings);
    if (pushDuration !== undefined && pushDuration.durationMinutes > IV_PUSH_MAXIMUM_MINUTES) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `The note documents an IV push, but the documented start/stop times ${describeDuration(
          pushDuration
        )} — an IV administration running longer than ${IV_PUSH_MAXIMUM_MINUTES} minutes is an infusion, not a push. ${whereClause(
          'times',
          'Reconcile the push wording with the times and re-record them'
        )}`,
        evidence: citing(pushDuration),
      });
      evaluation.outcome = openCodeSet(
        [
          codeCandidate(INJECTION_INFUSION_CODES.ivPush),
          codeCandidate(INJECTION_INFUSION_CODES.hydrationInitial),
          codeCandidate(INJECTION_INFUSION_CODES.therapeuticInitial),
        ],
        PUSH_VS_INFUSION_OPEN_SUMMARY
      );
      return finish();
    }
    evaluation.outcome = determinedCode({
      code: INJECTION_INFUSION_CODES.ivPush,
      display: codeCandidate(INJECTION_INFUSION_CODES.ivPush).display,
      justification: 'IV push administration documented → 96374.',
    });
    return finish();
  }

  const kind = facts.infusionKind?.value;

  if (kind === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: infusateAskMessage(facts),
      evidence: citing(facts.infusionDocumented),
    });
    evaluation.outcome = openCodeSet(
      [
        INJECTION_INFUSION_CODES.hydrationInitial,
        INJECTION_INFUSION_CODES.hydrationAdditionalHour,
        INJECTION_INFUSION_CODES.therapeuticInitial,
        INJECTION_INFUSION_CODES.therapeuticAdditionalHour,
      ].map(codeCandidate),
      INFUSION_KIND_OPEN_SUMMARY
    );
    return finish();
  }

  const initialCode = INFUSION_INITIAL_CODE[kind];
  const addOnCode = INFUSION_ADD_ON_CODE[kind];
  const duration = usableDuration(facts, findings);
  if (duration === undefined) {
    const documentedButUnusable = facts.duration !== undefined;
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `${
        documentedButUnusable
          ? 'The documented start and stop times cannot be used as recorded'
          : 'Start and stop times are not documented'
      } — ${TIMES_REQUIREMENT_CLAUSE}. ${whereClause('times', documentedButUnusable ? 'Re-record them' : 'Add them')}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      [codeCandidate(initialCode), codeCandidate(addOnCode)],
      infusionTimesOpenSummary(kind)
    );
    return finish();
  }

  if (kind === 'hydration' && duration.durationMinutes < HYDRATION_MINIMUM_MINUTES) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: `The documented start/stop times ${describeDuration(
        duration
      )} — 96360 requires at least ${HYDRATION_MINIMUM_MINUTES} minutes of hydration.`,
      evidence: citing(duration),
    });
    return finish();
  }

  if (kind === 'therapeutic' && duration.durationMinutes <= IV_PUSH_MAXIMUM_MINUTES) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: `The documented start/stop times ${describeDuration(
        duration
      )} — an IV administration of a drug running ${IV_PUSH_MAXIMUM_MINUTES} minutes or less is an IV push, reported with 96374 rather than 96365.`,
      evidence: citing(duration),
    });
    return finish();
  }

  const withinFirstHour =
    duration.durationMinutes > 60 ? ', and 30 minutes or less into the next hour' : ', within the first hour';

  const initialFloor =
    kind === 'hydration'
      ? `at least ${HYDRATION_MINIMUM_MINUTES} minutes`
      : `more than ${IV_PUSH_MAXIMUM_MINUTES} minutes, so an infusion rather than a push`;

  const units = additionalHourUnits(duration.durationMinutes);

  if (units === 0) {
    evaluation.outcome = determinedCode({
      code: initialCode,
      display: codeCandidate(initialCode).display,
      justification: `${INFUSION_KIND_TITLES[kind]} — documented start/stop times ${describeDuration(
        duration
      )} (${initialFloor}${withinFirstHour}) → ${initialCode}.`,
    });
    return finish();
  }

  const beyondFirstHour = duration.durationMinutes - 60;
  evaluation.outcome = determinedCode({
    code: initialCode,
    display: `${initialCode} — ${INFUSION_KIND_TITLES[kind]}, ${duration.durationMinutes} minutes total (with add-on ${addOnCode} × ${units} for the time beyond the first hour)`,
    justification: `${INFUSION_KIND_TITLES[kind]} — documented start/stop times ${describeDuration(
      duration
    )} → ${initialCode} for the first hour + ${addOnCode} × ${units} (${beyondFirstHour} minutes beyond the first hour; each additional hour bills a unit, and a final partial hour counts once more than 30 minutes into it).`,
    addOns: [
      {
        code: addOnCode,
        units,
        display: codeCandidate(addOnCode).display,
        justification: `${beyondFirstHour} minutes beyond the first hour → ${addOnCode} × ${units}.`,
      },
    ],
  });
  return finish();
}

function routeContradiction(code: string, info: InjectionCodeInfo, facts: InjectionInfusionFacts): Finding | undefined {
  const documented = facts.documentedRoutes;
  if (documented.length === 0 || documented.some((route) => route.value === info.route)) return undefined;
  return {
    level: 'contradiction',
    scope: codeScope(code),
    message: `${code} is ${ROUTE_CODE_LABELS[info.route]}, but the note documents ${documented
      .map((route) => ROUTE_DOCUMENTED_LABELS[route.value])
      .join(' and ')} — as documented that is reported with ${documented
      .map((route) => codeForRoute(route.value, facts.infusionKind?.value))
      .join(' and ')}.`,
    evidence: citing(documented[0]),
  };
}

function infusionKindFinding(
  code: string,
  info: InjectionCodeInfo,
  facts: InjectionInfusionFacts
): Finding | undefined {
  if (info.kind === undefined) return undefined;
  const documented = facts.infusionKind;
  if (documented === undefined) {
    return {
      level: 'determines',
      scope: codeScope(code),
      message: infusateAskMessage(facts, code),
      evidence: NOTHING_TO_CITE,
    };
  }

  if (documented.value === info.kind) return undefined;

  return {
    level: 'contradiction',
    scope: codeScope(code),
    message: `${code} reports ${INFUSION_KIND_LABELS[info.kind]}, but the note documents ${
      INFUSION_KIND_LABELS[documented.value]
    } — as documented that is reported with ${codeForRoute('infusion', documented.value)}.`,
    evidence: citing(documented),
  };
}

function injectionElementFindings(code: string, facts: InjectionInfusionFacts): Finding[] {
  const findings: Finding[] = [];
  if (!facts.drugDocumented) {
    findings.push({
      level: 'required',
      scope: codeScope(code),
      message: `The medication administered is not documented for ${code}. ${whereClause('drug', 'Record it')}`,
      evidence: NOTHING_TO_CITE,
    });
  }
  if (!facts.doseDocumented) {
    findings.push({
      level: 'required',
      scope: codeScope(code),
      message: `The dose is not documented for ${code}. ${whereClause('dose', 'Record it')}`,
      evidence: NOTHING_TO_CITE,
    });
  }
  if (!facts.siteDocumented) {
    findings.push({
      level: 'required',
      scope: codeScope(code),
      message: `The administration site is not documented for ${code}. ${whereClause('site', 'Record it')}`,
      evidence: NOTHING_TO_CITE,
    });
  }
  return findings;
}

function infusateElementFinding(code: string, kind: InfusionKind, facts: InjectionInfusionFacts): Finding | undefined {
  const missing: string[] = [];
  if (kind === 'hydration') {
    if (!facts.fluidDocumented) missing.push('fluid type');
    if (!facts.volumeDocumented) missing.push('volume');
  } else {
    if (!facts.drugDocumented) missing.push('the infused drug or substance');
    if (!facts.doseDocumented) missing.push('dose');
  }
  if (missing.length === 0) return undefined;
  const verb = missing.length > 1 ? 'Add these' : 'Add it';
  return {
    level: 'required',
    scope: codeScope(code),
    message:
      kind === 'hydration'
        ? `Fluid documentation for ${code} is incomplete — not documented: ${missing.join(', ')}. ${whereClause(
            'fluidVolume',
            verb
          )}`
        : `Substance documentation for ${code} is incomplete — not documented: ${missing.join(', ')}. ${whereClause(
            'substance',
            verb
          )}`,
    evidence: NOTHING_TO_CITE,
  };
}

function infusionTimeFindings(
  code: string,
  info: InjectionCodeInfo,
  facts: InjectionInfusionFacts,
  duration: InfusionDuration | undefined
): Finding[] {
  const findings: Finding[] = [];
  if (duration === undefined) {
    // An implausible span was already reported as a [C] by usableDuration.
    if (facts.duration === undefined) {
      findings.push({
        level: 'required',
        scope: codeScope(code),
        message: `Start and stop times are not documented for ${code} — ${TIMES_REQUIREMENT_CLAUSE}. ${whereClause(
          'times',
          'Add them'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    return findings;
  }

  if (
    info.baseCode === undefined &&
    info.kind === 'hydration' &&
    duration.durationMinutes < HYDRATION_MINIMUM_MINUTES
  ) {
    findings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `The documented start/stop times ${describeDuration(
        duration
      )} — 96360 requires at least ${HYDRATION_MINIMUM_MINUTES} minutes of hydration.`,
      evidence: citing(duration),
    });
  } else if (
    info.baseCode === undefined &&
    info.kind === 'therapeutic' &&
    duration.durationMinutes <= IV_PUSH_MAXIMUM_MINUTES
  ) {
    findings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `The documented start/stop times ${describeDuration(
        duration
      )} — an IV administration of a drug running ${IV_PUSH_MAXIMUM_MINUTES} minutes or less is an IV push, reported with 96374 rather than 96365.`,
      evidence: citing(duration),
    });
  } else if (info.baseCode !== undefined && additionalHourUnits(duration.durationMinutes) === 0) {
    const beyondFirstHour = Math.max(0, duration.durationMinutes - 60);
    findings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `${code} bills each additional hour beyond ${
        info.baseCode
      }'s first hour and needs more than 30 minutes into that hour — the documented start/stop times ${describeDuration(
        duration
      )} (${beyondFirstHour} minutes beyond the first hour) support no ${code} units.`,
      evidence: citing(duration),
    });
  }
  return findings;
}

function defendInjectionInfusionCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractInjectionInfusionFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  if (immunizationOutOfScope(facts)) {
    selected.forEach((selectedCode) =>
      setCodeAssessment(evaluation, selectedCode.code, CodeAssessmentKind.NotAssessed)
    );
    evaluation.outcome = notAssessedCode(IMMUNIZATION_NOT_ASSESSED_REASON);
    findings.push(immunizationFinding(facts, IMMUNIZATION_NOT_ASSESSED_REASON));
    return evaluation;
  }

  const inScopeSelected = selected.filter(
    (candidate): candidate is typeof candidate & { code: InjectionInfusionCode } =>
      isInjectionInfusionCode(candidate.code)
  );
  const payerNotes: string[] = [];

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isInjectionInfusionCode(code) ? INJECTION_CODE_INFO[code] : undefined),
    (info, code, codeFindings) => {
      const contradiction = routeContradiction(code, info, facts);
      if (contradiction) {
        codeFindings.push(contradiction);
      } else if (facts.documentedRoutes.length === 0) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The administration route is not documented for ${code} — ${ROUTE_ASK_CLAUSE}. ${whereClause(
            'route',
            'Add it'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (info.route === 'im-subq' || info.route === 'iv-push') {
        codeFindings.push(...injectionElementFindings(code, facts));
        if (info.route === 'iv-push') {
          const duration = usableDuration(facts, codeFindings, codeScope(code));
          if (duration !== undefined && duration.durationMinutes > IV_PUSH_MAXIMUM_MINUTES) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} is an IV push — an administration of ${IV_PUSH_MAXIMUM_MINUTES} minutes or less — but the documented start/stop times ${describeDuration(
                duration
              )}. As documented that is an infusion, reported with ${documentedInfusionCode(facts)}.`,
              evidence: citing(duration),
            });
          }
        }
      } else {
        const kindFinding =
          contradiction === undefined && facts.infusionDocumented ? infusionKindFinding(code, info, facts) : undefined;
        if (kindFinding) codeFindings.push(kindFinding);

        const elementFinding = infusateElementFinding(code, info.kind ?? 'hydration', facts);
        if (elementFinding) codeFindings.push(elementFinding);

        codeFindings.push(
          ...infusionTimeFindings(code, info, facts, usableDuration(facts, codeFindings, codeScope(code)))
        );

        if (info.baseCode !== undefined && !selected.some((c) => c.code === info.baseCode)) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} is an add-on code for each additional hour of ${
              info.kind === 'hydration' ? 'hydration' : 'drug infusion'
            } — it is billed alongside ${info.baseCode} (${INJECTION_CODE_INFO[info.baseCode].display}), but ${
              info.baseCode
            } is not selected.`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }
    }
  );

  if (inScopeSelected.length > 0) {
    if (facts.documentedRoutes.length > 1) {
      const coveredRoutes = new Set(inScopeSelected.map((c) => INJECTION_CODE_INFO[c.code].route));
      findings.push(
        ...otherRouteAdvisories(
          facts.documentedRoutes.filter((route) => !coveredRoutes.has(route.value)),
          facts.infusionKind?.value
        )
      );
    }
    if (facts.vaccineDocumented) {
      findings.push(immunizationFinding(facts, IMMUNIZATION_ADVISORY));
    }
    if (!facts.toleranceDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Patient tolerance is not documented — it does not affect the code, but a complete note records the response. ${whereClause(
          'tolerance',
          'Record it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (inScopeSelected.some((c) => c.code === INJECTION_INFUSION_CODES.imSubq)) {
      payerNotes.push(INJECTION_J_CODE_PAYER_NOTE);
    }
    if (facts.infusionSubstanceConflict || (facts.infusionKind?.value === 'therapeutic' && facts.fluidDocumented)) {
      payerNotes.push(INFUSION_HIERARCHY_PAYER_NOTE);
    }
  }
  if (payerNotes.length > 0) evaluation.payerNotes = payerNotes;

  return evaluation;
}

export const injectionInfusionFamily: ProcedureFamilyModel = {
  id: 'injection-infusion',
  displayName: 'Therapeutic Injections & IV Infusions',
  structuredFieldsFor: (input) => {
    const procedureType = input.procedureType?.trim() ?? '';

    if (procedureType.length > 0) {
      return /iv[\s-]*(?:fluid|hydration)|\binfusion\b/i.test(procedureType)
        ? [ProcedureStructuredField.InfusionTimes]
        : [];
    }
    return (input.cptCodes ?? []).some(
      (candidate) => isInjectionInfusionCode(candidate.code) && INJECTION_CODE_INFO[candidate.code].route === 'infusion'
    )
      ? [ProcedureStructuredField.InfusionTimes]
      : [];
  },
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('injection-infusion', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isInjectionInfusionCode(c.code))
  ),
  suggestCode: suggestInjectionInfusionCode,
  defendCodes: defendInjectionInfusionCodes,
};
