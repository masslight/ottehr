import { SentencePicks } from 'src/components/SuggestedSentences';
import { plainDose } from 'utils/lib/helpers/medications/plain-dose';
import {
  doseUnitLabel,
  frequencyForDosesPerDay,
  isCombinationProduct,
  PRESCRIPTION_FREQUENCIES,
  prescriptionDirectionsText,
  prescriptionDispense,
  prescriptionDoseUnit,
  prescriptionFrequency,
  prescriptionQuantityUnit,
  prescriptionRoute,
  prescriptionVerb,
  ROUTES_IN_VERB,
  SuggestedPrescriptionFields,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import {
  assembleSentence,
  isSentenceBlank,
  SentenceBlank,
  SentenceSegment,
} from 'utils/lib/helpers/suggested-sentences';
import { MedicationSearchDrug, MedicationSearchResult } from 'utils/lib/types/api/erx-search.types';
import {
  PrescriptionQuickPickData,
  PrescriptionQuickPickDosing,
  PrescriptionSetQuickPickData,
} from 'utils/lib/types/api/quick-picks.types';
import { ErxSuggestionRow } from './ErxSuggestionsBox';
import {
  applyPrescriptionQuickPick,
  calculatorDoseNote,
  CalculatorDosing,
  COMBINATION_MESSAGE,
  emptyPrescriptionLine,
  lineMaximumOf,
  measureOf,
  mgPerMeasure,
  NO_DETAILS_MESSAGE,
  PrescriptionLine,
  quickPickProduct,
  withAdditionalInstructions,
  withSuggestion,
} from './prescriptionLines';

/** One suggested prescription: the sentence as it reads, and what "+" writes into the line. */
export interface PrescriptionSuggestionRow extends ErxSuggestionRow {
  /** The line's fields with the row's blanks as picked. */
  fill: (picks: SentencePicks) => SuggestedPrescriptionFields;
  /** The line with the row used. */
  apply: (line: PrescriptionLine, picks: SentencePicks) => PrescriptionLine;
  /** The calculator after the dose blank opens with these settings. */
  calculator?: CalculatorDosing;
  /** A set's row: the set, and its quick pick the row is for; "+" adds the set's other quick picks on new lines. */
  fromSet?: { set: PrescriptionSetQuickPickData; memberId: string };
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
  /** The practice's Active prescription sets. */
  sets?: PrescriptionSetQuickPickData[];
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
 * left to enter, with a note: which ingredient to dose by is the provider's pick in the calculator. */
const dosedRow = (
  quickPick: PrescriptionQuickPickData,
  dosing: PrescriptionQuickPickDosing,
  id: string,
  medication: MedicationSearchResult,
  weightKg: number | undefined
): PrescriptionSuggestionRow => {
  const measure = measureOf(medication);
  // No route the product's dose form doesn't give: the provider fills it.
  const route = prescriptionRoute(medication);
  const unit = prescriptionDoseUnit(medication);
  const combination = isCombinationProduct(medication);
  // A product saved before the search gave its details (an older quick pick's) has no strength to dose by.
  const noDetails = !medication.ingredients?.length;
  const frequency =
    dosing.frequency && prescriptionFrequency(dosing.frequency)
      ? dosing.frequency
      : dosing.dosesPerDay !== undefined
      ? frequencyForDosesPerDay(dosing.dosesPerDay)
      : undefined;
  const { frequency: _frequency, durationDays, ...calculator } = dosing;
  const savedDosesPerDay = dosing.dosesPerDay ?? prescriptionFrequency(frequency)?.dosesPerDay;
  const doseOf = (settings: CalculatorDosing, dosesPerDay: number | undefined): ReturnType<typeof plainDose> =>
    measure && plainDose({ ...settings, weightKg, mgPerMeasure: mgPerMeasure(medication), measure, dosesPerDay });
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
      ...(!doseText && !combination && !noDetails && dosing.basis !== 'fixed' && !weightKg
        ? { placeholder: '(enter weight)' }
        : {}),
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
    const where = !route || ROUTES_IN_VERB.includes(route) ? '' : ` ${route}`;
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
    if (noDetails) return [NO_DETAILS_MESSAGE];
    if (combination) return [COMBINATION_MESSAGE];
    const { dose } = dosingFor(picks[frequencyAt]);
    return dose ? [dose.working, ...(dose.roundingNote ? [dose.roundingNote] : [])] : undefined;
  };
  const fill = (picks: SentencePicks): SuggestedPrescriptionFields => {
    const directions = {
      route: route ?? ('' as const),
      dose: picks[doseAt] ?? doseTextOf(picks) ?? '',
      frequency: picks[frequencyAt] ?? frequency ?? '',
      durationDays: picks[durationAt] ?? days ?? '',
      steps: [],
      instructions: '',
    };
    return {
      ...directions,
      ...prescriptionDispense(medication, directions),
      quantityUnit: quickPick.quantityUnit ?? prescriptionQuantityUnit(medication) ?? '',
      numberOfRefills: String(quickPick.numberOfRefills ?? 0),
      patientInstructions: withAdditionalInstructions(
        prescriptionDirectionsText(medication, directions),
        quickPick.additionalInstructions
      ),
    };
  };
  return {
    id,
    segments: segmentsFor([]),
    segmentsFor,
    quickPickName: quickPick.name,
    quickPickSource: quickPick.source,
    doseAt,
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
      if (typed) return { ...filled, maximum };
      const { settings, dose } = dosingFor(picks[frequencyAt]);
      // The working behind the dose's ⓘ, with the quick pick it is from.
      const doseNotes = dose && [calculatorDoseNote(dose, { name: quickPick.name, source: quickPick.source })];
      return { ...filled, dosing: settings, maximum, ...(doseNotes ? { doseNotes } : {}) };
    },
  };
};

