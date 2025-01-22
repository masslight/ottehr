import { Paper, FormControl, Stack, FormHelperText, Switch, FormControlLabel } from '@mui/material';
import {
  DatePicker,
  TimePicker,
  LocalizationProvider,
  DateValidationError,
  TimeValidationError,
} from '@mui/x-date-pickers';
import { LoadingButton } from '@mui/lab';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { BoldedTitleText } from './BoldedTitleText';

const splitDate = (orignialDate: DateTime): { datePortion: DateTime; timePortion: DateTime } => {
  return {
    datePortion: DateTime.fromObject(
      { day: orignialDate.day, month: orignialDate.month, year: orignialDate.year },
      { zone: 'utc' }
    ),
    timePortion: DateTime.fromObject(
      {
        hour: orignialDate.hour,
        minute: orignialDate.minute,
        second: orignialDate.second,
      },
      {
        zone: 'utc',
      }
    ),
  };
};

const consolidateDate = (datePortion: DateTime, timePortion: DateTime): DateTime => {
  return DateTime.fromObject(
    {
      day: datePortion.day,
      month: datePortion.month,
      year: datePortion.year,
      hour: timePortion.hour,
      minute: timePortion.minute,
      second: timePortion.second,
    },
    {
      zone: 'utc',
    }
  );
};

export interface CollectionDateTime {
  value: DateTime;
  isValidDate: boolean;
  isValidTime: boolean;
}

export interface OptionalCollectionDateTimeChanges {
  value?: DateTime;
  isValidDate?: boolean;
  isValidTime?: boolean;
}

interface SampleInfoProps {
  orderAddedDateTime: DateTime;
  orderingPhysician: string;
  individualCollectingSample: string;
  collectionDateTime: CollectionDateTime;
  showInPatientPortal: boolean;
  showButtons?: boolean;
  onDateTimeChange: ({ value, isValidDate, isValidTime }: OptionalCollectionDateTimeChanges) => void;
  onShowInPatientPortalChange: (value: boolean) => void;
}

export const SampleInformationCard: React.FC<SampleInfoProps> = ({
  orderAddedDateTime,
  orderingPhysician,
  individualCollectingSample,
  collectionDateTime,
  showInPatientPortal,
  showButtons = false,
  onDateTimeChange,
  onShowInPatientPortalChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dateValidationError, setDateValidationError] = useState<DateValidationError | null | undefined>(undefined);
  const [timeValidationError, setTimeValidationError] = useState<TimeValidationError | null | undefined>(undefined);

  const { datePortion, timePortion } = splitDate(collectionDateTime.value);

  const isDateError = dateValidationError !== undefined || !collectionDateTime.isValidDate;
  const isTimeError = timeValidationError !== undefined || !collectionDateTime.isValidTime;

  return (
    <>
      <AccordionCard
        label={'Sample Information'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1} sx={{ justifyContent: 'space-between' }}>
            <BoldedTitleText
              title={'Order Added'}
              description={orderAddedDateTime.toLocal().toFormat('MM/dd/yyyy hh:mm a') || ''}
            />
            <BoldedTitleText title={'Ordering Physician'} description={orderingPhysician} />
            <BoldedTitleText title={'Individual Collecting Sample'} description={individualCollectingSample} />
            <Stack direction={'row'} spacing={1} sx={{ justifyContent: 'space-between' }}>
              <FormControl fullWidth error={isDateError}>
                <LocalizationProvider dateAdapter={AdapterLuxon}>
                  <DatePicker
                    disabled={false}
                    format={'MM/dd/yyyy'}
                    label="Collection Date"
                    onChange={(newDateValue) => {
                      if (newDateValue) {
                        onDateTimeChange({
                          value: consolidateDate(newDateValue, timePortion),
                          isValidDate: newDateValue.isValid,
                        });
                      } else {
                        onDateTimeChange({
                          isValidDate: false,
                        });
                      }
                    }}
                    onError={(error, value) => {
                      if (value?.isValid) {
                        setDateValidationError(undefined);
                      } else {
                        setDateValidationError(error);
                        onDateTimeChange({
                          isValidDate: false,
                        });
                      }
                    }}
                    slotProps={{
                      textField: {
                        id: 'sample-collection-date',
                        error: isDateError,
                        required: true,
                        style: { width: '100%' },
                      },
                      actionBar: { actions: ['today'] },
                    }}
                    value={datePortion}
                  />
                </LocalizationProvider>
                {isDateError && <FormHelperText>Valid date required</FormHelperText>}
              </FormControl>
              <FormControl fullWidth error={isTimeError}>
                <LocalizationProvider dateAdapter={AdapterLuxon}>
                  <TimePicker
                    label="Collection Time"
                    onChange={(newTimeValue) => {
                      if (newTimeValue) {
                        onDateTimeChange({
                          value: consolidateDate(datePortion, newTimeValue),
                          isValidTime: newTimeValue.isValid,
                        });
                      } else {
                        onDateTimeChange({
                          isValidTime: false,
                        });
                      }
                    }}
                    onError={(error, value) => {
                      if (value?.isValid) {
                        setTimeValidationError(undefined);
                      } else {
                        setTimeValidationError(error);
                        onDateTimeChange({
                          isValidTime: false,
                        });
                      }
                    }}
                    slotProps={{
                      textField: {
                        id: 'sample-collection-time',
                        error: isTimeError,
                        required: true,
                        style: { width: '100%' },
                      },
                    }}
                    value={timePortion}
                  ></TimePicker>
                </LocalizationProvider>
                {isTimeError && <FormHelperText>Valid time required</FormHelperText>}
              </FormControl>
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={showInPatientPortal}
                  onChange={(event) => {
                    onShowInPatientPortalChange(event.target.checked);
                  }}
                />
              }
              label={'Show in Patient Portal'}
            />
            {showButtons && (
              <Stack spacing={1} direction={'row'}>
                <LoadingButton variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
                  Print label
                </LoadingButton>
                <LoadingButton variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
                  Print order
                </LoadingButton>
              </Stack>
            )}
          </Stack>
        </Paper>
      </AccordionCard>
    </>
  );
};
