import { useEffect, useState } from 'react';
import { checkTelemedLocationAvailability, getSelectors, PROJECT_WEBSITE, TelemedLocation } from 'utils';
import { useZapEHRAPIClient } from '../../utils';
import { UpdateAppointmentFn, useAppointmentsData, useAppointmentUpdate, useGetTelemedStates } from '../appointments';
import { useIntakeCommonStore } from '../common';
import { usePatientInfoStore } from '../patient-info';

type HookReturnType = CurrentLocation & {
  isValidationRunning: boolean;
  updateLocation: (locationCode: string) => ReturnType<UpdateAppointmentFn>;
  validateAppointmentLocation: () => Promise<{ error?: LocationError }>;
  updateLocationAvailabilityByWorkingHours: (location: TelemedLocation | null) => TelemedLocation | null;
};

type CurrentLocation = {
  location: TelemedLocation | null;
  isLocationInitialized: boolean;
};

export type LocationError = {
  title: React.ReactNode;
  content: React.ReactNode;
};

export const useTelemedLocation = (): HookReturnType => {
  const apiClient = useZapEHRAPIClient();
  const { data: locationsResponse } = useGetTelemedStates(apiClient, Boolean(apiClient));
  const { appointment, appointmentID } = useAppointmentsData();
  const locationCodeFromStore = useIntakeCommonStore((state) => state.selectedLocationState);
  const locationCodeFromAppointment = appointment?.state?.code ?? '';
  const [isValidationRunning, setIsValidationRunning] = useState(false);
  const { updateAppointment } = useAppointmentUpdate();

  const { patientInfo: currentPatientInfo, pendingPatientInfoUpdates } = getSelectors(usePatientInfoStore, [
    'patientInfo',
    'pendingPatientInfoUpdates',
  ]);

  const patientInfo = { ...currentPatientInfo, ...pendingPatientInfoUpdates, id: currentPatientInfo.id };

  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>({
    location: null,
    isLocationInitialized: false,
  });

  console.log('current location', currentLocation);

  const actualizeLocationAvailability = (location: TelemedLocation | null): TelemedLocation | null => {
    if (!location) {
      return null;
    }

    return {
      ...location,
      available: checkTelemedLocationAvailability(location),
    };
  };

  useEffect(() => {
    if (appointmentID && !appointment) {
      // we always use location saved from appointment if appointment was created
      // if appointment not received yet, set 'isLocationInitialized' to false to show loading status in the related components
      console.log('current location null 1');
      setCurrentLocation({ location: null, isLocationInitialized: false });
      return;
    }

    // get saved state code, if appointment was created use data from appointment, otherwise use data from store
    const stateCode = appointmentID ? appointment?.state?.code ?? '' : locationCodeFromStore;

    // get telemed location with this sate code,
    // we need this step because admin may turn off location but user have the old one in the appointment
    let location = locationsResponse?.locations?.find?.((loc) => loc?.state === stateCode) ?? null;

    // update location availability using our logic, this validation change availability to false if working hours are over
    location = actualizeLocationAvailability(location);

    setCurrentLocation({
      location,
      isLocationInitialized: true,
    });
  }, [appointmentID, appointment, locationCodeFromStore, locationsResponse]);

  const validateAppointmentLocation = async (): Promise<{ error?: LocationError }> => {
    if (!apiClient) {
      console.log('current location null 2');
      throw new Error('apiClient is not defined');
    }

    try {
      setIsValidationRunning(true);
      const telemedStatesResponse = await apiClient.getTelemedStates();
      const location = telemedStatesResponse?.locations?.find?.((loc) => loc?.state === locationCodeFromAppointment);

      if (!location?.state) {
        // this case will handle backend, frontend now validates only "state is closed" case
        return {};
      }

      if (checkTelemedLocationAvailability(location)) {
        return {};
      }

      return { error: getOutOfHoursMessage(location.state) };
    } finally {
      setIsValidationRunning(false);
    }
  };

  const updateLocation = async (locationCode: string): ReturnType<UpdateAppointmentFn> => {
    const operation = 'update';

    if (!locationCode) {
      return { operation, status: 'error' };
    }

    if (locationCode === locationCodeFromAppointment) {
      return { operation, status: 'success' };
    }

    const stateInfo = { locationState: locationCode };
    return updateAppointment({ patientInfo, stateInfo });
  };

  return {
    location: currentLocation.location,
    isLocationInitialized: currentLocation.isLocationInitialized,
    updateLocation,
    validateAppointmentLocation,
    isValidationRunning,
    updateLocationAvailabilityByWorkingHours: actualizeLocationAvailability,
  };
};

export const getOutOfHoursMessage = (state: string): LocationError => {
  const operatingHoursUrl = `${PROJECT_WEBSITE}/find-care/virtual-visit/#view-wait-times`;

  return {
    title: <>{state} state is closed now</>,
    content: (
      <>
        The state you've selected is currently closed. Please{' '}
        <a href={operatingHoursUrl} target="_blank" rel="noopener noreferrer">
          visit our website
        </a>{' '}
        to view state operating hours.
      </>
    ),
  };
};
