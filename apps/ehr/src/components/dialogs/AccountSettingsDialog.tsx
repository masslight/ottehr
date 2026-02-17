import { TextField } from '@mui/material';
import { Stack } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { getPatientLoginPhoneNumbers, updatePatientLoginPhoneNumbers } from 'src/api/api';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { useApiClients } from 'src/hooks/useAppClients';

interface Props {
  open: boolean;
  patientId: string;
  handleClose: () => void;
}

export const AccountSettingsDialog: React.FC<Props> = ({ open, patientId, handleClose }) => {
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);

  const { oystehrZambda } = useApiClients();

  const handleConfirm = async (): Promise<void> => {
    try {
      if (oystehrZambda) {
        await updatePatientLoginPhoneNumbers(oystehrZambda, {
          patientId,
          phoneNumbers,
        });
        enqueueSnackbar('Login phone numbers successfully updated', { variant: 'success' });
      }
    } catch {
      enqueueSnackbar('Error occurred', { variant: 'error' });
    }
  };

  useEffect(() => {
    async function fetchPhoneNumbers(): Promise<void> {
      if (oystehrZambda) {
        const response = await getPatientLoginPhoneNumbers(oystehrZambda, {
          patientId,
        });
        setPhoneNumbers(response.phoneNumbers);
      }
    }
    if (open) {
      void fetchPhoneNumbers();
    }
  }, [open, oystehrZambda, patientId, setPhoneNumbers]);

  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={open}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      description="Phone numbers that have access to this patient"
      title="Account Settings"
      confirmText="Save"
      closeButtonText="Cancel"
      ContentComponent={
        <Stack minWidth="500px" spacing={1} paddingTop="8px">
          {phoneNumbers.map((phone, index) => {
            return (
              <TextField
                key={index}
                autoComplete="off"
                variant="outlined"
                size="small"
                label="Phone"
                value={phone}
                onChange={(e) => {
                  phoneNumbers[index] = e.target.value;
                  setPhoneNumbers([...phoneNumbers]);
                }}
              />
            );
          })}
        </Stack>
      }
    />
  );
};
