import { Stack } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { PatientSelectInput } from 'src/components/input/PatientSelectInput';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { MANUAL_TASKS_CATEGORIES } from 'src/features/visits/in-person/hooks/useTasks';

export const CATEGORY_OPTIONS = [
  { value: MANUAL_TASKS_CATEGORIES.externalLab, label: 'External Labs' },
  { value: MANUAL_TASKS_CATEGORIES.internalLab, label: 'Internal Labs' },
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
  patient?: {
    id: string;
    name: string;
  };
  visit?: {
    id: string;
    label: string;
  };
  category?: string;
  order?: string;
  handleClose: () => void;
}

export const CreateTaskDialog: React.FC<Props> = ({ handleClose }) => {
  const methods = useForm();
  const categoryValue = methods.watch('category');
  const taskValue = methods.watch('task');
  const assigneeValue = methods.watch('assignee');
  const handleConfirm = async (): Promise<void> => {};
  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={true}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={!categoryValue || !taskValue || !assigneeValue}
      description={''}
      title={'New Task'}
      confirmText={'Create new task'}
      closeButtonText="Cancel"
      ContentComponent={
        <FormProvider {...methods}>
          <Stack minWidth="500px" spacing={1}>
            <PatientSelectInput name="patient" label="Patient" />
            <TextInput name="visit" label="Visit" />
            <SelectInput name="category" label="Category" options={CATEGORY_OPTIONS} required />
            <TextInput name="order" label="Order" />
            <TextInput name="task" label="Task" required />
            <TextInput name="taskDetails" label="Task details" />
            <Stack direction="row" spacing={1}>
              <ProviderSelectInput name="assignee" label="Assign task to" />
              <LocationSelectInput name="location" label="Office" required />
            </Stack>
          </Stack>
        </FormProvider>
      }
    />
  );
};
