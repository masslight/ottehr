import { Close, SaveOutlined } from '@mui/icons-material';
import { Autocomplete, Box, Button, FormHelperText, IconButton, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, ReactNode, useState } from 'react';
import { CptCodesInput } from 'src/components/input/CptCodesInput';
import { EmployeeOption, useEmployeeOptions } from 'src/components/input/EmployeeSelectInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  BlankButton,
  DateTimeBlank,
  PopoverBlank,
  SelectBlank,
  Sentence,
  TextBlank,
} from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { useGetVaccines } from 'src/features/visits/in-person/hooks/useImmunization';
import { PROVIDERS_FILTER } from 'src/shared/utils/employeeFilters';
import { BASE_ROUTE_OPTIONS, LOCATION_OPTIONS } from 'src/shared/utils/options';
import { BASE_UNIT_OPTIONS } from 'utils/lib/fhir/medication-administration';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import {
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';
import { ImmunizationDiagnosisOption, useImmunizationDiagnosisOptions } from '../hooks/useImmunizationDiagnosisOptions';
import { formatImmunizationCptCode, ImmunizationLine } from './immunizationLines';
import { IMMUNIZATION_MENU_PAPER_SX, ImmunizationMenu } from './ImmunizationMenu';

/** The admins' button under the line that saves it as a quick pick. */
export const SAVE_QUICK_PICK_LABEL = 'Save as quick pick';

const UNIT_OPTIONS = BASE_UNIT_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const ROUTE_OPTIONS = BASE_ROUTE_OPTIONS.map((option) => ({ value: option.code, label: option.name }));
const LOCATION_BLANK_OPTIONS = LOCATION_OPTIONS.map((option) => ({ value: option.code, label: option.name }));
const VIS_OPTIONS = [
  { value: 'given', label: 'given' },
  { value: 'not given', label: 'not given' },
];

/** The small uppercase heading over a group of sentences, as the eRx form's. */
export const ImmunizationSectionLabel: FC<{ children: ReactNode; spaced?: boolean }> = ({ children, spaced }) => (
  <Typography
    component="h3"
    sx={{
      fontSize: '12px',
      fontWeight: 500,
      textTransform: 'uppercase',
      color: 'primary.dark',
      ...(spaced && { mt: 1 }),
    }}
  >
    {children}
  </Typography>
);

/** The small "×" after a part of the sentence that takes it away. */
const RemoveButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <IconButton size="small" aria-label={label} onClick={onClick} sx={{ p: '2px', ml: '2px' }}>
    <Close sx={{ fontSize: 16 }} />
  </IconButton>
);

/** A blank's popup that picks one of a list by typing: the visit's diagnoses, the providers. */
const OptionSearch = <T,>({
  label,
  options,
  loading,
  getLabel,
  getKey,
  onPick,
  noOptionsText,
}: {
  label: string;
  options: T[] | undefined;
  loading?: boolean;
  getLabel: (option: T) => string;
  getKey: (option: T) => string;
  onPick: (option: T) => void;
  noOptionsText: string;
}): JSX.Element => (
  <Box sx={{ width: 360, pt: 0.5 }}>
    <Autocomplete<T>
      options={options ?? []}
      loading={loading}
      getOptionLabel={getLabel}
      getOptionKey={getKey}
      value={null}
      onChange={(_event, option) => option && onPick(option)}
      openOnFocus
      noOptionsText={noOptionsText}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder="Type to filter…"
          inputProps={{ ...params.inputProps, 'aria-label': label }}
        />
      )}
    />
  </Box>
);

