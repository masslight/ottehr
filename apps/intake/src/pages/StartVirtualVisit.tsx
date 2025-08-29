import { InfoOutlined } from '@mui/icons-material';
import { Autocomplete, Skeleton, TextField, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import {
  APIError,
  CreateSlotParams,
  getClosingTime,
  getHoursOfOperationForToday,
  getOpeningTime,
  getTimezone,
  isApiError,
  ServiceMode,
  TelemedLocation,
} from 'utils';
import ottehrApi from '../api/ottehrApi';
import { bookingBasePath, intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { CustomTooltip } from '../components/CustomTooltip';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import { BoldPurpleInputLabel } from '../components/form';
import PageForm from '../components/PageForm';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors } from '../IntakeThemeProvider';
import { useGetTelemedLocations } from '../telemed/features/appointments';
import { useOystehrAPIClient } from '../telemed/utils';

const emptyArray: [] = [];

const currentWorkingHoursText = (location: TelemedLocation | undefined): string | null => {
  if (!location?.schedule) {
    return null;
  }
  const schedule = location.schedule;
  const hoursOfOperation = getHoursOfOperationForToday(schedule);
  const timezone = getTimezone(schedule);
  if (!hoursOfOperation) {
    return null;
  }
  const { open, close } = hoursOfOperation;
  const openTime = DateTime.fromISO(open).setZone(timezone);
  const closeTime = DateTime.fromISO(close).setZone(timezone);
  if (openTime.isValid && closeTime.isValid) {
    return openTime.toFormat('h:mm a') + ' - ' + closeTime.toFormat('h:mm a');
  }
  return null;
};

const StartVirtualVisit = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [selectedLocation, setSelectedLocation] = useState<TelemedLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorDialogConfig, setErrorDialogConfig] = useState<ErrorDialogConfig | undefined>(undefined);

  const apiClient = useOystehrAPIClient({ tokenless: true });
  const { data: locationsResponse } = useGetTelemedLocations(apiClient, Boolean(apiClient));
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const telemedLocations = locationsResponse?.locations || emptyArray;

  console.log('locationsResponse', locationsResponse);

  const handleLocationChange = (_e: any, newValue: TelemedLocation | null): void => {
    setSelectedLocation(newValue);
  };

  const onSubmit = async (): Promise<void> => {
    try {
      if (!selectedLocation?.state || !tokenlessZambdaClient) {
        return;
      }

      const createSlotInput: CreateSlotParams = {
        scheduleId: selectedLocation.schedule.id!,
        startISO: DateTime.now().toISO(),
        serviceModality: ServiceMode.virtual,
        lengthInMinutes: 15,
        status: 'busy-tentative',
        walkin: true,
      };

      try {
        const slot = await ottehrApi.createSlot(createSlotInput, tokenlessZambdaClient);
        console.log('createSlotResponse', slot);
        const basePath = generatePath(bookingBasePath, {
          slotId: slot.id!,
        });
        navigate(`${basePath}/patients`);
      } catch (error) {
        console.error('Error creating slot:', error);
        let errorMessage = 'Sorry, this virtual service may not be available at the moment.';
        if (isApiError(error)) {
          errorMessage = (error as APIError).message;
        }
        setErrorDialogConfig({
          title: 'Error starting virtual visit',
          description: errorMessage,
          closeButtonText: 'Ok',
        });
      }

      setIsSubmitting(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedLocations = useMemo(() => {
    const getPriority = (location: { available: boolean; workingHours: null | string }): number => {
      if (location.available) return 0;
      if (location.workingHours) return 1;
      return 2;
    };

    return telemedLocations
      .map((location) => {
        const tz = getTimezone(location.schedule);
        const now = DateTime.now().setZone(tz);
        const state = location.state;
        const currentWorkingHours = currentWorkingHoursText(location);
        const openingTime =
          location.locationInformation.scheduleExtension &&
          getOpeningTime(location.locationInformation.scheduleExtension!, tz, now);
        const closingTime =
          location.locationInformation.scheduleExtension &&
          getClosingTime(location.locationInformation.scheduleExtension!, tz, now);
        const isOpen = Boolean(openingTime && openingTime <= now && (!closingTime || closingTime > now));

        return {
          state: state,
          available: location?.available && openingTime && closingTime ? isOpen : false,
          workingHours: (Boolean(location?.available) && currentWorkingHours) || null,
          fullName: location?.locationInformation?.name || state,
          scheduleId: location?.schedule.id || '',
          schedule: location?.schedule,
          locationInformation: location?.locationInformation,
        };
      })
      .sort((a, b) => {
        const priorityDiff = getPriority(a) - getPriority(b);
        return priorityDiff !== 0 ? priorityDiff : a.fullName.localeCompare(b.fullName);
      });
  }, [telemedLocations]);

  return (
    <PageContainer title="Request a Virtual Visit" imgAlt="Chat icon">
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information just
        once. Next time you return, it will all be here for you!
      </Typography>
      {!sortedLocations?.length || !telemedLocations?.length ? (
        <Skeleton
          sx={{
            borderRadius: 2,
            backgroundColor: otherColors.coachingVisit,
            p: 6,
          }}
        />
      ) : (
        <>
          <Autocomplete
            id="states-autocomplete"
            options={sortedLocations}
            getOptionLabel={(option) => option.fullName || option.state || ''}
            onChange={(_e, newValue) =>
              newValue?.schedule ? handleLocationChange(_e, newValue as TelemedLocation) : null
            }
            value={
              sortedLocations.find(
                (location) => location.locationInformation.id === selectedLocation?.locationInformation.id
              ) || null
            }
            isOptionEqualToValue={(option, value) => option.locationInformation.id === value.locationInformation.id}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.locationInformation.id}>
                  <Box>
                    <Typography sx={{ pt: 1 }} variant="body2">
                      {option.fullName}
                    </Typography>
                    {!option.available && (
                      <Typography variant="body2" color="text.secondary">
                        Unavailable now. {option.workingHours && option.available ? 'Working: ' : ''}
                      </Typography>
                    )}
                    {option.workingHours && (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Working hours today: {option.workingHours}
                        </Typography>
                      </>
                    )}
                  </Box>
                </li>
              );
            }}
            renderInput={(params) => (
              <>
                <BoldPurpleInputLabel required shrink sx={{ whiteSpace: 'pre-wrap', mt: 3 }}>
                  Visit location
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
            getOptionDisabled={(option) => !option.available}
          />
          <CustomTooltip
            enterTouchDelay={0}
            title={
              <Typography sx={{ fontWeight: 400, p: 1 }}>
                To properly connect you with a provider licensed in your location
              </Typography>
            }
            placement="top"
          >
            <Typography color="#8F9AA7" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mt: 1 }}>
              <InfoOutlined fontSize="small" style={{ marginRight: 4 }} />
              Why do we ask this?
            </Typography>
          </CustomTooltip>
        </>
      )}
      <PageForm
        controlButtons={{
          onBack: () => navigate(intakeFlowPageRoute.Homepage.path),
          loading: isSubmitting,
          submitDisabled: !selectedLocation,
          submitLabel: 'Continue',
        }}
        onSubmit={onSubmit}
      />
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

export default StartVirtualVisit;
