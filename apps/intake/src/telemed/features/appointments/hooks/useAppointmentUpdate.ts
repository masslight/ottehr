import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import {
  CreateAppointmentUCTelemedResponse,
  getSelectors,
  isoStringFromMDYString,
  PatientInfo,
  UpdateAppointmentResponse,
  yupDateTransform,
} from 'utils';
import { useOystehrAPIClient } from '../../../utils';
import { useIntakeCommonStore } from '../../common';
import { usePatientInfoStore } from '../../patient-info';
import {
  createPatientInfoWithChangedFields,
  isPatientInfoEqual,
  useAppointmentsData,
  useAppointmentStore,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from '..';

export type UpdateAppointmentFn = (data: {
  patientInfo: PatientInfo;
  stateInfo?: StateInfo;
  unconfirmedDateOfBirth?: string;
  isPatientConfirmDateOfBirth?: boolean;
}) => Promise<{
  operation: AppointmentUpdatingOperation;
  status: Extract<AppointmentUpdatingStatus, 'success' | 'error' | 'validation-error'>;
  error?: any;
  validationErrors?: ValidationErrors;
  response?: UpdateAppointmentResponse;
}>;

type ValidationErrors = { ageOutOfRange?: boolean; dateOfBirthConfirmation?: boolean };
type AppointmentUpdatingOperation = 'update' | 'create';
type AppointmentUpdatingStatus = 'idle' | 'pending' | 'success' | 'error' | 'validation-error';
type StateInfo = { locationState: string };

const initialValidationErrors: ValidationErrors = {
  ageOutOfRange: false,
  dateOfBirthConfirmation: false,
};

/**
 * useAppointmentsUpdate hook is used to manage appointment creation/updates.
 */
export const useAppointmentUpdate = (): {
  appointmentUpdatingStatus: AppointmentUpdatingStatus;
  appointmentUpdateValidationErrors: ValidationErrors;
  appointmentUpdateError: any;
  getAppointmentNextUpdateType: () => AppointmentUpdatingOperation;
  updateAppointment: UpdateAppointmentFn;
} => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);
  const intakeCommon = useIntakeCommonStore.getState();
  const { appointment } = useAppointmentsData();

  /**
   * Note: React may not always accurately track transition states (like `pending`)
   * in the async sequence `idle` -> `pending` -> `success`/`error`/`validation-error`
   * across *deep hook* hierarchies. In some cases, React Query status is also not
   * usable for this reason.
   *
   * Consider using the Promise returned by updateAppointment for more reliable
   * state tracking, e.g., for retrieving loading state:
   *
   *    setIsLoading(true);
   *    await updateAppointment({ patientInfo, stateInfo });
   *    setIsLoading(false);
   *
   * This state is still kept for cases where we only need to react to the final
   * status, but for other cases it should be tested carefully.
   */
  const [appointmentUpdatingStatus, setAppointmentUpdatingStatus] = useState<AppointmentUpdatingStatus>('idle');

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(initialValidationErrors);
  const [error, setError] = useState<any>();

  const getAppointmentNextUpdateType = useCallback((): AppointmentUpdatingOperation => {
    return appointmentID ? 'update' : 'create';
  }, [appointmentID]);

  const { patientInfo: currentPatientInfo, pendingPatientInfoUpdates } = getSelectors(usePatientInfoStore, [
    'patientInfo',
    'pendingPatientInfoUpdates',
  ]);

  const patientInfo = { ...currentPatientInfo, ...pendingPatientInfoUpdates, id: currentPatientInfo.id };
  const initialPatientInfoRef = useRef(currentPatientInfo);
  const createAppointmentMutation = useCreateAppointmentMutation();
  const updateAppointmentMutation = useUpdateAppointmentMutation();
  const operation = getAppointmentNextUpdateType();

  const makeUpdateResponse = ({
    status,
    response,
    error,
    validationErrors,
  }: {
    status?: Extract<AppointmentUpdatingStatus, 'success' | 'error' | 'validation-error'>;
    response?: UpdateAppointmentResponse;
    error?: any;
    validationErrors?: ValidationErrors;
  } = {}): Awaited<ReturnType<UpdateAppointmentFn>> => {
    if (validationErrors) {
      setValidationErrors((errors) => ({ ...errors, ...validationErrors }));
    }

    if (error) {
      setError(error);
    }

    const operationStatus = status ?? (error ? 'error' : validationErrors ? 'validation-error' : 'success');

    setAppointmentUpdatingStatus(operationStatus);

    return {
      operation,
      status: operationStatus,
      ...(response ? { response } : {}),
      ...(error ? { error } : {}),
      ...(validationErrors ? { validationErrors } : {}),
    };
  };

  /**
   * Updates or creates the appointment with the provided data.
   */
  const updateAppointment: UpdateAppointmentFn = async ({
    patientInfo: patientInfoSavingData,
    stateInfo,
    unconfirmedDateOfBirth,
    isPatientConfirmDateOfBirth,
  }) => {
    setAppointmentUpdatingStatus('pending');
    setValidationErrors(initialValidationErrors);
    setError(null);

    if (!apiClient) {
      console.error('apiClient is not defined');
      return makeUpdateResponse({ status: 'error' });
    }

    // Store DOB in yyyy-mm-dd format for backend validation
    const dateOfBirth = isoStringFromMDYString(
      yupDateTransform(patientInfoSavingData.dateOfBirth || patientInfo.dateOfBirth || '')
    );

    patientInfoSavingData.dateOfBirth = dateOfBirth || 'Unknown';
    if (!patientInfo.id) {
      patientInfoSavingData.newPatient = patientInfo.newPatient;
    }

    const isUpdateWithEqualPatientInfo =
      operation === 'update' && isPatientInfoEqual(initialPatientInfoRef.current, patientInfoSavingData);

    const isLocationNotChanged = !stateInfo?.locationState || stateInfo.locationState === appointment?.state?.code;

    if (isUpdateWithEqualPatientInfo && isLocationNotChanged) {
      console.log('update is not needed, data did not change');
      return makeUpdateResponse({ status: 'success' });
    }

    const pendingPatientInfoUpdates = createPatientInfoWithChangedFields(patientInfo, patientInfoSavingData);
    usePatientInfoStore.setState(() => ({ pendingPatientInfoUpdates }));
    const patientShouldConfirmDateOfBirth = patientInfo.id && !patientInfoSavingData.newPatient && !appointmentID;

    if (patientShouldConfirmDateOfBirth && !isPatientConfirmDateOfBirth) {
      console.log('should confirm date of birth');
      const validationErrors = { dateOfBirthConfirmation: true };
      return makeUpdateResponse({ validationErrors });
    }

    let response: UpdateAppointmentResponse | CreateAppointmentUCTelemedResponse;
    let savedPatientInfo: PatientInfo;

    try {
      // update appointment
      if (operation === 'update') {
        response = await updateAppointmentMutation.mutateAsync({
          appointmentID: appointmentID as string,
          apiClient,
          patientInfo: pendingPatientInfoUpdates as PatientInfo,
          stateInfo,
        });
        savedPatientInfo = pendingPatientInfoUpdates;
      } else {
        // create appointment
        response = await createAppointmentMutation.mutateAsync({
          apiClient,
          patientInfo: pendingPatientInfoUpdates as PatientInfo,
          unconfirmedDateOfBirth,

          /**
           * we use this saved location without rechecking it, as users can't easily change
           * their location from every screen. However, we'll do a final check of the location
           * on the review page before completing the appointment process.
           */
          stateInfo: { locationState: intakeCommon.selectedLocationState },
        });
        useAppointmentStore.setState(() => ({ appointmentID: response.appointmentId }));
        savedPatientInfo = createPatientInfoWithChangedFields(
          { ...patientInfo, id: (response as CreateAppointmentUCTelemedResponse).patientId || patientInfo.id },
          patientInfoSavingData
        );
        // we don't need to have the location in the store because we will get it from the appointment next time, clear the store to avoid confusion
        useIntakeCommonStore.setState({ selectedLocationState: '' });
      }
      usePatientInfoStore.setState(() => ({
        pendingPatientInfoUpdates: undefined,
        patientInfo: savedPatientInfo,
      }));
      initialPatientInfoRef.current = { ...savedPatientInfo };
      await queryClient.invalidateQueries({ queryKey: ['appointments', undefined] });
      return makeUpdateResponse({ response });
    } catch (error) {
      console.error('operation error', error);
      return makeUpdateResponse({ error });
    }
  };

  return {
    appointmentUpdateValidationErrors: validationErrors,
    appointmentUpdatingStatus,
    appointmentUpdateError: error,
    getAppointmentNextUpdateType,
    updateAppointment,
  };
};