interface ImmunizationSentencesProps {
  line: ImmunizationLine;
  index: number;
  onChange: (next: ImmunizationLine) => void;
  /** Absent for the only line: there is always one immunization to fill. */
  onRemove?: () => void;
  quickPicks: ImmunizationQuickPickData[];
  onQuickPick: (quickPick: ImmunizationQuickPickData) => void;
  /** Admins save the line as a quick pick; absent for everyone else. */
  onSaveQuickPick?: () => void;
  /** Shown once an order has been tried. */
  errors: string[];
  readOnly: boolean;
  /** Marks the administration blanks required: the details card, where they are needed to administer. */
  needAdministration?: boolean;
  /** More sentences after the administration ones (the details card's emergency contact). */
  children?: ReactNode;
}

/** One immunization as sentences: what and for what, how much and where, by whom, and the administration details
 * that can be entered at order time. */
export const ImmunizationSentences: FC<ImmunizationSentencesProps> = ({
  line,
  index,
  onChange,
  onRemove,
  quickPicks,
  onQuickPick,
  onSaveQuickPick,
  errors,
  readOnly,
  needAdministration,
  children,
}) => {
  const { details, administrationDetails } = line;
  const update = (patch: Partial<InputImmunizationOrderDetails>): void =>
    onChange({ ...line, details: { ...details, ...patch } });
  const updateAdministration = (patch: InputImmunizationOrderAdministrationDetails): void =>
    onChange({ ...line, administrationDetails: { ...administrationDetails, ...patch } });
  const { data: vaccines, isLoading: vaccinesLoading } = useGetVaccines();
  const diagnoses = useImmunizationDiagnosisOptions();
  const { options: providers, isLoading: providersLoading } = useEmployeeOptions(PROVIDERS_FILTER);
  // The instructions blank is offered as a link, like eRx's, and stays once opened or written in.
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const instructionsShown = instructionsOpen || !!details.instructions;

  // The date and time blanks share the one administered date-time; a date picked first is at midnight, as before.
  const administered = administrationDetails.administeredDateTime
    ? DateTime.fromISO(administrationDetails.administeredDateTime)
    : null;
  const setAdministered = (next: DateTime | null, part: 'date' | 'time'): void => {
    const current = administered?.isValid ? administered : null;
    const merged = !next?.isValid
      ? null
      : !current
      ? next
      : part === 'date'
      ? current.set({ year: next.year, month: next.month, day: next.day })
      : current.set({ hour: next.hour, minute: next.minute, second: 0, millisecond: 0 });
    updateAdministration({ administeredDateTime: merged?.toISO() ?? undefined });
  };
  const toDate = (value: string | undefined): DateTime | null => (value ? DateTime.fromISO(value) : null);

  const cptCodes = administrationDetails.cptCodes ?? [];
  // On its own row under the line's last sentence, once the line has a vaccine to save.
  const saveButton = onSaveQuickPick && !readOnly && details.medication && (
    <Button size="small" startIcon={<SaveOutlined />} onClick={onSaveQuickPick} sx={{ alignSelf: 'flex-start' }}>
      {SAVE_QUICK_PICK_LABEL}
    </Button>
  );

  return (
    // A blue bar down the immunization's left edge marks where each one starts; its sentences sit line under line.
    <Box
      sx={{ display: 'flex', flexDirection: 'column', borderLeft: 3, borderColor: 'primary.main', pl: 1.5 }}
      data-testid={dataTestIds.orderVaccinePage.line}
    >
      <Sentence onRemove={onRemove} removeLabel={`Remove immunization ${index + 1}`}>
        {/* The vaccine reads a little larger than the rest of the line. */}
        <Box component="span" sx={{ fontSize: '1.125em' }}>
          <PopoverBlank
            label="immunization"
            title="Immunization"
            // The menu's own field says "Immunization".
            hideTitle
            paperSx={IMMUNIZATION_MENU_PAPER_SX}
            value={details.medication?.name}
            need
            readOnly={readOnly}
            dataTestId={dataTestIds.orderVaccinePage.vaccine}
          >
            {(close) => (
              <ImmunizationMenu
                quickPicks={quickPicks}
                vaccines={vaccines}
                vaccinesLoading={vaccinesLoading}
                onQuickPick={(quickPick) => {
                  onQuickPick(quickPick);
                  close();
                }}
                onVaccine={(vaccine) => {
                  update({ medication: vaccine });
                  close();
                }}
              />
            )}
          </PopoverBlank>
        </Box>{' '}
        for {/* A chosen diagnosis stays a blank: clicking it picks again to swap it. */}
        <PopoverBlank
          label={details.associatedDx ? 'diagnosis' : 'add diagnosis'}
          title="Associated Dx"
          value={details.associatedDx?.display}
          readOnly={readOnly}
          dataTestId={dataTestIds.orderVaccinePage.associatedDx}
        >
          {(close) => (
            <OptionSearch<ImmunizationDiagnosisOption>
              label="Associated Dx"
              options={diagnoses}
              getLabel={(option) => option.display}
              getKey={(option) => option.resourceId}
              onPick={(associatedDx) => {
                update({ associatedDx });
                close();
              }}
              noOptionsText="No diagnoses on this visit"
            />
          )}
        </PopoverBlank>
        {details.associatedDx && !readOnly && (
          <RemoveButton label="Remove diagnosis" onClick={() => update({ associatedDx: undefined })} />
        )}
        .
      </Sentence>

      <Sentence>
        Give{' '}
        <TextBlank
          label="dose"
          kind="number"
          value={details.dose}
          onChange={(dose) => update({ dose })}
          readOnly={readOnly}
          need
          min={0}
          step={0.001}
          dataTestId={dataTestIds.orderVaccinePage.dose}
        />{' '}
        <SelectBlank
          label="units"
          title="Units"
          options={UNIT_OPTIONS}
          value={details.units || undefined}
          onChange={(units) => update({ units: units ?? '' })}
          readOnly={readOnly}
          need
          dataTestId={dataTestIds.orderVaccinePage.units}
        />{' '}
        <SelectBlank
          label="route"
          title="Route"
          options={ROUTE_OPTIONS}
          value={details.route || undefined}
          onChange={(route) => update({ route: route ?? '' })}
          readOnly={readOnly}
          clearable
          dataTestId={dataTestIds.orderVaccinePage.route}
        />{' '}
        in the{' '}
        <SelectBlank
          label="location"
          title="Location"
          options={LOCATION_BLANK_OPTIONS}
          value={details.location?.code}
          onChange={(code) => update({ location: LOCATION_OPTIONS.find((option) => option.code === code) })}
          readOnly={readOnly}
          clearable
          dataTestId={dataTestIds.orderVaccinePage.location}
        />
        .
      </Sentence>

      <Sentence>
        Manufacturer:{' '}
        <TextBlank
          label="manufacturer"
          value={details.manufacturer}
          onChange={(manufacturer) => update({ manufacturer })}
          readOnly={readOnly}
          dataTestId={dataTestIds.orderVaccinePage.manufacturer}
        />
        . Ordered by{' '}
        <PopoverBlank
          label="ordered by"
          title="Ordered by"
          value={details.orderedProvider?.name}
          need
          readOnly={readOnly}
          dataTestId={dataTestIds.orderVaccinePage.orderedBy}
        >
          {(close) => (
            <OptionSearch<EmployeeOption>
              label="Ordered by"
              options={providers}
              loading={providersLoading}
              getLabel={(option) => option.name}
              getKey={(option) => option.id}
              onPick={(orderedProvider) => {
                update({ orderedProvider });
                close();
              }}
              noOptionsText="No providers found"
            />
          )}
        </PopoverBlank>
        .
        {!instructionsShown && !readOnly && (
          <>
            {' '}
            <BlankButton label="+ instructions" ghost readOnly={readOnly} onClick={() => setInstructionsOpen(true)} />
          </>
        )}
      </Sentence>

      {/* On a line of its own, as wide as eRx's directions, so typed instructions wrap in a box that fits them. */}
      {instructionsShown && (
        <Sentence>
          Instructions:{' '}
          <TextBlank
            label="instructions"
            width="480px"
            multiline
            value={details.instructions}
            onChange={(instructions) => update({ instructions })}
            readOnly={readOnly}
            dataTestId={dataTestIds.orderVaccinePage.instructions}
          />
          {!readOnly && (
            <RemoveButton
              label="Remove instructions"
              onClick={() => {
                setInstructionsOpen(false);
                update({ instructions: '' });
              }}
            />
          )}
        </Sentence>
      )}

      <ImmunizationSectionLabel spaced>Administration</ImmunizationSectionLabel>
      <Sentence>
        Given on{' '}
        <DateTimeBlank
          kind="date"
          label="date"
          value={administered}
          onChange={(next) => setAdministered(next, 'date')}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.administeredDate}
        />{' '}
        at{' '}
        <DateTimeBlank
          kind="time"
          label="time"
          value={administered}
          onChange={(next) => setAdministered(next, 'time')}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.administeredTime}
        />
        .
      </Sentence>
      <Sentence>
        Lot{' '}
        <TextBlank
          label="lot number"
          value={administrationDetails.lot}
          onChange={(lot) => updateAdministration({ lot })}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.lotNumber}
        />
        , expires{' '}
        <DateTimeBlank
          kind="date"
          label="exp. date"
          value={toDate(administrationDetails.expDate)}
          onChange={(next) => updateAdministration({ expDate: next?.toISODate() ?? '' })}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.expiredDate}
        />
        , NDC{' '}
        <TextBlank
          label="NDC code"
          value={administrationDetails.ndc}
          onChange={(ndc) => updateAdministration({ ndc })}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.ndcCode}
        />
        .
      </Sentence>
      <Sentence>
        CVX{' '}
        <TextBlank
          label="CVX code"
          value={administrationDetails.cvx}
          onChange={(cvx) => updateAdministration({ cvx })}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.cvxCode}
        />
        , MVX{' '}
        <TextBlank
          label="MVX code"
          value={administrationDetails.mvx}
          onChange={(mvx) => updateAdministration({ mvx })}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.mvxCode}
        />
        .
      </Sentence>
      <Sentence>
        VIS{' '}
        <SelectBlank
          label="given or not"
          title="VIS"
          options={VIS_OPTIONS}
          value={administrationDetails.visGiven ? 'given' : 'not given'}
          onChange={(value) => updateAdministration({ visGiven: value === 'given' })}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.visCheckbox}
        />
        {administrationDetails.visGiven && (
          <>
            {' '}
            to the patient on{' '}
            <DateTimeBlank
              kind="date"
              label="VIS date"
              value={toDate(administrationDetails.visGivenDate)}
              onChange={(next) => updateAdministration({ visGivenDate: next?.toISODate() ?? undefined })}
              readOnly={readOnly}
              need={needAdministration}
              dataTestId={dataTestIds.vaccineDetailsPage.visGivenDate}
            />
          </>
        )}
        .
      </Sentence>
      <Sentence>
        CPT codes:{' '}
        <PopoverBlank
          label="CPT codes"
          title="CPT codes"
          value={cptCodes.map(formatImmunizationCptCode).join(', ') || undefined}
          readOnly={readOnly}
          need={needAdministration}
          dataTestId={dataTestIds.vaccineDetailsPage.cptCode}
        >
          {() => (
            <Box sx={{ width: 360, pt: 0.5 }}>
              <CptCodesInput
                cptCodes={cptCodes}
                onChange={(codes) => updateAdministration({ cptCodes: codes })}
                isEditable={!readOnly}
                withBillableUnits
              />
            </Box>
          )}
        </PopoverBlank>
        .
      </Sentence>

      {children}

      {saveButton}

      {errors.length > 0 && (
        <FormHelperText error sx={{ mt: 0.5 }}>
          {errors.join('. ')}.
        </FormHelperText>
      )}
    </Box>
  );
};
