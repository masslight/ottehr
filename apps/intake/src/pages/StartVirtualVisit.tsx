import { InfoOutlined } from '@mui/icons-material';
import { Autocomplete, Skeleton, TextField, Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { useMemo, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import { BoldPurpleInputLabel, CustomTooltip, PageForm, useUCZambdaClient } from 'ui-components';
import {
  checkTelemedLocationAvailability,
  CreateSlotParams,
  ServiceMode,
  stateCodeToFullName,
  TelemedLocation,
  telemedStateWorkingSchedule,
} from 'utils';
import { bookingBasePath, intakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { useGetTelemedStates } from '../telemed/features/appointments';
import { useZapEHRAPIClient } from '../telemed/utils';
import { PageContainer } from '../components';
import { DateTime } from 'luxon';
import ottehrApi from '../api/ottehrApi';

const emptyArray: [] = [];

const StartVirtualVisit = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [selectedLocation, setSelectedLocation] = useState<TelemedLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiClient = useZapEHRAPIClient();
  const { data: locationsResponse } = useGetTelemedStates(apiClient, Boolean(apiClient));
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const telemedStates = locationsResponse?.locations || emptyArray;

  const handleStateChange = (_e: any, newValue: TelemedLocation | null): void => {
    setSelectedLocation(newValue);
  };

  const onSubmit = async (): Promise<void> => {
    try {
      if (!selectedLocation?.state || !tokenlessZambdaClient) {
        return;
      }

      const createSlotInput: CreateSlotParams = {
        scheduleId: selectedLocation.scheduleId,
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
        // todo: handle error
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
          scheduleId: serverState?.scheduleId || '',
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
    </PageContainer>
  );
};

export default StartVirtualVisit;
