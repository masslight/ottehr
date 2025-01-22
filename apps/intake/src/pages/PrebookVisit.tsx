import { Autocomplete, Skeleton, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { FC, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BoldPurpleInputLabel } from 'ui-components';
import { BookableItem, ScheduleType, ServiceMode, VisitType } from 'utils';
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

const SERVICE_MODE: ServiceMode[] = [ServiceMode['in-person'], ServiceMode['virtual']];

const PrebookVisit = (): JSX.Element => {
  const navigate = useNavigate();
  const [serviceModeIndex, setServiceModeIndex] = useState<0 | 1>(0);
  const [selectedInPersonLocation, setSelectedInPersonLocation] = useState<BookableItem | null>(null);
  const [selectedVirtualLocation, setSelectedVirtualLocation] = useState<BookableItem | null>(null);

  const pathParams = useParams();
  const [searchParams] = useSearchParams();
  const serviceModeFromParam = pathParams[BOOKING_SERVICE_MODE_PARAM] ?? undefined;
  const bookingOn: string | null = searchParams.get(BOOKING_SCHEDULE_ON_QUERY_PARAM);
  const scheduleTypeFromParam: string | null = searchParams.get(BOOKING_SCHEDULE_TYPE_QUERY_PARAM);
  const selectedSlot: string | undefined = searchParams.get(BOOKING_SCHEDULE_SELECTED_SLOT) || undefined;
  const serviceMode: ServiceMode = (serviceModeFromParam as ServiceMode | undefined) ?? SERVICE_MODE[serviceModeIndex];

  const selectedLocation =
    (serviceModeFromParam ?? serviceMode) === 'in-person' ? selectedInPersonLocation : selectedVirtualLocation;

  const apiClient = useZapEHRAPIClient();
  console.log('service mode', serviceMode, serviceModeFromParam);
  const { data: inPersonData, status: inpersonStatus } = useGetBookableItems(
    apiClient,
    Boolean(apiClient) && serviceMode === 'in-person',
    {
      serviceMode,
    }
  );
  const { data: virtualData, status: virtualStatus } = useGetBookableItems(
    apiClient,
    Boolean(apiClient) && serviceMode === 'virtual',
    {
      serviceMode,
    }
  );
  const slugToFetch = bookingOn ?? selectedLocation?.slug;
  const scheduleType = (() => {
    if (scheduleTypeFromParam) {
      if (scheduleTypeFromParam === ScheduleType['group']) {
        return ScheduleType['group'];
      } else if (scheduleTypeFromParam === ScheduleType['location']) {
        return ScheduleType['location'];
      } else if (scheduleTypeFromParam === ScheduleType['provider']) {
        return ScheduleType['provider'];
      }
    } else if (selectedLocation) {
      if (selectedLocation.resourceType === 'HealthcareService') {
        return ScheduleType['group'];
      } else if (selectedLocation.resourceType === 'Location') {
        return ScheduleType['location'];
      } else {
        return ScheduleType['provider'];
      }
    }
    return undefined;
  })();
  console.log('slug to fetch', slugToFetch);

  const { data: slotData, status: fetchSlotsStatus } = useGetSchedule(
    apiClient,
    Boolean(apiClient) && slugToFetch !== undefined && scheduleType !== undefined,
    {
      slug: slugToFetch ?? '',
      scheduleType: scheduleType ?? ScheduleType['location'],
    }
  );

  const bookableItems = serviceMode === ServiceMode['in-person'] ? inPersonData?.items ?? [] : virtualData?.items ?? [];
  const categorized =
    serviceMode === ServiceMode['in-person'] ? inPersonData?.categorized ?? false : virtualData?.categorized ?? false;
  const bookablesLoading =
    serviceMode === ServiceMode['in-person'] ? inpersonStatus === 'loading' : virtualStatus === 'loading';

  const handleBookableSelectionChange = (_e: any, newValue: BookableItem | null): void => {
    if (newValue) {
      if (newValue.serviceMode === 'in-person') {
        setSelectedInPersonLocation(newValue);
      } else {
        setSelectedVirtualLocation(newValue);
      }
    } else {
      const type = serviceModeFromParam ?? serviceMode;
      if (type === 'in-person') {
        setSelectedInPersonLocation(newValue);
      } else {
        setSelectedVirtualLocation(newValue);
      }
    }
  };

  const finishSlotSelection = (slot?: string): void => {
    // console.log('slot selection event', slot, scheduleType, serviceMode, slugToFetch);
    // todo for future consideration: creating a persisted slot and routing to its id as the single param
    // would be amazing here
    if (slot && slugToFetch) {
      navigate(`/book/${slugToFetch}/${VisitType.PreBook}/${serviceMode}/patients`, {
        state: { slot, scheduleType },
      });
    }
  };

  const containerTitle = (() => {
    if (selectedLocation != undefined || bookingOn != undefined) {
      const locationName =
        slotData?.location?.slug === bookingOn && slotData?.location?.name ? slotData?.location?.name : bookingOn;
      return `Book a visit ${slotData?.location.scheduleType === ScheduleType['provider'] ? 'with' : 'at'} ${
        selectedLocation?.label ?? locationName
      }`;
    } else {
      return 'Book a visit';
    }
  })();

  if (serviceModeFromParam && serviceModeFromParam in ServiceMode === false) {
    return <Navigate to={intakeFlowPageRoute.PrebookVisit.path} replace />;
  }

  console.log('bookingOn', bookingOn);

  return (
    <PageContainer title={containerTitle} imgAlt="Chat icon">
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information just
        once. Next time you return, it will all be here for you!
      </Typography>
      {serviceModeFromParam == undefined && (
        <Box sx={{ border: '0px' }}>
          <Tabs
            value={serviceModeIndex}
            onChange={(_e, val) => {
              setServiceModeIndex(val);
            }}
            aria-label="basic tabs example"
          >
            <Tab label="In Person" />
            <Tab label="Virtual" />
          </Tabs>
        </Box>
      )}
      <Box sx={{ display: 'flex', width: '100%', flexDirection: 'column', marginTop: '20px' }}>
        {bookablesLoading && bookingOn == undefined ? (
          <Skeleton
            sx={{
              borderRadius: 2,
              backgroundColor: otherColors.coachingVisit,
              p: 6,
            }}
          />
        ) : bookingOn == undefined ? (
          <BookableSelectorComponent
            options={bookableItems}
            categorized={categorized}
            value={selectedLocation}
            onChange={handleBookableSelectionChange}
          />
        ) : (
          <></>
        )}
      </Box>
      <Box sx={{ display: 'flex', width: '100%', flexDirection: 'column', minHeight: '200px' }}>
        {slugToFetch &&
          (fetchSlotsStatus === 'loading' ? (
            <Skeleton
              sx={{
                borderRadius: 2,
                backgroundColor: otherColors.coachingVisit,
                p: 6,
              }}
            />
          ) : (
            <Schedule
              customOnSubmit={finishSlotSelection}
              slotData={slotData?.available ?? []}
              setSlotData={() => {
                console.log('this does nothing due to the custom on submit');
              }}
              slotsLoading={false}
              existingSelectedSlot={selectedSlot}
              handleSlotSelected={(slot: string) => {
                console.log('selected slot', slot);
              }}
              timezone={selectedLocation?.timezone ?? 'America/New_York'}
              locationSlug={slugToFetch}
              forceClosedToday={false}
              forceClosedTomorrow={false}
              markSlotBusy={false}
            />
          ))}
      </Box>
    </PageContainer>
  );
};
interface BookableSelectorProps {
  options: BookableItem[];
  categorized: boolean;
  value: BookableItem | null;
  onChange: (_e: any, newValue: BookableItem | null) => void;
}

const BookableSelectorComponent: FC<BookableSelectorProps> = (props: BookableSelectorProps) => {
  const { options, value, categorized, onChange } = props;
  const theme = useTheme();
  console.log('categorized', categorized);
  return (
    <Autocomplete
      id="bookable-autocomplete"
      options={options}
      getOptionLabel={(option) => option.label || option.state || ''}
      onChange={onChange}
      groupBy={
        categorized
          ? (option) => {
              return option.category ?? '';
            }
          : undefined
      }
      value={value}
      isOptionEqualToValue={(option, value) => option.state === value.state}
      renderOption={(props, option) => {
        console.log('option', option, option.secondaryLabel);
        return (
          <li {...props} key={`option-${option.resourceId}`}>
            <Box>
              <Typography sx={{ pt: 1 }} variant="body2" key={`label-${option.resourceId}`}>
                {option.label}
              </Typography>
              {option.secondaryLabel.map((sl, idx) => {
                return (
                  <Typography variant="body2" color="text.secondary" key={`sec-${option.resourceId}-${idx}`}>
                    {sl}
                  </Typography>
                );
              })}
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <>
          <BoldPurpleInputLabel required shrink sx={{ whiteSpace: 'pre-wrap' }}>
            Select a location
          </BoldPurpleInputLabel>
          <TextField
            {...params}
            placeholder="Search or select"
            variant="outlined"
            sx={{
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
            }}
          />
        </>
      )}
    />
  );
};

export default PrebookVisit;
