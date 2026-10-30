import { Close } from '@mui/icons-material';
import MedicationIcon from '@mui/icons-material/Medication';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Box, Button, IconButton, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { FC, Fragment, KeyboardEvent, MouseEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  addCptCode,
  CptCodeEntry,
  CptCodeSearch,
  designateMedicationCptCode,
  removeCptCode,
} from 'src/components/input/CptCodesInput';
import { IN_HOUSE_CONTAINED_MEDICATION_ID } from 'utils/lib/types/api/medication-administration.constants';
import { ExtendedMedicationDataForResponse, MedicationData } from 'utils/lib/types/api/medication-administration.types';
import { dataTestIds } from '../../../../../../constants/data-test-ids';
import { OrderFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { BlankOption, PopoverBlank, SelectBlank, Sentence, TextBlank } from '../../procedures/narrative/InlineBlanks';
import { Option } from '../medicationTypes';
import { MedicationFieldType } from './fieldsConfig';
import { OTHER_SEPARATOR, POPULAR_SEPARATOR } from './MedicationCardField';

/** The order form as sentences: the medication menu, the ORDER sentences and the BILLING sentences. */

/** A quick pick in the medication menu, whichever list it comes from. */
export interface QuickPickMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
}

type MedicationMenuPick = { kind: 'medication'; option: Option } | { kind: 'quickPick'; quickPick: QuickPickMenuItem };

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

/** The medication blank's menu: the in-house medications in the left column, the practice's quick picks in the
 * right, both following what's typed. Focus stays in the field: Up/Down move within a column, Left/Right (once a
 * row is highlighted) between them, Enter picks. */
const MedicationMenu: FC<{
  medications: Option[];
  medicationsLoading: boolean;
  quickPicks: QuickPickMenuItem[];
  quickPicksLoading: boolean;
  onMedication: (medicationId: string) => void;
}> = ({ medications, medicationsLoading, quickPicks, quickPicksLoading, onMedication }) => {
  const id = useId();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const typed = query.trim().toLowerCase();
  const matches = (text: string): boolean => !typed || text.toLowerCase().includes(typed);
  const medicationPicks: MedicationMenuPick[] = medications
    .filter((option) => matches(option.label))
    .map((option) => ({ kind: 'medication', option }));
  const quickPickPicks: MedicationMenuPick[] = quickPicks
    .filter((quickPick) => matches(quickPick.label))
    .map((quickPick) => ({ kind: 'quickPick', quickPick }));
  const columns = [medicationPicks, quickPickPicks];
  const [active, setActive] = useState<{ column: number; row: number }>();
  // A highlight the lists no longer reach is none.
  const highlighted = active && columns[active.column][active.row] ? active : undefined;
  const optionId = (column: number, row: number): string => `${id}-option-${column}-${row}`;
  const activeId = highlighted && optionId(highlighted.column, highlighted.row);
  // A row the keyboard moves to is scrolled into view within its column only. Never on hover: scrolling to a
  // half-shown hovered row moved the rows under the pointer, which hovered the next one, and so on.
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
    if (pick.kind === 'medication') onMedication(pick.option.value);
    else pick.quickPick.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const move = (column: number, row: number): void => {
      event.preventDefault();
      keyboardMoved.current = true;
      setActive({ column, row });
    };
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Without medications, the quick picks first.
      const column = highlighted?.column ?? (medicationPicks.length || !quickPickPicks.length ? 0 : 1);
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
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        onMouseMove={() => {
          keyboardMoved.current = false;
          if (!isActive) setActive({ column, row });
        }}
        onClick={() => choose(pick)}
        sx={{ px: 2, py: 0.75, cursor: 'pointer', bgcolor: isActive ? 'action.hover' : undefined }}
      >
        {pick.kind === 'medication' ? (
          pick.option.label
        ) : (
          <Box component="span" sx={{ fontStyle: 'italic' }}>
            {pick.quickPick.label}
          </Box>
        )}
      </Box>
    );
  };

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
          {medicationsLoading ? (
            <MenuMessage>Loading medications…</MenuMessage>
          ) : (
            medicationPicks.length === 0 && <MenuMessage>No medications match</MenuMessage>
          )}
        </Box>
        <Box
          data-menu-column
          sx={{ ...columnSx, borderLeft: { sm: 1 }, borderTop: { xs: 1, sm: 0 }, borderColor: 'divider' }}
        >
          <MenuHeading id={`${id}-quick-picks-heading`}>Quick picks</MenuHeading>
          <Box
            component="ul"
            id={`${id}-quick-picks`}
            role="listbox"
            aria-labelledby={`${id}-quick-picks-heading`}
            sx={MENU_LIST_SX}
          >
            {quickPickPicks.map((pick, row) => option(pick, 1, row))}
          </Box>
          {quickPickPicks.length === 0 &&
            (quickPicksLoading ? <MenuMessage>Loading…</MenuMessage> : <MenuMessage>No quick picks match</MenuMessage>)}
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

