import { TextField } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { useChartSection } from '../../hooks/useChartSection';
import { useDebounceNotesField } from '../../hooks/useDebounceNotesField';
import { useSyncServerNoteToField } from '../../hooks/useSyncServerNoteToField';

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

  useSyncServerNoteToField({
    serverValue: chartData?.medicalDecision?.text,
    getFieldValue: () => methods.getValues('medicalDecision'),
    setFieldValue: (value) => methods.setValue('medicalDecision', value),
  });

  const { control } = methods;

  const { data: progressNoteConfig } = useProgressNoteConfig();
  const mdmRequired = progressNoteConfig?.mdmRequired ?? true;

  const { onValueChange, isLoading } = useDebounceNotesField('medicalDecision');

  useEffect(() => {
    setIsUpdating(isLoading);
  }, [isLoading, setIsUpdating]);

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
