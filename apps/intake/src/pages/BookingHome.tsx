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
import { PatientInfo, ServiceMode, TIMEZONES, Timezone, VisitType, getSelectors } from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import ottehrApi from '../api/ottehrApi';
import { BOOKING_SLOT_ID_PARAM, bookingBasePath, intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { PatientInfoInProgress } from '../features/patients/types';
import { useQuery } from 'react-query';

type BookingState = {
  patientInfo: PatientInfoInProgress | undefined;
  unconfirmedDateOfBirth: string | undefined;
};

interface BookingStoreActions {
  setPatientInfo: (info: PatientInfoInProgress | undefined) => void;
  setUnconfirmedDateOfBirth: (dob: string | undefined) => void;
  completeBooking: () => void;
  handleLogout: () => void;
}

const BOOKING_INITIAL: BookingState = {
  patientInfo: undefined,
  unconfirmedDateOfBirth: undefined,
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
      completeBooking: () => {
        set((state) => ({
          ...state,
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

interface BookAppointmentContext
  extends Omit<BookingState, 'redirectToStart'>,
    Omit<BookingStoreActions, 'setLocationPath' | 'handleLogout'> {
  slotId: string;
  scheduleOwnerName: string;
  patients: PatientInfo[];
  timezone: Timezone;
  serviceMode: ServiceMode;
  visitType: VisitType;
  startISO: string;
  endISO: string;
  waitingMinutes: number | undefined;
  walkinOpen: boolean;
  officeOpen: boolean;
  patientsLoading: boolean;
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
    patientInfo,
    unconfirmedDateOfBirth,
    setPatientInfo,
    setUnconfirmedDateOfBirth,
    completeBooking,
    handleLogout,
  } = getSelectors(useBookingStore, [
    'patientInfo',
    'unconfirmedDateOfBirth',
    'setPatientInfo',
    'setUnconfirmedDateOfBirth',
    'completeBooking',
    'handleLogout',
  ]);
  const { [BOOKING_SLOT_ID_PARAM]: slotIdParam } = useParams();

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const [pageNotFound, setPageNotFound] = useState(false);
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth0();
  const { t } = useTranslation();

  const {
    data: slotDetailsData,
    error: getSlotDetailsError,
    isLoading: slotDetailsLoading,
    isFetching: slotDetailsFetching,
    isRefetching: slotDetailsRefetching,
  } = useQuery(
    ['get-slot-details', { zambdaClient: tokenlessZambdaClient, slotIdParam }],
    () =>
      tokenlessZambdaClient && slotIdParam
        ? ottehrApi.getSlotDetails({ slotId: slotIdParam }, tokenlessZambdaClient)
        : null,
    {
      onSuccess: (response) => {
        console.log('Slot details response:', response);
      },
      enabled: Boolean(slotIdParam) && Boolean(tokenlessZambdaClient),
    }
  );

  const slotDetailsLoadingInSomeWay = slotDetailsLoading || slotDetailsFetching || slotDetailsRefetching;

  if (slotDetailsData) {
    console.log('Slot details data:', slotDetailsData);
  } else if (getSlotDetailsError) {
    console.log('Slot details error:', getSlotDetailsError);
  } else {
    console.log('Slot details loading:', slotDetailsLoadingInSomeWay);
  }

  const {
    data: patientsData,
    error: getPatientsError,
    isLoading: patientsLoading,
    isFetching: patientsFetching,
    isRefetching: patientsRefetching,
  } = useQuery(
    ['get-patients', { zambdaClient: tokenfulZambdaClient, slotIdParam }],
    () => (tokenfulZambdaClient ? ottehrApi.getPatients(tokenfulZambdaClient) : null),
    {
      onSuccess: (response) => {
        console.log('get patients response:', response);
      },
      enabled: Boolean(tokenfulZambdaClient) && isAuthenticated && !authIsLoading,
    }
  );

  const patientsLoadingInSomeWay = patientsLoading || patientsFetching || patientsRefetching;

  console.log('patients data:', patientsData);
  console.log('patients error:', getPatientsError);
  console.log('patients loading:', patientsLoadingInSomeWay);
  console.log('Slot details loading:', slotDetailsLoadingInSomeWay);

  const outletContext: BookAppointmentContext | null = useMemo(() => {
    if (!slotDetailsData) {
      return null;
    }

    const waitingMinutesTemp: number | undefined = undefined;

    // todo: get this from slot details response
    const visitType = slotDetailsData.isWalkin ? VisitType.WalkIn : VisitType.PreBook;
    const { slotId, serviceMode, timezoneForDisplay: timezone, startISO, endISO, ownerName } = slotDetailsData;

    return {
      slotId,
      startISO,
      endISO,
      patients: patientsData?.patients ?? [],
      patientInfo,
      waitingMinutes: waitingMinutesTemp,
      visitType,
      serviceMode,
      timezone: timezone ?? TIMEZONES[0],
      patientsLoading: patientsLoadingInSomeWay,
      unconfirmedDateOfBirth,
      walkinOpen: true, // todo
      officeOpen: true, // todo
      scheduleOwnerName: ownerName,
      setPatientInfo,
      setUnconfirmedDateOfBirth,
      completeBooking,
    };
  }, [
    patientsData?.patients,
    slotDetailsData,
    patientInfo,
    patientsLoadingInSomeWay,
    unconfirmedDateOfBirth,
    setPatientInfo,
    setUnconfirmedDateOfBirth,
    completeBooking,
  ]);
  const walkinOpen = outletContext?.walkinOpen ?? false;

  useEffect(() => {
    if (!isAuthenticated && !authIsLoading) {
      handleLogout();
    }
  }, [authIsLoading, handleLogout, isAuthenticated]);

  // console.log('outlet context in root', outletContext);

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

  if (slotDetailsLoadingInSomeWay) {
    return (
      <PageContainer title={t('welcome.loading')}>
        <CircularProgress />
      </PageContainer>
    );
  }

  return (
    <>
      <Outlet context={{ ...outletContext }} />
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
