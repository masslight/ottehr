import { Autocomplete, Skeleton, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Box, styled } from '@mui/system';
import { Slot } from 'fhir/r4b';
import { TFunction } from 'i18next';
import noop from 'lodash/noop';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  APIError,
  BookableItem,
  BOOKING_CONFIG,
  CreateSlotParams,
  createSlotParamsFromSlotAndOptions,
  GetScheduleResponse,
  isApiError,
  ScheduleType,
  ServiceCategoryCode,
  ServiceCategoryCodeSchema,
  ServiceMode,
  SlotListItem,
} from 'utils';
import ottehrApi from '../api/ottehrApi';
import {
  BOOKING_SCHEDULE_ON_QUERY_PARAM,
  BOOKING_SCHEDULE_SELECTED_SLOT,
  BOOKING_SCHEDULE_TYPE_QUERY_PARAM,
  BOOKING_SERVICE_CATEGORY_PARAM,
  BOOKING_SERVICE_MODE_PARAM,
  bookingBasePath,
  intakeFlowPageRoute,
} from '../App';
import { PageContainer, Schedule } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import { BoldPurpleInputLabel } from '../components/form';
import { dataTestIds } from '../helpers/data-test-ids';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors } from '../IntakeThemeProvider';
import { useGetBookableItems, useGetSchedule } from '../telemed/features/appointments/appointment.queries';
import { useOystehrAPIClient } from '../telemed/utils';

const SERVICE_MODES: ServiceMode[] = [ServiceMode['in-person'], ServiceMode['virtual']];

const getUrl = (): string => {
  return `${window.location.pathname}${window.location.search}`;
};

const findSelectedSlotFromAvailable = (available: SlotListItem[], selectedSlotId?: string): Slot | undefined => {
  if (!selectedSlotId) {
    return undefined;
  }

  // todo: test needed to ensure an existing tentative-busy slot is included in the list of available
  // slots whenever this page is being used to update a previously selected slot time
  return available.find((si) => {
    const { slot, owner } = si;
    const { id: slotId, start: slotStart } = slot;

    if (owner.id && selectedSlotId.startsWith(owner.id)) {
      return `${owner.id}|${slotStart}` === selectedSlotId;
    } else {
      return slotId === selectedSlotId;
    }
  })?.slot;
};

const useBookingParams = (
  selectedLocation: BookableItem | null
): {
  serviceMode: ServiceMode;
  bookingOn: string | null;
  scheduleType: ScheduleType | null;
  selectedSlot: string | undefined;
  slugToFetch: string | undefined;
  serviceModeFromParam: string | undefined;
  serviceCategoryCode: ServiceCategoryCode | undefined;
} => {
  const [searchParams] = useSearchParams();
  const pathParams = useParams();
  const bookingOn = searchParams.get(BOOKING_SCHEDULE_ON_QUERY_PARAM);
  const scheduleTypeFromParam = searchParams.get(BOOKING_SCHEDULE_TYPE_QUERY_PARAM) as ScheduleType | null;
  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM];
  const serviceCategoryCodeFromParam = searchParams.get(BOOKING_SERVICE_CATEGORY_PARAM);

  const typeMap: Record<string, ScheduleType> = {
    HealthcareService: ScheduleType.group,
    Location: ScheduleType.location,
    Practitioner: ScheduleType.provider,
    PractitionerRole: ScheduleType.provider,
  };

  return {
    serviceMode: serviceModeFromParam as ServiceMode,
    serviceModeFromParam,
    bookingOn,
    selectedSlot: searchParams.get(BOOKING_SCHEDULE_SELECTED_SLOT) ?? undefined,
    scheduleType: scheduleTypeFromParam || (selectedLocation && typeMap[selectedLocation.resourceType]),
    slugToFetch: bookingOn ?? selectedLocation?.slug,
    serviceCategoryCode: ServiceCategoryCodeSchema.safeParse(serviceCategoryCodeFromParam)?.data ?? undefined,
  };
};

