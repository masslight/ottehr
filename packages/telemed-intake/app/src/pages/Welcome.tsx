import { Button, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TelemedLocation, isHoliday } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { clockFullColor } from '../assets/icons';
import { useGetTelemedStates, useSlotsStore } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { useZapEHRAPIClient } from '../utils';
import { federalHolidays, stateWorkingHours } from '../utils/constants';
import Schedule from '../components/Schedule';

const Welcome = (): JSX.Element => {
  const navigate = useNavigate();
  const apiClient = useZapEHRAPIClient({ tokenless: true });
  const theme = useTheme();
  const { slug, 'visit-type': visitType } = useParams();
  const { selectedSlot, setSlotAndVisitType } = useSlotsStore((state) => state);

  if (!slug) {
    throw new Error('Slug is not defined');
  }

  const [telemedStates, setTelemedStates] = useState<TelemedLocation[]>([]);

  const { data: telemedStatesData, isFetching } = useGetTelemedStates(apiClient, Boolean(apiClient));

  const state = telemedStatesData?.locations.find((stateTemp) => stateTemp.slug == slug);

  useEffect(() => {
    setSlotAndVisitType({ visitType });
    if (visitType === 'now') {
      setSlotAndVisitType({ selectedSlot: DateTime.now().toISO() });
    }
  }, [setSlotAndVisitType, visitType]);

  useEffect(() => {
    if (telemedStatesData) {
      setTelemedStates(telemedStatesData.locations);
    }
  }, [telemedStatesData]);

  const onSubmit = (): void => {
    navigate(IntakeFlowPageRoute.AuthPage.path);
    useIntakeCommonStore.setState({ selectedLocationState: state?.state });
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

  return (
    <CustomContainer
      title="Ottehr Telemedicine"
      subtitle={state?.state}
      img={clockFullColor}
      imgAlt="Clock icon"
      imgWidth={120}
      bgVariant={IntakeFlowPageRoute.NewUser.path}
      isFirstPage={true}
    >
      {isFetching && <Typography variant="body1">Loading...</Typography>}
      {!isFetching && !state && <Typography variant="body1">The location &quot;{slug}&quot; is not found</Typography>}
      {state && !state.available && (
        <Typography variant="body1">The location &quot;{slug}&quot; is not available</Typography>
      )}
      {!isFetching && state && state.available && (
        <>
          <Typography variant="body1">
            We&apos;re pleased to offer this new technology for accessing care. You will need to enter your information
            again just once. Next time you return, it will all be here for you!
          </Typography>

          <Typography variant="body1" marginTop={2}>
            Hours: {stateWorkingHours[state.state].weekdays}
          </Typography>

          {statesAvailabilityMap[state.state] ? (
            <>
              {visitType === 'prebook' && <Schedule slotData={state.availableSlots} timezone={'America/New_York'} />}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  className="next-button"
                  type="submit"
                  sx={{
                    mt: 2,
                  }}
                  onClick={onSubmit}
                >
                  Continue
                </Button>
              </Box>
            </>
          ) : (
            <Typography variant="body1">This location is not currently open</Typography>
          )}
        </>
      )}
    </CustomContainer>
  );
};

export default Welcome;