/** The set's quick picks that still exist, in its order, and how many of its ids no longer do. */
export const prescriptionSetMembers = (
  set: PrescriptionSetQuickPickData,
  quickPicks: PrescriptionQuickPickData[]
): { members: PrescriptionQuickPickData[]; missing: number } => {
  const members = set.memberIds.flatMap((memberId) => quickPicks.find((quickPick) => quickPick.id === memberId) ?? []);
  return { members, missing: set.memberIds.length - members.length };
};

/** "1 prescription in this set no longer exists." */
export const missingSetMembersText = (missing: number): string =>
  missing === 1
    ? '1 prescription in this set no longer exists.'
    : `${missing} prescriptions in this set no longer exist.`;

const rowFor = (
  quickPick: PrescriptionQuickPickData,
  id: string,
  medication: MedicationSearchResult,
  weightKg: number | undefined
): PrescriptionSuggestionRow =>
  quickPick.dosing ? dosedRow(quickPick, quickPick.dosing, id, medication, weightKg) : savedRow(quickPick, id);

/** Another quick pick of a set as its row would read for its own product: "Ibuprofen 100 mg/5ml Susp. Take 5 mL by
 * mouth every 6 hours as needed for 5 days." */
const alsoAddsText = (quickPick: PrescriptionQuickPickData, weightKg: number | undefined): string => {
  const { medicationDescription } = quickPick;
  const product = quickPickProduct(quickPick);
  const segments = product
    ? rowFor(quickPick, '', product, weightKg).segments
    : [quickPick.patientInstructions || 'No directions saved.'];
  const sentence = assembleSentence(
    segments.map((segment) =>
      isSentenceBlank(segment) && segment.initial === undefined ? { ...segment, initial: segment.placeholder } : segment
    ),
    []
  );
  return `Also adds: ${medicationDescription ?? quickPick.name}. ${
    /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
  }`;
};

/** The suggestions for a product: the practice's quick picks for exactly this product and its Active sets with one,
 * up to `QUICK_PICK_SUGGESTIONS` together in the list's order (by name); the box adds "Other" (Write my own). A
 * set's row is its quick pick for the product, named for the set, with what else it adds. Where more suggestion data
 * plugs in. */
export const prescriptionSuggestionsFor = ({
  medication,
  weightKg,
  quickPicks = [],
  sets = [],
}: PrescriptionSuggestionQuery): PrescriptionSuggestionRow[] => {
  const single = quickPicks
    .filter((quickPick) => isQuickPickFor(quickPick, medication))
    .map((quickPick, i) => ({
      name: quickPick.name,
      row: rowFor(quickPick, `quick-pick-${quickPick.id ?? i}`, medication, weightKg),
    }));
  const fromSets = sets.flatMap((set) => {
    const { members } = prescriptionSetMembers(set, quickPicks);
    const at = members.findIndex((quickPick) => isQuickPickFor(quickPick, medication));
    const member = members[at];
    if (!member?.id) return [];
    const row: PrescriptionSuggestionRow = {
      ...rowFor(member, `set-${set.id}`, medication, weightKg),
      setName: set.name,
      setSize: members.length,
      details: members.filter((_, i) => i !== at).map((other) => alsoAddsText(other, weightKg)),
      fromSet: { set, memberId: member.id },
    };
    return [{ name: set.name, row }];
  });
  // Each set goes in by name among the quick picks, which keep the list's order.
  return fromSets
    .reduce((rows, entry) => {
      const at = rows.findIndex((other) => other.name.localeCompare(entry.name) > 0);
      return at < 0 ? [...rows, entry] : [...rows.slice(0, at), entry, ...rows.slice(at)];
    }, single)
    .slice(0, QUICK_PICK_SUGGESTIONS)
    .map(({ row }) => row);
};

/** The lines a set puts where `line` is. Picked from the "+ quick pick" list, an empty line takes its first quick pick
 * and the rest follow on new lines; a line that holds something stays as it is, all of them following it. Used from
 * a suggestion row, the line is as the row made it and the set's other quick picks follow. Each is as if picked from
 * the list itself; a quick pick that no longer exists is left out and counted. */
export const withPrescriptionSet = (
  line: PrescriptionLine,
  set: PrescriptionSetQuickPickData,
  quickPicks: PrescriptionQuickPickData[],
  weightKg: number | undefined,
  used?: { line: PrescriptionLine; memberId: string }
): { lines: PrescriptionLine[]; missing: number } => {
  const { members, missing } = prescriptionSetMembers(set, quickPicks);
  const added = (quickPick: PrescriptionQuickPickData): PrescriptionLine =>
    withListedQuickPick(emptyPrescriptionLine(), quickPick, weightKg);
  if (used) {
    const at = members.findIndex((quickPick) => quickPick.id === used.memberId);
    return { lines: [used.line, ...members.filter((_, i) => i !== at).map(added)], missing };
  }
  if (isEmptyPrescriptionLine(line) && members.length) {
    const [first, ...rest] = members;
    return { lines: [withListedQuickPick(line, first, weightKg), ...rest.map(added)], missing };
  }
  return { lines: [line, ...members.map(added)], missing };
};

/** No medication picked yet. */
export const isEmptyPrescriptionLine = (line: PrescriptionLine): boolean => !line.drug && !line.medication;

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
