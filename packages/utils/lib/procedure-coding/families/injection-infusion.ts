// Therapeutic injections & IV hydration coding model — functional requirements §6.6.
// The administration route is the determinant: IM/SubQ ⇒ 96372, IV push ⇒ 96374, IV
// hydration infusion ⇒ 96365 (initial, 31 minutes to 1 hour) with 96366 add-on units for
// documented time beyond the first hour. Start/stop times are required for the hydration
// codes — the Time spent dropdown records a total only and does not satisfy them. Other
// administration codes (e.g. 96360/96361, 96367) are outside scope and are reported
// "not assessed", never guessed. J-code pairing is a billing-layer footnote, never checked.

import { snippetAround, textFlag, textMention } from '../extract';
import {
  CodeCandidate,
  emptyFamilyEvaluation,
  FactConfidence,
  FactValue,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

// ── Routes and code table ──────────────────────────────────────────────────────

export type InjectionRoute = 'im-subq' | 'iv-push' | 'infusion';

interface InjectionCodeInfo {
  route: InjectionRoute;
  /** True for 96366 — billed only alongside 96365. */
  addOn?: boolean;
  display: string;
}

const INJECTION_CODE_INFO: Record<string, InjectionCodeInfo> = {
  '96372': {
    route: 'im-subq',
    display: 'Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular',
  },
  '96374': {
    route: 'iv-push',
    display: 'Therapeutic, prophylactic, or diagnostic injection; intravenous push',
  },
  '96365': { route: 'infusion', display: 'IV hydration infusion; initial, 31 minutes to 1 hour' },
  '96366': { route: 'infusion', addOn: true, display: 'IV hydration infusion; each additional hour (add-on to 96365)' },
};

export function isInjectionInfusionCode(code: string): boolean {
  return INJECTION_CODE_INFO[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${INJECTION_CODE_INFO[code].display}` };
}

/** The 96365 minimum: an initial hydration infusion must run at least this many minutes. */
export const INFUSION_MINIMUM_MINUTES = 31;

export const INJECTION_J_CODE_PAYER_NOTE =
  "Billing note: 96372 pairs with the administered drug's J-code on the claim — that pairing happens in the billing layer, not on this page.";

// ── Time parsing ───────────────────────────────────────────────────────────────

// "14:05", "2:05 pm", "2:05pm" — meridiem optional (24-hour assumed without one).
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

/** Parses a structured HH:MM 24-hour string to minutes since midnight. */
function parseClockTime(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(raw);
  if (!match) return undefined;
  return tokenToMinutes(match[1], match[2], undefined);
}

export interface InfusionDuration {
  startMinutes: number;
  stopMinutes: number;
  /** Documented duration in minutes; a stop time earlier than the start means it crossed midnight (+24 h). */
  durationMinutes: number;
  crossesMidnight: boolean;
  confidence: FactConfidence;
  sourceText?: string;
}

function durationFrom(
  startMinutes: number,
  stopMinutes: number,
  confidence: FactConfidence,
  sourceText?: string
): InfusionDuration {
  const crossesMidnight = stopMinutes < startMinutes;
  return {
    startMinutes,
    stopMinutes,
    durationMinutes: stopMinutes - startMinutes + (crossesMidnight ? 24 * 60 : 0),
    crossesMidnight,
    confidence,
    sourceText,
  };
}

/** Start/stop times: the structured fields first, then start/stop lines or a time range in the text. */
export function extractInfusionDuration(input: ProcedureFactsInput, text: string): InfusionDuration | undefined {
  const structuredStart = parseClockTime(input.infusionStartTime);
  const structuredStop = parseClockTime(input.infusionStopTime);
  if (structuredStart !== undefined && structuredStop !== undefined) {
    return durationFrom(structuredStart, structuredStop, 'structured');
  }

  const startMatch = START_TIME_PATTERN.exec(text);
  const stopMatch = STOP_TIME_PATTERN.exec(text);
  if (startMatch && stopMatch) {
    const start = tokenToMinutes(startMatch[1], startMatch[2], startMatch[3]);
    const stop = tokenToMinutes(stopMatch[1], stopMatch[2], stopMatch[3]);
    if (start !== undefined && stop !== undefined) {
      const first = startMatch.index < stopMatch.index ? startMatch : stopMatch;
      return durationFrom(start, stop, 'text', snippetAround(text, first.index, first[0].length));
    }
  }

  const range = TIME_RANGE_PATTERN.exec(text);
  if (range) {
    // "2:05–2:47 pm": a meridiem on only the second time applies to both.
    const start = tokenToMinutes(range[1], range[2], range[3] ?? range[6]);
    const stop = tokenToMinutes(range[4], range[5], range[6]);
    if (start !== undefined && stop !== undefined) {
      return durationFrom(start, stop, 'text', snippetAround(text, range.index, range[0].length));
    }
  }
  return undefined;
}

/**
 * One-line display of the structured infusion times for note surfaces (review tab, PDFs,
 * admin pages), e.g. "14:05–14:47 (42 min)". The duration comes from the same cross-midnight
 * rule as extractInfusionDuration; a lone or unparseable endpoint renders verbatim (no
 * duration) rather than dropping. Returns undefined only when both times are absent.
 */
export function formatInfusionTimeRange(startTime?: string, stopTime?: string): string | undefined {
  if (!startTime && !stopTime) return undefined;
  const start = parseClockTime(startTime);
  const stop = parseClockTime(stopTime);
  const range = `${startTime ?? ''}–${stopTime ?? ''}`;
  if (start === undefined || stop === undefined) return range;
  return `${range} (${durationFrom(start, stop, 'structured').durationMinutes} min)`;
}

/**
 * 96366 add-on units for a documented duration: each additional hour beyond 96365's first
 * hour bills one unit, and a final partial hour counts only once more than 30 minutes into
 * it (the same ≥31-minute threshold as the initial hour).
 */
export function additionalHourUnits(durationMinutes: number): number {
  const beyondFirstHour = durationMinutes - 60;
  if (beyondFirstHour < INFUSION_MINIMUM_MINUTES) return 0;
  return Math.floor(beyondFirstHour / 60) + (beyondFirstHour % 60 >= INFUSION_MINIMUM_MINUTES ? 1 : 0);
}

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "14:05–16:36 total 151 minutes", with the cross-midnight adjustment called out when it applies. */
function describeDuration(duration: InfusionDuration): string {
  return `${formatClock(duration.startMinutes)}–${formatClock(duration.stopMinutes)}${
    duration.crossesMidnight ? ' (crossing midnight)' : ''
  } total ${duration.durationMinutes} minutes`;
}

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface InjectionInfusionFacts {
  /** IM/SubQ language (route or site words), from Medication used, Technique, or the text. */
  imSubqDocumented?: FactValue<true>;
  ivPushDocumented?: FactValue<true>;
  /** Infusion/hydration language, or an IV fluid plus a volume together. */
  infusionDocumented?: FactValue<true>;
  /** The resolved route (explicit push language wins over inferred infusion evidence). */
  route?: FactValue<InjectionRoute>;
  drugDocumented?: FactValue<true>;
  doseDocumented?: FactValue<true>;
  /** Administration site: the structured body site, or site words (deltoid, antecubital, …). */
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
const FLUID_PATTERN =
  /\bNS\b|normal\s+saline|\bLR\b|lactated\s+ringer'?s?\b|\bD5(?:W|NS)?\b|0\.9\s*%\s*(?:NaCl|saline|sodium\s+chloride)|sodium\s+chloride/i;
const VOLUME_PATTERN = /\d+(?:\.\d+)?\s*(?:mL|cc)\b|\b\d+(?:\.\d+)?\s*(?:L|liters?)\b/i;
const DOSE_PATTERN = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|units?|mEq)\b/i;
const DRUG_NAME_PATTERN =
  /toradol|ketorolac|rocephin|ceftriaxone|decadron|dexamethasone|zofran|ondansetron|phenergan|promethazine|benadryl|diphenhydramine|solu-?medrol|methylprednisolone|kenalog|triamcinolone|epinephrine|glucagon|bicillin|penicillin|vitamin\s+B-?12/i;
const ADMIN_SITE_TEXT_PATTERN =
  /\bdeltoid\b|ventro-?gluteal|\bgluteal\b|vastus\s+lateralis|\bthigh\b|antecubital|\bAC\s+fossa\b|\bforearm\b|upper\s+arm|\babdomen\b/i;
const TOLERANCE_PATTERN = /tolerat\w*|no\s+adverse\s+(?:reaction|event)|without\s+adverse|no\s+reaction/i;

/** A route/fluid fact matched across Medication used and Technique (structured) or the details text. */
function structuredOrTextFlag(input: ProcedureFactsInput, text: string, pattern: RegExp): FactValue<true> | undefined {
  const structuredHaystack = [input.medicationUsed ?? '', ...(input.technique ?? [])].join(' ');
  if (pattern.test(structuredHaystack)) {
    return { value: true, confidence: 'structured' };
  }
  return textFlag(text, pattern);
}

/** Deterministic injection/infusion fact extraction: structured fields first, then details-text patterns. */
export function extractInjectionInfusionFacts(input: ProcedureFactsInput): InjectionInfusionFacts {
  const text = input.procedureDetails ?? '';
  const structuredHaystack = [input.medicationUsed ?? '', ...(input.technique ?? [])].join(' ');

  const imSubqDocumented = structuredOrTextFlag(input, text, IM_SUBQ_PATTERN);
  const ivPushDocumented = structuredOrTextFlag(input, text, IV_PUSH_PATTERN);
  const fluidDocumented = structuredOrTextFlag(input, text, FLUID_PATTERN);
  const volumeDocumented = structuredOrTextFlag(input, text, VOLUME_PATTERN);
  // Explicit infusion/hydration language, or an IV fluid plus a volume together.
  const infusionDocumented =
    structuredOrTextFlag(input, text, INFUSION_PATTERN) ??
    (fluidDocumented && volumeDocumented && !ivPushDocumented ? fluidDocumented : undefined);

  // Explicit push language wins over the (weaker) fluid+volume inference: "flushed with 10 mL NS"
  // after a push must not read as a hydration infusion.
  let route: FactValue<InjectionRoute> | undefined;
  if (ivPushDocumented) {
    route = { ...ivPushDocumented, value: 'iv-push' };
  } else if (infusionDocumented) {
    route = { ...infusionDocumented, value: 'infusion' };
  } else if (imSubqDocumented) {
    route = { ...imSubqDocumented, value: 'im-subq' };
  }

  const drugStructured = Boolean(input.medicationUsed?.trim());
  const siteStructured = Boolean(input.bodySite?.trim() || input.otherBodySite?.trim());
  const toleranceStructured = Boolean(input.patientResponse?.trim());

  return {
    imSubqDocumented,
    ivPushDocumented,
    infusionDocumented,
    route,
    drugDocumented: drugStructured ? { value: true, confidence: 'structured' } : textFlag(text, DRUG_NAME_PATTERN),
    doseDocumented: DOSE_PATTERN.test(structuredHaystack)
      ? { value: true, confidence: 'structured' }
      : textFlag(text, DOSE_PATTERN),
    siteDocumented: siteStructured
      ? { value: true, confidence: 'structured' }
      : textFlag(text, ADMIN_SITE_TEXT_PATTERN),
    fluidDocumented,
    volumeDocumented,
    duration: extractInfusionDuration(input, text),
    toleranceDocumented: toleranceStructured
      ? { value: true, confidence: 'structured' }
      : textMention(text, TOLERANCE_PATTERN),
  };
}

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  route: {
    destination: `in the Medication used field or ${DETAILS_FIELD_LABEL}`,
    example: '"Rocephin 500 mg IM, left deltoid" or "NS 1000 mL IV infusion"',
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

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

const ROUTE_ASK_CLAUSE =
  'the administration route selects the code: IM/SubQ injection → 96372, IV push → 96374, IV hydration infusion → 96365 (with 96366 beyond the first hour)';

/** The start/stop-times requirement, spelled out once — including why Time spent does not satisfy it. */
const TIMES_REQUIREMENT_CLAUSE =
  'the hydration codes are time-based: 96365 requires at least 31 minutes of infusion and the documented duration drives 96366 add-on units; the Time spent dropdown records a total only and does not satisfy the start/stop requirement';

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestInjectionInfusionCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractInjectionInfusionFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings } = evaluation;

  const route = facts.route;
  if (route === undefined) {
    findings.push({
      level: 'determines',
      message: `The administration route is not documented — ${ROUTE_ASK_CLAUSE}. ${whereClause('route', 'Add it')}`,
    });
    evaluation.openCandidates = [codeCandidate('96372'), codeCandidate('96374'), codeCandidate('96365')];
    return evaluation;
  }

  if (route.value === 'im-subq') {
    evaluation.suggestion = {
      code: '96372',
      display: codeCandidate('96372').display,
      justification: 'IM/SubQ administration documented → 96372.',
    };
    evaluation.payerNotes = [INJECTION_J_CODE_PAYER_NOTE];
    return evaluation;
  }

  if (route.value === 'iv-push') {
    evaluation.suggestion = {
      code: '96374',
      display: codeCandidate('96374').display,
      justification: 'IV push administration documented → 96374.',
    };
    return evaluation;
  }

  // Hydration infusion: the documented start/stop times determine 96365 and its add-on units.
  const duration = facts.duration;
  if (duration === undefined) {
    findings.push({
      level: 'determines',
      message: `Start and stop times are not documented — ${TIMES_REQUIREMENT_CLAUSE}. ${whereClause(
        'times',
        'Add them'
      )}`,
    });
    evaluation.openCandidates = [codeCandidate('96365'), codeCandidate('96366')];
    return evaluation;
  }

  if (duration.durationMinutes < INFUSION_MINIMUM_MINUTES) {
    findings.push({
      level: 'contradiction',
      message: `The documented start/stop times ${describeDuration(
        duration
      )} — 96365 requires at least ${INFUSION_MINIMUM_MINUTES} minutes of infusion.`,
      sourceText: duration.sourceText,
      confidence: duration.confidence,
    });
    return evaluation;
  }

  const units = additionalHourUnits(duration.durationMinutes);
  if (units === 0) {
    evaluation.suggestion = {
      code: '96365',
      display: codeCandidate('96365').display,
      justification: `IV hydration infusion — documented start/stop times ${describeDuration(
        duration
      )} (at least ${INFUSION_MINIMUM_MINUTES} minutes, within the first hour${
        duration.durationMinutes > 60 ? ' plus 30 minutes or less into the next' : ''
      }) → 96365.`,
    };
    return evaluation;
  }

  const beyondFirstHour = duration.durationMinutes - 60;
  evaluation.suggestion = {
    code: '96365',
    // The display string carries the add-on so the single suggestion row reads as the full billing.
    display: `96365 — IV hydration infusion, ${duration.durationMinutes} minutes total (with add-on 96366 × ${units} for the time beyond the first hour)`,
    justification: `IV hydration infusion — documented start/stop times ${describeDuration(
      duration
    )} → 96365 for the first hour + 96366 × ${units} (${beyondFirstHour} minutes beyond the first hour; each additional hour bills a unit, and a final partial hour counts once more than 30 minutes into it).`,
    addOns: [
      {
        code: '96366',
        units,
        display: codeCandidate('96366').display,
        justification: `${beyondFirstHour} minutes beyond the first hour → 96366 × ${units}.`,
      },
    ],
  };
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

/** The wrong-route contradiction for a selected code, when the note documents only a different route. */
function routeContradiction(code: string, info: InjectionCodeInfo, facts: InjectionInfusionFacts): Finding | undefined {
  const ivEvidence = facts.ivPushDocumented ?? facts.infusionDocumented;
  if (info.route === 'im-subq' && !facts.imSubqDocumented && ivEvidence) {
    return {
      level: 'contradiction',
      cptCode: code,
      message: `${code} is an IM/SubQ injection code, but the note documents intravenous administration.`,
      sourceText: ivEvidence.sourceText,
      confidence: ivEvidence.confidence,
    };
  }
  if (info.route === 'iv-push') {
    if (facts.infusionDocumented && !facts.ivPushDocumented) {
      return {
        level: 'contradiction',
        cptCode: code,
        message: `${code} is an IV push code, but the note documents an infusion — hydration infusions are reported with 96365 (+96366).`,
        sourceText: facts.infusionDocumented.sourceText,
        confidence: facts.infusionDocumented.confidence,
      };
    }
    if (facts.imSubqDocumented && !facts.ivPushDocumented && !facts.infusionDocumented) {
      return {
        level: 'contradiction',
        cptCode: code,
        message: `${code} is an IV push code, but the note documents an IM/SubQ injection — that is reported with 96372.`,
        sourceText: facts.imSubqDocumented.sourceText,
        confidence: facts.imSubqDocumented.confidence,
      };
    }
  }
  if (info.route === 'infusion') {
    if (facts.ivPushDocumented && !facts.infusionDocumented) {
      return {
        level: 'contradiction',
        cptCode: code,
        message: `${code} is a hydration infusion code, but the note documents an IV push — that is reported with 96374.`,
        sourceText: facts.ivPushDocumented.sourceText,
        confidence: facts.ivPushDocumented.confidence,
      };
    }
    if (facts.imSubqDocumented && !facts.infusionDocumented && !facts.ivPushDocumented) {
      return {
        level: 'contradiction',
        cptCode: code,
        message: `${code} is a hydration infusion code, but the note documents an IM/SubQ injection — that is reported with 96372.`,
        sourceText: facts.imSubqDocumented.sourceText,
        confidence: facts.imSubqDocumented.confidence,
      };
    }
  }
  return undefined;
}

function defendInjectionInfusionCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractInjectionInfusionFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const inScopeSelected = selected.filter((c) => isInjectionInfusionCode(c.code));

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    const info = INJECTION_CODE_INFO[code];
    if (info === undefined) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Route: [C] when a different route is documented, [D] ask when none is.
    const contradiction = routeContradiction(code, info, facts);
    if (contradiction) {
      codeFindings.push(contradiction);
    } else if (facts.route === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `The administration route is not documented for ${code} — ${ROUTE_ASK_CLAUSE}. ${whereClause(
          'route',
          'Add it'
        )}`,
      });
    }

    if (info.route === 'im-subq' || (info.route === 'iv-push' && !info.addOn)) {
      // [R] drug / dose / administration site for the injection codes.
      if (!facts.drugDocumented) {
        codeFindings.push({
          level: 'required',
          cptCode: code,
          message: `The medication administered is not documented for ${code}. ${whereClause('drug', 'Record it')}`,
        });
      }
      if (!facts.doseDocumented) {
        codeFindings.push({
          level: 'required',
          cptCode: code,
          message: `The dose is not documented for ${code}. ${whereClause('dose', 'Record it')}`,
        });
      }
      if (!facts.siteDocumented) {
        codeFindings.push({
          level: 'required',
          cptCode: code,
          message: `The administration site is not documented for ${code}. ${whereClause('site', 'Record it')}`,
        });
      }
    } else {
      // Hydration codes: fluid type + volume, and the start/stop-time rules.
      const missingFluid: string[] = [];
      if (!facts.fluidDocumented) missingFluid.push('fluid type');
      if (!facts.volumeDocumented) missingFluid.push('volume');
      if (missingFluid.length > 0) {
        codeFindings.push({
          level: 'required',
          cptCode: code,
          message: `Fluid documentation for ${code} is incomplete — not documented: ${missingFluid.join(
            ', '
          )}. ${whereClause('fluidVolume', missingFluid.length > 1 ? 'Add these' : 'Add it')}`,
        });
      }

      const duration = facts.duration;
      if (duration === undefined) {
        codeFindings.push({
          level: 'required',
          cptCode: code,
          message: `Start and stop times are not documented for ${code} — ${TIMES_REQUIREMENT_CLAUSE}. ${whereClause(
            'times',
            'Add them'
          )}`,
        });
      } else if (code === '96365' && duration.durationMinutes < INFUSION_MINIMUM_MINUTES) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `The documented start/stop times ${describeDuration(
            duration
          )} — 96365 requires at least ${INFUSION_MINIMUM_MINUTES} minutes of infusion.`,
          sourceText: duration.sourceText,
          confidence: duration.confidence,
        });
      } else if (code === '96366' && additionalHourUnits(duration.durationMinutes) === 0) {
        const beyondFirstHour = Math.max(0, duration.durationMinutes - 60);
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `96366 bills each additional hour beyond 96365's first hour and needs more than 30 minutes into that hour — the documented start/stop times ${describeDuration(
            duration
          )} (${beyondFirstHour} minutes beyond the first hour) support no 96366 units.`,
          sourceText: duration.sourceText,
          confidence: duration.confidence,
        });
      }

      // 96366 is an add-on: it is billed only alongside its initial-hour code.
      if (code === '96366' && !selected.some((c) => c.code === '96365')) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message:
            '96366 is an add-on code for each additional hour of hydration — it is billed alongside 96365 (initial, 31 minutes to 1 hour), but 96365 is not selected.',
        });
      }
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(code);
    }
    findings.push(...codeFindings);
  }

  if (inScopeSelected.length > 0) {
    // Entry-level best practice and billing footnote, emitted once per entry.
    if (!facts.toleranceDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Patient tolerance is not documented — it does not affect the code, but a complete note records the response. ${whereClause(
          'tolerance',
          'Record it'
        )}`,
      });
    }
    if (inScopeSelected.some((c) => c.code === '96372')) {
      evaluation.payerNotes = [INJECTION_J_CODE_PAYER_NOTE];
    }
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

// Matches the product procedure types "Intramuscular (IM) Medication Injection" and
// "IV Fluid Administration" (and their "im-medication-injection"/"iv-fluid-administration"
// code slugs). Deliberately does NOT match "Oral Rehydration / Medication Administration"
// (oral route), "Intravenous (IV) Catheter Placement" (placement alone is not an
// administration), or "Nebulizer Treatment" (inhalation).
const INJECTION_INFUSION_TYPE_PATTERN = /\binjection\b|intramuscular|iv[\s-]*fluid|iv[\s-]*hydration|\bIV\s+push\b/i;

export const injectionInfusionFamily: ProcedureFamilyModel = {
  id: 'injection-infusion',
  displayName: 'Therapeutic Injections & IV Hydration',
  usesStructuredInfusionTimes: true,
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = INJECTION_INFUSION_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isInjectionInfusionCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractInjectionInfusionFacts,
  suggestCode: suggestInjectionInfusionCode,
  defendCodes: defendInjectionInfusionCodes,
};