const useBookingData = (
  serviceMode: ServiceMode,
  slugToFetch: string | undefined,
  scheduleType: ScheduleType | null,
  serviceCategoryCode?: ServiceCategoryCode
): {
  bookableItems: BookableItem[];
  isCategorized: boolean;
  isLoading: boolean;
  slotData: GetScheduleResponse | undefined;
  isSlotsLoading: boolean;
  inPersonData?: { items: BookableItem[]; categorized: boolean };
} => {
  const apiClient = useOystehrAPIClient({ tokenless: true });

  const { data: inPersonData, status: inPersonStatus } = useGetBookableItems(
    apiClient,
    Boolean(apiClient) && serviceMode === 'in-person',
    { serviceMode }
  );

  const { data: virtualData, status: virtualStatus } = useGetBookableItems(
    apiClient,
    Boolean(apiClient) && serviceMode === 'virtual',
    { serviceMode }
  );

  const { data: slotData, status: slotsStatus } = useGetSchedule(
    apiClient,
    Boolean(apiClient) && Boolean(slugToFetch) && Boolean(scheduleType),
    {
      slug: slugToFetch ?? '',
      scheduleType: scheduleType ?? ScheduleType.location,
      serviceCategoryCode,
    }
  );

  const currentData = serviceMode === ServiceMode['in-person'] ? inPersonData : virtualData;

  const isLoading =
    serviceMode === ServiceMode['in-person'] ? inPersonStatus === 'pending' : virtualStatus === 'pending';

  return {
    bookableItems: currentData?.items ?? [],
    isCategorized: currentData?.categorized ?? false,
    isLoading,
    slotData,
    isSlotsLoading: slotsStatus === 'pending',
    inPersonData,
  };
};

const getLocationTitleText = ({
  selectedLocation,
  bookingOn,
  slotData,
  isSlotsLoading,
  t,
}: {
  selectedLocation: BookableItem | null;
  bookingOn: string | null;
  slotData?: GetScheduleResponse;
  isSlotsLoading: boolean;
  t: TFunction;
}): string => {
  if ((!selectedLocation && !bookingOn) || isSlotsLoading) {
    return t('prebookVisit.title');
  }

  const locationName = slotData?.location?.name || selectedLocation?.label || bookingOn;
  const isProviderSchedule = slotData?.location?.scheduleOwnerType === ScheduleType.provider;
  const preposition = isProviderSchedule ? t('prebookVisit.prepositionWith') : t('prebookVisit.prepositionAt');
  return t('prebookVisit.titleWithLocation', { preposition, locationName });
};

