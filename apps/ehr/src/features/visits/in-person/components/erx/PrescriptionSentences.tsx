import { Close } from '@mui/icons-material';
import {
  Alert,
  AlertColor,
  Autocomplete,
  Box,
  Button,
  FormHelperText,
  IconButton,
  Link,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import ReportIssueDialog from 'src/components/dialogs/ReportIssueDialog';
import { SentencePicks } from 'src/components/SuggestedSentences';
import { useIcd10SearchInput } from 'src/features/admin/patient-education/useIcd10SearchInput';
import { useApiClients } from 'src/hooks/useAppClients';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  doseUnitLabel,
  PRESCRIPTION_FREQUENCIES,
  PRESCRIPTION_ROUTES,
  prescriptionDoseUnit,
  PrescriptionRoute,
  PrescriptionStep,
  prescriptionVerb,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { MedicationSearchDrug } from 'utils/lib/types/api/erx-search.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData, PrescriptionSetQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { useSearchMedications } from '../../../shared/hooks/useErxSearch';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';
import { BlankButton, PopoverBlank, SelectBlank, Sentence, TextBlank } from '../procedures/narrative/InlineBlanks';
import { DoseCalculator } from './DoseCalculator';
import { DoseInfoHover, DoseWarningBoxes, SourceText } from './DoseCalculatorCard';
import { DoseCalculatorAsWritten } from './DoseCalculatorPopup';
import { ErxSuggestionsBox } from './ErxSuggestionsBox';
import {
  DoseNote,
  emptyPrescriptionStep,
  maximumOriginText,
  maximumWarnings,
  pickedStrength,
  PrescriptionLine,
  withCalculatorDosing,
  withDirections,
  withDrug,
  withProduct,
} from './prescriptionLines';
import {
  isEmptyPrescriptionLine,
  prescriptionSetMembers,
  PrescriptionSuggestionRow,
  prescriptionSuggestionsFor,
} from './prescriptionSuggestions';
import { VisitWeight } from './useVisitWeight';

/** Units that read the same for any amount ("20 each", not "20 eachs"). */
const UNCOUNTED_UNITS: readonly QuantityUnit[] = ['Each', 'Gum', 'Unspecified'];

/** "Capsule" → "Capsules" unless the quantity is exactly 1. Display only: the order sends the NCPDP term as is. */
const unitLabel = (unit: QuantityUnit, quantity: string): string =>
  Number(quantity) === 1 || UNCOUNTED_UNITS.includes(unit)
    ? unit
    : /(s|x|ch|sh)$/.test(unit)
    ? `${unit}es`
    : `${unit}s`;

const SUBSTITUTION_OPTIONS = [
  { value: 'allowed', label: 'allowed' },
  { value: 'not allowed', label: 'not allowed (dispense as written)' },
];

/** The line's last link for admins, worded as the Quick Picks menu on other pages. */
export const ADD_QUICK_PICK_LABEL = '+ Add Quick Pick';

const SEARCH_UNAVAILABLE = 'Medication search is unavailable.';

/** The small "×" after a part of the sentence that takes it away. */
const RemoveButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <IconButton size="small" aria-label={label} onClick={onClick} sx={{ p: '2px', ml: '2px' }}>
    <Close sx={{ fontSize: 16 }} />
  </IconButton>
);

