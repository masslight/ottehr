import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Patient } from 'fhir/r4b';
import { ReactElement, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useEditPatientNameMutation } from '../../../hooks';
import { useAppointmentStore } from '../../../state';

interface EditPatientNameDialogProps {
  modalOpen: boolean;
  onClose: () => void;
}

interface FormInputs {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

export const EditPatientNameDialog = ({ modalOpen, onClose }: EditPatientNameDialogProps): ReactElement => {
  const { register, handleSubmit, formState, setValue } = useForm<FormInputs>();
  const [error, setError] = useState(false);
  const { patient } = getSelectors(useAppointmentStore, ['patient']);

  useEffect(() => {
    setValue('firstName', patient?.name?.[0]?.given?.[0]);
    setValue('middleName', patient?.name?.[0]?.given?.[1]);
    setValue('lastName', patient?.name?.[0]?.family);
  }, [patient, setValue]);

  const editPatientName = useEditPatientNameMutation();

  const onSubmit = async (data: FormInputs): Promise<void> => {
    try {
      if (!patient?.id) {
        throw new Error('Patient reference not provided');
      }

      const patientData: Patient = {
        ...patient,
        resourceType: 'Patient',
        id: patient.id,
        name: [
          {
            use: 'official',
            family: data.lastName,
            given: [data.firstName!],
          },
        ],
      };
      if (data.middleName) {
        patientData.name![0].given?.push(data.middleName);
      }
      await editPatientName.mutateAsync(
        { patientData: patientData },
        {
          onSuccess: (updatedData) => {
            useAppointmentStore.setState({
              patient: { ...updatedData },
            });
            onClose();
          },
        }
      );
    } catch (error) {
      setError(true);
      console.error('Error while updating patient name: ', error);
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onClose={onClose}
      fullWidth
      disableScrollLock
      sx={{ '.MuiPaper-root': { padding: 1, width: '444px', maxWidth: 'initial' } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle
          variant="h4"
          color="primary.dark"
          sx={{ width: '100%', py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}
        >
          Please enter patient name
          <IconButton onClick={onClose} aria-label="close" sx={{ mr: -3, mt: -3 }}>
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth required sx={{ mt: 1 }}>
            <TextField
              {...register('firstName', { required: true })}
              id="first-name"
              label="First Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.firstName}
              required
            />
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <TextField
              {...register('middleName')}
              id="middle-name"
              label="Middle Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.middleName}
            />
          </FormControl>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <TextField
              {...register('lastName', { required: true })}
              id="last-name"
              label="Last Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.lastName}
              required
            />
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton
            loading={editPatientName.isPending}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, ml: 1, mb: 1, px: 4 }}
            disabled={!formState.isValid}
          >
            Update Patient Name
          </LoadingButton>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            Failed to update patient name, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};
