import React, { FC, useEffect } from 'react';
import { TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useDebounceNotesField } from '../../../../hooks';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

const DEFAULT_TEXT =
  'Reviewed diagnosis, expected course, treatment plan, and reasons to seek urgent and/or emergent care.  Discharge instructions reviewed.  Caregiver expressed understanding.  All questions were answered, and caregiver is comfortable with discharge plan.';

type MedicalDecisionFieldProps = {
  loading: boolean;
  setIsUpdating: (value: boolean) => void;
};

export const MedicalDecisionField: FC<MedicalDecisionFieldProps> = ({ loading, setIsUpdating }) => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const methods = useForm({
    defaultValues: {
      medicalDecision: chartData?.medicalDecision?.text || DEFAULT_TEXT,
    },
  });
  const { control } = methods;

  const { onValueChange, isLoading } = useDebounceNotesField('medicalDecision');

  useEffect(() => {
    if (!loading && !chartData?.medicalDecision) {
      onValueChange(DEFAULT_TEXT);
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
