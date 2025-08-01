import { TextField } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
      medicalDecision: chartData?.medicalDecision?.text || '',
    },
  });

  useEffect(() => {
    if (!methods.getValues('medicalDecision') && chartData?.medicalDecision?.text) {
      methods.setValue('medicalDecision', chartData.medicalDecision.text);
    }
  }, [chartData?.medicalDecision?.text, methods]);

  const { control } = methods;

  const { onValueChange, isLoading } = useDebounceNotesField('medicalDecision');

  useEffect(() => {
    setIsUpdating(isLoading);
  }, [isLoading, setIsUpdating]);

  useEffect(() => {
    if (chartData?.medicalDecision?.text && !methods.getValues('medicalDecision')) {
      methods.setValue('medicalDecision', chartData.medicalDecision.text);
    }
  }, [chartData?.medicalDecision?.text, methods]);

  return (
    <Controller
      name="medicalDecision"
      control={control}
      render={({ field: { value, onChange } }) => (
        <TextField
          data-testid={dataTestIds.assessmentCard.medicalDecisionField}
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
