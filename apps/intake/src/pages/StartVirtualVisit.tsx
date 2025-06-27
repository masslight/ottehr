import { InfoOutlined } from '@mui/icons-material';
import { Autocomplete, Skeleton, TextField, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import {
  APIError,
  CreateSlotParams,
  getHoursOfOperationForToday,
  getTimezone,
  isApiError,
  isLocationOpen,
  ServiceMode,
  stateCodeToFullName,
  TelemedLocation,
  TIMEZONES,
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
import { useGetTelemedStates } from '../telemed/features/appointments';
import { useZapEHRAPIClient } from '../telemed/utils';

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

  const apiClient = useZapEHRAPIClient({ tokenless: true });
  const { data: locationsResponse } = useGetTelemedStates(apiClient, Boolean(apiClient));
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const telemedStates = locationsResponse?.locations || emptyArray;

  console.log('locationsResponse', locationsResponse);

  const handleStateChange = (_e: any, newValue: TelemedLocation | null): void => {
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

  const sortedStates = useMemo(() => {
    const allStates = new Set([...Object.keys(stateCodeToFullName), ...telemedStates.map((s) => s.state)]);

    const getPriority = (state: { available: boolean; workingHours: null | string }): number => {
      if (state.available) return 0;
      if (state.workingHours) return 1;
      return 2;
    };

    return [...allStates]
      .map((stateCode) => {
        const serverState = telemedStates.find((s) => s.state === stateCode);

        const currentWorkingHours = currentWorkingHoursText(serverState);
        return {
          state: stateCode,
          available: serverState?.locationInformation?.scheduleExtension
            ? isLocationOpen(
                serverState.locationInformation.scheduleExtension,
                serverState.locationInformation.timezone ?? TIMEZONES[0],
                DateTime.now().setZone(serverState.locationInformation.timezone ?? '')
              )
            : false,
          workingHours: (Boolean(serverState?.available) && currentWorkingHours) || null,
          fullName: stateCodeToFullName[stateCode] || stateCode,
          scheduleId: serverState?.schedule.id || '',
          schedule: serverState?.schedule,
          locationInformation: serverState?.locationInformation,
        };
      })
      .sort((a, b) => {
        const priorityDiff = getPriority(a) - getPriority(b);
        return priorityDiff !== 0 ? priorityDiff : a.fullName.localeCompare(b.fullName);
      });
  }, [telemedStates]);

  console.log('sortedStates, telemedStates', sortedStates?.length, telemedStates?.length);

  return (
    <PageContainer title="Request a Virtual Visit" imgAlt="Chat icon">
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information just
        once. Next time you return, it will all be here for you!
      </Typography>
      {!sortedStates?.length || !telemedStates?.length ? (
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
            options={sortedStates}
            getOptionLabel={(option) => option.fullName || option.state || ''}
            onChange={(_e, newValue) =>
              newValue?.schedule ? handleStateChange(_e, newValue as TelemedLocation) : null
            }
            value={sortedStates.find((state) => state.state === selectedLocation?.state) || null}
            isOptionEqualToValue={(option, value) => option.state === value.state}
            renderOption={(props, option) => {
              return (
                <li {...props}>
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
                  Current location (State)
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
