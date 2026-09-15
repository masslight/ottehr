/** CPT 2026 wound repair; CMS NCCI 2026 III §H and §L; ACEP Wound Repair FAQ §§2–10.
 * https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
 * https://www.acep.org/administration/reimbursement/reimbursement-faqs/wound-repair
 * Exact complete descriptor/band verification requires the licensed CPT codebook.
 */
import { buildEvaluation, coder, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { LACERATION_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, LegacyProcedureFields, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber, readRows, ScalarCodingField, StructuredRow } from '../structured-fields';

const LACERATION_CODES = {
  SimpleBodyUpTo2Point5Cm: '12001',
  SimpleBodyUpTo7Point5Cm: '12002',
  SimpleBodyUpTo12Point5Cm: '12004',
  SimpleBodyUpTo20Cm: '12005',
  SimpleBodyUpTo30Cm: '12006',
  SimpleBodyOver30Cm: '12007',
  SimpleFaceUpTo2Point5Cm: '12011',
  SimpleFaceUpTo5Cm: '12013',
  SimpleFaceUpTo7Point5Cm: '12014',
  SimpleFaceUpTo12Point5Cm: '12015',
  SimpleFaceUpTo20Cm: '12016',
  SimpleFaceUpTo30Cm: '12017',
  SimpleFaceOver30Cm: '12018',
  IntermediateBodyUpTo2Point5Cm: '12031',
  IntermediateBodyUpTo7Point5Cm: '12032',
  IntermediateBodyUpTo12Point5Cm: '12034',
  IntermediateBodyUpTo20Cm: '12035',
  IntermediateBodyUpTo30Cm: '12036',
  IntermediateBodyOver30Cm: '12037',
  IntermediateNeckHandsFeetGenitaliaUpTo2Point5Cm: '12041',
  IntermediateNeckHandsFeetGenitaliaUpTo7Point5Cm: '12042',
  IntermediateNeckHandsFeetGenitaliaUpTo12Point5Cm: '12044',
  IntermediateNeckHandsFeetGenitaliaUpTo20Cm: '12045',
  IntermediateNeckHandsFeetGenitaliaUpTo30Cm: '12046',
  IntermediateNeckHandsFeetGenitaliaOver30Cm: '12047',
  IntermediateFaceUpTo2Point5Cm: '12051',
  IntermediateFaceUpTo5Cm: '12052',
  IntermediateFaceUpTo7Point5Cm: '12053',
  IntermediateFaceUpTo12Point5Cm: '12054',
  IntermediateFaceUpTo20Cm: '12055',
  IntermediateFaceUpTo30Cm: '12056',
  IntermediateFaceOver30Cm: '12057',
  ComplexTrunkUpTo2Point5Cm: '13100',
  ComplexTrunkUpTo7Point5Cm: '13101',
  ComplexTrunkEachAdditional5Cm: '13102',
  ComplexScalpArmsLegsUpTo2Point5Cm: '13120',
  ComplexScalpArmsLegsUpTo7Point5Cm: '13121',
  ComplexScalpArmsLegsEachAdditional5Cm: '13122',
  ComplexOtherSitesUpTo2Point5Cm: '13131',
  ComplexOtherSitesUpTo7Point5Cm: '13132',
  ComplexOtherSitesEachAdditional5Cm: '13133',
  ComplexEyelidsNoseEarsLipsUpTo2Point5Cm: '13151',
  ComplexEyelidsNoseEarsLipsUpTo7Point5Cm: '13152',
  ComplexEyelidsNoseEarsLipsEachAdditional5Cm: '13153',
  MedicareAdhesiveOnly: 'G0168',
} as const;
type LacerationCode = (typeof LACERATION_CODES)[keyof typeof LACERATION_CODES];

// Lengths are accumulated as integer tenths of a centimeter to avoid boundary rounding.
const LENGTH_STEP_CM = 0.1;
const TENTHS_PER_CM = 1 / LENGTH_STEP_CM;
const MAX_WOUND_LENGTH_CM = 100; // Product input-validity ceiling.
const DECIMAL_ROUNDING_TOLERANCE = 1e-8;

// CPT complex-repair length boundaries, in the same internal unit.
const MIN_COMPLEX_LENGTH_TENTHS = 11;
const SHORT_COMPLEX_MAX_LENGTH_TENTHS = 25;
const BASE_COMPLEX_MAX_LENGTH_TENTHS = 75;
const COMPLEX_ADD_ON_LENGTH_TENTHS = 50;
const SEVEN_CODE_UPPER_LENGTH_BOUNDS = [25, 50, 75, 125, 200, 300, Infinity] as const;
const SIX_CODE_UPPER_LENGTH_BOUNDS = [25, 75, 125, 200, 300, Infinity] as const;

const sites = [
  'scalp',
  'neck',
  'axilla',
  'genitalia',
  'trunk',
  'arm',
  'leg',
  'hand',
  'foot',
  'face',
  'forehead',
  'cheek',
  'chin',
  'mouth',
  'ear',
  'eyelid',
  'nose',
  'lip',
  'mucosa',
];

const woundFields: ScalarCodingField[] = [
  { key: 'site', label: 'Site', kind: 'select', options: sites, defaultValue: undefined },
  { key: 'side', label: 'Side', kind: 'select', options: ['left', 'right', 'midline'], defaultValue: undefined },
  { key: 'length', label: 'Length (cm)', kind: 'number', defaultValue: undefined, min: 0, step: LENGTH_STEP_CM },
  {
    key: 'closure',
    label: 'Closure',
    kind: 'select',
    options: ['single layer', 'layered', 'adhesive only', 'strips only', 'open'],
  },
  {
    key: 'contaminated',
    label: 'Heavy contamination requiring extensive cleaning',
    kind: 'checkbox',
    defaultValue: false,
  },
  {
    key: 'exposedStructure',
    label: 'Exposed bone/cartilage/tendon/named neurovascular structure',
    kind: 'checkbox',
    defaultValue: false,
  },
  { key: 'edgeDebridement', label: 'Wound-edge debridement', kind: 'checkbox', defaultValue: false },
  {
    key: 'extensiveUndermining',
    label: 'Undermining at least the defect width',
    kind: 'checkbox',
    defaultValue: false,
  },
  { key: 'freeMargin', label: 'Helical/vermilion/nostril free margin', kind: 'checkbox', defaultValue: false },
  { key: 'retentionSutures', label: 'Retention sutures', kind: 'checkbox', defaultValue: false },
  {
    key: 'plannedTransfer',
    label: 'Deliberately developed adjacent tissue transfer',
    kind: 'checkbox',
    defaultValue: false,
  },
  { key: 'surgicalIncision', label: 'Closure of another surgical incision', kind: 'checkbox', defaultValue: false },
  { key: 'sameSiteLesionRemoval', label: 'Same-site lesion removal', kind: 'checkbox', defaultValue: false },
  {
    key: 'smallBenignExcision',
    label: 'Same-site benign lesion excision, diameter 0.5 cm or less',
    kind: 'checkbox',
    defaultValue: false,
  },
  { key: 'material', label: 'Closure material', kind: 'text' },
  { key: 'sutureCount', label: 'Suture/staple count', kind: 'number', defaultValue: undefined, min: 0, step: 1 },
  { key: 'irrigation', label: 'Irrigation performed', kind: 'checkbox', defaultValue: false },
];

for (const field of woundFields) if (!['site', 'side', 'length', 'closure'].includes(field.key)) field.details = true;

const fields: CodingField[] = [{ key: 'wounds', label: 'Wounds', kind: 'rows', fields: woundFields }];

const simpleBody = [
  LACERATION_CODES.SimpleBodyUpTo2Point5Cm,
  LACERATION_CODES.SimpleBodyUpTo7Point5Cm,
  LACERATION_CODES.SimpleBodyUpTo12Point5Cm,
  LACERATION_CODES.SimpleBodyUpTo20Cm,
  LACERATION_CODES.SimpleBodyUpTo30Cm,
  LACERATION_CODES.SimpleBodyOver30Cm,
];

const simpleFace = [
  LACERATION_CODES.SimpleFaceUpTo2Point5Cm,
  LACERATION_CODES.SimpleFaceUpTo5Cm,
  LACERATION_CODES.SimpleFaceUpTo7Point5Cm,
  LACERATION_CODES.SimpleFaceUpTo12Point5Cm,
  LACERATION_CODES.SimpleFaceUpTo20Cm,
  LACERATION_CODES.SimpleFaceUpTo30Cm,
  LACERATION_CODES.SimpleFaceOver30Cm,
];

const intermediateBody = [
  LACERATION_CODES.IntermediateBodyUpTo2Point5Cm,
  LACERATION_CODES.IntermediateBodyUpTo7Point5Cm,
  LACERATION_CODES.IntermediateBodyUpTo12Point5Cm,
  LACERATION_CODES.IntermediateBodyUpTo20Cm,
  LACERATION_CODES.IntermediateBodyUpTo30Cm,
  LACERATION_CODES.IntermediateBodyOver30Cm,
];

const intermediateNeck = [
  LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo2Point5Cm,
  LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo7Point5Cm,
  LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo12Point5Cm,
  LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo20Cm,
  LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo30Cm,
  LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaOver30Cm,
];

const intermediateFace = [
  LACERATION_CODES.IntermediateFaceUpTo2Point5Cm,
  LACERATION_CODES.IntermediateFaceUpTo5Cm,
  LACERATION_CODES.IntermediateFaceUpTo7Point5Cm,
  LACERATION_CODES.IntermediateFaceUpTo12Point5Cm,
  LACERATION_CODES.IntermediateFaceUpTo20Cm,
  LACERATION_CODES.IntermediateFaceUpTo30Cm,
  LACERATION_CODES.IntermediateFaceOver30Cm,
];

interface ComplexRepairCodes {
  upTo2Point5Cm: LacerationCode;
  upTo7Point5Cm: LacerationCode;
  eachAdditional5Cm: LacerationCode;
}

const complex: readonly ComplexRepairCodes[] = [
  {
    upTo2Point5Cm: LACERATION_CODES.ComplexTrunkUpTo2Point5Cm,
    upTo7Point5Cm: LACERATION_CODES.ComplexTrunkUpTo7Point5Cm,
    eachAdditional5Cm: LACERATION_CODES.ComplexTrunkEachAdditional5Cm,
  }, // Trunk
  {
    upTo2Point5Cm: LACERATION_CODES.ComplexScalpArmsLegsUpTo2Point5Cm,
    upTo7Point5Cm: LACERATION_CODES.ComplexScalpArmsLegsUpTo7Point5Cm,
    eachAdditional5Cm: LACERATION_CODES.ComplexScalpArmsLegsEachAdditional5Cm,
  }, // Scalp, arms, legs
  {
    upTo2Point5Cm: LACERATION_CODES.ComplexOtherSitesUpTo2Point5Cm,
    upTo7Point5Cm: LACERATION_CODES.ComplexOtherSitesUpTo7Point5Cm,
    eachAdditional5Cm: LACERATION_CODES.ComplexOtherSitesEachAdditional5Cm,
  }, // Remaining complex sites
  {
    upTo2Point5Cm: LACERATION_CODES.ComplexEyelidsNoseEarsLipsUpTo2Point5Cm,
    upTo7Point5Cm: LACERATION_CODES.ComplexEyelidsNoseEarsLipsUpTo7Point5Cm,
    eachAdditional5Cm: LACERATION_CODES.ComplexEyelidsNoseEarsLipsEachAdditional5Cm,
  }, // Eyelids, nose, ears, lips
];

const face = ['face', 'forehead', 'cheek', 'chin', 'mouth', 'ear', 'eyelid', 'nose', 'lip', 'mucosa'];

enum RepairComplexity {
  Simple,
  Intermediate,
  Complex,
}

/** Anatomic group index within the CPT code series for this repair complexity. */
function groupFor(site: string, level: RepairComplexity): number {
  if (level === RepairComplexity.Simple) return face.includes(site) ? 1 : 0;
  if (level === RepairComplexity.Intermediate)
    return face.includes(site) ? 2 : ['neck', 'hand', 'foot', 'genitalia'].includes(site) ? 1 : 0;
  if (site === 'trunk') return 0;
  if (['scalp', 'arm', 'leg'].includes(site)) return 1;
  return ['eyelid', 'nose', 'ear', 'lip'].includes(site) ? 3 : 2;
}

interface Group {
  level: RepairComplexity;
  group: number;
  /** Integer tenths of a centimeter; keeps summed lengths exact at CPT band boundaries. */
  lengthTenthsCm: number;
  wounds: StructuredRow[];
}

export const lacerationFamily: ProcedureFamilyModel<LacerationCode> = {
  codePairEdits: LACERATION_PTP_EDITS,
  capturesSite: true,
  capturesSide: true,
  id: 'laceration',
  procedureNames: PROCEDURE_NAMES['laceration'],
  displayName: 'Laceration repair',
  fields,
  codes: Object.values(LACERATION_CODES),
  suggest: (facts) => {
    const wounds = readRows(facts, 'wounds');

    if (!wounds.length) return missing('Wounds');

    const groups = new Map<string, Group>();

    const add = (wound: StructuredRow, level: RepairComplexity, lengthTenthsCm: number): void => {
      const group = groupFor(String(wound.site), level);
      const key = `${level}:${group}`;
      const item = groups.get(key) ?? { level, group, lengthTenthsCm: 0, wounds: [] };
      item.lengthTenthsCm += lengthTenthsCm;
      item.wounds.push(wound);
      groups.set(key, item);
    };

    for (const [index, wound] of wounds.entries()) {
      // Name the wound as the form numbers it: with several rows on screen, a bare "Site" does not say which.
      const inWound = (label: string): string => `Wounds ${index + 1}: ${label}`;
      const unanswered = [
        ...(sites.includes(String(wound.site)) ? [] : ['Site']),
        ...(wound.closure ? [] : ['Closure']),
      ];

      if (unanswered.length) return missing(...unanswered.map(inWound));

      // NCCI distinguishes deliberately developed tissue transfer from incidental Z-plasty-shaped closure.
      if (wound.plannedTransfer) return coder('Use reconstructive tissue-transfer codes.');

      if (wound.surgicalIncision || wound.closure === 'strips only' || wound.closure === 'open') continue;

      const cm = readNumber(wound, 'length');

      if (
        !cm ||
        cm > MAX_WOUND_LENGTH_CM ||
        Math.abs(cm * TENTHS_PER_CM - Math.round(cm * TENTHS_PER_CM)) > DECIMAL_ROUNDING_TOLERANCE
      )
        return missing(inWound('Length (cm)'));

      // ACEP §§4–5: complex repair requires intermediate components plus a qualifying complex finding.
      const intermediate = wound.closure === 'layered' || wound.contaminated;

      const complexFinding =
        wound.exposedStructure ||
        wound.edgeDebridement ||
        wound.extensiveUndermining ||
        wound.freeMargin ||
        wound.retentionSutures;

      if (complexFinding && !intermediate)
        return coder('Review closure depth alongside the documented complex findings.');

      let level = RepairComplexity.Simple;

      if (intermediate) level = RepairComplexity.Intermediate;

      if (intermediate && complexFinding) level = RepairComplexity.Complex;

      if (level === RepairComplexity.Complex && ['face', 'mucosa'].includes(String(wound.site)))
        return missing(inWound('Site'));

      // NCCI III §E.6/§L.9 includes even intermediate/complex closure for these small benign excisions.
      if (wound.smallBenignExcision || (level === RepairComplexity.Simple && wound.sameSiteLesionRemoval)) continue;

      add(wound, level, Math.round(cm * TENTHS_PER_CM));
    }

    // Apply the complex-series floor to the summed site group, then regroup short groups as intermediate.
    for (const [key, group] of [...groups])
      if (group.level === RepairComplexity.Complex && group.lengthTenthsCm < MIN_COMPLEX_LENGTH_TENTHS) {
        groups.delete(key);

        for (const wound of group.wounds)
          add(wound, RepairComplexity.Intermediate, Math.round(Number(wound.length) * TENTHS_PER_CM));
      }

    const lines: CodeSuggestion[] = [];

    for (const repairGroup of [...groups.values()].sort((a, b) => b.level - a.level)) {
      const modifiers = lines.length ? [CPT_MODIFIERS.DistinctService] : [];

      if (repairGroup.level === RepairComplexity.Complex) {
        const { upTo2Point5Cm, upTo7Point5Cm, eachAdditional5Cm } = complex[repairGroup.group];

        // One base per complex site group; additional length is expressed only with the related add-on.
        lines.push({
          code: repairGroup.lengthTenthsCm <= SHORT_COMPLEX_MAX_LENGTH_TENTHS ? upTo2Point5Cm : upTo7Point5Cm,
          display: 'Complex wound repair',
          justification: `Grouped repair length: ${repairGroup.lengthTenthsCm / TENTHS_PER_CM} cm.`,
          units: 1,
          modifiers,
        });

        if (repairGroup.lengthTenthsCm > BASE_COMPLEX_MAX_LENGTH_TENTHS)
          lines.push({
            requiresCode: upTo7Point5Cm,
            code: eachAdditional5Cm,
            display: 'Additional complex repair length',
            justification: 'Additional length beyond 7.5 cm.',
            units: Math.ceil(
              (repairGroup.lengthTenthsCm - BASE_COMPLEX_MAX_LENGTH_TENTHS) / COMPLEX_ADD_ON_LENGTH_TENTHS
            ),
            modifiers: [],
          });
      } else {
        const series =
          repairGroup.level === RepairComplexity.Simple
            ? repairGroup.group === 0
              ? simpleBody
              : simpleFace
            : [intermediateBody, intermediateNeck, intermediateFace][repairGroup.group];

        // Bounds are tenths of a centimeter. Seven-code series include the 2.6–5.0 cm band;
        // six-code series combine 2.6–7.5 cm in their second code.
        const upperLengthBounds =
          series.length === SEVEN_CODE_UPPER_LENGTH_BOUNDS.length
            ? SEVEN_CODE_UPPER_LENGTH_BOUNDS
            : SIX_CODE_UPPER_LENGTH_BOUNDS;

        lines.push({
          code: series[upperLengthBounds.findIndex((bound) => repairGroup.lengthTenthsCm <= bound)],
          display:
            repairGroup.level === RepairComplexity.Intermediate ? 'Intermediate wound repair' : 'Simple wound repair',
          justification: `Grouped repair length: ${repairGroup.lengthTenthsCm / TENTHS_PER_CM} cm.`,
          units: 1,
          modifiers,
        });
      }
    }

    if (!lines.length) return noCode('No separate repair code for the documented closure.');

    // Only wounds that actually produced a repair line decide the payer alternative. Wounds skipped
    // above (left open, strips only, surgical incision, small benign excision) carry no repair code,
    // so they must not make an otherwise adhesive-only record look mixed.
    const codedWounds = [...groups.values()].flatMap((repairGroup) => repairGroup.wounds);

    if (codedWounds.every((w) => w.closure === 'adhesive only')) {
      lines.forEach((line) => {
        line.alternative = 'standard';
      });

      lines.push({
        code: LACERATION_CODES.MedicareAdhesiveOnly,
        display: 'Wound closure using tissue adhesive',
        justification: 'Medicare adhesive-only alternative.',
        units: 1,
        modifiers: [],
        alternative: 'Medicare',
      });

      return buildEvaluation({
        suggestions: lines,
        findings: [],
        payerNotes: [
          'Adhesive-only closure: choose ordinary repair coding or Medicare G0168 as appropriate, not both.',
        ],
      });
    }

    return buildEvaluation({
      suggestions: lines,
      findings: [],
      payerNotes: codedWounds.some((wound) => wound.closure === 'adhesive only')
        ? [
            'For separate adhesive-only and sutured wounds, these repair codes show the standard option. Medicare may require G0168 for the adhesive-only wound and repair coding based only on the sutured wounds; review the separate sites before choosing codes.',
          ]
        : [],
    });
  },
  dailyLimits: {
    [LACERATION_CODES.SimpleBodyUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.SimpleBodyUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.SimpleBodyUpTo12Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.SimpleBodyUpTo20Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.SimpleBodyUpTo30Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.SimpleBodyOver30Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.SimpleFaceUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.SimpleFaceUpTo5Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.SimpleFaceUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.SimpleFaceUpTo12Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.SimpleFaceUpTo20Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.SimpleFaceUpTo30Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.SimpleFaceOver30Cm]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [LACERATION_CODES.IntermediateBodyUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateBodyUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateBodyUpTo12Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateBodyUpTo20Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateBodyUpTo30Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateBodyOver30Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo12Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo20Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaUpTo30Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateNeckHandsFeetGenitaliaOver30Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceUpTo5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceUpTo12Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceUpTo20Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceUpTo30Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.IntermediateFaceOver30Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexTrunkUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexTrunkUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexTrunkEachAdditional5Cm]: {
      maxUnits: 9,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [LACERATION_CODES.ComplexScalpArmsLegsUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexScalpArmsLegsUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexScalpArmsLegsEachAdditional5Cm]: {
      maxUnits: 9,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [LACERATION_CODES.ComplexOtherSitesUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexOtherSitesUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexOtherSitesEachAdditional5Cm]: {
      maxUnits: 7,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [LACERATION_CODES.ComplexEyelidsNoseEarsLipsUpTo2Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexEyelidsNoseEarsLipsUpTo7Point5Cm]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LACERATION_CODES.ComplexEyelidsNoseEarsLipsEachAdditional5Cm]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [LACERATION_CODES.MedicareAdhesiveOnly]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // ACEP §§3–6,10: measured wounds, layers, qualifying complex work and per-wound detail. Tetanus is reviewed in the immunization record.
  // https://www.acep.org/administration/reimbursement/reimbursement-faqs/wound-repair
  documentationChecklist: () => [
    'Record each wound’s specific site, measured length at repair, closure material and tissue layers closed; keep wounds individually identifiable.',
    'Describe extensive cleaning of a heavily contaminated wound or qualifying complex work when performed, including undermining extent and relevant structures.',
    'Record suture/staple count, irrigation, wound disposition, outcome and aftercare; review tetanus status in the immunization record.',
  ],
  readLegacyFacts: (input: LegacyProcedureFields) => {
    // Existing structured answers are migrated by exact option identity, never by interpreting narrative.
    const site: Partial<Record<string, string>> = {
      Head: 'scalp',
      Face: 'face',
      Arm: 'arm',
      Leg: 'leg',
      Torso: 'trunk',
      Genital: 'genitalia',
      Ear: 'ear',
      Nose: 'nose',
      Hand: 'hand',
      Foot: 'foot',
      Neck: 'neck',
      Finger: 'hand',
      Chest: 'trunk',
      Shoulder: 'arm',
      Hip: 'leg',
      Knee: 'leg',
      Ankle: 'leg',
    };

    const closure: Partial<Record<string, string>> = {
      'superficial-single': 'single layer',
      'subcutaneous-single': 'single layer',
      'subcutaneous-layered': 'layered',
      'fascia-muscle-layered': 'layered',
      'tissue-adhesive-only': 'adhesive only',
      'strips-only': 'strips only',
    };

    return {
      wounds: [
        {
          site: site[input.bodySite ?? ''],
          side: input.bodySide === 'Left' ? 'left' : input.bodySide === 'Right' ? 'right' : undefined,
          length: input.lengthCm,
          closure: closure[input.repairDepth ?? ''],
        },
      ],
    };
  },
};
