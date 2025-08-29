import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { LoadingButton } from '@mui/lab';
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, Typography } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import DateSearch from '../../../../components/DateSearch';
import { useEditPatientBirthDateMutation } from '../../../hooks';
import { useAppointmentData } from '../../../state';

interface EditPatientBirthDateDialogProps {
  modalOpen: boolean;
  onClose: () => void;
}

interface FormInputs {
  dateOfBirth: DateTime | null;
}

export const EditPatientBirthDateDialog = ({ modalOpen, onClose }: EditPatientBirthDateDialogProps): ReactElement => {
  const {
    handleSubmit,
    formState,
    control,
    setError: setFormError,
    resetField,
    setValue,
    getValues,
  } = useForm<FormInputs>();
  const [error, setError] = useState(false);
  const { patient, appointmentSetState } = useAppointmentData();

  useEffect(() => {
    setValue('dateOfBirth', patient?.birthDate ? DateTime.fromISO(patient?.birthDate) : null);
  }, [patient, setValue]);

  const editPatientBirthDate = useEditPatientBirthDateMutation();

  const onSubmit = async (data: FormInputs): Promise<void> => {
    try {
      if (!patient?.id) {
        throw new Error('Patient reference not provided');
      }

      const patientData: Patient = {
        ...patient,
        resourceType: 'Patient',
        id: patient.id,
        birthDate: data.dateOfBirth!.toISODate()!,
      };

      await editPatientBirthDate.mutateAsync(
        { patientData: patientData },
        {
          onSuccess: (updatedData) => {
            appointmentSetState({
              patient: { ...updatedData },
            });
            onClose();
          },
        }
      );
    } catch (error) {
      setError(true);
      console.error('Error while updating patient date of birth: ', error);
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
          Please enter patient's confirmed date of birth
          <IconButton onClick={onClose} aria-label="close" sx={{ mr: -3, mt: -3 }}>
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
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
            loading={editPatientBirthDate.isPending}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, ml: 1, mb: 1, px: 4 }}
            disabled={!formState.isValid}
          >
            Update Date of Birth
          </LoadingButton>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            Failed to update patient date of birth, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};
