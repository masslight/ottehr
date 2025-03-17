import { Box, Button, useTheme } from '@mui/material';
import { FC, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { usePatientStore } from '../../state/patient.store';
import { dataTestIds } from '../../constants/data-test-ids';
import { enqueueSnackbar } from 'notistack';
import { Questionnaire } from 'fhir/r4b';
import { useUpdatePatientAccount } from '../../hooks/useGetPatient';
import { structureQuestionnaireResponse } from '../../helpers/qr-structure';

type ActionBarProps = {
  handleDiscard: () => void;
  questionnaire: Questionnaire | undefined;
  patientId: string;
};

export const ActionBar: FC<ActionBarProps> = ({ handleDiscard, questionnaire, patientId }) => {
  const theme = useTheme();

  const submitQR = useUpdatePatientAccount();

  const { patchOperations, tempInsurances } = usePatientStore();
  const {
    formState: { isDirty },
    getValues,
    trigger,
  } = useFormContext();

  const hasChanges = useMemo(() => {
    return (
      isDirty ||
      (patchOperations?.patient?.length ?? 0) > 0 ||
      Object.values(patchOperations?.coverages || {}).some((ops) => ops.length > 0) ||
      Object.values(patchOperations?.relatedPersons || {}).some((ops) => ops.length > 0) ||
      tempInsurances.length > 0
    );
  }, [isDirty, patchOperations, tempInsurances]);

  if (!isDirty) return null;

  const handleSave = async (): Promise<void> => {
    // Trigger validation for all fields
    const isValid = await trigger();
    if (!isValid) {
      enqueueSnackbar('Please fix all field validation errors and try again', { variant: 'error' });
      return;
    }

    if (!questionnaire) {
      enqueueSnackbar('Something went wrong. Please reload the page.', { variant: 'error' });
      return;
    }
    console.log('form vals', getValues());
    const qr = structureQuestionnaireResponse(questionnaire, getValues(), patientId);
    console.log('qr', qr);
    submitQR.mutate(qr);
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 999,
        display: 'flex',
        justifyContent: 'space-between',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(2, 6),
        borderTop: `1px solid ${theme.palette.divider}`,
        boxShadow: '0px -3px 3px -2px rgba(0, 0, 0, 0.2)',
      }}
    >
      <Button
        variant="outlined"
        color="primary"
        sx={{
          borderRadius: 25,
          textTransform: 'none',
          fontWeight: 'bold',
        }}
        onClick={handleDiscard}
      >
        Back
      </Button>
      <Button
        data-testid={dataTestIds.patientInformationPage.saveChangesButton}
        variant="contained"
        color="primary"
        disabled={!hasChanges}
        sx={{
          borderRadius: 25,
          textTransform: 'none',
          fontWeight: 'bold',
        }}
        onClick={handleSave}
      >
        Save changes
      </Button>
    </Box>
  );
};
