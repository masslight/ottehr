import { defendSelectedCodes, lateralityFinding } from '../family-support';
import {
  citing,
  codeScope,
  emptyDefenseEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  ifPerformedClause,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  whereToDocumentClause,
} from '../model.types';
import { extractSplintingFacts, SPLINT_MATERIAL_BY_REGION } from './splinting.extract';
import {
  codeRange,
  COMPRESSION_APPLIANCE_LABEL,
  COMPRESSION_CODES,
  isSplintingCode,
  REGION_LABELS,
  SPLINT_CODES,
  SPLINTING_CODE_INFO,
  SPLINTING_CODES,
  STRAPPING_CODE_BY_REGION,
  STRAPPING_CODES,
} from './splinting.rules';
import { WHERE_TO_DOCUMENT, whereClause } from './splinting.shared';

export function defendSplintingCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractSplintingFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const strappingEvidence =
    facts.strappingDocumented ?? facts.unnaBootDocumented ?? facts.multiLayerCompressionDocumented;

  const documentedCompressionCode = facts.unnaBootDocumented
    ? SPLINTING_CODES.unnaBoot
    : facts.multiLayerCompressionDocumented
    ? SPLINTING_CODES.multiLayerCompression
    : undefined;

  const inScopeSelected = selected.filter((c) => isSplintingCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isSplintingCode(code) ? SPLINTING_CODE_INFO[code] : undefined),
    (info, code, codeFindings) => {
      if (info.kind === 'splint' && !facts.splintDocumented && strappingEvidence) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} is a splint-application code, but the note documents strapping/taping only — strapping is reported with ${codeRange(
            STRAPPING_CODES
          )}. ${whereClause('applianceKind', ifPerformedClause('applied', 'describe it', 'a splint'))}`,
          evidence: citing(strappingEvidence),
        });
      }

      if (info.kind === 'strapping' && !strappingEvidence && facts.splintDocumented) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} is a strapping code, but the note documents a splint only — splint application is reported with ${codeRange(
            SPLINT_CODES
          )}. ${whereClause('applianceKind', ifPerformedClause('applied', 'describe it', 'strapping'))}`,
          evidence: citing(facts.splintDocumented),
        });
      }

      if (info.kind === 'splint') {
        const region = facts.splintRegion;

        if (region === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `The splinted region is not documented for ${code} — the splint code depends on the body region and splint type. ${whereClause(
              'splintType',
              'Select the Body site and/or name the splint'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        } else if (region.value !== info.region) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers a splint of ${REGION_LABELS[info.region]}, but the note documents ${
              REGION_LABELS[region.value]
            }.`,
            evidence: citing(region),
          });
        }
        if (info.staticDynamic !== undefined) {
          if (facts.staticDynamic === undefined) {
            codeFindings.push({
              level: 'determines',
              scope: codeScope(code),
              message: `Whether the splint is static or dynamic is not documented for ${code} — it selects between the static and dynamic codes, and a static splint should say so rather than be assumed. ${whereClause(
                'staticDynamic',
                'Add it'
              )}`,
              evidence: NOTHING_TO_CITE,
            });
          } else if (facts.staticDynamic.value !== info.staticDynamic) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} is the ${info.staticDynamic} splint code, but the note documents a ${facts.staticDynamic.value} splint.`,
              evidence: citing(facts.staticDynamic),
            });
          }
        }
      } else if (COMPRESSION_CODES.some((compressionCode) => compressionCode === code)) {
        const applianceFact =
          code === SPLINTING_CODES.unnaBoot ? facts.unnaBootDocumented : facts.multiLayerCompressionDocumented;

        if (applianceFact === undefined) {
          if (facts.strapRegion !== undefined) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} covers ${COMPRESSION_APPLIANCE_LABEL[code]}, but the note documents strapping of ${
                REGION_LABELS[facts.strapRegion.value]
              } without one — that strapping is reported with ${STRAPPING_CODE_BY_REGION[facts.strapRegion.value]}.`,
              evidence: citing(facts.strapRegion),
            });
          } else {
            codeFindings.push({
              level: 'determines',
              scope: codeScope(code),
              message: `${
                COMPRESSION_APPLIANCE_LABEL[code]
              } is not documented for ${code} — the code is defined by that appliance. ${whereClause(
                'applianceKind',
                ifPerformedClause('applied', 'name it')
              )}`,
              evidence: NOTHING_TO_CITE,
            });
          }
        } else if (facts.lowerLegDocumented === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `The treated region is not documented for ${code} — it covers ${
              REGION_LABELS[info.region]
            }. ${whereClause('strapSite', 'Select it')}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      } else {
        const strapRegion = facts.strapRegion;

        if (documentedCompressionCode !== undefined) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers strapping of ${REGION_LABELS[info.region]}, but the note documents ${
              COMPRESSION_APPLIANCE_LABEL[documentedCompressionCode]
            } — that is reported with ${documentedCompressionCode}.`,
            evidence: citing(facts.unnaBootDocumented ?? facts.multiLayerCompressionDocumented),
          });
        } else if (strapRegion === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `The strapped region is not documented for ${code} — the strapping code depends on it. ${whereClause(
              'strapSite',
              'Select it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        } else if (strapRegion.value !== info.region) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers strapping of ${REGION_LABELS[info.region]}, but the note documents ${
              REGION_LABELS[strapRegion.value]
            }.`,
            evidence: citing(strapRegion),
          });
        }
      }

      if (!facts.applicationDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Application by the clinician is not documented for ${code} — application codes require that the clinician applied (and for splints, molded) the appliance. ${whereClause(
            'application',
            'Record it'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      const missingPre = facts.preNeurovascularDocumented === undefined;
      const missingPost = facts.postNeurovascularDocumented === undefined;
      const uncuedNeurovascular = facts.neurovascularUncuedDocumented;

      if (uncuedNeurovascular !== undefined && (missingPre || missingPost)) {
        const untied = missingPre && missingPost ? 'before or after' : missingPre ? 'before' : 'after';

        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `A neurovascular exam is documented for ${code}, but it is not tied to ${untied} application — the pre- and post-application checks are separate elements. If both were performed, say which is which. ${whereClause(
            'neurovascularTiming',
            'Add the timing'
          )}`,
          evidence: citing(uncuedNeurovascular),
        });
      } else {
        if (missingPre) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `A pre-application neurovascular exam is not documented for ${code} — record pulses, motor, sensation, and cap refill before application. ${whereClause(
              'preNeurovascular'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }

        if (missingPost) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `A post-application neurovascular exam is not documented for ${code} — re-examine and record pulses, motor, sensation, and cap refill after application. ${whereClause(
              'postNeurovascular'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }

      if (!facts.lateralityDocumented && code !== SPLINTING_CODES.chestStrapping) {
        codeFindings.push(lateralityFinding(code, whereClause('laterality', 'Select it')));
      }

      if (info.kind === 'splint' && !facts.materialDocumented) {
        const material = SPLINT_MATERIAL_BY_REGION[info.region];

        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The splint material is not documented for ${code} — it does not affect code selection, but a complete note records what the splint was made of (${
            material.accepted
          }). ${whereToDocumentClause({ ...WHERE_TO_DOCUMENT.material, example: material.example }, 'Record it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (inScopeSelected.length > 0 && !facts.instructionsDocumented) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: `Patient instructions are not documented — splint/strapping care and elevation guidance complete the note. ${whereClause(
        'instructions',
        'Record them'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }

  return evaluation;
}
