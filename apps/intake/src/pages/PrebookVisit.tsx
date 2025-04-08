import { Autocomplete, Skeleton, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Box, styled } from '@mui/system';
import { FC, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import noop from 'lodash/noop';
import { BoldPurpleInputLabel } from 'ui-components';
import { BookableItem, GetScheduleResponse, ScheduleType, ServiceMode, VisitType } from 'utils';
import {
  BOOKING_SCHEDULE_ON_QUERY_PARAM,
  BOOKING_SCHEDULE_TYPE_QUERY_PARAM,
  BOOKING_SERVICE_MODE_PARAM,
  BOOKING_SCHEDULE_SELECTED_SLOT,
  intakeFlowPageRoute,
} from '../App';
import { PageContainer, Schedule } from '../components';
import { otherColors } from '../IntakeThemeProvider';
import { useGetBookableItems, useGetSchedule } from '../telemed/features/appointments/appointment.queries';
import { useZapEHRAPIClient } from '../telemed/utils';
import { dataTestIds } from '../helpers/data-test-ids';
import { Slot } from 'fhir/r4b';

const SERVICE_MODES: ServiceMode[] = [ServiceMode['in-person'], ServiceMode['virtual']];

const useBookingParams = (
  selectedLocation: BookableItem | null
): {
  serviceMode: ServiceMode;
  bookingOn: string | null;
  scheduleType: ScheduleType | null;
  selectedSlot: string | undefined;
  slugToFetch: string | undefined;
  serviceModeFromParam: string | undefined;
} => {
  const [searchParams] = useSearchParams();
  const pathParams = useParams();
  const bookingOn = searchParams.get(BOOKING_SCHEDULE_ON_QUERY_PARAM);
  const scheduleTypeFromParam = searchParams.get(BOOKING_SCHEDULE_TYPE_QUERY_PARAM) as ScheduleType | null;
  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM];

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
  };
};

const useBookingData = (
  serviceMode: ServiceMode,
  slugToFetch: string | undefined,
  scheduleType: ScheduleType | null
): {
  bookableItems: BookableItem[];
  isCategorized: boolean;
  isLoading: boolean;
  slotData: GetScheduleResponse | undefined;
  isSlotsLoading: boolean;
  inPersonData?: { items: BookableItem[]; categorized: boolean };
} => {
  const apiClient = useZapEHRAPIClient();

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
    }
  );

  const currentData = serviceMode === ServiceMode['in-person'] ? inPersonData : virtualData;

  const isLoading =
    serviceMode === ServiceMode['in-person'] ? inPersonStatus === 'loading' : virtualStatus === 'loading';

  return {
    bookableItems: currentData?.items ?? [],
    isCategorized: currentData?.categorized ?? false,
    isLoading,
    slotData,
    isSlotsLoading: slotsStatus === 'loading',
    inPersonData,
  };
};

const getLocationTitleText = ({
  selectedLocation,
  bookingOn,
  slotData,
  isSlotsLoading,
}: {
  selectedLocation: BookableItem | null;
  bookingOn: string | null;
  slotData?: GetScheduleResponse;
  isSlotsLoading: boolean;
}): string => {
  if ((!selectedLocation && !bookingOn) || isSlotsLoading) {
    return 'Book a visit';
  }

  const locationName = slotData?.location?.name || selectedLocation?.label || bookingOn;
  const isProviderSchedule = slotData?.location?.scheduleType === ScheduleType.provider;
  const preposition = isProviderSchedule ? 'with' : 'at';
  return `Book a visit ${preposition} ${locationName}`;
};

const PrebookVisit: FC = () => {
  const navigate = useNavigate();
  const pathParams = useParams();

  const [serviceModeIndex, setServiceModeIndex] = useState<0 | 1>(0);
  const [selectedInPersonLocation, setSelectedInPersonLocation] = useState<BookableItem | null>(null);
  const [selectedVirtualLocation, setSelectedVirtualLocation] = useState<BookableItem | null>(null);

  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM];
  const serviceMode: ServiceMode = (serviceModeFromParam as ServiceMode | undefined) ?? SERVICE_MODES[serviceModeIndex];

  const selectedLocation =
    (serviceModeFromParam ?? serviceMode) === 'in-person' ? selectedInPersonLocation : selectedVirtualLocation;

  const { bookingOn, scheduleType, selectedSlot, slugToFetch } = useBookingParams(selectedLocation);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [specificScheduleId] = bookingOn?.split('Schedule/') ?? [];

  const {
    bookableItems,
    isCategorized,
    isLoading: isBookablesLoading,
    slotData,
    isSlotsLoading,
  } = useBookingData(serviceMode, slugToFetch, scheduleType);

  console.log('slotData', slotData);

  const handleBookableSelection = (_e: any, newValue: BookableItem | null): void => {
    const serviceType = newValue?.serviceMode ?? serviceModeFromParam ?? serviceMode;
    const setLocation = serviceType === 'in-person' ? setSelectedInPersonLocation : setSelectedVirtualLocation;
    setLocation(newValue);
  };

  const handleSlotSelection = (slot?: Slot): void => {
    if (slot && slugToFetch) {
      navigate(`/book/${slugToFetch}/${VisitType.PreBook}/${serviceMode}/patients`, {
        state: { slot, scheduleType },
      });
    }
  };

  const title = getLocationTitleText({ selectedLocation, bookingOn, slotData, isSlotsLoading });

  if (serviceModeFromParam && !(serviceModeFromParam in ServiceMode)) {
    return <Navigate to={intakeFlowPageRoute.PrebookVisit.path} replace />;
  }

  return (
    <PageContainer title={title} imgAlt="Chat icon">
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information just
        once. Next time you return, it will all be here for you!
      </Typography>

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
                    Select a location
                  </BoldPurpleInputLabel>
                  <StyledTextField {...params} placeholder="Search or select" variant="outlined" />
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
              scheduleType={scheduleType ?? ScheduleType.location}
              slotsLoading={false}
              existingSelectedSlot={slotData?.available?.find((si) => si.slot.id && si.slot.id === selectedSlot)?.slot}
              timezone={selectedLocation?.timezone ?? 'America/New_York'}
              locationSlug={slugToFetch}
              forceClosedToday={false}
              forceClosedTomorrow={false}
              markSlotBusy={false}
              setSlotData={noop} // this does nothing due to the custom on submit
              handleSlotSelected={noop}
            />
          ))}
      </SelectionContainer>
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
  return (
    <Box sx={{ border: '0px', display: hidden ? 'none' : 'block' }}>
      <Tabs
        value={serviceModeIndex}
        onChange={(_e, val) => setServiceModeIndex(val as 0 | 1)}
        aria-label="service mode tabs"
      >
        <Tab label="In Person" />
        <Tab label="Virtual" />
      </Tabs>
    </Box>
  );
};

export default PrebookVisit;
