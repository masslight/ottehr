import { Save } from '@mui/icons-material';
import { Button, CircularProgress } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { FC, useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  createQuestionnaireItemsMap,
  PATIENT_RECORD_CONFIG,
  PATIENT_RECORD_QUESTIONNAIRE,
  pruneEmptySections,
} from 'utils';
import { structureQuestionnaireResponse } from '../../../../../helpers/qr-structure';
import { useUpdatePatientAccount } from '../../../../../hooks/useGetPatient';

const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();
const questionnaireItemsMap = createQuestionnaireItemsMap(questionnaire.item ?? []);

// Hidden logical control-field keys across the patient-record config (e.g.
// `should-display-ssn-field`). These are config-driven flags, never rendered as
// inputs; they gate visible fields (e.g. the SSN input) via enableWhen.
const LOGICAL_FIELD_KEYS = new Set<string>(
  Object.values(PATIENT_RECORD_CONFIG.FormFields).flatMap((section) =>
    Object.values(section.logicalItems ?? {}).map((item) => item.key)
  )
);

// Collect the hidden logical control fields the given fields depend on via enableWhen
// (following chained gating). The backend filters submitted answers by enableWhen, so
// these must accompany the fields they gate or the gated answer (e.g. SSN) is dropped.
const collectLogicalControlFields = (fieldKeys: string[]): string[] => {
  const collected = new Set<string>();
  const queue = [...fieldKeys];
  while (queue.length > 0) {
    const key = queue.shift() as string;
    const enableWhen = questionnaireItemsMap.get(key)?.enableWhen ?? [];
    for (const condition of enableWhen) {
      const controlKey = condition.question;
      if (LOGICAL_FIELD_KEYS.has(controlKey) && !collected.has(controlKey)) {
        collected.add(controlKey);
        queue.push(controlKey);
      }
    }
  }
  return [...collected];
};

interface SectionSaveButtonProps {
  fieldKeys: string[];
  requiredFieldKeys: string[];
  patientId: string | undefined;
  encounterId?: string;
  onSaveSuccess?: () => void;
}

export const SectionSaveButton: FC<SectionSaveButtonProps> = ({
  fieldKeys,
  requiredFieldKeys,
  patientId,
  encounterId,
  onSaveSuccess,
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
    // Include the logical control fields this section's fields depend on so the
    // backend's enableWhen filtering keeps the fields they gate (e.g. SSN). They are
    // never dirty, so they are not added to sectionDirtyFields below.
    [...fieldKeys, ...collectLogicalControlFields(fieldKeys)].forEach((key) => {
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

    try {
      await submitQR.mutateAsync(qr);
    } catch {
      // useUpdatePatientAccount's onError already surfaces a snackbar; swallow
      // here to keep the section dirty (so the Save button stays visible) and
      // avoid an unhandled promise rejection from the click handler.
      return;
    }
    // Clear dirty state only for this section's fields so unsaved edits in other
    // sections keep their dirty markers (and their Save buttons).
    const currentValues = getValues();
    fieldKeys.forEach((key) => {
      resetField(key, { defaultValue: currentValues[key], keepError: false });
    });
    onSaveSuccess?.();
  }, [patientId, encounterId, fieldKeys, dirtyFields, getValues, resetField, submitQR, onSaveSuccess]);

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
