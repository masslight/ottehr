import { Close } from '@mui/icons-material';
import {
  Alert,
  AlertColor,
  Autocomplete,
  Box,
  FormHelperText,
  IconButton,
  Link,
  Snackbar,
  TextField,
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
  prescriptionDoseForm,
  prescriptionDoseUnit,
  PrescriptionRoute,
  PrescriptionStep,
  prescriptionVerb,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';
import { MedicationSearchDrug } from 'utils/lib/types/api/erx-search.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { useSearchMedications } from '../../../shared/hooks/useErxSearch';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';
import { ErxSuggestionsBox } from '../erx-looks/ErxSuggestionsBox';
import { BlankButton, PopoverBlank, SelectBlank, Sentence, TextBlank } from '../procedures/narrative/InlineBlanks';
import {
  defaultStrength,
  emptyPrescriptionStep,
  pickedStrength,
  PrescriptionLine,
  prescriptionQuickPickLabel,
  withDirections,
  withProduct,
  withSuggestion,
} from './prescriptionLines';
import { PrescriptionSuggestionRow, prescriptionSuggestionsFor } from './prescriptionSuggestions';

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

/** The quick pick list's first entry for admins, worded as the Quick Picks menu on other pages. */
const ADD_QUICK_PICK = '__add-quick-pick__';
export const ADD_QUICK_PICK_LABEL = '+ Add or Update Quick Pick';

const SEARCH_UNAVAILABLE = 'Medication search is unavailable.';

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

const MedicationSearch: FC<{ onPick: (drug: MedicationSearchDrug) => void }> = ({ onPick }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { debounce } = useDebounce(300);
  const { data: drugs = [], isFetching, isError } = useSearchMedications(debouncedQuery);
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
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

type Diagnosis = { code: string; display: string };

/** A diagnosis as a blank holds it, worded as the line's diagnosis blank reads: "Croup J05.0". */
const diagnosisText = ({ code, display }: Diagnosis): string => `${display} ${code}`;
const diagnosisOfText = (text: string): Diagnosis => {
  const at = text.lastIndexOf(' ');
  return { code: text.slice(at + 1), display: text.slice(0, at) };
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

interface PrescriptionSentencesProps {
  line: PrescriptionLine;
  index: number;
  onChange: (next: PrescriptionLine) => void;
  /** Absent for the only line: there is always one prescription to fill. */
  onRemove?: () => void;
  quickPicks: PrescriptionQuickPickData[];
  onQuickPick: (quickPick: PrescriptionQuickPickData) => void;
  /** Admins save the line as a quick pick; absent for everyone else. */
  onSaveQuickPick?: () => void;
  /** The chart's diagnoses; the primary one leads the suggestions when the line has no diagnosis of its own. */
  visitDiagnoses: (IcdSearchResponse['codes'][number] & { isPrimary?: boolean })[];
  /** The patient's age at the visit, which picks a drug's starting strength. */
  patientAgeYears?: number;
  /** The age in months and the vitals weight, which pick the suggestions and work out weight-based doses. */
  patientAgeMonths?: number;
  weightKg?: number;
  /** "using weight 18 kg (previous visit, …)" when the suggestions use an earlier visit's weight. */
  weightNote?: string;
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
  onSaveQuickPick,
  visitDiagnoses,
  patientAgeYears,
  patientAgeMonths,
  weightKg,
  weightNote,
  errors,
  readOnly,
}) => {
  const update = (patch: Partial<PrescriptionLine>): void => onChange({ ...line, ...patch });
  const description = line.medication?.description;
  const { drug, medication } = line;
  // The line's own diagnosis, then the visit's, primary first, as one string: a re-rendered list with the same codes
  // is the same key.
  const diagnosisCodesKey = [
    ...(line.diagnosis ? [line.diagnosis.code] : []),
    ...[...visitDiagnoses]
      .sort((a, b) => Number(b.isPrimary ?? false) - Number(a.isPrimary ?? false))
      .map((diagnosis) => diagnosis.code),
  ].join(' ');
  // A new rows array resets the picks inside the suggestions box, so it changes only with the product, patient or
  // diagnoses.
  const suggestions = useMemo(
    () =>
      medication
        ? prescriptionSuggestionsFor({
            drug,
            medication,
            ageMonths: patientAgeMonths,
            weightKg,
            diagnosisCodes: diagnosisCodesKey.split(' ').filter(Boolean),
          })
        : [],
    [drug, medication, patientAgeMonths, weightKg, diagnosisCodesKey]
  );
  // The directions and dispense blanks wait for a pick among the suggestions (or "Other"), unless the line opens
  // with directions (a quick pick, an edited line). A new medication or strength hides them again until a pick,
  // whatever directions the line carries over.
  const [revealed, setRevealed] = useState(false);
  const [awaitingPick, setAwaitingPick] = useState(false);
  const hasDirections =
    line.steps.length > 0 ||
    [line.dose, line.frequency, line.durationDays, line.patientInstructions].some((value) => value.trim() !== '');
  if (!revealed && (readOnly || (hasDirections && !awaitingPick))) setRevealed(true);
  const changeProduct = (next: PrescriptionLine): void => {
    const changed = next.medication?.ndc !== line.medication?.ndc;
    if (changed) {
      setRevealed(false);
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
    setRevealed(true);
    setAwaitingPick(false);
  };
  const matches = (suggestion: PrescriptionSuggestionRow, picks: SentencePicks): boolean => {
    const filled = suggestion.fill(picks);
    return (
      line.quantityValue.trim() === filled.quantityValue &&
      (filled.quantityUnit === '' || line.quantityUnit === filled.quantityUnit) &&
      line.daysSupply.trim() === filled.daysSupply &&
      line.patientInstructions.trim() === filled.patientInstructions
    );
  };
  const strength = pickedStrength(line);
  const doseUnit = prescriptionDoseUnit(prescriptionDoseForm(description ?? ''), line.route || undefined, description);
  // The instructions blank is offered as a link, like "+ urgent", and stays once opened or written in.
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const instructionsShown = instructionsOpen || line.instructions !== '';
  const setSteps = (steps: PrescriptionStep[]): void => onChange(withDirections(line, { steps }));

  /** The dose, frequency and duration blanks of one step; `at` names the step in later steps' labels, and the
   * route blank sits between the first step's dose and frequency. */
  const stepBlanks = (
    step: PrescriptionStep,
    at: string,
    onStep: (patch: Partial<PrescriptionStep>) => void,
    route?: ReactNode
  ): ReactNode => (
    <>
      <TextBlank
        label={`${at}dose`}
        kind="number"
        value={step.dose}
        onChange={(dose) => onStep({ dose })}
        readOnly={readOnly}
        min={0}
        step={0.5}
      />
      {doseUnit && ` ${doseUnitLabel(doseUnit, Number(step.dose) || undefined)}`} {route}
      <SelectBlank
        label={`${at}frequency`}
        title="Frequency"
        options={Object.keys(PRESCRIPTION_FREQUENCIES)}
        value={step.frequency || undefined}
        onChange={(value) => onStep({ frequency: value ?? '' })}
        readOnly={readOnly}
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
            <IconButton
              size="small"
              aria-label="Remove instructions"
              onClick={() => {
                setInstructionsOpen(false);
                onChange(withDirections(line, { instructions: '' }));
              }}
              sx={{ p: '2px', ml: '2px' }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </>
      ) : (
        '.'
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
      {/* The suggestions sit above the line's first sentence once a medication is picked. */}
      {!readOnly && line.medication && (
        <ErxSuggestionsBox<PrescriptionSuggestionRow>
          look="rows"
          rows={suggestions}
          weightNote={suggestions.length ? weightNote : undefined}
          isAdded={matches}
          renderPicker={(row, blank, pick) =>
            // A row's diagnosis blank opens the line's pick-list.
            row.diagnosisAt === undefined || row.segments[row.diagnosisAt] !== blank ? undefined : (
              <DiagnosisSearch visitDiagnoses={visitDiagnoses} onPick={(diagnosis) => pick(diagnosisText(diagnosis))} />
            )
          }
          onPick={(suggestion, picks) => {
            reveal();
            // A row's diagnosis blank brings its value, if any; an empty one leaves the line's.
            const at = suggestion.diagnosisAt;
            const chosen =
              at === undefined ? undefined : picks[at] ?? (suggestion.segments[at] as SentenceBlank).initial;
            onChange(
              withSuggestion(line, suggestion.fill(picks), chosen ? { diagnosis: diagnosisOfText(chosen) } : {})
            );
          }}
          onOther={reveal}
        />
      )}

      <Sentence onRemove={onRemove} removeLabel={`Remove prescription ${index + 1}`}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          Prescription {index + 1}:
        </Box>{' '}
        {!readOnly && (
          <>
            <SelectBlank
              label="+ quick pick"
              title="Quick pick"
              options={[
                // Not while the line is hidden awaiting a pick: it would save directions no one has seen.
                ...(onSaveQuickPick && !(awaitingPick && !revealed)
                  ? [{ value: ADD_QUICK_PICK, label: ADD_QUICK_PICK_LABEL }]
                  : []),
                ...quickPicks.map((quickPick, i) => ({
                  value: quickPick.id ?? String(i),
                  label: prescriptionQuickPickLabel(quickPick),
                })),
              ]}
              value={undefined}
              onChange={(value) => {
                if (value === ADD_QUICK_PICK) {
                  onSaveQuickPick?.();
                  return;
                }
                const quickPick = quickPicks.find((item, i) => (item.id ?? String(i)) === value);
                if (!quickPick) return;
                // A quick pick's directions are picked ones: they show.
                setAwaitingPick(false);
                onQuickPick(quickPick);
              }}
              readOnly={readOnly}
              emptyText={quickPicks.length ? 'No matches' : 'No quick picks yet'}
            />{' '}
          </>
        )}
        <PopoverBlank
          label="medication"
          title="Medication"
          value={line.drug?.name ?? description}
          need
          readOnly={readOnly}
        >
          {(close) => (
            <MedicationSearch
              onPick={(drug) => {
                changeProduct(withProduct(line, drug, defaultStrength(drug, patientAgeYears)));
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
          <IconButton
            size="small"
            aria-label={`Remove ${line.diagnosis.code}`}
            onClick={() => update({ diagnosis: null })}
            sx={{ p: '2px', ml: '2px' }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        .{/* Urgent is offered only when wanted, like "+ details": a grey link until clicked. */}
        {line.urgent ? (
          <>
            {' '}
            Urgent:{' '}
            <Box component="span" sx={{ fontWeight: 700 }}>
              yes
            </Box>
            {!readOnly && (
              <IconButton
                size="small"
                aria-label="Remove urgent"
                onClick={() => update({ urgent: false })}
                sx={{ p: '2px', ml: '2px' }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </>
        ) : (
          !readOnly && (
            <>
              {' '}
              <BlankButton label="+ urgent" ghost readOnly={readOnly} onClick={() => update({ urgent: true })} />
            </>
          )
        )}
      </Sentence>

      {/* The blanks behind the directions: each change rewrites the Directions box unless the provider typed there.
          A taper adds "then" steps, each a sentence of its own; the route on the first applies to all. */}
      {revealed && (
        <>
          <Sentence>
            {prescriptionVerb(line.route)}{' '}
            {stepBlanks(
              line,
              '',
              (patch) => onChange(withDirections(line, patch)),
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
          {line.steps.map((step, i) => (
            <Sentence
              key={i}
              onRemove={readOnly ? undefined : () => setSteps(line.steps.filter((_, j) => j !== i))}
              removeLabel={`Remove step ${i + 2}`}
            >
              then{' '}
              {stepBlanks(step, `step ${i + 2} `, (patch) =>
                setSteps(line.steps.map((other, j) => (j === i ? { ...other, ...patch } : other)))
              )}
              {i === line.steps.length - 1 ? courseEnd : '.'}
            </Sentence>
          ))}
          <Sentence>
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
            .
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
