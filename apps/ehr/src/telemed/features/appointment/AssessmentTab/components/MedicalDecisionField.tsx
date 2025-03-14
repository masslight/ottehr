import { TextField } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MDM_FIELD_DEFAULT_TEXT } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useDebounceNotesField } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';

type MedicalDecisionFieldProps = {
  loading: boolean;
  setIsUpdating: (value: boolean) => void;
};

export const MedicalDecisionField: FC<MedicalDecisionFieldProps> = ({ loading, setIsUpdating }) => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const methods = useForm({
    defaultValues: {
      medicalDecision: chartData?.medicalDecision?.text || MDM_FIELD_DEFAULT_TEXT,
    },
  });
  const { control } = methods;

  const { onValueChange, isLoading } = useDebounceNotesField('medicalDecision');

  useEffect(() => {
    if (!loading && !chartData?.medicalDecision) {
      onValueChange(MDM_FIELD_DEFAULT_TEXT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    setIsUpdating(isLoading);
  }, [isLoading, setIsUpdating]);

  return (
    <Controller
      name="medicalDecision"
      control={control}
      render={({ field: { value, onChange } }) => (
        <TextField
          data-testid={dataTestIds.assessmentPage.medicalDecisionField}
          value={value}
          onChange={(e) => {
            onChange(e);
            onValueChange(e.target.value);
          }}
          size="small"
          label="Medical Decision Making *"
          fullWidth
          multiline
          disabled={loading}
        />
      )}
    />
  );
};
