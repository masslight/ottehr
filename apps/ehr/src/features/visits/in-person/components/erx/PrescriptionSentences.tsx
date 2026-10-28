import { Close, SaveOutlined } from '@mui/icons-material';
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
  useTheme,
} from '@mui/material';
import { FC, KeyboardEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
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

/** The admins' button under the line that saves it as a quick pick. */
export const SAVE_QUICK_PICK_LABEL = 'Save as quick pick';

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

/** A pick in the line's medication menu. */
type MedicationMenuPick =
  | { kind: 'set'; set: PrescriptionSetQuickPickData; members: PrescriptionQuickPickData[] }
  | { kind: 'quickPick'; quickPick: PrescriptionQuickPickData }
  | { kind: 'drug'; drug: MedicationSearchDrug };

/** How many sets and how many quick picks the menu lists before anything is typed. */
const MEDICATION_MENU_LIMIT = 10;

/** The menu's quick picks column. Before anything is typed: the first sets and the first quick picks, `more` when there are
 * others. Typed: every set matching by name or by a quick pick's name or product, and every quick pick matching by
 * name or product. */
const quickPickColumn = (
  typed: string,
  sets: PrescriptionSetQuickPickData[],
  quickPicks: PrescriptionQuickPickData[]
): { sets: MedicationMenuPick[]; quickPicks: MedicationMenuPick[]; more: boolean } => {
  const setPicks = sets.map((set) => ({
    kind: 'set' as const,
    set,
    members: prescriptionSetMembers(set, quickPicks).members,
  }));
  const query = typed.trim().toLowerCase();
  const toPick = (quickPick: PrescriptionQuickPickData): MedicationMenuPick => ({ kind: 'quickPick', quickPick });
  if (!query)
    return {
      sets: setPicks.slice(0, MEDICATION_MENU_LIMIT),
      quickPicks: quickPicks.slice(0, MEDICATION_MENU_LIMIT).map(toPick),
      more: sets.length > MEDICATION_MENU_LIMIT || quickPicks.length > MEDICATION_MENU_LIMIT,
    };
  const matches = (quickPick: PrescriptionQuickPickData): boolean =>
    [quickPick.name, quickPick.medicationDescription].some((text) => text?.toLowerCase().includes(query));
  return {
    sets: setPicks.filter(({ set, members }) => set.name.toLowerCase().includes(query) || members.some(matches)),
    quickPicks: quickPicks.filter(matches).map(toPick),
    more: false,
  };
};

const MENU_HEADING_SX = { display: 'block', px: 2, pt: 1, pb: 0.5, fontWeight: 700, color: 'text.secondary' };
const MENU_LIST_SX = { listStyle: 'none', m: 0, p: 0 };

const MenuHeading: FC<{ id: string; children: ReactNode }> = ({ id, children }) => (
  <Typography id={id} variant="caption" sx={MENU_HEADING_SX}>
    {children}
  </Typography>
);

const MenuMessage: FC<{ children: ReactNode }> = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
    {children}
  </Typography>
);

/** The line's medication menu: the medication search's results in the left column, the practice's sets and quick
 * picks in the right, both following what's typed. Focus stays in the field: Up/Down move within a column,
 * Left/Right (once a row is highlighted) between them, Enter picks. */