/** A failed search's way to tell the development team: the visit's own Report Issue dialog. */
const ReportSearchIssue: FC = () => {
  const { oystehr } = useApiClients();
  const { patient, appointment, encounter, location } = useAppointmentData();
  const [open, setOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const [toastType, setToastType] = useState<AlertColor>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  return (
    <>
      <FormHelperText error>
        {SEARCH_UNAVAILABLE}{' '}
        {encounter && (
          <Link component="button" type="button" onClick={() => setOpen(true)}>
            Report an issue
          </Link>
        )}
      </FormHelperText>
      {encounter && (
        <ReportIssueDialog
          open={open}
          handleClose={() => setOpen(false)}
          oystehr={oystehr}
          patient={patient}
          appointment={appointment}
          encounter={encounter}
          locationId={location?.id}
          setToastMessage={setToastMessage}
          setToastType={setToastType}
          setSnackbarOpen={setSnackbarOpen}
        />
      )}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={toastType} onClose={() => setSnackbarOpen(false)}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

/** The drug search: also the quick pick admin's product search, at its dialog's width. */
export const MedicationSearch: FC<{ onPick: (drug: MedicationSearchDrug) => void; width?: number | string }> = ({
  onPick,
  width = 360,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { debounce } = useDebounce(300);
  const { data: drugs = [], isFetching, isError } = useSearchMedications(debouncedQuery);
  return (
    <Box sx={{ width, pt: 0.5 }}>
      <Autocomplete<MedicationSearchDrug>
        options={drugs}
        loading={isFetching}
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.name}
        inputValue={query}
        onInputChange={(_event, value) => {
          setQuery(value);
          debounce(() => setDebouncedQuery(value));
        }}
        value={null}
        onChange={(_event, option) => option && onPick(option)}
        noOptionsText={
          query.trim().length < 2
            ? 'Type to search medications'
            : isError
            ? SEARCH_UNAVAILABLE
            : 'Nothing found for this search criteria'
        }
        renderInput={(params) => <TextField {...params} size="small" label="Medication" />}
      />
      {isError && <ReportSearchIssue />}
    </Box>
  );
};

/** A suggestion row's dose blank: type the dose, Enter or "Use" picks it. */
const DoseEntry: FC<{ initial?: string; onPick: (dose: string) => void }> = ({ initial, onPick }) => {
  const [dose, setDose] = useState(initial ?? '');
  const valid = Number(dose) > 0;
  return (
    <Box
      component="form"
      sx={{ display: 'flex', gap: 1, alignItems: 'center', pt: 0.5 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onPick(dose);
      }}
    >
      <TextField
        size="small"
        type="number"
        label="Dose"
        value={dose}
        onChange={(event) => setDose(event.target.value)}
        inputProps={{ min: 0, step: 0.5 }}
        sx={{ width: 120 }}
      />
      <Button type="submit" size="small" disabled={!valid}>
        Use
      </Button>
    </Box>
  );
};

interface DiagnosisOption {
  code: string;
  display: string;
  group: 'Visit diagnoses' | 'Search results';
}

/** The visit's diagnoses first (filtered by what's typed), then ICD-10 search results not already among them. */
const DiagnosisSearch: FC<{
  visitDiagnoses: IcdSearchResponse['codes'];
  onPick: (diagnosis: { code: string; display: string }) => void;
}> = ({ visitDiagnoses, onPick }) => {
  const { inputValue: search, setInputValue: setSearch, options: searchResults, isFetching } = useIcd10SearchInput();
  const query = search.trim().toLowerCase();
  const options: DiagnosisOption[] = [
    ...visitDiagnoses
      .filter(
        (diagnosis, i) =>
          visitDiagnoses.findIndex((other) => other.code === diagnosis.code) === i &&
          `${diagnosis.code} ${diagnosis.display}`.toLowerCase().includes(query)
      )
      .map((diagnosis) => ({ code: diagnosis.code, display: diagnosis.display, group: 'Visit diagnoses' as const })),
    ...(query
      ? searchResults
          .filter((result) => !visitDiagnoses.some((diagnosis) => diagnosis.code === result.code))
          .map((result) => ({ code: result.code, display: result.display, group: 'Search results' as const }))
      : []),
  ];
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
      <Autocomplete<DiagnosisOption>
        options={options}
        loading={isFetching}
        filterOptions={(items) => items}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => `${option.code} - ${option.display}`}
        inputValue={search}
        onInputChange={(_event, value, reason) => {
          if (reason === 'input' || reason === 'clear') setSearch(reason === 'input' ? value : '');
        }}
        value={null}
        onChange={(_event, option) => option && onPick({ code: option.code, display: option.display })}
        openOnFocus
        noOptionsText={search ? 'No diagnoses found' : 'Start typing to search for a diagnosis'}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            label="Diagnosis"
            placeholder="Select a visit diagnosis or type to search"
          />
        )}
      />
    </Box>
  );
};

/** A row of the line's medication menu. */
type MedicationMenuOption =
  | { kind: 'set'; set: PrescriptionSetQuickPickData; members: PrescriptionQuickPickData[] }
  // Nested: under the medication whose strength it orders.
  | { kind: 'quickPick'; quickPick: PrescriptionQuickPickData; nested?: boolean }
  | { kind: 'drug'; drug: MedicationSearchDrug }
  | { kind: 'searching' }
  | { kind: 'more' };

/** How many sets and how many quick picks the medication menu lists before anything is typed. */
const MEDICATION_MENU_LIMIT = 10;
const MORE_TEXT = 'Type to search more quick picks and medications';
const SEARCHING_TEXT = 'Searching medications…';

