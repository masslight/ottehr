import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Button, IconButton, TextField } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { getPatientLoginPhoneNumbers, updatePatientLoginPhoneNumbers } from 'src/api/api';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { useApiClients } from 'src/hooks/useAppClients';
import InputMask from '../InputMask';

interface Props {
  patientId: string;
  handleClose: () => void;
}

export const AccountSettingsDialog: React.FC<Props> = ({ patientId, handleClose }) => {
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
        setPhoneNumbers(response.phoneNumbers.map((phone) => phone.replace('+1', '')));
      }
    }
    void fetchPhoneNumbers();
  }, [oystehrZambda, patientId, setPhoneNumbers]);

  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={true}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={phoneNumbers.length === 0}
      description="Phone numbers that have access to this patient"
      title="Account Settings"
      confirmText="Save"
      closeButtonText="Cancel"
      ContentComponent={
        <Stack minWidth="500px" spacing={1} paddingTop="8px">
          {phoneNumbers.map((phone, index) => {
            return (
              <Stack direction="row" spacing={2}>
                <TextField
                  key={index}
                  autoComplete="off"
                  variant="outlined"
                  size="small"
                  label="Phone"
                  value={phone}
                  style={{ flexGrow: 1 }}
                  onChange={(e) => {
                    phoneNumbers[index] = e.target.value;
                    setPhoneNumbers([...phoneNumbers]);
                  }}
                  inputProps={{ mask: '(000) 000-0000' }}
                  InputProps={{
                    inputComponent: InputMask as any,
                  }}
                />
                <IconButton
                  onClick={() => {
                    phoneNumbers.splice(index, 1);
                    setPhoneNumbers([...phoneNumbers]);
                  }}
                  size="small"
                  color="error"
                >
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
              onClick={() => {
                phoneNumbers.push('');
                setPhoneNumbers([...phoneNumbers]);
              }}
            >
              Add number
            </Button>
          </Box>
        </Stack>
      }
    />
  );
};
