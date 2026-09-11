/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS NCCI 2026 Chapter V §C.5; CPT 2026 30901/30903/30905/30906 descriptors.
 * Original, Ch.V: "Control of bleeding is an integral component of endoscopic procedures, and is not separately reportable."
 * https://www.cms.gov/files/document/05-chapter5-ncci-medicare-policy-manual-2026-final.pdf
 */
import { buildEvaluation, coder, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { NASAL_PACKING_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField } from '../structured-fields';

const NASAL_PACKING_CODES = {
  LimitedAnteriorControl: '30901',
  ExtensiveAnteriorControl: '30903',
  InitialPosteriorControl: '30905',
  RepeatPosteriorControl: '30906',
} as const;
type NasalPackingCode = (typeof NASAL_PACKING_CODES)[keyof typeof NASAL_PACKING_CODES];

const fields: readonly CodingField[] = [
  {
    key: 'leftEffort',
    label: 'Left anterior treatment',
    kind: 'select',
    options: ['none', 'temporary pledget only', 'limited', 'extensive'],
    helperText:
      'Limited: cautery or retained packing. Extensive: failed initial control, repeated cautery or layered/deeper packing; a tampon alone is limited.',
    // Most nosebleeds are one-sided, so "none" is the ordinary answer for the untreated side.
    defaultValue: 'none',
  },
  {
    key: 'rightEffort',
    label: 'Right anterior treatment',
    kind: 'select',
    options: ['none', 'temporary pledget only', 'limited', 'extensive'],
    helperText:
      'Limited: cautery or retained packing. Extensive: failed initial control, repeated cautery or layered/deeper packing; a tampon alone is limited.',
    // Most nosebleeds are one-sided, so "none" is the ordinary answer for the untreated side.
    defaultValue: 'none',
  },
  {
    key: 'posterior',
    label: 'Posterior treatment',
    kind: 'select',
    options: ['none', 'first', 'repeat'],
    defaultValue: 'none',
  },
  {
    key: 'posteriorSide',
    label: 'Posterior side',
    visible: (facts) => facts.posterior !== undefined && facts.posterior !== 'none',
    kind: 'select',
    options: ['left', 'right', 'both'],
  },
  {
    key: 'procedureCaused',
    label: 'Bleeding caused by another nasal procedure',
    kind: 'checkbox',
    defaultValue: false,
  },
  {
    key: 'endoscope',
    label: 'Bleeding control required an endoscope (not visualization alone)',
    kind: 'checkbox',
    defaultValue: false,
  },
];

export const nasalPackingFamily: ProcedureFamilyModel<NasalPackingCode> = {
  codePairEdits: NASAL_PACKING_PTP_EDITS,
  capturesSite: true,
  capturesSide: true,
  id: 'nasal-packing',
  procedureNames: PROCEDURE_NAMES['nasal-packing'],
  displayName: 'Nosebleed control',
  fields,
  codes: Object.values(NASAL_PACKING_CODES),
  suggest: (facts) => {
    // NCCI Ch.V: control during the causative procedure is included; endoscopic control has its own pathway.
    if (facts.procedureCaused) return noCode('Bleeding control is included in the procedure that caused it.');

    if (facts.endoscope) return coder('Endoscopic bleeding control needs a different procedure code.');

    const lines: CodeSuggestion[] = [];

    if (facts.posterior !== 'none') {
      if (!facts.posteriorSide) return missing('Posterior side');

      // Posterior control includes same-side anterior work; posterior codes do not take bilateral 50.
      lines.push({
        code:
          facts.posterior === 'repeat'
            ? NASAL_PACKING_CODES.RepeatPosteriorControl
            : NASAL_PACKING_CODES.InitialPosteriorControl,
        display: 'Control of posterior nasal hemorrhage',
        justification: 'Posterior source treated.',
        units: 1,
        modifiers: [],
      });
    }

    for (const { side, effortField } of [
      { side: 'left', effortField: 'leftEffort' },
      { side: 'right', effortField: 'rightEffort' },
    ] as const) {
      if (facts.posterior !== 'none' && (facts.posteriorSide === side || facts.posteriorSide === 'both')) continue;

      const effort = facts[effortField];

      if (effort === 'none' || effort === 'temporary pledget only') continue;

      // Adopted product policy (2026-09-06): failed initial control, repeated cautery or layered/deeper packing
      // establishes extensive effort. A nasal tampon alone remains limited; the device name never determines it.
      //
      // 30901/30903/30905 are NCCI PTP pairs, so a second line needs a distinct-service modifier alongside
      // its laterality or it denies. Laterality alone does not override the edit.
      lines.push({
        code:
          effort === 'extensive'
            ? NASAL_PACKING_CODES.ExtensiveAnteriorControl
            : NASAL_PACKING_CODES.LimitedAnteriorControl,
        display: 'Control of anterior nasal hemorrhage',
        justification: `${side}: ${effort} control.`,
        units: 1,
        modifiers: [
          side === 'left' ? CPT_MODIFIERS.LeftSide : CPT_MODIFIERS.RightSide,
          ...(lines.length ? [CPT_MODIFIERS.DistinctService] : []),
        ],
      });
    }

    if (
      lines.length === 2 &&
      lines[0].code === lines[1].code &&
      (lines[0].code === NASAL_PACKING_CODES.LimitedAnteriorControl ||
        lines[0].code === NASAL_PACKING_CODES.ExtensiveAnteriorControl)
    )
      return buildEvaluation({
        suggestions: [
          {
            code: lines[0].code,
            display: lines[0].display,
            justification: 'Bilateral anterior control.',
            units: 1,
            modifiers: [CPT_MODIFIERS.Bilateral],
          },
        ],
      });

    return lines.length
      ? buildEvaluation({ suggestions: lines })
      : noCode('No separately coded cautery or retained packing documented.');
  },
  dailyLimits: {
    [NASAL_PACKING_CODES.LimitedAnteriorControl]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [NASAL_PACKING_CODES.ExtensiveAnteriorControl]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [NASAL_PACKING_CODES.InitialPosteriorControl]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [NASAL_PACKING_CODES.RepeatPosteriorControl]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  documentationChecklist: (facts) => [
    'Record bleeding source and side, cautery/packing method and materials, whether packing remained in place, control achieved and follow-up.',
    ...(facts.leftEffort === 'extensive' || facts.rightEffort === 'extensive'
      ? [
          'Describe failed initial control, repeated cautery or layered/deeper packing; a tampon or balloon alone does not establish extensive treatment.',
        ]
      : []),
    ...(facts.posterior === 'repeat'
      ? ['Reference prior control of the same posterior bleed and describe recurrence and repeat treatment.']
      : []),
  ],
};