const MedicationMenu: FC<{
  quickPicks: PrescriptionQuickPickData[];
  sets: PrescriptionSetQuickPickData[];
  onDrug: (drug: MedicationSearchDrug) => void;
  onQuickPick: (quickPick: PrescriptionQuickPickData) => void;
  onSet: (set: PrescriptionSetQuickPickData) => void;
}> = ({ quickPicks, sets, onDrug, onQuickPick, onSet }) => {
  const id = useId();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { debounce } = useDebounce(300);
  const { data: drugs, isFetching, isError } = useSearchMedications(debouncedQuery);
  // The search needs two characters. It runs from the first keystroke until the search for what's typed returns:
  // the debounce's wait too, which would otherwise show the last search's answer (or none) as this one's.
  const searched = query.trim().length >= 2;
  const searching = searched && (isFetching || debouncedQuery !== query);
  const medicationPicks: MedicationMenuPick[] =
    searched && !searching ? (drugs ?? []).map((drug) => ({ kind: 'drug', drug })) : [];
  const listed = quickPickColumn(query, sets, quickPicks);
  const quickPickPicks = [...listed.sets, ...listed.quickPicks];
  const columns = [medicationPicks, quickPickPicks];
  const [active, setActive] = useState<{ column: number; row: number }>();
  // A highlight the lists no longer reach is none.
  const highlighted = active && columns[active.column][active.row] ? active : undefined;
  const optionId = (column: number, row: number): string => `${id}-option-${column}-${row}`;
  const activeId = highlighted && optionId(highlighted.column, highlighted.row);
  // A row the keyboard moves to is scrolled into view within its column only. Never on hover: scrolling to a
  // half-shown hovered row moved the rows under the pointer, which hovered the next one, and so on (scrollIntoView
  // also scrolled the popup itself).
  const keyboardMoved = useRef(false);
  useEffect(() => {
    const row = activeId ? document.getElementById(activeId) : null;
    const column = row?.closest<HTMLElement>('[data-menu-column]');
    if (!row || !column || !keyboardMoved.current) return;
    keyboardMoved.current = false;
    const bottom = row.offsetTop + row.offsetHeight;
    if (row.offsetTop < column.scrollTop) column.scrollTop = row.offsetTop;
    else if (bottom > column.scrollTop + column.clientHeight) column.scrollTop = bottom - column.clientHeight;
  }, [activeId]);

  const choose = (pick: MedicationMenuPick): void => {
    if (pick.kind === 'set') onSet(pick.set);
    else if (pick.kind === 'quickPick') onQuickPick(pick.quickPick);
    else onDrug(pick.drug);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const move = (column: number, row: number): void => {
      event.preventDefault();
      keyboardMoved.current = true;
      setActive({ column, row });
    };
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const column = highlighted?.column ?? (medicationPicks.length ? 0 : 1);
      const count = columns[column].length;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (count) move(column, highlighted ? (highlighted.row + step + count) % count : step > 0 ? 0 : count - 1);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && highlighted) {
      // Until a row is highlighted, Left/Right move in the text.
      const column = event.key === 'ArrowLeft' ? 0 : 1;
      const count = columns[column].length;
      if (column !== highlighted.column && count) move(column, Math.min(highlighted.row, count - 1));
    } else if (event.key === 'Enter' && highlighted) {
      event.preventDefault();
      choose(columns[highlighted.column][highlighted.row]);
    }
  };

  const option = (pick: MedicationMenuPick, column: number, row: number): ReactNode => {
    const isActive = highlighted?.column === column && highlighted.row === row;
    return (
      <Box
        component="li"
        key={optionId(column, row)}
        id={optionId(column, row)}
        role="option"
        aria-selected={isActive}
        // The field keeps focus.
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {
          keyboardMoved.current = false;
          if (!isActive) setActive({ column, row });
        }}
        onClick={() => choose(pick)}
        sx={{ px: 2, py: 0.75, cursor: 'pointer', bgcolor: isActive ? 'action.hover' : undefined }}
      >
        {pick.kind === 'drug' ? (
          pick.drug.name
        ) : (
          <>
            {pick.kind === 'set' && (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                Set:{' '}
              </Box>
            )}
            <Box component="span" sx={{ fontStyle: 'italic' }}>
              {pick.kind === 'set' ? pick.set.name : pick.quickPick.name}
            </Box>
            {/* A quick pick or set shows only its name, which the practice words as it likes. */}
          </>
        )}
      </Box>
    );
  };

  /** A heading and its picks, numbered from `from` in the column; nothing when it has none. */
  const group = (heading: string, picks: MedicationMenuPick[], from: number): ReactNode =>
    picks.length > 0 && (
      <li role="presentation">
        <MenuHeading id={`${id}-heading-${from}`}>{heading}</MenuHeading>
        <Box component="ul" role="group" aria-labelledby={`${id}-heading-${from}`} sx={MENU_LIST_SX}>
          {picks.map((pick, i) => option(pick, 1, from + i))}
        </Box>
      </li>
    );

  // Each column scrolls on its own (the rows' offsets measured from it); on a narrow screen the quick picks go under
  // the medications. A fixed height, not a maximum: one following the rows resized the popup as typing emptied and
  // refilled the columns.
  const columnSx = {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    height: 180,
    [theme.breakpoints.up('sm')]: { height: 300 },
    overflowY: 'auto',
  };
  return (
    <Box sx={{ pt: 0.5 }}>
      <TextField
        size="small"
        fullWidth
        label="Medication"
        placeholder="Select a quick pick or type to search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(undefined);
          debounce(() => setDebouncedQuery(event.target.value));
        }}
        onKeyDown={onKeyDown}
        inputProps={{
          role: 'combobox',
          autoComplete: 'off',
          'aria-autocomplete': 'list',
          'aria-expanded': true,
          'aria-controls': `${id}-medications ${id}-quick-picks`,
          'aria-activedescendant': activeId,
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mt: 1 }}>
        <Box data-menu-column sx={columnSx}>
          <MenuHeading id={`${id}-medications-heading`}>Medications</MenuHeading>
          <Box
            component="ul"
            id={`${id}-medications`}
            role="listbox"
            aria-labelledby={`${id}-medications-heading`}
            sx={MENU_LIST_SX}
          >
            {medicationPicks.map((pick, row) => option(pick, 0, row))}
          </Box>
          {!searched ? (
            <MenuMessage>Type to search medications</MenuMessage>
          ) : searching ? (
            <MenuMessage>Searching medications…</MenuMessage>
          ) : isError ? (
            <Box sx={{ px: 2 }}>
              <ReportSearchIssue />
            </Box>
          ) : (
            medicationPicks.length === 0 && <MenuMessage>Nothing found for this search criteria</MenuMessage>
          )}
        </Box>
        <Box
          data-menu-column
          sx={{ ...columnSx, borderLeft: { sm: 1 }, borderTop: { xs: 1, sm: 0 }, borderColor: 'divider' }}
        >
          <Box
            component="ul"
            id={`${id}-quick-picks`}
            role="listbox"
            aria-label="Prescription sets and quick picks"
            sx={MENU_LIST_SX}
          >
            {group('Prescription sets', listed.sets, 0)}
            {group('Quick picks', listed.quickPicks, listed.sets.length)}
          </Box>
          {quickPickPicks.length === 0 && <MenuMessage>No quick picks match</MenuMessage>}
          {listed.more && <MenuMessage>Type to search more</MenuMessage>}
        </Box>
      </Box>
    </Box>
  );
};

