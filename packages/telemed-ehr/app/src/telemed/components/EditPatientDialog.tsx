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
import { Patient } from 'fhir/r4';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import DateSearch from '../../components/DateSearch';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore, useEditPatientInformationMutation } from '../state';

interface EditPatientDialogProps {
  modalOpen: boolean;
  onClose: () => void;
}

interface FormInputs {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth: DateTime | null;
}

const EditPatientDialog = ({ modalOpen, onClose }: EditPatientDialogProps): ReactElement => {
  const {
    register,
    handleSubmit,
    formState,
    control,
    setError: setFormError,
    resetField,
    setValue,
    getValues,
  } = useForm<FormInputs>();
  const [error, setError] = useState(false);
  const { patient } = getSelectors(useAppointmentStore, ['patient']);

  useEffect(() => {
    setValue('dateOfBirth', patient?.birthDate ? DateTime.fromISO(patient?.birthDate) : null);
    setValue('firstName', patient?.name?.[0]?.given?.[0]);
    setValue('middleName', patient?.name?.[0]?.given?.[1]);
    setValue('lastName', patient?.name?.[0]?.family);
  }, [patient, setValue]);

  const editPatient = useEditPatientInformationMutation();

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
        birthDate: data.dateOfBirth!.toISODate()!,
      };
      if (data.middleName) {
        patientData.name![0].given?.push(data.middleName);
      }
      await editPatient.mutateAsync(
        { patientData: patientData },
        {
          onSuccess: () => {
            useAppointmentStore.setState({
              patient: { ...patientData },
            });
            onClose();
          },
        },
      );
    } catch (error) {
      setError(true);
      console.error('Error while editing patient information: ', error);
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
          Edit Patient Information
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
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <Controller
              name={'dateOfBirth'}
              control={control}
              render={({ field: { value } }) => (
                <DateSearch
                  date={value || null}
                  setDate={(date) => setValue('dateOfBirth', date)}
                  setIsValidDate={(valid) => {
                    if (valid) {
                      const val = getValues('dateOfBirth');
                      resetField('dateOfBirth');
                      setValue('dateOfBirth', val);
                    } else {
                      setFormError('dateOfBirth', { message: 'Date of birth is not valid' });
                    }
                  }}
                  defaultValue={null}
                  label="Date of birth"
                  required
                ></DateSearch>
              )}
            />
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton
            loading={editPatient.isLoading}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={{ fontWeight: '700', textTransform: 'none', borderRadius: 6, ml: 1, mb: 1, px: 4 }}
            disabled={!formState.isValid}
          >
            Save
          </LoadingButton>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error editing this patient, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};

export default EditPatientDialog;
