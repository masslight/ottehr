import { Save } from '@mui/icons-material';
import { Button, CircularProgress } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { FC, useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { PATIENT_RECORD_QUESTIONNAIRE, pruneEmptySections } from 'utils';
import { structureQuestionnaireResponse } from '../../../../../helpers/qr-structure';
import { useUpdatePatientAccount } from '../../../../../hooks/useGetPatient';

const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();

interface SectionSaveButtonProps {
  fieldKeys: string[];
  requiredFieldKeys: string[];
  patientId: string | undefined;
  encounterId?: string;
}

export const SectionSaveButton: FC<SectionSaveButtonProps> = ({
  fieldKeys,
  requiredFieldKeys,
  patientId,
  encounterId,
}) => {
  const queryClient = useQueryClient();
  const { watch, formState, resetField, getValues } = useFormContext();
  const { dirtyFields, errors } = formState;

  const submitQR = useUpdatePatientAccount(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['patient-account-get'] }),
      queryClient.invalidateQueries({ queryKey: ['patient-coverages'] }),
    ]);
  });

  const watchedValues = watch(fieldKeys);

  const isDirty = useMemo(
    () => fieldKeys.some((key) => dirtyFields[key]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldKeys, dirtyFields, watchedValues]
  );

  const hasRequiredFieldErrors = useMemo(
    () => requiredFieldKeys.some((key) => !watch(key) || errors[key]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requiredFieldKeys, errors, watchedValues]
  );

  const handleSave = useCallback(async () => {
    if (!patientId) return;

    const allValues = getValues();
    const sectionValues: Record<string, any> = {};
    fieldKeys.forEach((key) => {
      sectionValues[key] = allValues[key];
    });

    const sectionDirtyFields: Record<string, boolean> = {};
    fieldKeys.forEach((key) => {
      if (dirtyFields[key]) {
        sectionDirtyFields[key] = true;
      }
    });

    const qr = pruneEmptySections(
      structureQuestionnaireResponse(questionnaire, sectionValues, patientId, sectionDirtyFields)
    );
    if (encounterId) {
      qr.encounter = { reference: `Encounter/${encounterId}` };
    }

    await submitQR.mutateAsync(qr);
    // Clear dirty state only for this section's fields so unsaved edits in other
    // sections keep their dirty markers (and their Save buttons).
    const currentValues = getValues();
    fieldKeys.forEach((key) => {
      resetField(key, { defaultValue: currentValues[key], keepError: false });
    });
  }, [patientId, encounterId, fieldKeys, dirtyFields, getValues, resetField, submitQR]);

  if (!isDirty) return null;

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={submitQR.isPending ? <CircularProgress size={14} /> : <Save fontSize="small" />}
      disabled={hasRequiredFieldErrors || submitQR.isPending}
      onClick={handleSave}
      sx={{ textTransform: 'none', fontSize: '13px', py: 0.25, px: 1.5 }}
    >
      Save
    </Button>
  );
};
