import { Box, Checkbox, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalFieldNames, VitalsLastMenstrualPeriodObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsCardProps } from '../types';

type VitalsLastMenstrualPeriodCardProps = VitalsCardProps<VitalsLastMenstrualPeriodObservationDTO>;

const VitalsLastMenstrualPeriodCard: React.FC<VitalsLastMenstrualPeriodCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
}): JSX.Element => {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState<DateTime | null>(null);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestObservation = currentObs[0];
  const isUnsure = latestObservation?.isUnsure === true;
  const latestDate = latestObservation?.value;

  const [isUnsureOptionSelected, setIsUnsureOptionSelected] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveLMPObservation = async (): Promise<void> => {
    if (!selectedDate) {
      return;
    }

    try {
      setIsSaving(true);
      const vitalObs: VitalsLastMenstrualPeriodObservationDTO = {
        field: VitalFieldNames.VitalLastMenstrualPeriod,
        value: selectedDate.toISODate() ?? '',
        isUnsure: isUnsureOptionSelected,
      };
      await handleSaveVital(vitalObs);
      setSelectedDate(null);
      setIsUnsureOptionSelected(false);
    } catch {
      enqueueSnackbar('Error saving Last Menstrual Period data', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        historicalObs={historicalObs}
        currentEncounterObs={currentObs}
        isLoading={false}
        historyElementCreator={(historyEntry) => {
          const isCurrent = currentObs.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? handleDeleteVital : undefined}
              dataTestId={dataTestIds.vitalsPage.lastMenstrualPeriodItem}
            />
          );
        }}
      />
    );
  };

  const formatDateForDisplay = (dateStr: string): string => {
    try {
      const date = DateTime.fromISO(dateStr);
      return date.isValid ? date.toFormat('MM/dd/yyyy') : dateStr;
    } catch {
      return dateStr;
    }
  };

  const title =
    'Last Menstrual Period ' + (latestDate ? `${formatDateForDisplay(latestDate)}${isUnsure ? ' (unsure)' : ''}` : '');

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={title}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.lastMenstrualPeriodHeader}
      >
        {isReadOnly ? (
          renderRightColumn()
        ) : (
          <DoubleColumnContainer
            divider
            leftColumn={
              <Grid
                container
                sx={{
                  height: 'auto',
                  width: 'auto',
                  backgroundColor: '#F7F8F9',
                  borderRadius: 2,
                  my: 2,
                  mx: 2,
                  py: 2,
                  px: 2,
                }}
              >
                <Grid item xs={12} sm={8} md={8} lg={8} order={{ xs: 1, sm: 1, md: 1 }}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="Last Menstrual Period"
                      value={selectedDate}
                      onChange={setSelectedDate}
                      disabled={isSaving}
                      maxDate={DateTime.now()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          InputLabelProps: {
                            shrink: true,
                          },
                          inputProps: {
                            'data-testid': dataTestIds.vitalsPage.lastMenstrualPeriodDateInput,
                          },
                        },
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                <Grid
                  item
                  container
                  xs={12}
                  sm={4}
                  md={4}
                  lg={4}
                  order={{ xs: 2, sm: 2, md: 2, lg: 3 }}
                  style={{ alignSelf: 'center' }}
                >
                  <RoundedButton
                    size="small"
                    disabled={!selectedDate}
                    loading={isSaving}
                    onClick={handleSaveLMPObservation}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.lastMenstrualPeriodAddButton}
                  >
                    Add
                  </RoundedButton>
                </Grid>
                <Grid item xs={12} sm={12} md={12} lg={12} order={{ xs: 5, sm: 5, md: 5, lg: 5 }} sx={{ mt: 1, ml: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                    <FormControlLabel
                      sx={{
                        backgroundColor: 'transparent',
                        pr: 0,
                      }}
                      control={
                        <Checkbox
                          size="small"
                          sx={{
                            color: theme.palette.primary.main,
                            '&.Mui-checked': {
                              color: theme.palette.primary.main,
                            },
                            '&.Mui-disabled': {
                              color: lighten(theme.palette.primary.main, 0.4),
                            },
                          }}
                          disabled={isSaving}
                          checked={isUnsureOptionSelected}
                          onChange={(e) => setIsUnsureOptionSelected(e.target.checked)}
                          data-testid={dataTestIds.vitalsPage.lastMenstrualPeriodUnsureCheckbox}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: isSaving ? lighten(theme.palette.text.primary, 0.4) : theme.palette.text.primary,
                          }}
                        >
                          Unsure
                        </Typography>
                      }
                    />
                  </Box>
                </Grid>
              </Grid>
            }
            rightColumn={renderRightColumn()}
          />
        )}
      </AccordionCard>
    </Box>
  );
};

export default VitalsLastMenstrualPeriodCard;
