/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS NCCI 2026 Chapter IV §G.2–3,6–8: dressing/surgery exclusions and initial care; Noridian A56112: prefabrication.
 * CMS MPFS RVU26A rows 29105–29580 corroborate code identities and bilateral indicators, not full CPT guidelines.
 * https://www.cms.gov/files/zip/rvu26a.zip
 * Original, Ch.IV: "Casting/splinting/strapping CPT codes shall not be reported for application of a dressing after a therapeutic procedure."
 * https://www.cms.gov/files/document/04-chapter4-ncci-medicare-policy-manual-2026-final.pdf
 * https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=56112
 */
import { buildEvaluation, coder, lateralityModifiers, missing, MueAdjudication, noCode } from '../cpt';
import { SPLINTING_PTP_EDITS } from '../medicare-ptp';
import { LegacyProcedureFields, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber, selectedSide } from '../structured-fields';

const SPLINT_REGION = {
  LongArm: 'long arm',
  Forearm: 'forearm',
  Finger: 'finger',
  LongLeg: 'long leg',
  ShortLeg: 'short leg',
  Thorax: 'thorax',
  Shoulder: 'shoulder',
  ElbowWrist: 'elbow/wrist',
  Hip: 'hip',
  Knee: 'knee',
  AnkleFoot: 'ankle/foot',
  UnnaBoot: 'Unna boot',
  LowBack: 'low back',
} as const;

const SPLINTING_CODES = {
  LongArmSplint: '29105',
  StaticForearmSplint: '29125',
  StaticFingerSplint: '29130',
  LongLegSplint: '29505',
  ShortLegSplint: '29515',
  ThoraxStrapping: '29200',
  ShoulderStrapping: '29240',
  ElbowOrWristStrapping: '29260',
  HipStrapping: '29520',
  KneeStrapping: '29530',
  AnkleOrFootStrapping: '29540',
  UnnaBoot: '29580',
  DynamicForearmSplint: '29126',
  DynamicFingerSplint: '29131',
} as const;

const SPLINT_CARE = {
  Initial: 'initial stabilization',
  // The supplied scope includes medically necessary replacement during/after follow-up.
  // CPT guideline reproduced by KZA (2015); this is not established by NCCI's initial-care paragraphs alone.
  // https://www.kzanow.com/coding-coaches/are-cast-re-applications-included-in-the-global-period
  Replacement: 'replacement during/after follow-up',
  Definitive: 'definitive fracture care',
  Dressing: 'dressing after a procedure',
} as const;

type SplintingCode = (typeof SPLINTING_CODES)[keyof typeof SPLINTING_CODES];

const fields: readonly CodingField[] = [
  {
    key: 'device',
    neededForCoding: true,
    label: 'Device',
    kind: 'select',
    options: ['splint', 'strap', 'cast', 'prefabricated orthotic'],
  },
  {
    key: 'region',
    neededForCoding: true,
    label: 'Body region',
    kind: 'select',
    options: Object.values(SPLINT_REGION),
  },
  {
    key: 'mobility',
    label: 'Splint mobility',
    kind: 'select',
    options: ['static', 'dynamic'],
    defaultValue: 'static',
    visible: (facts) => facts.device === 'splint',
  },
  {
    key: 'care',
    label: 'Care context',
    kind: 'select',
    options: Object.values(SPLINT_CARE),
    defaultValue: SPLINT_CARE.Initial,
  },
  {
    key: 'fabricated',
    label: 'Fabricated from raw materials',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.device === 'splint',
  },
  { key: 'sameAreaSurgery', label: 'Same-area surgery', kind: 'checkbox', defaultValue: false },
  {
    key: 'side',
    neededForCoding: (facts) => facts.region !== SPLINT_REGION.Thorax,
    label: 'Side',
    kind: 'select',
    options: ['left', 'right', 'both'],
    defaultValue: undefined,
  },
  {
    key: 'count',
    neededForCoding: true,
    label: 'Fingers treated',
    kind: 'number',
    defaultValue: 1,
    min: 0,
    step: 1,
    visible: (facts) => facts.region === SPLINT_REGION.Finger,
  },
];

// Code inventories are constants local to this family; they are not an interpreted rule language.
const splints: Partial<Record<string, SplintingCode>> = {
  [SPLINT_REGION.LongArm]: SPLINTING_CODES.LongArmSplint,
  [SPLINT_REGION.Forearm]: SPLINTING_CODES.StaticForearmSplint,
  [SPLINT_REGION.Finger]: SPLINTING_CODES.StaticFingerSplint,
  [SPLINT_REGION.LongLeg]: SPLINTING_CODES.LongLegSplint,
  [SPLINT_REGION.ShortLeg]: SPLINTING_CODES.ShortLegSplint,
};