/** The medication blank's popup: twice the other blanks' width for the menu's two columns, within the screen. */
const MEDICATION_MENU_PAPER_SX = {
  width: 'min(680px, calc(100vw - 32px))',
  maxWidth: 'min(680px, calc(100vw - 32px))',
  maxHeight: 'min(440px, calc(100dvh - 32px))',
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
  // The suggestions fold to their title once one is used (or "Other"); another medication, or a line waiting for a
  // pick again (a new strength), opens them again.
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
  const suggestionsFor = line.drug?.name ?? line.medication?.description;
  const [collapsedFor, setCollapsedFor] = useState(suggestionsFor);
  if (collapsedFor !== suggestionsFor) {
    setCollapsedFor(suggestionsFor);
    setSuggestionsCollapsed(false);
  }
  const changeProduct = (next: PrescriptionLine): void => {
    const changed = next.medication?.ndc !== line.medication?.ndc;
    if (changed) {
      setPicked(false);
      setAwaitingPick(true);
      // The line waits for a pick among the suggestions: they show.
      setSuggestionsCollapsed(false);
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
  // On its own row under the line's last sentence; not while the line is hidden awaiting a pick: it would save
  // directions no one has seen.
  const saveButton = onSaveQuickPick && !readOnly && !(awaitingPick && !revealed) && (
    <Button size="small" startIcon={<SaveOutlined />} onClick={onSaveQuickPick} sx={{ alignSelf: 'flex-start' }}>
      {SAVE_QUICK_PICK_LABEL}
    </Button>
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
          collapsed={suggestionsCollapsed}
          onCollapsedChange={setSuggestionsCollapsed}
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
                  // "Use this dose" uses the row, as its "+" does.
                  reveal();
                  setSuggestionsCollapsed(true);
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
            setSuggestionsCollapsed(true);
            const used = suggestion.apply(line, picks);
            if (suggestion.fromSet && onSet)
              onSet(suggestion.fromSet.set, { line: used, memberId: suggestion.fromSet.memberId });
            else onChange(used);
          }}
          onOther={() => {
            reveal();
            setSuggestionsCollapsed(true);
          }}
        />
      )}

      {/* A blue bar down the prescription's left edge sets it apart from the tinted suggestions above; its sentences
          sit line under line, single spaced. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', borderLeft: 3, borderColor: 'primary.main', pl: 1.5 }}>
        {/* The line starts with its medication: the bar marks where each prescription starts, so it isn't numbered. */}
        <Sentence onRemove={onRemove} removeLabel={`Remove prescription ${index + 1}`}>
          <PopoverBlank
            label="medication"
            title="Medication"
            // The menu's own field says "Medication".
            hideTitle
            paperSx={MEDICATION_MENU_PAPER_SX}
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
          .
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
            </Sentence>
          </>
        )}

        {saveButton}

        {errors.length > 0 && (
          <FormHelperText error sx={{ mt: 0.5 }}>
            {errors.join('. ')}.
          </FormHelperText>
        )}
      </Box>
    </Box>
  );
};
