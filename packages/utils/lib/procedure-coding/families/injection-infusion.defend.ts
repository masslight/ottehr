import { defendSelectedCodes } from '../family-support';
import {
  citing,
  CodeAssessmentKind,
  codeScope,
  emptyDefenseEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  Finding,
  notAssessedCode,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  setCodeAssessment,
} from '../model.types';
import {
  describeDuration,
  extractInjectionInfusionFacts,
  InfusionDuration,
  InjectionInfusionFacts,
} from './injection-infusion.extract';
import {
  additionalHourUnits,
  codeForRoute,
  HYDRATION_MINIMUM_MINUTES,
  INFUSION_KIND_LABELS,
  InfusionKind,
  INJECTION_CODE_INFO,
  INJECTION_INFUSION_CODES,
  InjectionCodeInfo,
  InjectionInfusionCode,
  isInjectionInfusionCode,
  IV_PUSH_MAXIMUM_MINUTES,
  ROUTE_CODE_LABELS,
  ROUTE_DOCUMENTED_LABELS,
} from './injection-infusion.rules';
import {
  IMMUNIZATION_ADVISORY,
  IMMUNIZATION_NOT_ASSESSED_REASON,
  immunizationFinding,
  immunizationOutOfScope,
  infusateAskMessage,
  INFUSION_HIERARCHY_PAYER_NOTE,
  INJECTION_J_CODE_PAYER_NOTE,
  otherRouteAdvisories,
  ROUTE_ASK_CLAUSE,
  TIMES_REQUIREMENT_CLAUSE,
  usableDuration,
  whereClause,
} from './injection-infusion.shared';

function documentedInfusionCode(facts: InjectionInfusionFacts): string {
  return codeForRoute('infusion', facts.infusionKind?.value);
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

export function defendInjectionInfusionCodes(input: ProcedureFactsInput): FamilyEvaluation {
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
