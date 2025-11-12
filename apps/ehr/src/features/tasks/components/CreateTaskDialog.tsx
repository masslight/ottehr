import { Stack } from '@mui/material';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { PatientSelectInput } from 'src/components/input/PatientSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { useCreateManualTask } from 'src/features/visits/in-person/hooks/useTasks';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { MANUAL_TASK } from 'utils';
import { useGetPatientVisitHistory } from '../../../hooks/useGetPatientVisitHistory';
import { getVisitTypeLabelForTypeAndServiceMode } from '../../../shared/utils';
import {
  getPatientLabel,
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
  { value: MANUAL_TASK.category.billing, label: 'Billing' },
  { value: MANUAL_TASK.category.other, label: 'Other' },
];

interface Props {
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
      appointmentId: formValue.appointment,
      orderId: formValue.order,
      taskTitle: formValue.taskTitle,
      taskDetails: formValue.taskDetails,
      assignee: formValue.assignee,
      location: formValue.location,
      patient: formValue.patient,
    });
  };

  const { data: visitHistory, isLoading: appointmentsLoading } = useGetPatientVisitHistory(formValue.patient?.id);
  const appointments = visitHistory?.visits ?? [];

  const appointmentOptions = (appointments ?? []).map((appointment) => {
    return {
      label: `${getVisitTypeLabelForTypeAndServiceMode({
        type: appointment.type,
        serviceMode: appointment.serviceMode,
      })} ${appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime) : ''}`,
      value: appointment.appointmentId ?? '',
    };
  });

  const { encounter } = useAppointmentData(
    appointments?.find((appointment) => appointment.appointmentId === formValue.appointment)?.appointmentId
  );
  const encounterId = encounter?.id ?? '';

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
      methods.setValue('appointment', null);
    }
  }, [formValue.patient, methods]);

  useEffect(() => {
    if (!formValue.appointment || !formValue.category) {
      methods.setValue('order', null);
    }
  }, [formValue.appointment, formValue.category, methods]);

  const urlParams = useParams();
  const appointmentId = urlParams['id'];
  const appointment = useAppointmentData(appointmentId);
  useEffect(() => {
    if (appointment.patient) {
      methods.setValue('patient', {
        id: appointment.patient.id,
        name: getPatientLabel(appointment.patient),
      });
      methods.setValue('appointment', appointmentId);
    }
  }, [appointmentId, appointment, methods]);

  useEffect(() => {
    const orderFullUrl = urlParams['*'];
    const serviceRequestId = urlParams['serviceRequestID'];
    const procedureId = urlParams['procedureId'];
    if (orderFullUrl?.startsWith('in-house-lab-orders') && serviceRequestId) {
      methods.setValue('category', MANUAL_TASK.category.inHouseLab);
      methods.setValue('order', serviceRequestId);
    } else if (orderFullUrl?.startsWith('external-lab-orders') && serviceRequestId) {
      methods.setValue('category', MANUAL_TASK.category.externalLab);
      methods.setValue('order', serviceRequestId);
    } else if (orderFullUrl?.startsWith('nursing-orders') && serviceRequestId) {
      methods.setValue('category', MANUAL_TASK.category.nursingOrders);
      methods.setValue('order', serviceRequestId);
    } else if (orderFullUrl?.startsWith('radiology') && serviceRequestId) {
      methods.setValue('category', MANUAL_TASK.category.radiology);
      methods.setValue('order', serviceRequestId);
    } else if (procedureId) {
      methods.setValue('category', MANUAL_TASK.category.procedures);
      methods.setValue('order', procedureId);
    } else {
      methods.setValue('category', null);
      methods.setValue('order', null);
    }
    methods.setValue('taskTitle', null);
    methods.setValue('taskDetails', null);
    methods.setValue('assignee', null);
    methods.setValue('location', null);
  }, [urlParams, methods]);

  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={open}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={!formValue.category || !formValue.taskTitle || !formValue.location}
      description={''}
      title={'New Task'}
      confirmText={'Create new task'}
      closeButtonText="Cancel"
      ContentComponent={
        <FormProvider {...methods}>
          <Stack minWidth="500px" spacing={1} paddingTop="8px">
            <PatientSelectInput name="patient" label="Patient" />
            <SelectInput
              name="appointment"
              label="Visit"
              options={appointmentsLoading ? [] : appointmentOptions}
              loading={appointmentsLoading}
              disabled={!formValue.patient}
            />
            <SelectInput name="category" label="Category" options={CATEGORY_OPTIONS} required />
            <SelectInput
              name="order"
              label="Order"
              options={orderOptions}
              loading={ordersLoading}
              disabled={!formValue.appointment || !formValue.category}
            />
            <TextInput name="taskTitle" label="Title" required />
            <TextInput name="taskDetails" label="Task details" />
            <Stack direction="row" spacing={1}>
              <EmployeeSelectInput name="assignee" label="Assign task to" />
              <LocationSelectInput name="location" label="Location" required />
            </Stack>
          </Stack>
        </FormProvider>
      }
    />
  );
};