const medicationMenuLabel = (option: MedicationMenuOption): string =>
  option.kind === 'set'
    ? option.set.name
    : option.kind === 'quickPick'
    ? option.quickPick.name
    : option.kind === 'drug'
    ? option.drug.name
    : option.kind === 'searching'
    ? SEARCHING_TEXT
    : MORE_TEXT;

const medicationMenuKey = (option: MedicationMenuOption): string =>
  option.kind === 'set'
    ? `set-${option.set.id}`
    : option.kind === 'quickPick'
    ? `quick-pick-${option.quickPick.id ?? option.quickPick.name}`
    : option.kind === 'drug'
    ? `drug-${option.drug.name}`
    : option.kind;

/** The menu's rows. Before anything is typed: the first sets, then the first quick picks, and a row saying to type
 * for more. Typed: the sets matching by name or by a quick pick's name or product; then each medication the search
 * found, with the quick picks ordering one of its strengths (by NDC) under it; then the quick picks matching by name
 * or product that are under none. While the search runs, a row holds the medications' place. */
const medicationMenuOptions = ({
  typed,
  sets,
  quickPicks,
  drugs,
  searching,
}: {
  typed: string;
  sets: PrescriptionSetQuickPickData[];
  quickPicks: PrescriptionQuickPickData[];
  /** Absent until there is a search's answer to show. */
  drugs?: MedicationSearchDrug[];
  searching: boolean;
}): MedicationMenuOption[] => {
  const setOptions = sets.map((set) => ({
    kind: 'set' as const,
    set,
    members: prescriptionSetMembers(set, quickPicks).members,
  }));
  const query = typed.trim().toLowerCase();
  if (!query) {
    const more = sets.length > MEDICATION_MENU_LIMIT || quickPicks.length > MEDICATION_MENU_LIMIT;
    return [
      ...setOptions.slice(0, MEDICATION_MENU_LIMIT),
      ...quickPicks.slice(0, MEDICATION_MENU_LIMIT).map((quickPick) => ({ kind: 'quickPick' as const, quickPick })),
      ...(more ? [{ kind: 'more' as const }] : []),
    ];
  }
  const matches = (quickPick: PrescriptionQuickPickData): boolean =>
    [quickPick.name, quickPick.medicationDescription].some((text) => text?.toLowerCase().includes(query));
  const underDrugs = new Set<PrescriptionQuickPickData>();
  const drugRows = searching
    ? []
    : (drugs ?? []).flatMap((drug) => {
        const ndcs = new Set(drug.strengths.flatMap((strength) => strength.ndcs));
        const nested = quickPicks.filter(
          (quickPick) => !underDrugs.has(quickPick) && quickPick.ndc !== undefined && ndcs.has(quickPick.ndc)
        );
        nested.forEach((quickPick) => underDrugs.add(quickPick));
        return [
          { kind: 'drug' as const, drug },
          ...nested.map((quickPick) => ({ kind: 'quickPick' as const, quickPick, nested: true })),
        ];
      });
  return [
    ...setOptions.filter(
      ({ set, members }) => set.name.toLowerCase().includes(query) || members.some((member) => matches(member))
    ),
    ...(searching ? [{ kind: 'searching' as const }] : drugRows),
    ...quickPicks
      .filter((quickPick) => !underDrugs.has(quickPick) && matches(quickPick))
      .map((quickPick) => ({ kind: 'quickPick' as const, quickPick })),
  ];
};

