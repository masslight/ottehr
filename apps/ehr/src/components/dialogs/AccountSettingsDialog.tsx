import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Button, IconButton } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import { useEffect } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { getPatientLoginPhoneNumbers, updatePatientLoginPhoneNumbers } from 'src/api/api';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { useApiClients } from 'src/hooks/useAppClients';
import { normalizePhoneNumber } from 'utils';
import { PhoneInput } from '../input/PhoneInput';

interface Props {
  patientId: string;
  handleClose: () => void;
}

export const AccountSettingsDialog: React.FC<Props> = ({ patientId, handleClose }) => {
  const methods = useForm();
  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'phones',
  });

  const formValue = methods.watch();

  const { oystehrZambda } = useApiClients();

  const handleConfirm = async (): Promise<void> => {
    const valid = await methods.trigger();
    if (valid) {
      try {
        if (oystehrZambda) {
          await updatePatientLoginPhoneNumbers(oystehrZambda, {
            patientId,
            phoneNumbers: formValue.phones.map((phone: { value: string }) => normalizePhoneNumber(phone.value)),
          });
          enqueueSnackbar('Login phone numbers successfully updated', { variant: 'success' });
        }
      } catch {
        enqueueSnackbar('Error occurred', { variant: 'error' });
      }
      handleClose();
    }
  };

  useEffect(() => {
    async function fetchPhoneNumbers(): Promise<void> {
      if (oystehrZambda) {
        const response = await getPatientLoginPhoneNumbers(oystehrZambda, {
          patientId,
        });
        methods.reset({
          phones: response.phoneNumbers.map((phone) => {
            return {
              value: phone.replace('+1', ''),
            };
          }),
        });
      }
    }
    void fetchPhoneNumbers();
  }, [oystehrZambda, patientId, methods]);

  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={true}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={!formValue.phones || formValue.phones.length === 0}
      description="Phone numbers that have access to this patient"
      title="Account Settings"
      confirmText="Save"
      closeButtonText="Cancel"
      closeOnConfirm={false}
      ContentComponent={
        <FormProvider {...methods}>
          <Stack minWidth="500px" spacing={1} paddingTop="8px">
            {fields.map((field, index) => {
              return (
                <Stack direction="row" spacing={2} key={field.id}>
                  <PhoneInput name={'phones.' + index + '.value'} label="Phone" required />
                  <IconButton onClick={() => remove(index)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              );
            })}
            <Box>
              <Button
                variant="text"
                startIcon={<AddIcon fontSize="small" />}
                style={{ textTransform: 'none' }}
                onClick={() => append({ value: '' })}
              >
                Add number
              </Button>
            </Box>
          </Stack>
        </FormProvider>
      }
    />
  );
};
