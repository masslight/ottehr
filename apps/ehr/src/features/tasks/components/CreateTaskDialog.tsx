import { Stack } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { getLocationLabel, LocationSelectInput } from 'src/components/input/LocationSelectInput';
import { PatientSelectInput } from 'src/components/input/PatientSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { useCreateManualTask } from 'src/features/visits/in-person/hooks/useTasks';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { getVisitTypeLabelForTypeAndServiceMode } from 'src/shared/utils/formatLabelValue';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { useGetPatientVisitHistory } from '../../../hooks/useGetPatientVisitHistory';
import {
  getPatientLabel,
  TASK_CATEGORY_LABEL,
  useExternalLabOrdersOptions,
  useInHouseLabOrdersOptions,
  useInHouseMedicationsOptions,
  useNursingOrdersOptions,
  useProceduresOptions,
  useRadiologyOrdersOptions,
} from '../common';

interface Props {
  open: boolean;
  handleClose: () => void;
  /** Appointment to prefill; falls back to the `:id` url param when omitted. */
  appointmentId?: string;
  /** Patient to prefill when no appointment supplies one (appointment prefill wins). */
  initialPatient?: { id: string; name: string };
}

export const CreateTaskDialog: React.FC<Props> = ({
  open,
  handleClose,
  appointmentId: appointmentIdProp,
  initialPatient,
}) => {
  const methods = useForm();
  const formValue = methods.watch();

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) {
      methods.reset();
    }
    setRefreshKey(Date.now());
  }, [open, methods]);

  const { mutateAsync: createManualTask } = useCreateManualTask();
  const handleConfirm = async (): Promise<void> => {
    await createManualTask({
      category: formValue.category,
      appointmentId: formValue.appointment,
      orderId: formValue.order,
      encounterId: encounterId || undefined,
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
      id: appointment.appointmentId ?? '',
      label: `${getVisitTypeLabelForTypeAndServiceMode({
        type: appointment.type,
        serviceMode: appointment.serviceMode,
      })} ${appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime) : ''}`,
    };
  });

  const { encounter } = useAppointmentData(
    appointments?.find((appointment) => appointment.appointmentId === formValue.appointment)?.appointmentId
  );
  const encounterId = encounter?.id ?? '';

  const { inHouseLabOrdersLoading, inHouseLabOrdersOptions } = useInHouseLabOrdersOptions(encounterId, refreshKey);
  const { externalLabOrdersLoading, externalLabOrdersOptions } = useExternalLabOrdersOptions(encounterId, refreshKey);
  const { nursingOrdersLoading, nursingOrdersOptions } = useNursingOrdersOptions(encounterId, refreshKey);
  const { radiologyOrdersLoading, radiologyOrdersOptions } = useRadiologyOrdersOptions(encounterId, refreshKey);
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
  const appointmentId = appointmentIdProp ?? urlParams['id'];
  const appointment = useAppointmentData(appointmentId);
  useEffect(() => {
    if (appointment.patient && open) {
      methods.setValue('patient', {
        id: appointment.patient.id,
        name: getPatientLabel(appointment.patient),
      });
      methods.setValue('appointment', appointmentId);
    }
  }, [appointmentId, appointment, methods, open]);

  useEffect(() => {
    if (open && initialPatient && !appointment.patient && !methods.getValues('patient')) {
      methods.setValue('patient', initialPatient);
    }
  }, [open, initialPatient, appointment.patient, methods]);

  // useParams() returns an unstable {} outside a matched Route, so the effect deps must be the primitive params, not the object.
  const orderFullUrl = urlParams['*'];
  const serviceRequestId = urlParams['serviceRequestID'];
  const procedureId = urlParams['procedureId'];
  useEffect(() => {
    if (!open) {
      return;
    }
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
  }, [orderFullUrl, serviceRequestId, procedureId, methods, open]);

  // Visit context implies the location; declared after the URL-context effect above so its 'location' clear on open runs first.
  useEffect(() => {
    if (open && appointment.location?.id && !methods.getValues('location')) {
      methods.setValue('location', { id: appointment.location.id, name: getLocationLabel(appointment.location) });
    }
  }, [open, appointment.location, methods]);

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
              options={appointmentsLoading ? [] : appointmentOptions.map((appointment) => appointment.id)}
              getOptionLabel={(option) => appointmentOptions.find((opt) => opt.id === option)?.label ?? option}
              loading={appointmentsLoading}
              disabled={!formValue.patient}
            />
            <SelectInput
              name="category"
              label="Category"
              options={Object.values(MANUAL_TASK.category)}
              getOptionLabel={(option) => TASK_CATEGORY_LABEL[option]}
              required
            />
            <SelectInput
              name="order"
              label="Order"
              options={orderOptions.map((order) => order.id)}
              getOptionLabel={(option) => orderOptions.find((opt) => opt.id === option)?.label ?? ''}
              loading={ordersLoading}
              disabled={!formValue.appointment || !formValue.category}
            />
            <TextInput name="taskTitle" label="Title" required />
            <TextInput name="taskDetails" label="Task details" />
            <Stack direction="row" spacing={1}>
              <EmployeeSelectInput name="assignee" label="Assign task to" />
              <LocationSelectInput name="location" label="Location" type="in-person" required />
            </Stack>
          </Stack>
        </FormProvider>
      }
    />
  );
};
