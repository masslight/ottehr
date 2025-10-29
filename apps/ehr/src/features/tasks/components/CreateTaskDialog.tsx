import { Stack } from '@mui/material';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { PatientSelectInput } from 'src/components/input/PatientSelectInput';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { MANUAL_TASKS_CATEGORIES } from 'src/features/visits/in-person/hooks/useTasks';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useGetPatient } from 'src/hooks/useGetPatient';

export const CATEGORY_OPTIONS = [
  { value: MANUAL_TASKS_CATEGORIES.externalLab, label: 'External Labs' },
  { value: MANUAL_TASKS_CATEGORIES.inHouseLab, label: 'In-house Labs' },
  { value: MANUAL_TASKS_CATEGORIES.medications, label: 'Medications' },
  { value: MANUAL_TASKS_CATEGORIES.nursingOrders, label: 'Nursing Orders' },
  { value: MANUAL_TASKS_CATEGORIES.patientFollowUp, label: 'Patient Follow-up' },
  { value: MANUAL_TASKS_CATEGORIES.procedures, label: 'Procedures' },
  { value: MANUAL_TASKS_CATEGORIES.radiology, label: 'Radiology' },
  { value: MANUAL_TASKS_CATEGORIES.charting, label: 'Charting' },
  { value: MANUAL_TASKS_CATEGORIES.coding, label: 'Coding' },
  { value: MANUAL_TASKS_CATEGORIES.other, label: 'Other' },
];

interface Props {
  appointmentId?: string;
  category?: string;
  order?: string;
  handleClose: () => void;
}

export const CreateTaskDialog: React.FC<Props> = ({ handleClose }) => {
  const methods = useForm();
  const formValue = methods.watch();
  const handleConfirm = async (): Promise<void> => {};

  const { appointments, loading: appointmentsLoading } = useGetPatient(formValue.patient?.id);

  const visitOptions = (appointments ?? []).map((appointment) => {
    return {
      label: `${appointment.typeLabel} ${
        appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime, appointment.officeTimeZone) : ''
      }`,
      value: appointment.id ?? '',
    };
  });

  useEffect(() => {
    if (!formValue.patient) {
      methods.resetField('visit');
    }
  }, [formValue.patient, methods]);

  useEffect(() => {
    if (!formValue.visit || !formValue.category) {
      methods.resetField('order');
    }
  }, [formValue.visit, formValue.category, methods]);
  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={true}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={!formValue.category || !formValue.task}
      description={''}
      title={'New Task'}
      confirmText={'Create new task'}
      closeButtonText="Cancel"
      ContentComponent={
        <FormProvider {...methods}>
          <Stack minWidth="500px" spacing={1} paddingTop="8px">
            <PatientSelectInput name="patient" label="Patient" />
            <SelectInput
              name="visit"
              label="Visit"
              options={appointmentsLoading ? [] : visitOptions}
              loading={appointmentsLoading}
              disabled={!formValue.patient}
            />
            <SelectInput name="category" label="Category" options={CATEGORY_OPTIONS} />
            <SelectInput name="order" label="Order" options={[]} disabled={!formValue.visit || !formValue.category} />
            <TextInput name="task" label="Task" required />
            <TextInput name="taskDetails" label="Task details" />
            <Stack direction="row" spacing={1}>
              <ProviderSelectInput name="assignee" label="Assign task to" />
              <LocationSelectInput name="location" label="Location" required />
            </Stack>
          </Stack>
        </FormProvider>
      }
    />
  );
};
