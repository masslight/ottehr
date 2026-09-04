import {
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractSplintingFacts } from './splinting.extract';
import {
  ALL_SPLINTING_CODES,
  codeCandidate,
  codeRange,
  COMPRESSION_CODES,
  KIND_ASK_CLAUSE,
  REGION_LABELS,
  SPLINT_CODE_BY_REGION,
  SPLINT_CODES,
  SPLINT_REGION_MENU,
  SPLINTING_CODE_INFO,
  SPLINTING_CODES,
  staticDynamicPair,
  STRAP_REGION_MENU,
  STRAPPING_CODE_BY_REGION,
  STRAPPING_CODES,
} from './splinting.rules';
import { whereClause } from './splinting.shared';

export function suggestSplintingCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractSplintingFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  const compressionCode = facts.unnaBootDocumented
    ? SPLINTING_CODES.unnaBoot
    : facts.multiLayerCompressionDocumented
    ? SPLINTING_CODES.multiLayerCompression
    : undefined;

  if (compressionCode !== undefined) {
    if (facts.lowerLegDocumented === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `${compressionCode} covers ${
          REGION_LABELS[SPLINTING_CODE_INFO[compressionCode].region]
        }, but the treated region is not documented. ${whereClause('strapSite', 'Select it')}`,
        evidence: NOTHING_TO_CITE,
      });

      evaluation.outcome = openCodeSet(
        COMPRESSION_CODES.map(codeCandidate),
        `${codeRange(COMPRESSION_CODES)} — the treated region (leg below the knee) confirms the compression code`
      );

      return evaluation;
    }

    evaluation.outcome = determinedCode({
      code: compressionCode,
      display: codeCandidate(compressionCode).display,
      justification: `${
        facts.unnaBootDocumented ? 'Unna boot' : 'Multi-layer compression system'
      } applied to the leg below the knee → ${compressionCode}.`,
    });

    return evaluation;
  }

  const kind = facts.splintDocumented ? 'splint' : facts.strappingDocumented ? 'strapping' : undefined;

  if (kind === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The appliance is not documented — ${KIND_ASK_CLAUSE}. ${whereClause('applianceKind', 'Describe it')}`,
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      ALL_SPLINTING_CODES.map(codeCandidate),
      `${codeRange(
        ALL_SPLINTING_CODES
      )} — the appliance (splint vs strapping) and the body region determine the exact code`
    );

    return evaluation;
  }

  if (kind === 'strapping') {
    const strapRegion = facts.strapRegion;

    if (strapRegion === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `The strapped region is not documented — the strapping code depends on it (${STRAP_REGION_MENU}). ${whereClause(
          'strapSite',
          'Select it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });

      evaluation.outcome = openCodeSet(
        STRAPPING_CODES.map(codeCandidate),
        `${codeRange(STRAPPING_CODES)} — the strapped region determines the exact code`
      );

      return evaluation;
    }

    const code = STRAPPING_CODE_BY_REGION[strapRegion.value];

    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification: `Strapping documented; ${REGION_LABELS[strapRegion.value]} is the documented region → ${code}.`,
    });

    return evaluation;
  }

  const region = facts.splintRegion;

  if (region === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The splinted region is not documented — the splint code depends on the body region and splint type (${SPLINT_REGION_MENU}). ${whereClause(
        'splintType',
        'Select the Body site and/or name the splint'
      )}`,
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      SPLINT_CODES.map(codeCandidate),
      `${codeRange(SPLINT_CODES)} — the splinted region and splint type determine the exact code`
    );

    return evaluation;
  }

  if (region.value === 'short-arm' || region.value === 'finger') {
    const pair = staticDynamicPair(region.value);

    if (facts.staticDynamic === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `Whether the splint is static or dynamic is not documented — it selects ${
          pair.staticCode
        } (static) vs ${
          pair.dynamicCode
        } (dynamic), and a static splint should say so rather than be assumed. ${whereClause(
          'staticDynamic',
          'Add it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });

      evaluation.outcome = openCodeSet(
        [codeCandidate(pair.staticCode), codeCandidate(pair.dynamicCode)],
        `${pair.staticCode}–${pair.dynamicCode} — static vs dynamic determines the exact code`
      );

      return evaluation;
    }

    const code = facts.staticDynamic.value === 'static' ? pair.staticCode : pair.dynamicCode;

    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification: `Splint applied to ${REGION_LABELS[region.value]}; ${
        facts.staticDynamic.value
      } splint documented → ${code}.`,
    });

    return evaluation;
  }

  const code = SPLINT_CODE_BY_REGION[region.value];

  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: `Splint applied to ${REGION_LABELS[region.value]} → ${code}.`,
  });

  return evaluation;
}
