/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, CircularProgress, Divider, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  Navigate,
  Outlet,
  generatePath,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { ErrorDialog, ErrorDialogConfig, PageForm } from 'ui-components';
import { ZambdaClient, useUCZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import { GetScheduleResponse, PatientInfo, ScheduleType, ServiceMode, VisitType, getSelectors } from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import zapehrApi, { AvailableLocationInformation } from '../api/ottehrApi';
import { BOOKING_SLOT_ID_PARAM, bookingBasePath, intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { PatientInfoInProgress } from '../features/patients/types';
import { useCheckOfficeOpen } from '../hooks/useCheckOfficeOpen';
import { SlotListItem } from 'utils/lib/utils';

type BookingState = {
  visitType: VisitType | undefined;
  serviceType: ServiceMode | undefined;
  scheduleType: ScheduleType | undefined;
  selectedLocationResponse: GetScheduleResponse | undefined;
  // selectedSlot: string | undefined;
  patients: PatientInfo[];
  patientInfo: PatientInfoInProgress | undefined;
  unconfirmedDateOfBirth: string | undefined;
  // slotData: SlotListItem[];
};

interface BookingStoreActions {
  setPatientInfo: (info: PatientInfoInProgress | undefined) => void;
  setPatients: (patients: PatientInfo[]) => void;
  setUnconfirmedDateOfBirth: (dob: string | undefined) => void;
  setSelectedLocationResponse: (location: GetScheduleResponse | undefined) => void;
  setSelectedSlot: (slotId: string | undefined) => void;
  setSlotData: (slotData: SlotListItem[]) => void;
  setScheduleType: (scheduleType: ScheduleType | undefined) => void;
  completeBooking: () => void;
  handleLogout: () => void;
}

const BOOKING_INITIAL: BookingState = {
  patients: [],
  patientInfo: undefined,
  unconfirmedDateOfBirth: undefined,
  selectedLocationResponse: undefined,
  //selectedSlot: undefined,
  visitType: undefined,
  serviceType: undefined,
  scheduleType: undefined,
  //slotData: [],
};

const useBookingStore = create<BookingState & BookingStoreActions>()(
  persist(
    (set) => ({
      ...BOOKING_INITIAL,
      clear: () => {
        set({
          ...BOOKING_INITIAL,
        });
      },
      setPatientInfo: (info: PatientInfoInProgress | undefined) => {
        set((state) => {
          let isNewPatientInfo = false;
          if (state.patientInfo && state.patientInfo.id !== info?.id) {
            isNewPatientInfo = true;
          }
          return {
            ...state,
            patientInfo: info,
            unconfirmedDateOfBirth: isNewPatientInfo ? undefined : state.unconfirmedDateOfBirth,
          };
        });
      },
      setPatients: (patients: PatientInfo[]) => {
        set((state) => ({
          ...state,
          patients,
        }));
      },
      setUnconfirmedDateOfBirth: (unconfirmedDateOfBirth: string | undefined) => {
        set((state) => ({
          ...state,
          unconfirmedDateOfBirth,
        }));
      },
      setVisitType: (visitType: VisitType | undefined) => {
        set((state) => ({
          ...state,
          visitType,
        }));
      },
      setScheduleType: (scheduleType: ScheduleType | undefined) => {
        set((state) => ({
          ...state,
          scheduleType,
        }));
      },
      setSelectedLocationResponse: (selectedLocationResponse: GetScheduleResponse | undefined) => {
        set((state) => ({
          ...state,
          selectedLocationResponse,
          slotData: selectedLocationResponse?.available ?? [],
        }));
      },
      setSlotData: (slotData: SlotListItem[]) => {
        set((state) => {
          return {
            ...state,
            slotData,
          };
        });
      },
      setSelectedSlot: (selectedSlot: string | undefined) => {
        set((state) => ({
          ...state,
          selectedSlot,
        }));
      },
      completeBooking: () => {
        set((state) => ({
          ...state,
          selectedSlot: undefined,
          patientInfo: undefined,
          unconfirmedDateOfBirth: undefined,
        }));
      },
      handleLogout: () => {
        set(() => ({
          ...BOOKING_INITIAL,
        }));
      },
    }),
    { name: 'ip-intake-booking-store' }
  )
);

enum LoadingState {
  initial,
  loading,
  complete,
}

interface BookAppointmentContext
  extends Omit<BookingState, 'selectedLocationResponse' | 'redirectToStart'>,
    Omit<
      BookingStoreActions,
      'setLocationPath' | 'setSelectedLocationResponse' | 'handleLogout' | 'setPatients' | 'setScheduleType'
    > {
  visitType: VisitType | undefined;
  slotId: string;
  selectedLocation: AvailableLocationInformation | undefined;
  //slotData: SlotListItem[];
  waitingMinutes: number | undefined;
  locationLoading: boolean;
  patientsLoading: boolean;
  // getSlotListItemWithId: (slotId: string) => SlotListItem | undefined;
}

export const useBookingContext = (): BookAppointmentContext => {
  const outletContext = useOutletContext<BookAppointmentContext>();
  return {
    ...outletContext,
  };
};

interface CustomContainerText {
  title: string;
  subtext?: string;
}

const isPostPatientSelectionPath = (basePath: string, pathToCheck: string): boolean => {
  // review is last step but we detect on submit instead so redirect doesnt jump
  // the transition to the appointment page
  const prepatientSelectionPaths = [basePath, `${basePath}/get-ready`, `${basePath}/patients`, `${basePath}/review`];
  const normalized = pathToCheck.split('?')[0];
  return !prepatientSelectionPaths.includes(normalized);
};

const BookingHome: FC = () => {
  const {
    selectedLocationResponse,
    patients,
    patientInfo,
    //selectedSlot,
    unconfirmedDateOfBirth,
    scheduleType,
    //slotData,
    setSelectedLocationResponse,
    setPatientInfo,
    setPatients,
    setUnconfirmedDateOfBirth,
    setSelectedSlot,
    completeBooking,
    setSlotData,
    handleLogout,
    setScheduleType,
  } = getSelectors(useBookingStore, [
    'patientInfo',
    'unconfirmedDateOfBirth',
    'selectedLocationResponse',
    'setSelectedLocationResponse',
    'patients',
    'visitType',
    //'selectedSlot',
    'setPatientInfo',
    'setPatients',
    'setUnconfirmedDateOfBirth',
    'setSelectedSlot',
    'completeBooking',
    'setSlotData',
    'handleLogout',
    'scheduleType',
    'setScheduleType',
    //'slotData',
  ]);
  const { [BOOKING_SLOT_ID_PARAM]: slotIdParam } = useParams();

  // const [locationLoading, setLocationLoading] = useState(LoadingState.initial);
  const [patientsLoading, setPatientsLoading] = useState(LoadingState.initial);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const [pageNotFound, setPageNotFound] = useState(false);
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth0();
  const { t } = useTranslation();
  const { BOOKING_SLOT_ID_PARAM: slotIdParm } = useParams();

  /*
  useEffect(() => {
    const slot = navState?.slot as Slot | undefined;
    const scheduleType = navState?.scheduleType;
    if (slot?.id) {
      setSelectedSlot(slot?.id);
    }
    if (scheduleType && scheduleType in ScheduleType) {
      setScheduleType(scheduleType as ScheduleType);
    }
  }, [navState, setScheduleType, setSelectedSlot]);

  const scheduleTypeForFetch = useMemo(() => {
    return navState?.scheduleType ?? scheduleType;
  }, [navState?.scheduleType, scheduleType]);
  */
  const outletContext: BookAppointmentContext = useMemo(() => {
    let selectedLocationTemp: AvailableLocationInformation | undefined = undefined;
    let waitingMinutesTemp: number | undefined = undefined;
    if (selectedLocationResponse) {
      selectedLocationTemp = selectedLocationResponse.location;
      waitingMinutesTemp = selectedLocationResponse.waitingMinutes;
    }

    // todo: get this from slot details response
    const visitType = VisitType.PreBook;
    const serviceType = ServiceMode['in-person'];
    /*const getSlotListItemWithId = (slotId: string): SlotListItem | undefined => {
      return slotData.find((si) => `${si.slot.id}` === `${slotId}`);
    };*/
    return {
      patients,
      patientInfo,
      // slotData,
      slotId: slotIdParm ?? '',
      selectedLocation: selectedLocationTemp,
      waitingMinutes: waitingMinutesTemp,
      visitType,
      scheduleType,
      serviceType,
      locationLoading: false,
      patientsLoading: patientsLoading !== LoadingState.complete,
      // selectedSlot,
      unconfirmedDateOfBirth,
      setPatientInfo,
      setUnconfirmedDateOfBirth,
      setSelectedSlot,
      completeBooking,
      setSlotData,
      // getSlotListItemWithId,
    };
  }, [
    selectedLocationResponse,
    patients,
    patientInfo,
    slotIdParm,
    scheduleType,
    patientsLoading,
    unconfirmedDateOfBirth,
    setPatientInfo,
    setUnconfirmedDateOfBirth,
    setSelectedSlot,
    completeBooking,
    setSlotData,
  ]);
  const { walkinOpen } = useCheckOfficeOpen(outletContext.selectedLocation);

  useEffect(() => {
    if (!isAuthenticated && !authIsLoading) {
      handleLogout();
    }
  }, [authIsLoading, handleLogout, isAuthenticated, setScheduleType]);

  // console.log('outlet context in root', outletContext);

  /*
  useEffect(() => {
    const fetchLocation = async (locationSlug: string, scheduleType: ScheduleType, isWalkin: boolean): Promise<any> => {
      try {
        if (!tokenlessZambdaClient) {
          return;
        }
        setLocationLoading(LoadingState.loading);
        console.log('schedule type sluggo: ', scheduleType, locationSlug);
        // temporarily hardcoding the params for the walkin case here due to a bug with the dynamic values
        // and plans to overhaul this page in the near future
        let scheduleTypeForFetch = scheduleType ?? ScheduleType.location;
        let locationSlugForFetch = locationSlug;
        if (isWalkin) {
          scheduleTypeForFetch = ScheduleType.location;
          locationSlugForFetch = 'testing';
        }
        const res = await zapehrApi.getSchedule(tokenlessZambdaClient, {
          scheduleType: scheduleTypeForFetch,
          slug: locationSlugForFetch,
          isWalkin,
        });
        setSelectedLocationResponse(res);
      } catch (error) {
        setPageNotFound(true);
        console.error('Error validating location: ', error);
      } finally {
        setLocationLoading(LoadingState.complete);
      }
    };

    // So long as / is a valid path or auth0 redirects to /, this must be here. Otherwise the
    // function is called with no slug parameter and overwrites the contents of local storage.
    if (slugParam && locationLoading === LoadingState.initial && scheduleTypeForFetch && visitTypeParam !== undefined) {
      void fetchLocation(slugParam, scheduleTypeForFetch, visitTypeParam === VisitType.WalkIn);
    }
  }, [
    locationLoading,
    scheduleTypeForFetch,
    setSelectedLocationResponse,
    slugParam,
    tokenlessZambdaClient,
    visitTypeParam,
  ]);
  */

  useEffect(() => {
    async function getPatients(): Promise<void> {
      if (!tokenfulZambdaClient) {
        return;
      }
      setPatientsLoading(LoadingState.loading);

      const response = await zapehrApi.getPatients(tokenfulZambdaClient);
      const patients = response.patients;

      if (patients.length > 0) {
        setPatients(patients);
      } else {
        if (slotIdParam) {
          // Navigate to NewUser if patients not found?
        }
        // navigate to the root domain (localhost:3002 or welcome.ottehr.com) if either of stateParam or slugParam or visitTypeParam are undefined.
        else {
          navigate('');
        }
      }
    }

    if (isAuthenticated && patientsLoading === LoadingState.initial) {
      getPatients()
        .catch((error) => {
          console.log(error);
        })
        .finally(() => setPatientsLoading(LoadingState.complete));
    }
  }, [
    isAuthenticated,
    setPatients,
    tokenfulZambdaClient,
    patientsLoading,
    walkinOpen,
    navigate,
    scheduleType,
    slotIdParam,
  ]);

  /*
  useEffect(() => {
    const recoverFromLostData = async (slug: string, zambdaClient: ZambdaClient): Promise<void> => {
      try {
        const res = await zapehrApi.getSchedule(zambdaClient, {
          slug,
          scheduleType: scheduleType ?? ScheduleType.location,
        });
        setSelectedLocationResponse(res);
      } catch (e) {
        console.error('selected location unexpectedly missing from store -- could not recover');
        // show an error asking user to go to front desk
        setErrorConfig(NO_LOCATION_ERROR(t));
        return;
      }
    };
    if (
      !outletContext.selectedLocation &&
      locationLoading === LoadingState.complete &&
      slugParam &&
      tokenlessZambdaClient
    ) {
      console.error('selected location unexpectedly missing from store -- attempting recovery');
      void recoverFromLostData(slugParam, tokenlessZambdaClient);
    }
  }, [
    locationLoading,
    outletContext.selectedLocation,
    setSelectedLocationResponse,
    slugParam,
    tokenlessZambdaClient,
    t,
    scheduleType,
  ]);
  */

  // all this is to say, "if the user wound up somewhere in
  // the booking flow by finishing the booking and then pounding
  // the back button, escort them gently to the start of the flow"
  if (!patientInfo) {
    if (slotIdParam) {
      const solvedPath = generatePath(pathname, {
        slotId: slotIdParam,
      });
      const basePath = generatePath(bookingBasePath, {
        slotId: slotIdParam,
      });
      const shouldStartAtBeginning = isPostPatientSelectionPath(basePath, solvedPath) && !patientsLoading;
      // console.log('basePath, solvedPath, shouldSAB', basePath, solvedPath, shouldStartAtBeginning);
      if (shouldStartAtBeginning) {
        return <Navigate to={basePath} replace={true} />;
      }
    } else {
      console.log('there is NOT patient info');
    }
  } else {
    console.log('there is patient info');
  }

  if (pageNotFound) {
    return (
      <PageContainer title={t('welcome.errors.notFound.title')}>
        <Typography variant="body1">
          {t('welcome.errors.notFound.description')}{' '}
          <a href="https://ottehr.com/find-care/">{t('welcome.errors.notFound.link')}</a>.
        </Typography>
      </PageContainer>
    );
  }

  if (!selectedLocationResponse) {
    /*
     * TODO: Component requires refactoring
     *
     * Current implementation has the following issues:
     * - Race conditions between parent component's useEffect and internal logic of child components
     * - Contains complex navigation logic
     * - Potential for collisions
     * - Not decomposed and contains too much code
     *
     * Issue with incorrect welcome page redirect https://github.com/masslight/ottehr/issues/908:
     * 1. selectedLocationResponse is set asynchronously in useEffect
     * 2. renderWelcome chooses component to render immediately, without waiting for selectedLocationResponse
     * 3. Rendered component depends on selectedLocationResponse value
     *
     * Possible scenarios:
     * A. With empty LocalStorage (bug-case):
     *    - Outlet renders without selectedLocationResponse
     *    - Incorrect redirect to welcome page occurs
     *
     * B. With non-empty LocalStorage:
     *    - selectedLocationResponse is retrieved from LocalStorage
     *    - Incorrect redirect does not occur
     *
     * Current solution:
     * To fix bug-case - display loading screen while selectedLocationResponse is not set,
     * and preventing Outlet render in pending state causing incorrect redirect to welcome page
     */
    return (
      <PageContainer title={t('welcome.loading')}>
        <CircularProgress />
      </PageContainer>
    );
  }

  return (
    <>
      <ErrorDialog
        open={errorConfig != undefined}
        title={errorConfig?.title ?? ''}
        description={errorConfig?.description ?? ''}
        closeButtonText={errorConfig?.closeButtonText ?? t('reviewAndSubmit.ok')}
        handleClose={() => {
          setErrorConfig(undefined);
        }}
      />
    </>
  );
};
export default BookingHome;
