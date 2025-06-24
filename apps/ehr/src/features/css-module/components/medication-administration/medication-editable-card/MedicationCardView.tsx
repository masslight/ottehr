import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Grid, Paper, Typography } from '@mui/material';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ExtendedMedicationDataForResponse,
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  makeMedicationOrderUpdateRequestInput,
  MedicationData,
  MedicationOrderStatusesType,
  UpdateMedicationOrderInput,
} from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { OrderFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { getInHouseMedicationMARUrl } from '../../../routing/helpers';
import { CSSLoader } from '../../CSSLoader';
import { ButtonRounded } from '../../RoundedButton';
import { MedicationStatusChip } from '../statuses/MedicationStatusChip';
import { MedicationCardField } from './MedicationCardField';
import { InHouseMedicationFieldType } from './utils';

type MedicationCardViewProps = {
  type: 'dispense' | 'order-new' | 'order-edit';
  onSave: (medicationSaveOrUpdateRequest: UpdateMedicationOrderInput) => void;
  medication?: ExtendedMedicationDataForResponse;
  fieldsConfig: Partial<
    Record<
      keyof MedicationData,
      {
        xs: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
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
}) => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();

  const OrderFooter = (): React.ReactElement => {
    return (
      <Box sx={{ minHeight: '40px' }} display="flex" justifyContent="space-between" alignItems="center">
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
        <MedicationStatusChip
          isEditable={false}
          medication={medication}
          onClick={onStatusSelect}
          status={selectedStatus}
        />
        {isEditable && (
          <Box display="flex" flexDirection="row" gap={2}>
            <ButtonRounded
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
        <Grid
          item
          xs={12}
          sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          {type !== 'order-new' && (
            <Typography gutterBottom sx={{ height: '26px', display: 'flex', flexDirection: 'row', gap: 3 }}>
              <span>Order ID: {medication?.id}</span>
              <span>
                {medication?.dateGiven} {medication?.timeGiven}
              </span>
              <span>by {medication?.providerCreatedTheOrder}</span>{' '}
            </Typography>
          )}
          {isUpdating && (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <CSSLoader size={24} height={'30px'} width={'30px'} />
              <Box ml={1}>Saving...</Box>
            </div>
          )}
        </Grid>
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
                isEditable={isEditable}
                field={field as keyof MedicationData}
                label={field}
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
        <Grid item xs={12}>
          {type === 'dispense' ? <DispenseFooter /> : <OrderFooter />}
        </Grid>
      </Grid>
    </Paper>
  );
};