/** The line's one medication menu: the practice's sets and quick picks with the medication search's results. */
const MedicationMenu: FC<{
  quickPicks: PrescriptionQuickPickData[];
  sets: PrescriptionSetQuickPickData[];
  onDrug: (drug: MedicationSearchDrug) => void;
  onQuickPick: (quickPick: PrescriptionQuickPickData) => void;
  onSet: (set: PrescriptionSetQuickPickData) => void;
}> = ({ quickPicks, sets, onDrug, onQuickPick, onSet }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { debounce } = useDebounce(300);
  const { data: drugs, isFetching, isError } = useSearchMedications(debouncedQuery);
  // The search needs two characters.
  const searched = query.trim().length >= 2;
  const options = medicationMenuOptions({
    typed: query,
    sets,
    quickPicks,
    drugs: searched ? drugs : undefined,
    searching: searched && isFetching,
  });
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
      <Autocomplete<MedicationMenuOption>
        options={options}
        filterOptions={(items) => items}
        getOptionLabel={medicationMenuLabel}
        getOptionKey={medicationMenuKey}
        getOptionDisabled={(option) => option.kind === 'more' || option.kind === 'searching'}
        renderOption={(props, option) => (
          <li {...props}>
            {option.kind === 'more' || option.kind === 'searching' ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {medicationMenuLabel(option)}
              </Typography>
            ) : option.kind === 'drug' ? (
              option.drug.name
            ) : (
              <Box sx={option.kind === 'quickPick' && option.nested ? { pl: 2 } : undefined}>
                {option.kind === 'set' && (
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    Set:{' '}
                  </Box>
                )}
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {medicationMenuLabel(option)}
                </Box>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {option.kind === 'set'
                    ? `${option.members.length} ${option.members.length === 1 ? 'prescription' : 'prescriptions'}`
                    : option.quickPick.medicationDescription}
                </Typography>
              </Box>
            )}
          </li>
        )}
        inputValue={query}
        onInputChange={(_event, value, reason) => {
          if (reason !== 'input' && reason !== 'clear') return;
          const next = reason === 'input' ? value : '';
          setQuery(next);
          debounce(() => setDebouncedQuery(next));
        }}
        value={null}
        onChange={(_event, option) => {
          if (option?.kind === 'set') onSet(option.set);
          else if (option?.kind === 'quickPick') onQuickPick(option.quickPick);
          else if (option?.kind === 'drug') onDrug(option.drug);
        }}
        openOnFocus
        noOptionsText={
          query.trim().length < 2
            ? 'Type to search medications'
            : isError
            ? SEARCH_UNAVAILABLE
            : 'Nothing found for this search criteria'
        }
        renderInput={(params) => (
          <TextField {...params} size="small" label="Medication" placeholder="Select a quick pick or type to search" />
        )}
      />
      {isError && <ReportSearchIssue />}
    </Box>
  );
};

interface PrescriptionSentencesProps {
  line: PrescriptionLine;
  index: number;
  onChange: (next: PrescriptionLine) => void;
  /** Absent for the only line: there is always one prescription to fill. */
  onRemove?: () => void;
  quickPicks: PrescriptionQuickPickData[];
  onQuickPick: (quickPick: PrescriptionQuickPickData) => void;
  /** The practice's prescription sets: the Active ones are listed above the quick picks in the medication menu and suggested with them.
   * Inactive ones wait for review in Admin. */
  sets?: PrescriptionSetQuickPickData[];
  /** A set picked from the medication menu, or `used` from its suggestion row (the line as the row made it, and its quick pick
   * the row was for). */
  onSet?: (set: PrescriptionSetQuickPickData, used?: { line: PrescriptionLine; memberId: string }) => void;
  /** Admins save the line as a quick pick; absent for everyone else. */
  onSaveQuickPick?: () => void;
  /** The chart's diagnoses, listed first in the line's diagnosis search. */
  visitDiagnoses: IcdSearchResponse['codes'];
  /** The vitals weight, which works out weight-based doses. */
  weightKg?: number;
  /** "using weight 18 kg (previous visit, …)" when the suggestions use an earlier visit's weight. */
  weightNote?: string;
  /** The dose calculator's weight: the vitals', or one typed in any line's calculator, which the page keeps. */
  weight?: VisitWeight;
  weightText?: string;
  onWeightText?: (value: string | undefined) => void;
  /** Shown once a send has been tried. */
  errors: string[];
  readOnly: boolean;
}

