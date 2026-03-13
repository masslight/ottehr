import { Box, Checkbox, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalsLastMenstrualPeriodObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsLastMenstrualPeriodCardProps = VitalsCardProps<VitalsLastMenstrualPeriodObservationDTO>;

const VitalsLastMenstrualPeriodCard: React.FC<VitalsLastMenstrualPeriodCardProps> = ({ field }): JSX.Element => {
  const theme = useTheme();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestObservation = field.current[0];
  const isUnsure = latestObservation?.isUnsure === true;
  const latestDate = latestObservation?.value;
  const { localState } = field;

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        historicalObs={field.historical}
        currentEncounterObs={field.current}
        isLoading={false}
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
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
                onKeyDown={handleKeyDown}
                sx={{
                  height: 'auto',
                  width: 'auto',
                  backgroundColor: '#F7F8F9',
                  borderRadius: 2,
                  my: 2,
                  mx: 2,
                  py: 2,
                  px: 2,
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
                }}
              >
                <Grid item xs={12} sm={8} md={8} lg={8} order={{ xs: 1, sm: 1, md: 1 }}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="Last Menstrual Period"
                      value={localState.selectedDate}
                      onChange={localState.handleDateChange}
                      disabled={field.isSaving}
                      maxDate={DateTime.now()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: localState.isDateInvalid && localState.validationError,
                          helperText:
                            localState.isDateInvalid && localState.validationError ? 'Invalid value' : undefined,
                          InputLabelProps: {
                            shrink: true,
                          },
                          inputProps: {
                            'data-testid': dataTestIds.vitalsPage.lastMenstrualPeriodDateInput,
                          },
                          FormHelperTextProps: {
                            sx: {
                              position: 'absolute',
                              bottom: '-15px',
                              left: 0,
                            },
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
                    disabled={localState.isDisabled || field.isSaving}
                    loading={field.isSaving}
                    onClick={field.save}
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
                          disabled={field.isSaving}
                          checked={localState.isUnsureSelected}
                          onChange={(e) => localState.handleUnsureChange(e.target.checked)}
                          data-testid={dataTestIds.vitalsPage.lastMenstrualPeriodUnsureCheckbox}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: field.isSaving
                              ? lighten(theme.palette.text.primary, 0.4)
                              : theme.palette.text.primary,
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
