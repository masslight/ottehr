import { TextField, Typography } from '@mui/material';
import { FC, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { useChartFields } from '../../hooks/useChartFields';
import { useDebounceNotesField } from '../../hooks/useDebounceNotesField';

type MedicalDecisionFieldProps = {
  /** Disables the input while the surrounding card is still loading. */
  loading?: boolean;
  /** Reports the in-flight save, so the surrounding card can show its own spinner. */
  setIsUpdating?: (value: boolean) => void;
  /**
   * Read and write this encounter instead of resolving one from the appointment store — for a page keyed
   * by encounter, where the store is empty and the field would neither load nor save.
   */
  encounterId?: string;
  /** Called after a save lands, for a page that owns its own chart query. */
  onSaved?: () => void;
  /** Overrides the label. The Easy Chart note puts the field's name in its section heading instead. */
  label?: string;
};

export const MedicalDecisionField: FC<MedicalDecisionFieldProps> = ({
  loading,
  setIsUpdating,
  encounterId,
  onSaved,
  label,
}) => {
  const { data: chartData } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
    },
    encounterId,
  });

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

  const { onValueChange, isLoading } = useDebounceNotesField('medicalDecision', { encounterId, onSaved });

  useEffect(() => {
    setIsUpdating?.(isLoading);
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
            onValueChange(e.target.value, {
              refetchChartDataOnSave: true,
            });
          }}
          size="small"
          label={label ?? `Medical Decision Making${mdmRequired ? ' *' : ''}`}
          fullWidth
          multiline
          disabled={loading}
        />
      )}
    />
  );
};

/**
 * The same text, read-only. Mirrors `MedicalDecisionContainer`'s locked branch — on a signed visit the
 * note should read as a document, not as a disabled input.
 */
export const MedicalDecisionFieldReadOnly: FC<Pick<MedicalDecisionFieldProps, 'encounterId'>> = ({ encounterId }) => {
  const { data: chartFields } = useChartFields({
    requestedFields: { medicalDecision: { _tag: 'medical-decision' } },
    encounterId,
  });
  const medicalDecision = chartFields?.medicalDecision?.text;
  if (!medicalDecision) return null;
  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {medicalDecision}
    </Typography>
  );
};
