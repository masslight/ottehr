import { Box, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalBloodPressureObservationMethod, VitalsBloodPressureObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsBloodPressureCardProps = VitalsCardProps<VitalsBloodPressureObservationDTO>;

const VitalsBloodPressureCard: React.FC<VitalsBloodPressureCardProps> = ({ field }): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestPressureValueLabel = (() => {
    const latestHistoryEntry = field.current[0];
    if (!latestHistoryEntry) return;
    return `${latestHistoryEntry.systolicPressure}/${latestHistoryEntry.diastolicPressure}`;
  })();

  const { localState } = field;

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  const renderBloodPressureQualifierDropdown = (): JSX.Element => {
    return (
      <FormControl size="small" fullWidth sx={{ backgroundColor: 'white' }} disabled={field.isSaving}>
        <InputLabel id="qualifier-label">Qualifier</InputLabel>
        <Select
          value={localState.observationQualifier}
          label="Qualifier"
          labelId="qualifier-label"
          variant="outlined"
          error={false}
          defaultValue=""
          onChange={(event) => {
            const eventValue = event.target.value;
            const selectedQualifier = eventValue && eventValue.length > 0 ? eventValue : '';
            localState.handleQualifierChange(selectedQualifier);
          }}
        >
          <MenuItem key="default_obs_method" value={''}>
            <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
              &nbsp;
            </Typography>
          </MenuItem>
          {Object.values(VitalBloodPressureObservationMethod).map((obsMethod) => (
            <MenuItem key={obsMethod} value={obsMethod}>
              <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                {obsMethod}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        currentEncounterObs={field.current}
        historicalObs={field.historical}
        isLoading={false}
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
              dataTestId={dataTestIds.vitalsPage.bloodPressureItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`BP (mm Hg) ${latestPressureValueLabel ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.bloodPressureHeader}
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
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
                }}
              >
                {/* Systolic / Diastolic pressure Input Field column */}
                <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                    }}
                  >
                    <VitalsTextInputFiled
                      label="Systolic"
                      value={localState.systolicValue}
                      disabled={field.isSaving}
                      isInputError={localState.isSystolicInvalid && localState.validationError}
                      onChange={localState.handleSystolicChange}
                      onKeyDown={handleKeyDown}
                      data-testid={dataTestIds.vitalsPage.bloodPressureSystolicInput}
                    />
                    <Typography fontSize={25} sx={{ ml: 1 }}>
                      /
                    </Typography>
                    <VitalsTextInputFiled
                      label="Diastolic"
                      value={localState.diastolicValue}
                      disabled={field.isSaving}
                      isInputError={localState.isDiastolicInvalid && localState.validationError}
                      onChange={localState.handleDiastolicChange}
                      onKeyDown={handleKeyDown}
                      sx={{ ml: 1 }}
                      data-testid={dataTestIds.vitalsPage.bloodPressureDiastolicInput}
                    />
                  </Box>
                </Grid>

                {/* Qualifier/method dropdown column */}
                <Grid
                  item
                  xs={12}
                  sm={3}
                  md={3}
                  lg={3}
                  order={{ xs: 2, sm: 2, md: 2, lg: 2 }}
                  sx={{ mt: isLargeScreen ? 0 : 0 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      ml: 1,
                    }}
                  >
                    {renderBloodPressureQualifierDropdown()}
                  </Box>
                </Grid>

                {/* Add Button column */}
                <Grid
                  item
                  xs={12}
                  sm={3}
                  md={3}
                  lg={3}
                  order={{ xs: 3, sm: 3, md: 3, lg: 3 }}
                  sx={{ mt: isLargeScreen ? 0 : 0 }}
                >
                  <RoundedButton
                    size="small"
                    disabled={localState.isDisabled}
                    loading={field.isSaving}
                    onClick={field.save}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.bloodPressureAddButton}
                  >
                    Add
                  </RoundedButton>
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

export default VitalsBloodPressureCard;
