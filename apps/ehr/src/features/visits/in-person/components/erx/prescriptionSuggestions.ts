import { SentencePicks } from 'src/components/SuggestedSentences';
import { plainDose } from 'utils/lib/helpers/medications/plain-dose';
import {
  doseUnitLabel,
  frequencyForDosesPerDay,
  isCombinationStrength,
  PRESCRIPTION_FREQUENCIES,
  prescriptionDirectionsText,
  prescriptionDispense,
  prescriptionDoseForm,
  prescriptionDoseUnit,
  prescriptionFrequency,
  prescriptionQuantityUnit,
  prescriptionRoute,
  prescriptionVerb,
  ROUTES_IN_VERB,
  SuggestedPrescriptionFields,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { SentenceBlank, SentenceSegment } from 'utils/lib/helpers/suggested-sentences';
import { MedicationSearchDrug, MedicationSearchResult } from 'utils/lib/types/api/erx-search.types';
import { PrescriptionQuickPickData, PrescriptionQuickPickDosing } from 'utils/lib/types/api/quick-picks.types';
import { ErxSuggestionRow } from '../erx-looks/ErxSuggestionsBox';
import {
  applyPrescriptionQuickPick,
  CalculatorDosing,
  COMBINATION_MESSAGE,
  lineMaximumOf,
  MEASURE_OF,
  mgPerMeasure,
  PrescriptionLine,
  withSuggestion,
} from './prescriptionLines';

/** One suggested prescription: the sentence as it reads, and what "+" writes into the line. */
export interface PrescriptionSuggestionRow extends ErxSuggestionRow {
  /** The line's fields with the row's blanks as picked. */
  fill: (picks: SentencePicks) => SuggestedPrescriptionFields;
  /** Where a blank that picks the diagnosis by search sits ("— for [acute otitis media]"). Its value, as
   * "Display CODE", goes on the line with the row; an empty one leaves the line's. */
  diagnosisAt?: number;
  /** The line with the row used, in place of `withSuggestion` with its fields (a quick pick's row). */
  apply?: (line: PrescriptionLine, picks: SentencePicks) => PrescriptionLine;
  /** The calculator after the dose blank opens with these settings. */
  calculator?: CalculatorDosing;
}

/** What the suggestions are chosen by. */
export interface PrescriptionSuggestionQuery {
  drug: MedicationSearchDrug | null;
  medication: MedicationSearchResult;
  ageMonths?: number;
  weightKg?: number;
  /** The line's own diagnosis code, then the visit's, primary first. */
  diagnosisCodes: string[];
  /** The practice's prescription quick picks, as the list has them. */
  quickPicks?: PrescriptionQuickPickData[];
}

/** How many of the product's quick picks the box shows, before "Other". */
export const QUICK_PICK_SUGGESTIONS = 3;

/** The day counts a duration blank offers. */
const DURATION_DAYS = ['3', '5', '7', '10', '14', '30'];

/** A quick pick is for this product when its NDC is the product's, or, without NDCs on both, its description is. */
export const isQuickPickFor = (quickPick: PrescriptionQuickPickData, medication: MedicationSearchResult): boolean =>
  quickPick.ndc && medication.ndc
    ? quickPick.ndc === medication.ndc
    : quickPick.medicationDescription !== undefined && quickPick.medicationDescription === medication.description;

/** The quick pick on the line as it would be from the quick pick list, keeping the line's product (and so its drug
 * and strength blanks). */
const withQuickPick = (line: PrescriptionLine, quickPick: PrescriptionQuickPickData): PrescriptionLine =>
  applyPrescriptionQuickPick(line, { ...quickPick, ndc: undefined, medicationDescription: undefined });

/** A quick pick without the calculator's settings: its saved directions as written, and "+" uses it as the quick
 * pick list does. */
const savedRow = (quickPick: PrescriptionQuickPickData, id: string): PrescriptionSuggestionRow => ({
  id,
  segments: [quickPick.patientInstructions || 'No directions saved.'],
  quickPickName: quickPick.name,
  quickPickSource: quickPick.source,
  fill: () => ({
    route: '',
    dose: '',
    frequency: '',
    durationDays: '',
    steps: [],
    instructions: '',
    quantityValue: quickPick.quantityValue === undefined ? '' : String(quickPick.quantityValue),
    quantityUnit: quickPick.quantityUnit ?? '',
    daysSupply: quickPick.daysSupply === undefined ? '' : String(quickPick.daysSupply),
    numberOfRefills: String(quickPick.numberOfRefills ?? 0),
    patientInstructions: quickPick.patientInstructions ?? '',
  }),
  apply: (line) => withQuickPick(line, quickPick),
});

/** A quick pick saved from the calculator, re-dosed for this patient's weight by the same calculator: "Take [6] mL by
 * mouth [twice daily] for [10] days." with every blank editable, and the working behind the ⓘ. Without a weight the
 * dose blank waits ("(enter weight)"); a dose typed into it is the provider's, so the line keeps no settings. A
 * frequency picked on the row does as on the line (`withCalculatorDosing`): another count of doses a day keeps the
 * rate and basis with the new count, and by mg/kg/day the dose is worked out again. A combination product's dose is
 * left to enter, with a note (pending dabrams). */
const dosedRow = (
  quickPick: PrescriptionQuickPickData,
  dosing: PrescriptionQuickPickDosing,
  id: string,
  medication: MedicationSearchResult,
  weightKg: number | undefined
): PrescriptionSuggestionRow & Required<Pick<PrescriptionSuggestionRow, 'apply'>> => {
  const { description } = medication;
  const form = prescriptionDoseForm(description);
  const measure = form && MEASURE_OF[form];
  const route = prescriptionRoute(description) ?? 'by mouth';
  const unit = prescriptionDoseUnit(form, route, description);
  const combination = isCombinationStrength(description);
  const frequency =
    dosing.frequency && prescriptionFrequency(dosing.frequency)
      ? dosing.frequency
      : dosing.dosesPerDay !== undefined
      ? frequencyForDosesPerDay(dosing.dosesPerDay)
      : undefined;
  const { frequency: _frequency, durationDays, ...calculator } = dosing;
  const savedDosesPerDay = dosing.dosesPerDay ?? prescriptionFrequency(frequency)?.dosesPerDay;
  const doseOf = (settings: CalculatorDosing, dosesPerDay: number | undefined): ReturnType<typeof plainDose> =>
    measure &&
    plainDose({
      weightKg,
      mgPerMeasure: mgPerMeasure(description),
      measure,
      basis: settings.basis,
      rate: settings.rate,
      dosesPerDay,
      maxPerDoseMg: settings.maxPerDoseMg,
      maxPerDayMg: settings.maxPerDayMg,
    });
  const savedDose = doseOf(calculator, savedDosesPerDay);
  /** The settings and the dose for the frequency picked on the row, as `withCalculatorDosing` has them on the line. */
  const dosingFor = (
    picked: string | undefined
  ): { settings: CalculatorDosing; dose: ReturnType<typeof plainDose> } => {
    const dosesPerDay = picked === undefined ? undefined : prescriptionFrequency(picked)?.dosesPerDay;
    if (dosesPerDay === undefined || dosesPerDay === savedDosesPerDay) return { settings: calculator, dose: savedDose };
    const settings = { ...calculator, dosesPerDay };
    return { settings, dose: settings.basis === 'mg/kg/day' ? doseOf(settings, dosesPerDay) : savedDose };
  };
  const [doseAt, frequencyAt, durationAt] = [1, 3, 5];
  const doseTextOf = (picks: SentencePicks): string | undefined => {
    const { dose } = dosingFor(picks[frequencyAt]);
    return dose ? String(dose.amount) : undefined;
  };
  const days = durationDays === undefined ? undefined : String(durationDays);
  const segmentsFor = (picks: SentencePicks): SentenceSegment[] => {
    const { dose } = dosingFor(picks[frequencyAt]);
    const doseText = dose ? String(dose.amount) : undefined;
    const doseBlank: SentenceBlank = {
      title: 'Dose',
      options: [],
      initial: doseText,
      ...(!doseText && !combination && dosing.basis !== 'fixed' && !weightKg ? { placeholder: '(enter weight)' } : {}),
    };
    const frequencyBlank: SentenceBlank = {
      title: 'Frequency',
      options: Object.keys(PRESCRIPTION_FREQUENCIES),
      initial: frequency,
    };
    const durationBlank: SentenceBlank = {
      title: 'Duration',
      options: days === undefined || DURATION_DAYS.includes(days) ? DURATION_DAYS : [...DURATION_DAYS, days],
      initial: days,
      optional: true,
      placeholder: '#',
    };
    const where = ROUTES_IN_VERB.includes(route) ? '' : ` ${route}`;
    return [
      `${prescriptionVerb(route)} `,
      doseBlank,
      `${unit ? ` ${doseUnitLabel(unit, dose?.amount)}` : ''}${where} `,
      frequencyBlank,
      ' for ',
      durationBlank,
      ' days.',
    ];
  };
  const doseInfoFor = (picks: SentencePicks): string[] | undefined => {
    if (combination) return [COMBINATION_MESSAGE];
    const { dose } = dosingFor(picks[frequencyAt]);
    return dose ? [dose.working, ...(dose.roundingNote ? [dose.roundingNote] : [])] : undefined;
  };
  const fill = (picks: SentencePicks): SuggestedPrescriptionFields => {
    const directions = {
      route,
      dose: picks[doseAt] ?? doseTextOf(picks) ?? '',
      frequency: picks[frequencyAt] ?? frequency ?? '',
      durationDays: picks[durationAt] ?? days ?? '',
      steps: [],
      instructions: '',
    };
    return {
      ...directions,
      ...prescriptionDispense(description, directions),
      quantityUnit: quickPick.quantityUnit ?? prescriptionQuantityUnit(description) ?? '',
      numberOfRefills: String(quickPick.numberOfRefills ?? 0),
      patientInstructions: prescriptionDirectionsText(description, directions),
    };
  };
  return {
    id,
    segments: segmentsFor([]),
    segmentsFor,
    quickPickName: quickPick.name,
    quickPickSource: quickPick.source,
    doseAt,
    doseInfo: doseInfoFor([]),
    doseInfoFor,
    calculator,
    fill,
    apply: (line, picks) => {
      const filled = withSuggestion(withQuickPick(line, quickPick), fill(picks));
      // The calculator's dose keeps its settings on the line, as does its blank waiting for a weight; a dose typed into
      // the row is the provider's own (a combination product's always is: it has no dose of the calculator's).
      const typed = picks[doseAt] !== undefined && picks[doseAt] !== doseTextOf(picks);
      // Its maximum stays either way, for the warnings.
      const maximum = lineMaximumOf(calculator, { quickPick: quickPick.name, source: quickPick.source });
      return typed ? { ...filled, maximum } : { ...filled, dosing: dosingFor(picks[frequencyAt]).settings, maximum };
    },
  };
};

/** The suggestions for a product: the practice's quick picks for exactly this product, up to
 * `QUICK_PICK_SUGGESTIONS` in the list's order; the box adds "Other" (Write my own). Where more suggestion data
 * plugs in. */
export const prescriptionSuggestionsFor = ({
  medication,
  weightKg,
  quickPicks = [],
}: PrescriptionSuggestionQuery): PrescriptionSuggestionRow[] =>
  quickPicks
    .filter((quickPick) => isQuickPickFor(quickPick, medication))
    .slice(0, QUICK_PICK_SUGGESTIONS)
    .map((quickPick, i) => {
      const id = `quick-pick-${quickPick.id ?? i}`;
      return quickPick.dosing
        ? dosedRow(quickPick, quickPick.dosing, id, medication, weightKg)
        : savedRow(quickPick, id);
    });

/** A quick pick chosen from the "+ quick pick" list: one saved from the calculator is re-dosed for this patient's
 * weight exactly as its suggestion row is (no weight: the dose waits, the settings stay); one without, as saved. */
export const withListedQuickPick = (
  line: PrescriptionLine,
  quickPick: PrescriptionQuickPickData,
  weightKg: number | undefined
): PrescriptionLine => {
  const applied = applyPrescriptionQuickPick(line, quickPick);
  return quickPick.dosing && applied.medication
    ? dosedRow(quickPick, quickPick.dosing, '', applied.medication, weightKg).apply(applied, [])
    : applied;
};