const PrebookVisit: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const pathParams = useParams();
  const { state: navState } = useLocation();

  const isReschedule = Boolean(navState?.reschedule);

  const [serviceModeIndex, setServiceModeIndex] = useState<0 | 1>(0);
  const [selectedInPersonLocation, setSelectedInPersonLocation] = useState<BookableItem | null>(null);
  const [selectedVirtualLocation, setSelectedVirtualLocation] = useState<BookableItem | null>(null);

  const [errorDialogConfig, setErrorDialogConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM];
  const serviceMode: ServiceMode = (serviceModeFromParam as ServiceMode | undefined) ?? SERVICE_MODES[serviceModeIndex];

  const selectedLocation =
    (serviceModeFromParam ?? serviceMode) === 'in-person' ? selectedInPersonLocation : selectedVirtualLocation;

  const { bookingOn, scheduleType, selectedSlot, slugToFetch, serviceCategoryCode } =
    useBookingParams(selectedLocation);
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const {
    bookableItems,
    isCategorized,
    isLoading: isBookablesLoading,
    slotData,
    isSlotsLoading,
  } = useBookingData(serviceMode, slugToFetch, scheduleType, serviceCategoryCode);

  const handleBookableSelection = (_e: any, newValue: BookableItem | null): void => {
    const serviceType = newValue?.serviceMode ?? serviceModeFromParam ?? serviceMode;
    const setLocation = serviceType === 'in-person' ? setSelectedInPersonLocation : setSelectedVirtualLocation;
    setLocation(newValue);
  };

  const handleSlotSelection = async (slot?: Slot): Promise<void> => {
    if (slot && tokenlessZambdaClient) {
      // Use test questionnaire canonical if injected via config (for e2e test isolation)
      const questionnaireCanonical =
        serviceMode === ServiceMode.virtual
          ? BOOKING_CONFIG.virtualQuestionnaireCanonical
          : BOOKING_CONFIG.inPersonQuestionnaireCanonical;
      const createSlotInput: CreateSlotParams = {
        ...createSlotParamsFromSlotAndOptions(slot, {
          originalBookingUrl: getUrl(),
          status: 'busy-tentative',
        }),
        ...(questionnaireCanonical && { questionnaireCanonical }),
      };

      try {
        const slot = await ottehrApi.createSlot(createSlotInput, tokenlessZambdaClient);
        const basePath = generatePath(bookingBasePath, {
          slotId: slot.id!,
        });
        if (isReschedule) {
          navigate(`${basePath}/review`);
        } else {
          const basePath = generatePath(bookingBasePath, {
            slotId: slot.id!,
          });
          navigate(`${basePath}/patients`);
        }
      } catch (error) {
        let errorMessage = t('prebookVisit.slotUnavailable');
        if (isApiError(error)) {
          errorMessage = (error as APIError).message;
        }
        setErrorDialogConfig({
          title: t('prebookVisit.errorReservingTitle'),
          description: errorMessage,
          closeButtonText: t('prebookVisit.ok'),
        });
      }
    }
  };

  const title = getLocationTitleText({ selectedLocation, bookingOn, slotData, isSlotsLoading, t });

  if (serviceModeFromParam && !(serviceModeFromParam in ServiceMode)) {
    return <Navigate to={intakeFlowPageRoute.PrebookVisit.path} replace />;
  }

  return (
    <PageContainer title={title} imgAlt="Chat icon">
      <Typography variant="body1">{t('prebookVisit.intro')}</Typography>

      <ServiceModeSelector
        serviceModeIndex={serviceModeIndex}
        setServiceModeIndex={setServiceModeIndex}
        hidden={Boolean(serviceModeFromParam) || Boolean(bookingOn)}
      />

      <SelectionContainer>
        {!bookingOn &&
          (isBookablesLoading ? (
            <LoadingSkeleton />
          ) : (
            <Autocomplete
              id="bookable-autocomplete"
              options={bookableItems}
              data-testid={dataTestIds.scheduleVirtualVisitStatesSelector}
              getOptionLabel={(option) => option.label || option.state || ''}
              onChange={handleBookableSelection}
              groupBy={isCategorized ? (option) => option.category ?? '' : undefined}
              value={selectedLocation}
              isOptionEqualToValue={(option, value) => option.state === value.state}
              renderOption={(props, option) => (
                <li {...props} key={`option-${option.resourceId}`}>
                  <Box>
                    <Typography sx={{ pt: 1 }} variant="body2">
                      {option.label}
                    </Typography>
                    {option.secondaryLabel.map((label, idx) => (
                      <Typography variant="body2" color="text.secondary" key={`sec-${option.resourceId}-${idx}`}>
                        {label}
                      </Typography>
                    ))}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <>
                  <BoldPurpleInputLabel required shrink sx={{ whiteSpace: 'pre-wrap' }}>
                    {t('prebookVisit.selectLocation')}
                  </BoldPurpleInputLabel>
                  <StyledTextField {...params} placeholder={t('prebookVisit.searchOrSelect')} variant="outlined" />
                </>
              )}
            />
          ))}

        {slugToFetch &&
          (isSlotsLoading ? (
            <LoadingSkeleton />
          ) : (
            <Schedule
              customOnSubmit={handleSlotSelection}
              slotData={(slotData?.available ?? []).map((sli) => sli.slot)}
              slotsLoading={false}
              existingSelectedSlot={findSelectedSlotFromAvailable(slotData?.available ?? [], selectedSlot)}
              timezone={selectedLocation?.timezone ?? slotData?.timezone ?? 'America/New_York'}
              forceClosedToday={false}
              forceClosedTomorrow={false}
              handleSlotSelected={noop}
            />
          ))}
      </SelectionContainer>

      <ErrorDialog
        open={!!errorDialogConfig}
        title={errorDialogConfig?.title || ''}
        description={errorDialogConfig?.description || ''}
        closeButtonText={errorDialogConfig?.closeButtonText || ''}
        handleClose={() => setErrorDialogConfig(undefined)}
      />
    </PageContainer>
  );
};

const LoadingSkeleton: FC = () => (
  <Skeleton
    sx={{
      borderRadius: 2,
      backgroundColor: otherColors.coachingVisit,
      p: 6,
    }}
  />
);

const SelectionContainer = styled(Box)({
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  marginTop: '20px',
  minHeight: '200px',
});

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: theme.palette.background.paper,
    borderColor: otherColors.lightGray,
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: otherColors.lightGray,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: otherColors.lightGray,
    },
  },
}));

interface ServiceModeSelectorProps {
  serviceModeIndex: number;
  setServiceModeIndex: (idx: 0 | 1) => void;
  hidden?: boolean;
}

const ServiceModeSelector: FC<ServiceModeSelectorProps> = ({ setServiceModeIndex, serviceModeIndex, hidden }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ border: '0px', display: hidden ? 'none' : 'block' }}>
      <Tabs
        value={serviceModeIndex}
        onChange={(_e, val) => setServiceModeIndex(val as 0 | 1)}
        aria-label="service mode tabs"
      >
        <Tab label={t('prebookVisit.inPersonTab')} />
        <Tab label={t('prebookVisit.virtualTab')} />
      </Tabs>
    </Box>
  );
};

export default PrebookVisit;
