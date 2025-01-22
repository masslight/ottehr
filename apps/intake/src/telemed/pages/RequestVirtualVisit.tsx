import { InfoOutlined } from '@mui/icons-material';
import { Autocomplete, Skeleton, TextField, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BoldPurpleInputLabel, CustomTooltip, PageForm } from 'ui-components';
import {
  checkTelemedLocationAvailability,
  stateCodeToFullName,
  TelemedLocation,
  telemedStateWorkingSchedule,
} from 'utils';
import { intakeFlowPageRoute } from '../../App';
import { otherColors } from '../../IntakeThemeProvider';
import { useAppointmentUpdate, useGetTelemedStates } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { useTelemedLocation } from '../features/locationState';
import { useZapEHRAPIClient } from '../utils';

const emptyArray: [] = [];

const RequestVirtualVisit = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [selectedLocation, setSelectedLocation] = useState<TelemedLocation | null>(null);
  const { getAppointmentNextUpdateType } = useAppointmentUpdate();
  const canUpdateLocation = getAppointmentNextUpdateType() === 'update';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiClient = useZapEHRAPIClient();
  const { data: locationsResponse } = useGetTelemedStates(apiClient, Boolean(apiClient));

  const {
    location: telemedLocation,
    isLocationInitialized,
    updateLocation,
    updateLocationAvailabilityByWorkingHours,
  } = useTelemedLocation();

  const [searchParams] = useSearchParams();
  const flowParam = searchParams.get('flow');
  const telemedStates = locationsResponse?.locations || emptyArray;
  const { t } = useTranslation();

  // set previous selected location to UI selector
  useEffect(() => {
    if (telemedLocation?.available) {
      setSelectedLocation(telemedLocation);
    }
  }, [telemedLocation]);

  const handleStateChange = (_e: any, newValue: TelemedLocation | null): void => {
    setSelectedLocation(newValue);
  };

  const onSubmit = async (): Promise<void> => {
    try {
      if (!selectedLocation?.state) {
        return;
      }

      setIsSubmitting(true);

      /**
       * If the user has been on the page for too long, the location availability
       * might have changed, so we need to check it again.
       *
       * The telemed location might also have been changed by an admin, but we
       * defer checking this until the review page to avoid an additional GET request.
       */
      const actualizedLocation = updateLocationAvailabilityByWorkingHours(selectedLocation);

      if (!actualizedLocation?.available) {
        setSelectedLocation(null);
        useIntakeCommonStore.setState({ error: `${selectedLocation.state} state is closed now` });
        return;
      }

      if (canUpdateLocation) {
        // we can update appointment and location only if appointment created already
        const updateResult = await updateLocation(selectedLocation.state);
        if (updateResult?.status === 'error') {
          throw new Error('location is not updated');
        }
      } else {
        /**
         * We can't update the location if the appointment hasn't been created yet.
         * In this case, we save the location to the store to use it later during
         * appointment creation. After the appointment is created, we will clear
         * the location from the store. This is the only case when we need to have
         * the location in the store.
         */
        useIntakeCommonStore.setState({ selectedLocationState: selectedLocation.state });
      }

      const query = flowParam ? `?flow=${flowParam}` : '';

      navigate(`${intakeFlowPageRoute.TelemedPatientInformation.path}${query}`, {
        state: { patientId: location?.state?.patientId },
      });
    } catch (error) {
      useIntakeCommonStore.setState({ error: t('general.errors.general') });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedStates = useMemo(() => {
    const allStates = new Set([...Object.keys(stateCodeToFullName), ...telemedStates.map((s) => s.state)]);

    const getPriority = (state: {
      available: boolean;
      workingHours: null | (typeof telemedStateWorkingSchedule)[string];
    }): number => {
      if (state.available) return 0;
      if (state.workingHours) return 1;
      return 2;
    };

    return [...allStates]
      .map((stateCode) => {
        const serverState = telemedStates.find((s) => s.state === stateCode);

        return {
          state: stateCode,
          available: serverState ? checkTelemedLocationAvailability(serverState) : false,
          workingHours: (Boolean(serverState?.available) && telemedStateWorkingSchedule[stateCode]) || null,
          fullName: stateCodeToFullName[stateCode] || stateCode,
        };
      })
      .sort((a, b) => {
        const priorityDiff = getPriority(a) - getPriority(b);
        return priorityDiff !== 0 ? priorityDiff : a.fullName.localeCompare(b.fullName);
      });
  }, [telemedStates]);

  console.log(
    'isLocationInitialized, sortedStates, telemedStates',
    isLocationInitialized,
    sortedStates?.length,
    telemedStates?.length
  );

  return (
    <CustomContainer title="Request a Virtual Visit" imgAlt="Chat icon">
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information just
        once. Next time you return, it will all be here for you!
      </Typography>
      {!isLocationInitialized || !sortedStates?.length || !telemedStates?.length ? (
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
            onChange={handleStateChange}
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
                          Mon - Fri: {option.workingHours?.weekdays}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Weekends & Federal Holidays: {option.workingHours?.weekends}
                        </Typography>
                      </>
                    )}
                  </Box>
                </li>
              );
            }}
            renderInput={(params) => (
              <>
                <BoldPurpleInputLabel required shrink sx={{ whiteSpace: 'pre-wrap' }}>
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
    </CustomContainer>
  );
};

export default RequestVirtualVisit;
