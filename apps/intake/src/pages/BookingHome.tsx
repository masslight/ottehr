// cSpell:ignore tokenful
import { CircularProgress, Typography } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import { generatePath, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { getSelectors, PatientInfo, PROJECT_WEBSITE, ServiceMode, Timezone, TIMEZONES, VisitType } from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import ottehrApi from '../api/ottehrApi';
import { BOOKING_SLOT_ID_PARAM, bookingBasePath } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import { PatientInfoInProgress } from '../features/patients/types';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

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
  scheduleOwnerType: string;
  scheduleOwnerId: string;
  patients: PatientInfo[];
  timezone: Timezone;
  serviceMode: ServiceMode;
  visitType: VisitType;
  startISO: string;
  endISO: string;
  waitingMinutes: number | undefined;
  patientsLoading: boolean;
  originalBookingUrl?: string;
}

export const useBookingContext = (): BookAppointmentContext => {
  const outletContext = useOutletContext<BookAppointmentContext>();
  return {
    ...outletContext,
  };
};

// cSpell:ignore prepatient
const isPostPatientSelectionPath = (basePath: string, pathToCheck: string): boolean => {
  // review is last step but we detect on submit instead so redirect doesn't jump
  // the transition to the appointment page
  const prepatientSelectionPaths = [basePath, `${basePath}/get-ready`, `${basePath}/patients`, `${basePath}/review`];
  const normalized = pathToCheck.split('?')[0];
  return !prepatientSelectionPaths.includes(normalized);
};

const BookingHome: FC = () => {
  const { patientInfo, unconfirmedDateOfBirth, setPatientInfo, setUnconfirmedDateOfBirth, completeBooking } =
    getSelectors(useBookingStore, [
      'patientInfo',
      'unconfirmedDateOfBirth',
      'setPatientInfo',
      'setUnconfirmedDateOfBirth',
      'completeBooking',
      'handleLogout',
    ]);
  const { [BOOKING_SLOT_ID_PARAM]: slotIdParam } = useParams();

  const { pathname } = useLocation();
  // const navigate = useNavigate();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const [pageNotFound, _setPageNotFound] = useState(false);
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  // const { isAuthenticated, isLoading: authIsLoading } = useAuth0();
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
    // console.log('Slot details data:', slotDetailsData);
  } else if (getSlotDetailsError) {
    console.log('Slot details error:', getSlotDetailsError);
  } else {
    // console.log('Slot details loading:', slotDetailsLoadingInSomeWay);
  }

  const {
    data: patientsData,
    error: _getPatientsError,
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
      enabled: Boolean(tokenfulZambdaClient),
    }
  );

  const patientsLoadingInSomeWay = patientsLoading || patientsFetching || patientsRefetching;

  /*
    console.log('patients data:', patientsData);
    console.log('patients error:', getPatientsError);
    console.log('patients loading:', patientsLoadingInSomeWay);
    console.log('Slot details loading:', slotDetailsLoadingInSomeWay);
  */

  const outletContext: BookAppointmentContext | null = useMemo(() => {
    if (!slotDetailsData) {
      return null;
    }

    const waitingMinutesTemp: number | undefined = undefined;

    const visitType = slotDetailsData.isWalkin ? VisitType.WalkIn : VisitType.PreBook;
    const {
      slotId,
      serviceMode,
      timezoneForDisplay: timezone,
      startISO,
      endISO,
      ownerName,
      ownerType,
      ownerId,
      originalBookingUrl,
    } = slotDetailsData;
    let scheduleOwnerType = 'Location';
    if (ownerType === 'Practitioner') {
      scheduleOwnerType = 'Provider';
    }
    if (ownerType === 'HealthcareService') {
      scheduleOwnerType = 'Group';
    }

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
      scheduleOwnerName: ownerName,
      scheduleOwnerType,
      scheduleOwnerId: ownerId,
      originalBookingUrl,
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
          {t('welcome.errors.notFound.description')} <a href={PROJECT_WEBSITE}>{t('welcome.errors.notFound.link')}</a>.
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
