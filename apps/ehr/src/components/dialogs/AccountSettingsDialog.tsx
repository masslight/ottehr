import { Stack } from '@mui/system';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { TextInput } from '../input/TextInput';

interface Props {
  open: boolean;
  handleClose: () => void;
}

export const AccountSettingsDialog: React.FC<Props> = ({ open, handleClose }) => {
  const methods = useForm();
  //const formValue = methods.watch();

  useEffect(() => {
    if (!open) {
      methods.reset();
    }
  }, [open, methods]);

  const handleConfirm = async (): Promise<void> => {
    console.log('Confirmed!');
  };

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
        <FormProvider {...methods}>
          <Stack minWidth="500px" spacing={1} paddingTop="8px">
            <TextInput name="phone" label="Phone" />
          </Stack>
        </FormProvider>
      }
    />
  );
};