type ScalarField = Exclude<MedicationFieldType, 'location' | 'effectiveDateTime' | 'expDate' | 'lotNumber' | 'dose'>;

interface OrderSentencesProps {
  medication?: ExtendedMedicationDataForResponse;
  isEditable: boolean;
  isRequired: (field: MedicationFieldType) => boolean;
  getFieldValue: <Field extends keyof MedicationData>(
    field: Field,
    type?: string
  ) => MedicationData[Field] | '' | undefined;
  onFieldValueChange: <Field extends keyof MedicationData>(field: Field, value: MedicationData[Field]) => void;
  selectsOptions: OrderFieldsSelectsOptions;
  quickPicks: QuickPickMenuItem[];
  quickPicksLoading: boolean;
  /** Opens the add/update quick pick dialog; absent when the user may not save quick picks. */
  onSaveAsQuickPick?: () => void;
}

/** The ORDER section: "Give [medication], [dose] [units], by the [route] route." and the lines after it. */
export const OrderSentences: FC<OrderSentencesProps> = ({
  medication,
  isEditable,
  isRequired,
  getFieldValue,
  onFieldValueChange,
  selectsOptions,
  quickPicks,
  quickPicksLoading,
  onSaveAsQuickPick,
}) => {
  const readOnly = !isEditable;
  const testId = dataTestIds.orderMedicationPage.inputField;
  const text = (field: ScalarField): string | undefined => {
    const value = getFieldValue(field);
    return value ? String(value) : undefined;
  };
  const change = (field: MedicationFieldType, value: string | number | undefined): void =>
    onFieldValueChange(field, value);

  const medicationId = text('medicationId');
  // The backend may create the order's medication resource without an id: the saved name then stands in.
  const medicationLabel =
    medicationId === IN_HOUSE_CONTAINED_MEDICATION_ID && medication?.medicationName
      ? medication.medicationName
      : selectsOptions.medicationId.options.find((option) => option.value === medicationId)?.label;

  // The dropdown's "Popular" / "Other" separators become list groups; a route's trailing "route" is dropped
  // because the sentence already ends with it ("by the Intravenous route").
  const routeOptions = useMemo((): BlankOption[] => {
    let group: string | undefined;
    const options: BlankOption[] = [];
    for (const option of selectsOptions.route.options) {
      if (option.value === POPULAR_SEPARATOR || option.value === OTHER_SEPARATOR) {
        group = option.label;
        continue;
      }
      options.push({ value: option.value, label: option.label.replace(/\s+route$/i, ''), group });
    }
    return options;
  }, [selectsOptions.route.options]);

  const associatedDx = text('associatedDx');
  const diagnosisLabel = selectsOptions.associatedDx.options.find((option) => option.value === associatedDx)?.label;
  const doseValue = getFieldValue('dose');

  return (
    <>
      <Sentence>
        Give{' '}
        <PopoverBlank
          label="medication"
          title="Medication"
          // The menu's own field says "Medication".
          hideTitle
          paperSx={MEDICATION_MENU_PAPER_SX}
          value={medicationLabel}
          need={isRequired('medicationId')}
          readOnly={readOnly}
          dataTestId={testId('medicationId')}
        >
          {(close) => (
            <MedicationMenu
              medications={selectsOptions.medicationId.options}
              medicationsLoading={selectsOptions.medicationId.status !== 'loaded'}
              quickPicks={quickPicks.map((quickPick) => ({
                ...quickPick,
                onSelect: () => {
                  quickPick.onSelect();
                  close();
                },
              }))}
              quickPicksLoading={quickPicksLoading}
              onMedication={(value) => {
                change('medicationId', value);
                close();
              }}
            />
          )}
        </PopoverBlank>
        ,{' '}
        <TextBlank
          label="dose"
          kind="number"
          min={0}
          value={doseValue === '' ? undefined : doseValue}
          onChange={(raw) => change('dose', raw)}
          readOnly={readOnly}
          need={isRequired('dose')}
          dataTestId={testId('dose')}
        />{' '}
        <SelectBlank
          label="units"
          title="Units"
          options={selectsOptions.units.options}
          value={text('units')}
          onChange={(value) => change('units', value ?? '')}
          readOnly={readOnly}
          need={isRequired('units')}
          verbatim
          clearable
          dataTestId={testId('units')}
        />
        , by the{' '}
        <SelectBlank
          label="route"
          title="Route"
          options={routeOptions}
          value={text('route')}
          onChange={(value) => change('route', value ?? '')}
          readOnly={readOnly}
          need={isRequired('route')}
          verbatim
          clearable
          dataTestId={testId('route')}
        />{' '}
        route.
      </Sentence>
      <Sentence>
        Diagnosis:{' '}
        {associatedDx && diagnosisLabel ? (
          <Box component="span" data-testid={testId('associatedDx')}>
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }}>
              {diagnosisLabel}
            </Box>
            {isEditable && (
              <IconButton
                size="small"
                aria-label={`Remove ${diagnosisLabel}`}
                onClick={() => change('associatedDx', '')}
                sx={{ p: '2px', ml: '2px' }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        ) : (
          <SelectBlank
            label="add diagnosis"
            title="Diagnosis"
            options={selectsOptions.associatedDx.options}
            value={undefined}
            onChange={(value) => change('associatedDx', value ?? '')}
            readOnly={readOnly}
            need={isRequired('associatedDx')}
            verbatim
            emptyText="No diagnoses on this visit"
            dataTestId={testId('associatedDx')}
          />
        )}
      </Sentence>
      <Sentence>
        Product: NDC{' '}
        <TextBlank
          label="NDC"
          value={text('ndc')}
          onChange={(raw) => change('ndc', raw)}
          readOnly={readOnly}
          need={isRequired('ndc')}
          dataTestId={testId('ndc')}
        />
        , made by{' '}
        <TextBlank
          label="manufacturer"
          value={text('manufacturer')}
          onChange={(raw) => change('manufacturer', raw)}
          readOnly={readOnly}
          need={isRequired('manufacturer')}
          dataTestId={testId('manufacturer')}
        />
        .
      </Sentence>
      <Sentence>
        Ordered by{' '}
        <SelectBlank
          label="ordered by"
          title="Ordered by"
          options={selectsOptions.providerId.options}
          value={text('providerId')}
          onChange={(value) => change('providerId', value ?? '')}
          readOnly={readOnly}
          need={isRequired('providerId')}
          verbatim
          clearable
          emptyText={selectsOptions.providerId.status === 'loaded' ? 'No providers' : 'Loading…'}
          dataTestId={testId('providerId')}
        />
        .
      </Sentence>
      {onSaveAsQuickPick && (
        <Button
          size="small"
          startIcon={<SaveOutlinedIcon />}
          onClick={onSaveAsQuickPick}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          Save as quick pick
        </Button>
      )}
    </>
  );
};

interface BillingSentencesProps {
  cptCodes: CptCodeEntry[];
  onCptCodesChange: (codes: CptCodeEntry[]) => void;
  isEditable: boolean;
  billableUnitSizeInput: string;
  onBillableUnitSizeChange: (value: string) => void;
  doseUnitsLabel: string;
  billableUnits: number;
}

/** The BILLING section: the CPT / HCPCS codes with their medication marker, then the billable unit size and
 * the units it yields. */
export const BillingSentences: FC<BillingSentencesProps> = ({
  cptCodes,
  onCptCodesChange,
  isEditable,
  billableUnitSizeInput,
  onBillableUnitSizeChange,
  doseUnitsLabel,
  billableUnits,
}) => (
  <>
    <Sentence>
      CPT / HCPCS codes:{' '}
      {cptCodes.map((code, index) => (
        <Fragment key={code.code}>
          {index > 0 && '; '}
          <Box component="span">
            {code.isMedication ? (
              <Tooltip title="This code is the medication">
                <MedicationIcon color="primary" sx={{ fontSize: 18, verticalAlign: '-3px' }} />
              </Tooltip>
            ) : (
              isEditable && (
                <Tooltip title="Mark as medication">
                  <IconButton
                    size="small"
                    aria-label={`Mark ${code.code} as the medication`}
                    onClick={() => onCptCodesChange(designateMedicationCptCode(cptCodes, code.code))}
                    sx={{ p: '2px' }}
                  >
                    <MedicationOutlinedIcon color="disabled" sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )
            )}{' '}
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }}>
              {code.code} {code.display}
            </Box>
            {isEditable && (
              <IconButton
                size="small"
                aria-label={`Remove ${code.code}`}
                onClick={() => onCptCodesChange(removeCptCode(cptCodes, code.code, true))}
                sx={{ p: '2px', ml: '2px' }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        </Fragment>
      ))}{' '}
      {isEditable ? (
        <PopoverBlank
          label={cptCodes.length ? '+ another' : 'add CPT / HCPCS code'}
          title="CPT / HCPCS code"
          ghost={cptCodes.length > 0}
          readOnly={false}
        >
          {(close) => (
            <Box sx={{ width: 360, maxWidth: '100%', pt: 1 }}>
              <CptCodeSearch
                autoFocus
                onPick={(code) => {
                  onCptCodesChange(addCptCode(cptCodes, code, true));
                  close();
                }}
              />
            </Box>
          )}
        </PopoverBlank>
      ) : (
        cptCodes.length === 0 && (
          <Box component="span" sx={{ color: 'text.secondary' }}>
            none
          </Box>
        )
      )}
    </Sentence>
    <Sentence>
      Billed in units of{' '}
      <TextBlank
        label="Billable unit size"
        placeholder="size"
        value={billableUnitSizeInput}
        onChange={onBillableUnitSizeChange}
        readOnly={!isEditable}
      />{' '}
      {doseUnitsLabel || (
        <Box component="span" sx={{ color: 'text.secondary' }}>
          (units)
        </Box>
      )}
      :{' '}
      <Box component="span" sx={{ fontWeight: 500 }}>
        {billableUnits}
      </Box>{' '}
      billable units.
    </Sentence>
  </>
);