const straps: Partial<Record<string, SplintingCode>> = {
  [SPLINT_REGION.Thorax]: SPLINTING_CODES.ThoraxStrapping,
  [SPLINT_REGION.Shoulder]: SPLINTING_CODES.ShoulderStrapping,
  [SPLINT_REGION.ElbowWrist]: SPLINTING_CODES.ElbowOrWristStrapping,
  [SPLINT_REGION.Hip]: SPLINTING_CODES.HipStrapping,
  [SPLINT_REGION.Knee]: SPLINTING_CODES.KneeStrapping,
  [SPLINT_REGION.AnkleFoot]: SPLINTING_CODES.AnkleOrFootStrapping,
  [SPLINT_REGION.UnnaBoot]: SPLINTING_CODES.UnnaBoot,
};

export const splintingFamily: ProcedureFamilyModel<SplintingCode> = {
  codePairEdits: SPLINTING_PTP_EDITS,
  capturesSite: true,
  capturesSide: true,
  id: 'splinting',
  procedureNames: PROCEDURE_NAMES['splinting'],
  displayName: 'Splint/strap application',
  fields,
  codes: Object.values(SPLINTING_CODES),
  suggest: (facts) => {
    if (facts.device === 'cast') return coder('Cast application requires a different procedure code.');

    if (facts.device === 'prefabricated orthotic')
      return noCode('Prefabricated-device application has no separate application code.');

    // NCCI permits separately reported initial stabilization when definitive fracture care is not furnished.
    if (facts.care === SPLINT_CARE.Definitive)
      return coder('Use the definitive fracture-treatment code; initial splint application is included.');

    // NCCI IV §G.2: a dressing after a procedure is included in that procedure.
    if (facts.care === SPLINT_CARE.Dressing)
      return noCode('Dressing application is included in the preceding procedure.');

    if (facts.sameAreaSurgery || (facts.device === 'splint' && !facts.fabricated))
      return noCode('Application is included in surgery or uses a prefabricated device.');

    if (!facts.device || !facts.region) return missing('Device', 'Body region');

    const region = String(facts.region);

    if (facts.device === 'strap' && region === SPLINT_REGION.LowBack)
      return noCode('Low-back strapping is not a covered application code.');

    let cpt: SplintingCode | undefined = (facts.device === 'splint' ? splints : straps)[region];

    if (facts.device === 'splint' && facts.mobility === 'dynamic') {
      if (region === SPLINT_REGION.Forearm) cpt = SPLINTING_CODES.DynamicForearmSplint;
      else if (region === SPLINT_REGION.Finger) cpt = SPLINTING_CODES.DynamicFingerSplint;
      else return coder('Dynamic application outside forearm/finger codes.');
    }

    if (!cpt) return coder('This device and body region require another code.');

    const count = region === SPLINT_REGION.Finger ? readNumber(facts, 'count') : 1;

    if (!count || !Number.isInteger(count)) return missing('Fingers treated');

    if (!facts.side && region !== SPLINT_REGION.Thorax) return missing('Side');

    return buildEvaluation({
      suggestions: [
        {
          code: cpt,
          display: 'Application of splint or strapping',
          justification: `Documented device, body region and ${facts.care}.`,
          units: count,
          modifiers: lateralityModifiers(facts.side),
        },
      ],
    });
  },
  dailyLimits: {
    [SPLINTING_CODES.LongArmSplint]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.StaticForearmSplint]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.DynamicForearmSplint]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.StaticFingerSplint]: { maxUnits: 3, adjudicationIndicator: MueAdjudication.DateOfServiceClinical },
    [SPLINTING_CODES.DynamicFingerSplint]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [SPLINTING_CODES.ThoraxStrapping]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.ShoulderStrapping]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.ElbowOrWristStrapping]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [SPLINTING_CODES.LongLegSplint]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.ShortLegSplint]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.HipStrapping]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.KneeStrapping]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.AnkleOrFootStrapping]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [SPLINTING_CODES.UnnaBoot]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
  },
  documentationChecklist: (facts) => [
    'Record condition, region/side, device, materials and static/dynamic construction when applicable.',
    'Record initial stabilization/referral or replacement context, who applied the device and applicable order/supervision.',
    'Record post-application neurovascular findings, supplies and follow-up instructions.',
    ...(facts.region === SPLINT_REGION.Finger
      ? ['Identify each finger treated and the applicable digit modifier.']
      : []),
    ...(facts.region === SPLINT_REGION.UnnaBoot ? ['State the indication for compression.'] : []),
  ],
  readLegacyFacts: (input: LegacyProcedureFields) => {
    const regions: Partial<Record<string, string>> = {
      'Short Arm Splint': SPLINT_REGION.Forearm,
      'Long Arm Splint': SPLINT_REGION.LongArm,
      'Finger Splint': SPLINT_REGION.Finger,
      'Short Leg Splint': SPLINT_REGION.ShortLeg,
      'Long Leg Splint': SPLINT_REGION.LongLeg,
    };
    const matched = (input.technique ?? []).filter((option) => regions[option]);

    // Sugar-tong names deliberately do not decide the region: this remains the provider's choice.
    return {
      side: selectedSide(input),
      region: matched.length === 1 ? regions[matched[0]] : undefined,
      device: matched.length ? 'splint' : input.technique?.includes('Strapping') ? 'strap' : undefined,
      fabricated: input.suppliesUsed?.some((option) => option === 'Fiberglass' || option === 'Plaster') ?? false,
    };
  },
};
