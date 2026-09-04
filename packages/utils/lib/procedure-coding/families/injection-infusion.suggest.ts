import {
  citing,
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { describeDuration, extractInjectionInfusionFacts } from './injection-infusion.extract';
import {
  additionalHourUnits,
  codeCandidate,
  HYDRATION_MINIMUM_MINUTES,
  INFUSION_ADD_ON_CODE,
  INFUSION_INITIAL_CODE,
  INFUSION_KIND_TITLES,
  InfusionKind,
  INJECTION_INFUSION_CODES,
  IV_PUSH_MAXIMUM_MINUTES,
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

export function suggestInjectionInfusionCode(input: ProcedureFactsInput): FamilyEvaluation {
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
