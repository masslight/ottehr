import {
  firstMatch,
  medicationOrTechniqueOrTextFlag,
  snippetAround,
  textFlag,
  textMention,
  TOLERANCE_PATTERN,
} from '../extract';
import {
  INFUSION_TIMES_FIELD_LABEL,
  MEDICATION_FIELD_LABEL,
  PATIENT_RESPONSE_FIELD_LABEL,
  SITE_FIELD_LABEL,
  TECHNIQUE_FIELD_LABEL,
} from '../family-support';
import { clockSpan, formatClock, parseClockTime } from '../format';
import { FactProvenance, FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';
import type { InfusionKind, InjectionRoute } from './injection-infusion.rules';

const ROUTE_HIERARCHY = ['infusion', 'iv-push', 'im-subq'] satisfies InjectionRoute[];

export const MAX_PLAUSIBLE_INFUSION_MINUTES = 12 * 60;

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

export function describeDuration(duration: InfusionDuration): string {
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
