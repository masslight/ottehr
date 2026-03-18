import { otherColors } from '@ehrTheme/colors';
import { Add } from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, CircularProgress, Grid, Paper, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { Stack } from '@mui/system';
import { InHouseMedicationQuickPick } from 'config-types';
import { DateTime } from 'luxon';
import { useEffect } from 'react';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createInHouseMedicationQuickPick, getInHouseMedicationsQuickPicks } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  APIErrorCode,
  ExtendedMedicationDataForResponse,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
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
import { InHouseMedicationFieldType } from './utils';

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
  onQuickPickSelect?: (quickPick: (typeof MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks)[number]) => void;
};

const CreateQuickPickDialog = ({
  createQuickPickOpen,
  setCreateQuickPickOpen,
  localValues,
}: {
  createQuickPickOpen: boolean;
  setCreateQuickPickOpen: (open: boolean) => void;
  localValues: Partial<MedicationData>;
}): React.ReactElement => {
  const { oystehrZambda } = useApiClients();
  const [quickPickName, setQuickPickName] = React.useState('');
  const [createQuickPickLoading, setCreateQuickPickLoading] = React.useState(false);
  const [createQuickPickError, setCreateQuickPickError] = React.useState<string | undefined>(undefined);
  const [quickPickNameExistsError, setQuickPickNameExistsError] = React.useState<boolean>(false);

  async function createQuickPick(update?: boolean): Promise<void> {
    const { medicationId, dose, units, route, instructions } = localValues;
    if (!oystehrZambda) {
      return;
    }
    if (!medicationId || !dose || !units || !route) {
      setCreateQuickPickError('Medication, dose, units, and route are required');
      return;
    }
    if (!quickPickName) {
      setCreateQuickPickError('Name is required');
      return;
    }

    setCreateQuickPickLoading(true);
    setCreateQuickPickError(undefined);
    console.log(update);
    try {
      await createInHouseMedicationQuickPick(oystehrZambda, {
        name: quickPickName,
        medicationID: medicationId,
        dose: dose,
        units: units,
        route: route,
        instructions: instructions,
        ...(typeof update === 'boolean' ? { update: update } : {}),
      });
      setQuickPickName('');
      setCreateQuickPickError(undefined);
      setQuickPickNameExistsError(false);
      setCreateQuickPickOpen(false);
    } catch (error: any) {
      console.error('Error creating quick pick:', error);
      setCreateQuickPickError(error.message);
      if (error.code === APIErrorCode.QUICK_PICK_NAME_EXISTS) {
        setQuickPickNameExistsError(true);
      }
    }
    setCreateQuickPickLoading(false);
  }

  return (
    <CustomDialog
      open={createQuickPickOpen}
      confirmLoading={createQuickPickLoading}
      handleConfirm={createQuickPick}
      confirmText="Create quick pick"
      handleClose={async () => {
        setCreateQuickPickOpen(false);
      }}
      title="Create quick pick"
      description={
        <div style={{ width: '500px' }}>
          <TextField
            required
            fullWidth
            label="Name"
            sx={{ marginTop: 1 }}
            value={quickPickName}
            onChange={(event) => setQuickPickName(event.target.value)}
          />
          {createQuickPickError && (
            <Typography variant="body2" color="error" sx={{ marginTop: 1 }}>
              {createQuickPickError}
            </Typography>
          )}
          {quickPickNameExistsError && (
            <LoadingButton
              variant="outlined"
              color="primary"
              onClick={() => createQuickPick(true)}
              loading={createQuickPickLoading}
              sx={{
                fontWeight: 500,
                borderRadius: '100px',
                mr: '8px',
                textTransform: 'none',
              }}
            >
              Update quick pick
            </LoadingButton>
          )}
        </div>
      }
      closeButtonText="Cancel"
    />
  );
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
  onQuickPickSelect,
}) => {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const { id: appointmentId } = useParams();
  const [createQuickPickOpen, setCreateQuickPickOpen] = React.useState(false);
  const theme = useTheme();

  const [inHouseMedicationsQuickPicksOptions, setInHouseMedicationsQuickPicksOptions] = React.useState<
    InHouseMedicationQuickPick[] | undefined
  >(undefined);

  useEffect(() => {
    async function fetchMedicationsQuickPicks(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      let inHouseMedicationQuickPicksTemp = await getInHouseMedicationsQuickPicks(oystehrZambda);
      inHouseMedicationQuickPicksTemp = inHouseMedicationQuickPicksTemp.filter(
        (quickPick) => quickPick.status === 'active'
      );
      setInHouseMedicationsQuickPicksOptions(inHouseMedicationQuickPicksTemp);
    }
    fetchMedicationsQuickPicks().catch((error) =>
      console.log('Error fetching in house quick picks medications', error)
    );
  }, [oystehrZambda]);

  const showAddFromQuickPicks =
    (type === 'order-new' || type === 'order-edit') &&
    onQuickPickSelect &&
    inHouseMedicationsQuickPicksOptions &&
    inHouseMedicationsQuickPicksOptions.length > 0;

  const canAddQuickPick = localValues.medicationId && localValues.dose && localValues.units && localValues.route;

  const OrderFooter = (): React.ReactElement => {
    return (
      <Box sx={{ minHeight: '40px' }} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" gap={2}>
          <ButtonRounded
            data-testid={dataTestIds.orderMedicationPage.backButton}
            variant="outlined"
            onClick={() => navigate(getInHouseMedicationMARUrl(appointmentId!))}
            color="primary"
            size="large"
            startIcon={<ArrowBackIcon />}
          >
            Back
          </ButtonRounded>
          {!isReadOnly && onDelete && type !== 'order-new' && (
            <ButtonRounded onClick={onDelete} variant="outlined" color="error" size="large">
              Delete Order
            </ButtonRounded>
          )}
          <Tooltip
            title={
              canAddQuickPick ? '' : 'To save a quick pick, the medication, dose, units, and route inputs are required'
            }
            placement="top"
          >
            <span>
              <ButtonRounded
                onClick={() => setCreateQuickPickOpen(true)}
                variant="outlined"
                color="primary"
                size="large"
                startIcon={<Add />}
                disabled={!canAddQuickPick}
              >
                Save Quick Pick
              </ButtonRounded>
            </span>
          </Tooltip>
        </Box>
        {isEditable && (
          <ButtonRounded
            data-testid={dataTestIds.orderMedicationPage.fillOrderToSaveButton}
            disabled={isSaveButtonDisabled}
            onClick={() =>
              onSave(
                makeMedicationOrderUpdateRequestInput({
                  id: medication?.id,
                  orderData: { ...localValues },
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
          {!isReadOnly && onDelete && (
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
                    orderData: { ...localValues },
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
                    orderData: { ...localValues },
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
                    orderData: { ...localValues },
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
        {showAddFromQuickPicks && (
          <Grid item xs={12}>
            <QuickPicksButton
              quickPicks={inHouseMedicationsQuickPicksOptions}
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
        <CreateQuickPickDialog
          createQuickPickOpen={createQuickPickOpen}
          setCreateQuickPickOpen={setCreateQuickPickOpen}
          localValues={localValues}
        />
        {Object.entries(fieldsConfig).map(([field, config]) => {
          const value = getFieldValue(field as keyof MedicationData);
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
          {type === 'dispense' || type === 'dispense-not-administered' ? <DispenseFooter /> : <OrderFooter />}
        </Grid>
      </Grid>
    </Paper>
  );
};
