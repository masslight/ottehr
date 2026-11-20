import { Close, ExpandMore, SaveOutlined } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  FormHelperText,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
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
import { PROVIDERS_FILTER } from 'src/shared/utils/employeeFilters';
import { BASE_ROUTE_OPTIONS, LOCATION_OPTIONS } from 'src/shared/utils/options';
import { BASE_UNIT_OPTIONS } from 'utils/lib/fhir/medication-administration';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import {
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';
import { ImmunizationDiagnosisOption, useImmunizationDiagnosisOptions } from '../hooks/useImmunizationDiagnosisOptions';
import {
  administrationSummary,
  ImmunizationFormValues,
  manufacturerBlank,
  mergeAdministeredDateTime,
  pickManufacturer,
} from './immunizationForm';
import { ImmunizationMenu, immunizationMenuPaperSx } from './ImmunizationMenu';

/** The admins' button under the sentences that saves the form as a quick pick. */
export const SAVE_QUICK_PICK_LABEL = 'Save as quick pick';

const UNIT_OPTIONS = BASE_UNIT_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const ROUTE_OPTIONS = BASE_ROUTE_OPTIONS.map((option) => ({ value: option.code, label: option.name }));
const LOCATION_BLANK_OPTIONS = LOCATION_OPTIONS.map((option) => ({ value: option.code, label: option.name }));

const toDate = (value: string | undefined): DateTime | null => (value ? DateTime.fromISO(value) : null);

// A blue bar down the immunization's left edge; its sentences sit line under line.
const SENTENCES_SX = {
  display: 'flex',
  flexDirection: 'column',
  borderLeft: 3,
  borderColor: 'primary.main',
  pl: 1.5,
} as const;

/** The small uppercase heading over a group of sentences. */
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
  values: ImmunizationFormValues;
  onChange: (next: ImmunizationFormValues) => void;
  /** The practice's quick picks, offered in the immunization menu. Absent where none can be applied: an order being
   * edited. */
  quickPicks?: ImmunizationQuickPickData[];
  quickPicksLoading?: boolean;
  onQuickPick: (quickPick: ImmunizationQuickPickData) => void;
  /** Admins save the form as a quick pick; absent for everyone else. */
  onSaveQuickPick?: () => void;
  /** What is missing, shown once ordering or administering has been tried. */
  errors: string[];
  readOnly: boolean;
  /** Marks the administration blanks required: the details card, where they are needed to administer. */
  needAdministration?: boolean;
  /** The order page: Administration starts collapsed under a one-line summary of what it holds, and opens on a click. */
  collapseAdministration?: boolean;
  /** More sentences after the administration ones (the details card's emergency contact). */
  children?: ReactNode;
}

/** One immunization as sentences: what and for what, how much and where, by whom, and the administration details
 * that can be entered at order time. */
