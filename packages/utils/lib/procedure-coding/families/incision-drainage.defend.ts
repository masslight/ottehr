import { defendSelectedCodes, joinWithOr } from '../family-support';
import {
  citing,
  codeScope,
  emptyDefenseEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  ifPerformedClause,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
} from '../model.types';
import {
  extractIncisionDrainageFacts,
  INCISION_DRAINAGE_COMPLEXITY_ELEMENT_PATTERNS,
  IncisionDrainageComplexityElement,
} from './incision-drainage.extract';
import {
  INCISION_DRAINAGE_CODE_CATALOG,
  INCISION_DRAINAGE_CODES,
  isIncisionDrainageCode,
} from './incision-drainage.rules';
import {
  COMPLEXITY_ELEMENT_LABELS,
  COMPLEXITY_ELEMENT_MENU,
  complexityElementList,
  outOfScopeSiteMessage,
  whereClause,
} from './incision-drainage.shared';

function complexityElementMenuExcept(exclude: IncisionDrainageComplexityElement): string {
  return joinWithOr(
    INCISION_DRAINAGE_COMPLEXITY_ELEMENT_PATTERNS.filter(([element]) => element !== exclude).map(
      ([element]) => COMPLEXITY_ELEMENT_LABELS[element]
    )
  );
}

export function defendIncisionDrainageCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractIncisionDrainageFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const firstElement = facts.complexityElements[0];
  const anyInScope = selected.some((c) => isIncisionDrainageCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    INCISION_DRAINAGE_CODE_CATALOG.resolve,
    (_info, code, codeFindings, answerAtEntryLevel) => {
      if (facts.outOfScopeSite) {
        findings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: outOfScopeSiteMessage(facts.outOfScopeSite.value, `${code} is selected`),
          evidence: citing(facts.outOfScopeSite),
        });
        answerAtEntryLevel();
        return;
      }

      if (code === INCISION_DRAINAGE_CODES.complicatedOrMultiple.code && firstElement === undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `10061 is selected, but the note does not document any complexity element (${COMPLEXITY_ELEMENT_MENU}) — as documented this supports 10060 (simple or single abscess). ${whereClause(
            'complexityElement',
            ifPerformedClause('performed', 'add it')
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      const packingOnly = facts.complexityElements.length === 1 && facts.complexityElements[0].value === 'packing';

      if (code === INCISION_DRAINAGE_CODES.simpleOrSingle.code && firstElement !== undefined) {
        codeFindings.push({
          level: packingOnly ? 'bestPractice' : 'contradiction',
          scope: codeScope(code),
          message: packingOnly
            ? `10060 is selected and the note documents ${
                COMPLEXITY_ELEMENT_LABELS.packing
              } — packing supports a complicated I&D rather than establishing one on its own, so 10060 stands as documented. ${whereClause(
                'complexityElement',
                `If ${complexityElementMenuExcept('packing')} was also part of the procedure, add it`
              )}`
            : `10060 is selected, but the note documents ${complexityElementList(
                facts
              )} — as documented this supports 10061 (complicated or multiple).`,
          evidence: citing(firstElement),
        });
      }

      if (!facts.locationDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The abscess location is not documented for ${code}. ${whereClause('site', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.incisionDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The incision is not documented for ${code} — the note should describe how the abscess was opened. ${whereClause(
            'incision'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.drainageDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Drainage is not documented for ${code} — the note should record the character (and ideally volume) of what drained. ${whereClause(
            'drainage'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (anyInScope) {
    if (!facts.sizeDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Lesion size is not documented — it does not select the code, but it supports the complexity narrative. ${whereClause(
          'size',
          'Enter it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Anesthesia is not noted — it does not affect the code (local anesthesia is included), but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.cultureDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Culture & sensitivity is not documented — record whether a specimen was sent. ${whereClause(
          'culture',
          'Record it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.dressingOrToleranceDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Dressing and patient tolerance are not documented. ${whereClause('dressing', 'Add them')}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}
