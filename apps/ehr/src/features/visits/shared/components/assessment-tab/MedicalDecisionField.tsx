import { TextField } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { useChartSection } from '../../hooks/useChartSection';
import { useDebounceNotesField } from '../../hooks/useDebounceNotesField';

type MedicalDecisionFieldProps = {
  loading: boolean;
  setIsUpdating: (value: boolean) => void;
};

export const MedicalDecisionField: FC<MedicalDecisionFieldProps> = ({ loading, setIsUpdating }) => {
  const { data: chartData } = useChartSection('encounterNotes');

  const methods = useForm({
    defaultValues: {
      medicalDecision: chartData?.medicalDecision?.text || '',
    },
  });

  useEffect(() => {
    const newValue = chartData?.medicalDecision?.text || '';
    const currentValue = methods.getValues('medicalDecision');

    if (newValue !== currentValue) {
      methods.setValue('medicalDecision', newValue);
    }
  }, [chartData?.medicalDecision?.text, methods]);

  const { control } = methods;

  const { data: progressNoteConfig } = useProgressNoteConfig();
  const mdmRequired = progressNoteConfig?.mdmRequired ?? true;

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
          label={`Medical Decision Making${mdmRequired ? ' *' : ''}`}
          fullWidth
          multiline
          disabled={loading}
        />
      )}
    />
  );
};