/** One prescription as sentences: what, for what, how to take it, how much, and whether it may be substituted. */
export const PrescriptionSentences: FC<PrescriptionSentencesProps> = ({
  line,
  index,
  onChange,
  onRemove,
  quickPicks,
  onQuickPick,
  sets,
  onSet,
  onSaveQuickPick,
  visitDiagnoses,
  weightKg,
  weightNote,
  weight,
  weightText,
  onWeightText = () => undefined,
  errors,
  readOnly,
}) => {
  const update = (patch: Partial<PrescriptionLine>): void => onChange({ ...line, ...patch });
  const description = line.medication?.description;
  const { medication } = line;
  const activeSets = useMemo(() => sets?.filter((set) => set.status === 'Active') ?? [], [sets]);
  // A new rows array resets the picks inside the suggestions box, so it changes only with the product, weight, quick
  // picks or sets.
  const suggestions = useMemo(
    () => (medication ? prescriptionSuggestionsFor({ medication, weightKg, quickPicks, sets: activeSets }) : []),
    [medication, weightKg, quickPicks, activeSets]
  );
  // The directions and dispense blanks wait for a pick among the suggestions (or "Other"), unless the line opens
  // with directions (a quick pick, an edited line). A new medication or strength hides them again until a pick,
  // whatever directions the line carries over. A product with no suggestions has nothing to pick: its line opens
  // straight away.
  const [picked, setPicked] = useState(false);
  const [awaitingPick, setAwaitingPick] = useState(false);
  const hasDirections =
    line.steps.length > 0 ||
    [line.dose, line.frequency, line.durationDays, line.patientInstructions].some((value) => value.trim() !== '');
  if (!picked && (readOnly || (hasDirections && !awaitingPick))) setPicked(true);
  const revealed = picked || (line.medication !== null && suggestions.length === 0);
  const changeProduct = (next: PrescriptionLine): void => {
    const changed = next.medication?.ndc !== line.medication?.ndc;
    if (changed) {
      setPicked(false);
      setAwaitingPick(true);
    }
    // The send check sees the hidden line as unfinished.
    onChange(changed ? { ...next, awaitingPick: true } : next);
  };
  // Shown again (a pick, a quick pick): it can be sent once complete.
  useEffect(() => {
    if (revealed && line.awaitingPick) onChange({ ...line, awaitingPick: false });
  }, [revealed, line, onChange]);
  const reveal = (): void => {
    setPicked(true);
    setAwaitingPick(false);
  };
  /** A row is "In use" when using it would change none of the line's quantity, days supply and directions, and the
   * line has one of them: on an empty line a row that fills none (a quick pick saved without them) still shows its
   * "+", which then sets its refills, substitution and note. */
  const matches = (suggestion: PrescriptionSuggestionRow, picks: SentencePicks): boolean => {
    const filled = suggestion.fill(picks);
    const empty = [line.quantityValue, line.daysSupply, line.patientInstructions].every((value) => value.trim() === '');
    return (
      !empty &&
      line.quantityValue.trim() === filled.quantityValue &&
      (filled.quantityUnit === '' || line.quantityUnit === filled.quantityUnit) &&
      line.daysSupply.trim() === filled.daysSupply &&
      line.patientInstructions.trim() === filled.patientInstructions
    );
  };
  const strength = pickedStrength(line);
  const doseUnit = prescriptionDoseUnit(line.medication);
  // The instructions blank is offered as a link, like "+ urgent", and stays once opened or written in.
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const instructionsShown = instructionsOpen || line.instructions !== '';
  // Ends the line's last sentence; not while the line is hidden awaiting a pick: it would save directions no one has
  // seen.
  const saveLink = onSaveQuickPick && !readOnly && !(awaitingPick && !revealed) && (
    <>
      {' '}
      <BlankButton label={ADD_QUICK_PICK_LABEL} ghost readOnly={readOnly} onClick={onSaveQuickPick} />
    </>
  );
  const setSteps = (steps: PrescriptionStep[]): void => onChange(withDirections(line, { steps }));
  // A dose over the maximum the line carries: orange under the dose sentence, its blank outlined; never blocks.
  const warnings = maximumWarnings(line);
  const warns = (blank: 'dose' | 'frequency'): boolean => warnings.some((warning) => warning.blank === blank);
  const maximumFrom = line.maximum?.from;
  const warningInfo: ReactNode[] = maximumFrom
    ? [
        maximumOriginText(maximumFrom),
        ...(maximumFrom !== 'calculator' && maximumFrom.source
          ? [<SourceText key="source" source={maximumFrom.source} />]
          : []),
      ]
    : [];

  /** Shown while the step's dose is as the calculator worked it out or a strength change re-measured it: an ⓘ with
   * how, and the quick pick (with its source) whose dosing it is. */
  const doseInfo = (step: PrescriptionStep, at: string, doseNote: DoseNote | undefined): ReactNode =>
    doseNote &&
    doseNote.dose === step.dose &&
    (doseNote.working ? (
      <DoseInfoHover
        label={`How the ${at}dose was worked out`}
        lines={[
          doseNote.working,
          ...(doseNote.text ? [doseNote.text] : []),
          ...(doseNote.capNote ? [doseNote.capNote] : []),
          ...(doseNote.quickPick
            ? [
                `From the quick pick: ${doseNote.quickPick.name}`,
                ...(doseNote.quickPick.source ? [<SourceText key="source" source={doseNote.quickPick.source} />] : []),
              ]
            : []),
        ]}
        testId={`${at}dose-working-note`}
      />
    ) : (
      <DoseInfoHover label={`${at}dose re-measured`} lines={[doseNote.text]} testId={`${at}dose-note`} />
    ));

  /** The dose, frequency and duration blanks of one step; `at` names the step in later steps' labels, and the
   * route blank sits between the first step's dose and frequency. */
  const stepBlanks = (
    step: PrescriptionStep,
    at: string,
    onStep: (patch: Partial<PrescriptionStep>) => void,
    doseNote: DoseNote | undefined,
    route?: ReactNode
  ): ReactNode => (
    <>
      <TextBlank
        label={`${at}dose`}
        // The calculator's settings by weight wait for one, as a quick pick's suggestion row does.
        placeholder={
          at === '' && line.dosing && line.dosing.basis !== 'fixed' && !weightKg && !step.dose
            ? '(enter weight)'
            : undefined
        }
        kind="number"
        value={step.dose}
        onChange={(dose) => onStep({ dose })}
        readOnly={readOnly}
        min={0}
        step={0.5}
        warn={at === '' && warns('dose')}
      />
      {doseUnit && ` ${doseUnitLabel(doseUnit, Number(step.dose) || undefined)}`}
      {/* A later step's ⓘ follows its dose; the first step's leads its sentence, by the calculator. */}
      {at !== '' && doseInfo(step, at, doseNote)} {route}
      <SelectBlank
        label={`${at}frequency`}
        title="Frequency"
        options={Object.keys(PRESCRIPTION_FREQUENCIES)}
        value={step.frequency || undefined}
        onChange={(value) => onStep({ frequency: value ?? '' })}
        readOnly={readOnly}
        warn={at === '' && warns('frequency')}
      />{' '}
      for{' '}
      <TextBlank
        label={`${at}duration`}
        placeholder="days"
        kind="number"
        value={step.durationDays}
        onChange={(durationDays) => onStep({ durationDays })}
        readOnly={readOnly}
        min={1}
      />{' '}
      {Number(step.durationDays) === 1 ? 'day' : 'days'}
    </>
  );

  /** What ends the last step's sentence: the instructions once wanted, then the "+ then" and "+ instructions" links. */
  const courseEnd = (
    <>
      {instructionsShown ? (
        <>
          ,{' '}
          <TextBlank
            label="instructions"
            value={line.instructions}
            onChange={(instructions) => onChange(withDirections(line, { instructions }))}
            readOnly={readOnly}
          />
          .
          {!readOnly && (
            <RemoveButton
              label="Remove instructions"
              onClick={() => {
                setInstructionsOpen(false);
                onChange(withDirections(line, { instructions: '' }));
              }}
            />
          )}
        </>
      ) : (
        '.'
      )}
      {/* A dosed quick pick's additional instructions follow the sentence as the directions write them, removed as the
          instructions are. */}
      {line.additionalInstructions !== undefined && (
        <>
          {' '}
          <TextBlank
            label="additional instructions"
            multiline
            value={line.additionalInstructions}
            onChange={(additionalInstructions) => onChange(withDirections(line, { additionalInstructions }))}
            readOnly={readOnly}
          />
          {!readOnly && (
            <RemoveButton
              label="Remove additional instructions"
              onClick={() => onChange(withDirections(line, { additionalInstructions: undefined }))}
            />
          )}
        </>
      )}
      {!readOnly && (
        <>
          {' '}
          <BlankButton
            label="+ then"
            ghost
            readOnly={readOnly}
            onClick={() => setSteps([...line.steps, emptyPrescriptionStep()])}
          />
          {!instructionsShown && (
            <>
              {' '}
              <BlankButton label="+ instructions" ghost readOnly={readOnly} onClick={() => setInstructionsOpen(true)} />
            </>
          )}
        </>
      )}
    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* The suggestions sit above the line's first sentence once a medication with any is picked; "Other" is last. */}
      {!readOnly && line.medication && suggestions.length > 0 && (
        <ErxSuggestionsBox<PrescriptionSuggestionRow>
          rows={suggestions}
          weightNote={weightNote}
          isAdded={matches}
          renderPicker={(row, blank, pick) =>
            // A row's dose blank is typed in.
            row.doseAt !== undefined && row.segments[row.doseAt] === blank ? (
              <DoseEntry initial={blank.initial} onPick={pick} />
            ) : undefined
          }
          // A quick pick with dosing opens the calculator with its settings; "Use this dose" uses the row with that
          // dose. A quick pick saved as written shows the icon disabled, its hover saying so, so the rows line up.
          renderDoseTool={(row, picks) =>
            row.calculator ? (
              <DoseCalculator
                line={row.apply(line, picks)}
                initial={row.calculator}
                label={`Dose calculator for ${row.quickPickName ?? 'this suggestion'}`}
                weight={weight}
                weightText={weightText}
                onWeightText={onWeightText}
                onChange={(next) => {
                  reveal();
                  onChange(next);
                }}
              />
            ) : (
              <DoseCalculatorAsWritten
                quickPickName={row.quickPickName ?? 'This suggestion'}
                label={`Dose calculator for ${row.quickPickName ?? 'this suggestion'}`}
              />
            )
          }
          onPick={(suggestion, picks) => {
            reveal();
            const used = suggestion.apply(line, picks);
            if (suggestion.fromSet && onSet)
              onSet(suggestion.fromSet.set, { line: used, memberId: suggestion.fromSet.memberId });
            else onChange(used);
          }}
          onOther={reveal}
        />
      )}

      <Sentence onRemove={onRemove} removeLabel={`Remove prescription ${index + 1}`}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          Prescription {index + 1}:
        </Box>{' '}
        <PopoverBlank
          label="medication"
          title="Medication"
          // The menu's own field says "Medication".
          hideTitle
          value={line.drug?.name ?? description}
          need
          readOnly={readOnly}
        >
          {(close) => (
            <MedicationMenu
              quickPicks={quickPicks}
              sets={activeSets}
              onDrug={(drug) => {
                changeProduct(withDrug(line, drug));
                close();
              }}
              onQuickPick={(quickPick) => {
                // A quick pick's directions are picked ones: they show.
                setAwaitingPick(false);
                onQuickPick(quickPick);
                close();
              }}
              onSet={(set) => {
                // An empty line takes the set's first quick pick, whose directions show as a picked quick pick's do.
                if (isEmptyPrescriptionLine(line)) setAwaitingPick(false);
                onSet?.(set);
                close();
              }}
            />
          )}
        </PopoverBlank>{' '}
        {line.drug && (
          <>
            <SelectBlank
              label="strength"
              title="Strength"
              // A product name ("250 mg/5ml Susp"), shown as the list spells it rather than lower-cased for prose.
              verbatim
              options={line.drug.strengths.map((option) => option.strength)}
              value={strength?.strength}
              onChange={(value) => {
                const next = line.drug?.strengths.find((option) => option.strength === value);
                if (line.drug && next) changeProduct(withProduct(line, line.drug, next));
              }}
              readOnly={readOnly}
              need
            />{' '}
          </>
        )}
        for {/* A chosen diagnosis stays a blank: clicking it searches again to swap it. */}
        <PopoverBlank
          label={line.diagnosis ? 'diagnosis' : 'add diagnosis'}
          title="Diagnosis"
          // The search's own field says "Diagnosis".
          hideTitle
          value={line.diagnosis ? `${line.diagnosis.display} ${line.diagnosis.code}` : undefined}
          readOnly={readOnly}
        >
          {(close) => (
            <DiagnosisSearch
              visitDiagnoses={visitDiagnoses}
              onPick={(diagnosis) => {
                update({ diagnosis });
                close();
              }}
            />
          )}
        </PopoverBlank>
        {line.diagnosis && !readOnly && (
          <RemoveButton label={`Remove ${line.diagnosis.code}`} onClick={() => update({ diagnosis: null })} />
        )}
        .{!revealed && saveLink}
      </Sentence>

      {/* The blanks behind the directions: each change rewrites the Directions box unless the provider typed there.
          A taper adds "then" steps, each a sentence of its own; the route on the first applies to all. */}
      {revealed && (
        <>
          <Sentence>
            {/* The calculator works out the first step's dose, so it and the dose's ⓘ start the sentence; a course's
                steps come from its look once there is data. */}
            {!readOnly && (
              <DoseCalculator
                line={line}
                // The rule the line holds (a suggestion's or "Use this dose"'s), as a suggestion row's is.
                initial={line.dosing}
                weight={weight}
                weightText={weightText}
                onWeightText={onWeightText}
                onChange={onChange}
              />
            )}
            {doseInfo(line, '', line.doseNotes?.[0])}
            {prescriptionVerb(line.route)}{' '}
            {stepBlanks(
              line,
              '',
              (patch) => onChange(withDirections(withCalculatorDosing(line, patch, weightKg), patch)),
              line.doseNotes?.[0],
              <>
                <SelectBlank
                  label="route"
                  title="Route"
                  options={PRESCRIPTION_ROUTES}
                  value={line.route || undefined}
                  onChange={(value) =>
                    onChange(withDirections(line, { route: (value as PrescriptionRoute | undefined) ?? '' }))
                  }
                  readOnly={readOnly}
                  need
                />{' '}
              </>
            )}
            {line.steps.length === 0 ? courseEnd : '.'}
          </Sentence>
          <DoseWarningBoxes warnings={warnings.map((warning) => warning.text)} info={warningInfo} />
          {line.steps.map((step, i) => (
            <Sentence
              key={i}
              onRemove={readOnly ? undefined : () => setSteps(line.steps.filter((_, j) => j !== i))}
              removeLabel={`Remove step ${i + 2}`}
            >
              then{' '}
              {stepBlanks(
                step,
                `step ${i + 2} `,
                (patch) => setSteps(line.steps.map((other, j) => (j === i ? { ...other, ...patch } : other))),
                line.doseNotes?.[i + 1]
              )}
              {i === line.steps.length - 1 ? courseEnd : '.'}
            </Sentence>
          ))}
          <Sentence muted>
            Dispense{' '}
            <TextBlank
              label="quantity"
              kind="number"
              value={line.quantityValue}
              onChange={(quantityValue) => update({ quantityValue })}
              readOnly={readOnly}
              need
              min={0}
              step={0.001}
            />{' '}
            <SelectBlank
              label="unit"
              title="Unit"
              options={QUANTITY_UNITS.map((unit) => ({ value: unit, label: unitLabel(unit, line.quantityValue) }))}
              value={line.quantityUnit || undefined}
              onChange={(value) => update({ quantityUnit: (value as QuantityUnit | undefined) ?? '' })}
              readOnly={readOnly}
              need
            />
            ,{' '}
            <TextBlank
              label="days supply"
              placeholder="days"
              kind="number"
              value={line.daysSupply}
              onChange={(daysSupply) => update({ daysSupply })}
              readOnly={readOnly}
              min={1}
            />
            -day supply,{' '}
            <TextBlank
              label="refills"
              kind="number"
              value={line.numberOfRefills}
              onChange={(numberOfRefills) => update({ numberOfRefills })}
              readOnly={readOnly}
              need
              min={0}
            />{' '}
            refills.
          </Sentence>

          <Sentence>
            Directions:{' '}
            <TextBlank
              label="directions"
              width="480px"
              multiline
              value={line.patientInstructions}
              onChange={(patientInstructions) => update({ patientInstructions })}
              readOnly={readOnly}
              need
            />
          </Sentence>

          <Sentence>
            Note to pharmacy:{' '}
            <TextBlank
              label="note to pharmacy"
              width="520px"
              placeholder="optional"
              value={line.noteToPharmacy}
              onChange={(noteToPharmacy) => update({ noteToPharmacy })}
              readOnly={readOnly}
            />
          </Sentence>

          <Sentence>
            Substitution{' '}
            <SelectBlank
              label="substitution"
              title="Substitution"
              options={SUBSTITUTION_OPTIONS}
              value={line.substitutionAllowed ? 'allowed' : 'not allowed'}
              onChange={(value) => value && update({ substitutionAllowed: value === 'allowed' })}
              readOnly={readOnly}
            />
            .{/* Urgent is offered only when wanted: a grey link until clicked. */}
            {line.urgent ? (
              <>
                {' '}
                Urgent:{' '}
                <Box component="span" sx={{ fontWeight: 700 }}>
                  yes
                </Box>
                {!readOnly && <RemoveButton label="Remove urgent" onClick={() => update({ urgent: false })} />}
              </>
            ) : (
              !readOnly && (
                <>
                  {' '}
                  <BlankButton label="+ urgent" ghost readOnly={readOnly} onClick={() => update({ urgent: true })} />
                </>
              )
            )}
            {saveLink}
          </Sentence>
        </>
      )}

      {errors.length > 0 && (
        <FormHelperText error sx={{ mt: '-8px' }}>
          {errors.join('. ')}.
        </FormHelperText>
      )}
    </Box>
  );
};
