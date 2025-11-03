import { Stack } from '@mui/material';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { PatientSelectInput } from 'src/components/input/PatientSelectInput';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { useCreateManualTask } from 'src/features/visits/in-person/hooks/useTasks';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useGetPatient } from 'src/hooks/useGetPatient';
import { MANUAL_TASK } from 'utils';
import {
  useExternalLabOrdersOptions,
  useInHouseLabOrdersOptions,
  useInHouseMedicationsOptions,
  useNursingOrdersOptions,
  useProceduresOptions,
  useRadiologyOrdersOptions,
} from '../common';

export const CATEGORY_OPTIONS = [
  { value: MANUAL_TASK.category.externalLab, label: 'External Labs' },
  { value: MANUAL_TASK.category.inHouseLab, label: 'In-house Labs' },
  { value: MANUAL_TASK.category.inHouseMedications, label: 'In-house Medications' },
  { value: MANUAL_TASK.category.nursingOrders, label: 'Nursing Orders' },
  { value: MANUAL_TASK.category.patientFollowUp, label: 'Patient Follow-up' },
  { value: MANUAL_TASK.category.procedures, label: 'Procedures' },
  { value: MANUAL_TASK.category.radiology, label: 'Radiology' },
  { value: MANUAL_TASK.category.erx, label: 'eRx' },
  { value: MANUAL_TASK.category.charting, label: 'Charting' },
  { value: MANUAL_TASK.category.coding, label: 'Coding' },
  { value: MANUAL_TASK.category.other, label: 'Other' },
];

interface Props {
  appointmentId?: string;
  category?: string;
  order?: string;
  open: boolean;
  handleClose: () => void;
}

export const CreateTaskDialog: React.FC<Props> = ({ open, handleClose }) => {
  const methods = useForm();
  const formValue = methods.watch();

  const { mutateAsync: createManualTask } = useCreateManualTask();
  const handleConfirm = async (): Promise<void> => {
    await createManualTask({
      category: formValue.category,
      taskTitle: formValue.task,
      taskDetails: formValue.taskDetails,
      locationId: formValue.location.id,
    });
  };

  const { appointments, loading: appointmentsLoading } = useGetPatient(formValue.patient?.id);

  const visitOptions = (appointments ?? []).map((appointment) => {
    return {
      label: `${appointment.typeLabel} ${
        appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime, appointment.officeTimeZone) : ''
      }`,
      value: appointment.id ?? '',
    };
  });

  const encounterId = appointments?.find((appointment) => appointment.id === formValue.visit)?.encounter?.id ?? '';

  const { inHouseLabOrdersLoading, inHouseLabOrdersOptions } = useInHouseLabOrdersOptions(encounterId);
  const { externalLabOrdersLoading, externalLabOrdersOptions } = useExternalLabOrdersOptions(encounterId);
  const { nursingOrdersLoading, nursingOrdersOptions } = useNursingOrdersOptions(encounterId);
  const { radiologyOrdersLoading, radiologyOrdersOptions } = useRadiologyOrdersOptions(encounterId);
  const { proceduresLoading, proceduresOptions } = useProceduresOptions(encounterId);
  const { inHouseMedicationsLoading, inHouseMedicationsOptions } = useInHouseMedicationsOptions(encounterId);

  const ordersLoading =
    formValue.category === MANUAL_TASK.category.inHouseLab
      ? inHouseLabOrdersLoading
      : formValue.category === MANUAL_TASK.category.externalLab
      ? externalLabOrdersLoading
      : formValue.category === MANUAL_TASK.category.nursingOrders
      ? nursingOrdersLoading
      : formValue.category === MANUAL_TASK.category.radiology
      ? radiologyOrdersLoading
      : formValue.category === MANUAL_TASK.category.procedures
      ? proceduresLoading
      : formValue.category === MANUAL_TASK.category.inHouseMedications
      ? inHouseMedicationsLoading
      : false;

  const orderOptions =
    formValue.category === MANUAL_TASK.category.inHouseLab
      ? inHouseLabOrdersOptions
      : formValue.category === MANUAL_TASK.category.externalLab
      ? externalLabOrdersOptions
      : formValue.category === MANUAL_TASK.category.nursingOrders
      ? nursingOrdersOptions
      : formValue.category === MANUAL_TASK.category.radiology
      ? radiologyOrdersOptions
      : formValue.category === MANUAL_TASK.category.procedures
      ? proceduresOptions
      : formValue.category === MANUAL_TASK.category.inHouseMedications
      ? inHouseMedicationsOptions
      : [];

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
      open={open}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={!formValue.category || !formValue.task || !formValue.location}
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
            <SelectInput name="category" label="Category" options={CATEGORY_OPTIONS} required />
            <SelectInput
              name="order"
              label="Order"
              options={orderOptions}
              loading={ordersLoading}
              disabled={!formValue.visit || !formValue.category}
            />
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
