import { otherColors } from '@ehrTheme/colors';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import { Box, CircularProgress, Grid, InputAdornment, Paper, TextField, Typography, useTheme } from '@mui/material';
import Alert from '@mui/material/Alert';
import { Stack } from '@mui/system';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  computeBillableUnits,
  ExtendedMedicationDataForResponse,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  InHouseMedicationQuickPickData,
  makeMedicationOrderUpdateRequestInput,
  MEDICAL_HISTORY_CONFIG,
  MedicationData,
  MedicationOrderStatusesType,
  UpdateMedicationOrderInput,
} from 'utils';
import { dataTestIds } from '../../../../../../constants/data-test-ids';
import { Loader } from '../../../../shared/components/Loader';
import { QuickPicksButton } from '../../../../shared/components/QuickPicksButton';
import { OrderFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { getInHouseMedicationMARUrl } from '../../../routing/helpers';
import { ButtonRounded } from '../../RoundedButton';
import { MedicationStatusChip } from '../statuses/MedicationStatusChip';
import { getFieldLabel, MedicationFieldType, MedicationOrderType, XsVariants } from './fieldsConfig';
import { MedicationCardField } from './MedicationCardField';
import { MedicationCptCodes } from './MedicationCptCodes';
import { InHouseMedicationFieldType, isLikelyMedicationCode } from './utils';

export interface InteractionsMessage {
  style: 'loading' | 'warning' | 'success';
  message: string;
}

type MedicationCardViewProps = {
  type: MedicationOrderType;
  onSave: (medicationSaveOrUpdateRequest: UpdateMedicationOrderInput) => void;
  medication?: ExtendedMedicationDataForResponse;
  fieldsConfig: Partial<
    Record<
      keyof MedicationData,
      {
        xs: XsVariants;
        isRequired: boolean;
      }
    >
  >;
  localValues: Partial<MedicationData>;
  selectedStatus?: MedicationOrderStatusesType;
  isUpdating: boolean;
  onFieldValueChange: <Field extends keyof MedicationData>(field: Field, value: MedicationData[Field]) => void;
  onStatusSelect: (newStatus: MedicationOrderStatusesType) => void;
  getFieldValue: <Field extends keyof MedicationData>(
    field: Field,
    type?: string
  ) => MedicationData[Field] | '' | undefined;
  showErrors: boolean;
  fieldErrors: Record<string, boolean>;
  getFieldType: (field: keyof MedicationData) => InHouseMedicationFieldType;
  isEditable: boolean;
  saveButtonText: string;
  isSaveButtonDisabled: boolean;
  selectsOptions: OrderFieldsSelectsOptions;
  interactionsMessage?: InteractionsMessage;
  onInteractionsMessageClick: () => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
  onBack?: () => void;
  onClearForm?: () => void;
  onQuickPickSelect?: (quickPick: (typeof MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks)[number]) => void;
  fhirQuickPicks?: InHouseMedicationQuickPickData[];
  fhirQuickPicksLoading?: boolean;
  onFhirQuickPickSelect?: (quickPick: InHouseMedicationQuickPickData) => void;
  showQuickPickAddOption?: boolean;
  isAdmin?: boolean;
  onQuickPickAddOrUpdate?: () => void;
};

export const MedicationCardView: React.FC<MedicationCardViewProps> = ({
  onSave,
  medication,
  fieldsConfig,
  localValues,
  selectedStatus,
  isUpdating,
  onFieldValueChange,
  onStatusSelect,
  getFieldValue,
  type,
  showErrors,
  fieldErrors,
  getFieldType,
  isEditable,
  saveButtonText,
  isSaveButtonDisabled,
  selectsOptions,
  interactionsMessage,
  onInteractionsMessageClick,
  onDelete,
  isReadOnly,
  onBack,
  onClearForm,
  onQuickPickSelect,
  fhirQuickPicks,
  fhirQuickPicksLoading = false,
  onFhirQuickPickSelect,
  showQuickPickAddOption,
  isAdmin,
  onQuickPickAddOrUpdate,
}) => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const theme = useTheme();

  // Billing unit size: local UI state (string, to allow intermediate values like "2."),
  // initialized from the saved medication-designated CPT code when editing an existing order
  const [billableUnitSizeInput, setBillableUnitSizeInput] = useState(() => {
    const saved = localValues.cptCodes?.find((c) => c.isMedication || c.billableUnitSize != null)?.billableUnitSize;
    return saved != null ? String(saved) : '';
  });

  const billableUnitSize = useMemo(() => {
    const parsed = Number(billableUnitSizeInput);
    return billableUnitSizeInput !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [billableUnitSizeInput]);

  const doseUnitsLabel = useMemo(() => {
    const unitsValue = localValues.units;
    if (!unitsValue) return '';
    return selectsOptions.units.options.find((option) => option.value === unitsValue)?.label ?? unitsValue;
  }, [localValues.units, selectsOptions.units.options]);

  const billableUnits = useMemo(
    () => computeBillableUnits(localValues.dose, billableUnitSize),
    [localValues.dose, billableUnitSize]
  );

  // Normalize to exactly one medication-designated code (default: first), and attach
  // billing data to that code only
  const withBillingData = (
    codes: NonNullable<MedicationData['cptCodes']>,
    unitSize: number | undefined
  ): NonNullable<MedicationData['cptCodes']> => {
    const designatedIndex = Math.max(
      0,
      codes.findIndex((c) => c.isMedication)
    );
    return codes.map(({ code, display }, index) => {
      const isMedicationCode = index === designatedIndex;
      return {
        code,
        display,
        ...(isMedicationCode ? { isMedication: true } : {}),
        ...(isMedicationCode && unitSize != null
          ? { billableUnitSize: unitSize, billableUnits: computeBillableUnits(localValues.dose, unitSize) }
          : {}),
      };
    });
  };

  const handleBillableUnitSizeChange = (value: string): void => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setBillableUnitSizeInput(value);
    // Write billing data through to the medication-designated CPT code so it is included
    // anywhere localValues is saved (order save, quick pick save)
    const parsed = Number(value);
    const newUnitSize = value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    if (localValues.cptCodes?.length) {
      onFieldValueChange('cptCodes', withBillingData(localValues.cptCodes, newUnitSize));
    }
  };

  // Sync the input when billing data changes externally (e.g. a quick pick is selected)
  const externalUnitSize = localValues.cptCodes?.find((c) => c.isMedication || c.billableUnitSize != null)
    ?.billableUnitSize;
  useEffect(() => {
    if (externalUnitSize != null) {
      if (externalUnitSize !== billableUnitSize) setBillableUnitSizeInput(String(externalUnitSize));
    } else if ((localValues.cptCodes?.length ?? 0) > 0 && billableUnitSize != null) {
      setBillableUnitSizeInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalUnitSize, localValues.cptCodes]);

  // Recompute billable units against the current dose at save time
  const buildOrderDataForSave = (): Partial<MedicationData> => ({
    ...localValues,
    cptCodes: localValues.cptCodes ? withBillingData(localValues.cptCodes, billableUnitSize) : undefined,
  });

  // Warn when the medication designation looks inconsistent with typical medication code ranges
  const billingWarnings = useMemo(() => {
    const codes = localValues.cptCodes ?? [];
    if (codes.length === 0) return [];
    const warnings: string[] = [];
    const designated = codes.find((c) => c.isMedication) ?? codes[0];
    const likelyMedications = codes.filter((c) => isLikelyMedicationCode(c.code));
    if (!isLikelyMedicationCode(designated.code)) {
      warnings.push(`Code ${designated.code} is marked as the medication but does not appear to be a medication code.`);
    }
    if (likelyMedications.length > 1) {
      warnings.push(
        `Multiple selected codes appear to be medications: ${likelyMedications
          .map((c) => c.code)
          .join(', ')}. Only one code should be marked as the medication.`
      );
    }
    return warnings;
  }, [localValues.cptCodes]);

  const inHouseMedicationsquickPicksList = useMemo(() => {
    const medispanCodeSet = selectsOptions.medicationId.medispanCodeSet ?? new Set<string>();
    const ndcCodeSet = selectsOptions.medicationId.ndcCodeSet ?? new Set<string>();
    type QuickPick = (typeof MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks)[number];
    const hasNdc = (pick: QuickPick): boolean => pick.ndc != null && ndcCodeSet.has(pick.ndc);
    const hasMedispan = (pick: QuickPick): boolean =>
      pick.dosespotId != null && medispanCodeSet.has(String(pick.dosespotId));
    return MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks.filter((f) => hasNdc(f) || hasMedispan(f));
  }, [selectsOptions.medicationId.medispanCodeSet, selectsOptions.medicationId.ndcCodeSet]);

  const showHardcodedQuickPicks =
    (type === 'order-new' || type === 'order-edit') && onQuickPickSelect && inHouseMedicationsquickPicksList.length > 0;
  const showFhirQuickPicks =
    onFhirQuickPickSelect && (showQuickPickAddOption || (fhirQuickPicks && fhirQuickPicks.length > 0));

  const OrderFooter = (): React.ReactElement => {
    return (
      <Box sx={{ minHeight: '40px' }} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" gap={2}>
          <ButtonRounded
            data-testid={dataTestIds.orderMedicationPage.backButton}
            variant="outlined"
            onClick={() => (onBack ? onBack() : navigate(getInHouseMedicationMARUrl(appointmentId!)))}
            color="primary"
            size="large"
            startIcon={<ArrowBackIcon />}
          >
            Back
          </ButtonRounded>
          {onClearForm && (
            <ButtonRounded variant="outlined" color="primary" size="large" onClick={onClearForm}>
              Clear Form
            </ButtonRounded>
          )}
          {!isReadOnly && onDelete && type !== 'order-new' && (
            <ButtonRounded onClick={onDelete} variant="outlined" color="error" size="large">
              Delete Order
            </ButtonRounded>
          )}
        </Box>
        {isEditable && (
          <ButtonRounded
            data-testid={dataTestIds.orderMedicationPage.fillOrderToSaveButton}
            disabled={isSaveButtonDisabled}
            onClick={() =>
              onSave(
                makeMedicationOrderUpdateRequestInput({
                  id: medication?.id,
                  orderData: buildOrderDataForSave(),
                  newStatus: selectedStatus,
                })
              )
            }
            variant="contained"
            color="primary"
            size="large"
          >
            {saveButtonText}
          </ButtonRounded>
        )}
      </Box>
    );
  };

  const DispenseFooter = (): React.ReactElement => {
    return (
      <Box sx={{ minHeight: '40px' }} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" gap={2}>
          <MedicationStatusChip
            isEditable={false}
            medication={medication}
            onClick={onStatusSelect}
            status={selectedStatus}
          />
          {!isReadOnly && onDelete && type !== 'completed-edit' && (
            <ButtonRounded onClick={onDelete} variant="outlined" color="error" size="large">
              Delete Order
            </ButtonRounded>
          )}
        </Box>
        {isEditable && (
          <Box display="flex" flexDirection="row" gap={2}>
            <ButtonRounded
              data-testid={dataTestIds.inHouseMedicationsPage.notAdministeredButton}
              disabled={isSaveButtonDisabled}
              onClick={() =>
                onSave(
                  makeMedicationOrderUpdateRequestInput({
                    id: medication?.id,
                    orderData: buildOrderDataForSave(),
                    newStatus: 'administered-not',
                  })
                )
              }
              variant="outlined"
              color="primary"
              size="large"
            >
              Not Administered
            </ButtonRounded>
            <ButtonRounded
              data-testid={dataTestIds.inHouseMedicationsPage.partlyAdministeredButton}
              disabled={isSaveButtonDisabled}
              onClick={() =>
                onSave(
                  makeMedicationOrderUpdateRequestInput({
                    id: medication?.id,
                    orderData: buildOrderDataForSave(),
                    newStatus: 'administered-partly',
                  })
                )
              }
              variant="outlined"
              color="primary"
              size="large"
            >
              Partly Administered
            </ButtonRounded>
            <ButtonRounded
              data-testid={dataTestIds.inHouseMedicationsPage.administeredButton}
              disabled={isSaveButtonDisabled}
              onClick={() =>
                onSave(
                  makeMedicationOrderUpdateRequestInput({
                    id: medication?.id,
                    orderData: buildOrderDataForSave(),
                    newStatus: 'administered',
                  })
                )
              }
              variant="contained"
              color="primary"
              size="large"
            >
              Administered
            </ButtonRounded>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={2}>
        {showFhirQuickPicks && (
          <Grid item xs={12}>
            <QuickPicksButton
              quickPicks={fhirQuickPicks ?? []}
              loading={fhirQuickPicksLoading}
              getLabel={(qp) => {
                const parts = [qp.name] as string[];
                if (qp.dose != null && qp.units != null) {
                  parts.push(`${qp.dose} ${qp.units}`);
                }
                return parts.join(', ');
              }}
              onSelect={onFhirQuickPickSelect!}
              disabled={isUpdating}
              showAddOption={showQuickPickAddOption}
              isAdmin={isAdmin}
              onAddOrUpdate={onQuickPickAddOrUpdate}
            />
          </Grid>
        )}
        {!showFhirQuickPicks && showHardcodedQuickPicks && (
          <Grid item xs={12}>
            <QuickPicksButton
              quickPicks={inHouseMedicationsquickPicksList}
              getLabel={(quickPick) => {
                const parts = [quickPick.name] as string[];
                if (quickPick.dose != null && quickPick.units != null) {
                  parts.push(`${quickPick.dose} ${quickPick.units}`);
                } else if (quickPick.dose != null) {
                  parts.push(String(quickPick.dose));
                }
                if (quickPick.route != null) {
                  const routeLabel =
                    selectsOptions.route.options.find((o) => o.value === quickPick.route)?.label ?? quickPick.route;
                  parts.push(routeLabel);
                }
                return parts.join(', ');
              }}
              onSelect={onQuickPickSelect}
              disabled={isUpdating}
            />
          </Grid>
        )}
        <Grid
          item
          xs={12}
          sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          {type !== 'order-new' && (
            <Typography gutterBottom sx={{ height: '26px', display: 'flex', flexDirection: 'row', gap: 3 }}>
              <span>Order ID: {medication?.id}</span>
              <span>
                {medication?.effectiveDateTime
                  ? DateTime.fromISO(medication.effectiveDateTime).toFormat('MM/dd/yyyy hh:mm a')
                  : ''}
              </span>
            </Typography>
          )}
          {isUpdating && (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Loader size={24} height={'30px'} width={'30px'} />
              <Box ml={1}>Saving...</Box>
            </div>
          )}
        </Grid>
        {Object.entries(fieldsConfig).map(([field, config]) => {
          if (field === 'cptCodes') return null; // Rendered separately below
          const value = getFieldValue(field as keyof MedicationData) as
            | string
            | number
            | NonNullable<MedicationData['location']>
            | undefined;
          let renderValue: string | undefined;

          // renderValue handles edge case when backend created new medication resource without id
          if (field === 'medicationId' && medication?.medicationName && value === IN_HOUSE_CONTAINED_MEDICATION_ID) {
            renderValue = medication.medicationName;
          }

          return (
            <Grid item xs={config!.xs} key={field}>
              <MedicationCardField
                isEditable={isEditable && !(type === 'dispense' && field === 'medicationId')}
                field={field as MedicationFieldType}
                label={getFieldLabel(field as MedicationFieldType, type)}
                type={getFieldType(field as keyof MedicationData)}
                value={value}
                renderValue={renderValue}
                onChange={onFieldValueChange}
                required={config!.isRequired}
                showError={showErrors || fieldErrors[field]}
                selectsOptions={selectsOptions}
              />
            </Grid>
          );
        })}
        {interactionsMessage ? (
          <Grid item xs={12}>
            <Stack
              style={{
                background:
                  interactionsMessage.style === 'warning'
                    ? otherColors.lightErrorBg
                    : interactionsMessage.style === 'success'
                    ? otherColors.lightGreen
                    : 'none',
                padding: '16px',
                borderRadius: '4px',
                width: '100%',
                cursor: 'pointer',
              }}
              alignItems="center"
              direction="row"
              onClick={onInteractionsMessageClick}
            >
              {interactionsMessage.style === 'warning' ? (
                <ErrorOutlineOutlined style={{ width: '20px', height: '20px', color: theme.palette.error.main }} />
              ) : interactionsMessage.style === 'success' ? (
                <CheckCircleOutline style={{ width: '20px', height: '20px', color: theme.palette.success.main }} />
              ) : (
                <CircularProgress size="16px" />
              )}
              <Typography
                variant="body2"
                style={{
                  color:
                    interactionsMessage.style === 'warning'
                      ? otherColors.lightErrorText
                      : interactionsMessage.style === 'success'
                      ? otherColors.darkGreenText
                      : '#000',
                  marginLeft: '12px',
                }}
                display="inline"
              >
                <span style={{ fontWeight: '500' }}>Interaction: </span>
                {interactionsMessage.message}
              </Typography>
            </Stack>
          </Grid>
        ) : null}
        <Grid item xs={12}>
          <MedicationCptCodes
            cptCodes={localValues.cptCodes ?? []}
            onChange={(codes) => onFieldValueChange('cptCodes', withBillingData(codes, billableUnitSize))}
            isEditable={isEditable}
            showMedicationDesignation
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Billable Unit Size"
            size="small"
            fullWidth
            value={billableUnitSizeInput}
            onChange={(e) => handleBillableUnitSizeChange(e.target.value)}
            disabled={!isEditable}
            inputProps={{ inputMode: 'decimal' }}
            InputProps={{
              endAdornment: doseUnitsLabel ? (
                <InputAdornment position="end">
                  <Typography variant="body2" color="text.secondary">
                    {doseUnitsLabel}
                  </Typography>
                </InputAdornment>
              ) : undefined,
            }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Billable Units"
            size="small"
            fullWidth
            value={billableUnits}
            InputProps={{ readOnly: true }}
          />
        </Grid>
        {billingWarnings.map((warning) => (
          <Grid item xs={12} key={warning}>
            <Alert severity="warning">{warning}</Alert>
          </Grid>
        ))}
        <Grid item xs={12}>
          {type === 'dispense' || type === 'dispense-not-administered' || type === 'completed-edit' ? (
            <DispenseFooter />
          ) : (
            <OrderFooter />
          )}
        </Grid>
      </Grid>
    </Paper>
  );
};