export const ImmunizationSentences: FC<ImmunizationSentencesProps> = ({
  values,
  onChange,
  quickPicks,
  quickPicksLoading,
  onQuickPick,
  onSaveQuickPick,
  errors,
  readOnly,
  needAdministration,
  collapseAdministration,
  children,
}) => {
  const { details, administrationDetails } = values;
  const update = (patch: Partial<InputImmunizationOrderDetails>): void =>
    onChange({ ...values, details: { ...details, ...patch } });
  const updateAdministration = (patch: InputImmunizationOrderAdministrationDetails): void =>
    onChange({ ...values, administrationDetails: { ...administrationDetails, ...patch } });
  const diagnoses = useImmunizationDiagnosisOptions();
  const { options: providers, isLoading: providersLoading } = useEmployeeOptions(PROVIDERS_FILTER);
  // The ordering provider reads as the provider list names them; by the name saved with the order when not listed.
  const orderedByName =
    providers?.find((provider) => provider.id === details.orderedProvider?.id)?.name ?? details.orderedProvider?.name;
  // The instructions blank is offered as a link, and stays once opened or written in.
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const instructionsShown = instructionsOpen || !!details.instructions;

  // The date and time blanks share the one administered date-time.
  const administered = toDate(administrationDetails.administeredDateTime);
  const setAdministered = (next: DateTime | null, part: 'date' | 'time'): void =>
    updateAdministration({
      administeredDateTime: mergeAdministeredDateTime(administrationDetails.administeredDateTime, next, part),
    });
  // A site saved before it left the list still reads by its name.
  const savedLocation = details.location;
  const locationOptions =
    savedLocation && !LOCATION_BLANK_OPTIONS.some((option) => option.value === savedLocation.code)
      ? [...LOCATION_BLANK_OPTIONS, { value: savedLocation.code, label: savedLocation.name }]
      : LOCATION_BLANK_OPTIONS;
  const manufacturer = manufacturerBlank(values);
  const cptCodes = administrationDetails.cptCodes ?? [];
  const [administrationOpen, setAdministrationOpen] = useState(false);
  const administrationShown = !collapseAdministration || administrationOpen;
  const summary = administrationShown ? [] : administrationSummary(values);
  // On its own row under the last sentence, once there is a vaccine to save.
  const saveButton = onSaveQuickPick && !readOnly && details.medication?.id && (
    <Button size="small" startIcon={<SaveOutlined />} onClick={onSaveQuickPick} sx={{ alignSelf: 'flex-start' }}>
      {SAVE_QUICK_PICK_LABEL}
    </Button>
  );

  return (
    <Box sx={SENTENCES_SX}>
      <Sentence>
        {/* The vaccine, a little larger than the rest; its menu lists the quick picks and the vaccines. */}
        <Box component="span" sx={{ fontSize: '1.125em' }}>
          <PopoverBlank
            label="immunization"
            title="Immunization"
            // The menu's own field says "Immunization".
            hideTitle
            paperSx={immunizationMenuPaperSx(Boolean(quickPicks))}
            value={details.medication?.name || undefined}
            need
            readOnly={readOnly}
            dataTestId={dataTestIds.orderVaccinePage.vaccine}
          >
            {(close) => (
              <ImmunizationMenu
                quickPicks={quickPicks}
                quickPicksLoading={quickPicksLoading}
                onQuickPick={(quickPick) => {
                  onQuickPick(quickPick);
                  close();
                }}
                onVaccine={(medication) => {
                  update({ medication });
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
        via{' '}
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
          options={locationOptions}
          value={details.location?.code}
          onChange={(code) =>
            update({
              location:
                LOCATION_OPTIONS.find((option) => option.code === code) ??
                (code === details.location?.code ? details.location : undefined),
            })
          }
          readOnly={readOnly}
          clearable
          dataTestId={dataTestIds.orderVaccinePage.location}
        />
        .
      </Sentence>

      <Sentence>
        Ordered by{' '}
        <PopoverBlank
          label="ordered by"
          title="Ordered by"
          value={orderedByName || undefined}
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

      {/* On a line of its own, so typed instructions wrap in a box that fits them. */}
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

      <ImmunizationSectionLabel spaced>
        {collapseAdministration ? (
          <ButtonBase
            aria-expanded={administrationShown}
            onClick={() => setAdministrationOpen(!administrationShown)}
            sx={{ font: 'inherit', color: 'inherit', textTransform: 'inherit', gap: '2px', borderRadius: 0.5 }}
            data-testid={dataTestIds.orderVaccinePage.administrationToggle}
          >
            <ExpandMore
              sx={{
                fontSize: 18,
                color: 'text.secondary',
                transform: administrationShown ? undefined : 'rotate(-90deg)',
              }}
            />
            Administration
          </ButtonBase>
        ) : (
          'Administration'
        )}
      </ImmunizationSectionLabel>
      {summary.length > 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid={dataTestIds.orderVaccinePage.administrationSummary}
        >
          {summary.join(' · ')}
        </Typography>
      )}
      {administrationShown && (
        <>
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
            {/* One pick sets the manufacturer's name and its MVX code. */}
            Manufacturer{' '}
            <SelectBlank
              label="manufacturer"
              title="Manufacturer"
              options={manufacturer.options}
              value={manufacturer.value}
              onChange={(mvx) => onChange(pickManufacturer(values, mvx))}
              readOnly={readOnly}
              need={needAdministration}
              clearable
              verbatim
              dataTestId={dataTestIds.orderVaccinePage.manufacturer}
            />
            {/* "Merck and Co., Inc." already ends the sentence. */}
            {manufacturer.label?.endsWith('.') ? null : '.'}
          </Sentence>
          <Sentence>
            VIS given to the patient on{' '}
            <DateTimeBlank
              kind="date"
              label="VIS date"
              value={toDate(administrationDetails.visGivenDate)}
              onChange={(next) => {
                const visGivenDate = next?.toISODate() ?? undefined;
                updateAdministration({ visGivenDate, visGiven: Boolean(visGivenDate) });
              }}
              readOnly={readOnly}
              need={needAdministration}
              dataTestId={dataTestIds.vaccineDetailsPage.visGivenDate}
            />
            .
          </Sentence>
          <Sentence>
            CPT codes:{' '}
            <PopoverBlank
              label="CPT codes"
              title="CPT codes"
              value={cptCodes.map((cptCode) => cptCode.code).join(', ') || undefined}
              readOnly={readOnly}
              dataTestId={dataTestIds.vaccineDetailsPage.cptCode}
            >
              {() => (
                <Box sx={{ width: 360, pt: 0.5 }}>
                  <CptCodesInput
                    cptCodes={cptCodes}
                    onChange={(codes) => updateAdministration({ cptCodes: codes })}
                    isEditable={!readOnly}
                  />
                </Box>
              )}
            </PopoverBlank>
            .
          </Sentence>
        </>
      )}

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
