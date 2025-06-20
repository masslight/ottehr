import { Box, Button, Paper, Stack } from '@mui/material';
// import { DatePicker, TimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';
// import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { openPdf } from './OrderCollection';

// eslint-disable-next-line @typescript-eslint/no-unused-vars

interface OrderInfoProps {
  orderPdfUrl: string | undefined;
  orderAddedDateTime?: string;
  orderingPhysician?: string;
  individualCollectingSample?: string;
  collectionDateTime?: string;
  showInPatientPortal?: boolean;
}

export const OrderInformationCard: React.FC<OrderInfoProps> = ({ orderPdfUrl }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <AccordionCard
        label={'Order information'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              type="button"
              sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
              disabled={!orderPdfUrl}
              onClick={() => orderPdfUrl && openPdf(orderPdfUrl)}
            >
              Print order
            </Button>
            {/* <BoldedTitleText
              title={'Order added'}
              description={DateTime.fromISO(orderAddedDateTime).toLocal().toFormat('MM/dd/yyyy hh:mm a') || ''}
            /> */}
            {/* <BoldedTitleText title={'Ordering physician'} description={orderingPhysician} /> */}
            {/* <BoldedTitleText title={'Individual Collecting Sample'} description={individualCollectingSample} /> */}
            {/* <Stack direction={'row'} spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Controller
                name={dateFormName}
                control={control}
                defaultValue={datePortion || DateTime.now()}
                render={({ field }) => (
                  <>
                    <FormControl fullWidth error={!!errors[dateFormName]}>
                      <LocalizationProvider dateAdapter={AdapterLuxon}>
                        <DatePicker
                          {...field}
                          disabled={false}
                          format={'MM/dd/yyyy'}
                          label="Collection Date"
                          slotProps={{
                            textField: {
                              id: 'sample-collection-date',
                              error: !!errors[dateFormName],
                              required: true,
                              style: { width: '100%' },
                            },
                            actionBar: { actions: ['today'] },
                          }}
                          value={datePortion}
                        />
                      </LocalizationProvider>
                      {!!errors[dateFormName] && <FormHelperText>Valid date required</FormHelperText>}
                    </FormControl>
                  </>
                )}
              /> */}
            {/* <Controller
                name={timeFormName}
                control={control}
                defaultValue={timePortion || DateTime.now()}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors[timeFormName]}>
                    <LocalizationProvider dateAdapter={AdapterLuxon}>
                      <TimePicker
                        {...field}
                        label="Collection Time"
                        slotProps={{
                          textField: {
                            id: 'sample-collection-time',
                            error: !!errors[timeFormName],
                            required: true,
                            style: { width: '100%' },
                          },
                        }}
                        value={timePortion}
                      ></TimePicker>
                    </LocalizationProvider>
                    {!!errors[timeFormName] && <FormHelperText>Valid time required</FormHelperText>}
                  </FormControl>
                )}
              />
            </Stack> */}
            {/* <FormControlLabel
              control={
                <Controller
                  name={'show-in-patient-portal'}
                  control={control}
                  defaultValue={showInPatientPortal || false}
                  render={({ field }) => <Switch {...field} checked={field.value} />}
                />
              }
              label={'Show Results in Patient Portal'}
            /> */}
          </Stack>
        </Paper>
      </AccordionCard>
    </Box>
  );
};
