import LoadingButton from '@mui/lab/LoadingButton';
import { Autocomplete, Skeleton, TextField, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoldPurpleInputLabel } from 'ottehr-components';
import { TelemedLocation, isHoliday } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { clockFullColor } from '../assets/icons';
import { useGetTelemedStates } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { useZapEHRAPIClient } from '../utils';
import { federalHolidays, stateWorkingHours } from '../utils/constants';

const Welcome = (): JSX.Element => {
  const navigate = useNavigate();
  const apiClient = useZapEHRAPIClient({ tokenless: true });
  const theme = useTheme();
  const [telemedStates, setTelemedStates] = useState<TelemedLocation[]>([]);
  const [selectedState, setSelectedState] = useState<TelemedLocation | null>(null);

  const { data: telemedStatesData, isFetching } = useGetTelemedStates(apiClient, Boolean(apiClient));

  useEffect(() => {
    if (telemedStatesData) {
      setTelemedStates(telemedStatesData.locations);
    }
  }, [telemedStatesData]);

  const handleStateChange = (_e: any, newValue: TelemedLocation | null): void => {
    setSelectedState(newValue);
  };

  const onSubmit = (): void => {
    navigate(IntakeFlowPageRoute.AuthPage.path);
    useIntakeCommonStore.setState({ selectedLocationState: selectedState?.state });
  };

  const checkStateAvailability = (option: TelemedLocation): boolean => {
    if (!option.available) return false;

    const hours = stateWorkingHours[option.state];
    if (!hours) return false;
    const timeZone = hours.timeZone;
    if (!timeZone) return false;

    const now = DateTime.now().setZone(timeZone);
    const dayOfWeek = now.weekday;
    const currentTime = now.hour + now.minute / 60;

    let workingHours;
    const isTodayHoliday = isHoliday(now, federalHolidays);

    if (isTodayHoliday) {
      workingHours = hours.holidays;
    } else if (dayOfWeek === 7 || dayOfWeek === 6) {
      workingHours = hours.weekends;
    } else {
      workingHours = hours.weekdays;
    }

    if (!workingHours) return false;

    const [startTimeStr, endTimeStr] = workingHours.split(' – ');
    const startTime = Number(DateTime.fromFormat(startTimeStr, 'h a', { zone: timeZone }).toFormat('H'));
    let endTime = Number(DateTime.fromFormat(endTimeStr, 'h a', { zone: timeZone }).toFormat('H'));

    if (endTime === 0) {
      endTime = 24;
    }

    return currentTime >= startTime && currentTime < endTime;
  };

  const statesAvailabilityMap = useMemo(() => {
    const availabilityMap: Record<string, boolean> = {};
    telemedStates.forEach((option) => {
      availabilityMap[option.state] = checkStateAvailability(option);
    });
    return availabilityMap;
  }, [telemedStates]);

  const sortedStates = useMemo(
    () =>
      [...telemedStates].sort((a, b) => (statesAvailabilityMap[a.state] === statesAvailabilityMap[b.state] ? 0 : -1)),
    [telemedStates, statesAvailabilityMap],
  );

  return (
    <CustomContainer
      title="Ottehr Telemedicine"
      img={clockFullColor}
      imgAlt="Clock icon"
      imgWidth={120}
      bgVariant={IntakeFlowPageRoute.NewUser.path}
      isFirstPage={true}
    >
      <Typography variant="body1">
        We're pleased to offer this new technology for accessing care. You will need to enter your information again
        just once. Next time you return, it will all be here for you!
      </Typography>
      <Typography variant="body1" sx={{ py: 2 }}>
        You can view states in which we operate and their hours here.
      </Typography>
      {isFetching ? (
        <Skeleton
          sx={{
            borderRadius: 2,
            backgroundColor: otherColors.coachingVisit,
            p: 6,
          }}
        />
      ) : (
        <Autocomplete
          id="states-autocomplete"
          options={sortedStates}
          getOptionLabel={(option) => option.state}
          onChange={handleStateChange}
          isOptionEqualToValue={(option, value) => option.state === value.state}
          renderOption={(props, option) => {
            const workingHours = stateWorkingHours[option.state];
            return (
              <li {...props}>
                <Box>
                  <Typography sx={{ pt: 1 }} variant="body2">
                    {option.state}
                  </Typography>
                  {!statesAvailabilityMap[option.state] && (
                    <Typography variant="body2" color="text.secondary">
                      Unavailable
                    </Typography>
                  )}
                  {option.available && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {workingHours?.weekdays}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Weekends & Federal Holidays: {workingHours?.weekends}
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
                placeholder="Select states"
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
          getOptionDisabled={(option) => !statesAvailabilityMap[option.state]}
        />
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          loading={isFetching}
          variant="contained"
          color="primary"
          disabled={!selectedState}
          size="large"
          className="next-button"
          type="submit"
          sx={{
            mt: 2,
          }}
          onClick={onSubmit}
        >
          Continue
        </LoadingButton>
      </Box>
    </CustomContainer>
  );
};

export default Welcome;
